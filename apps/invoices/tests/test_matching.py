"""
Tests for 3-way matching service.

Tests cover:
- Perfect match scenarios
- Tolerance boundary cases
- Quantity mismatches
- Price mismatches
- Auto-match thresholds
"""

import pytest
from decimal import Decimal
from datetime import date

from apps.budget.models import BudgetLine, FiscalYear
from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration
from apps.invoices.services import ThreeWayMatchingService, InvoiceService
from apps.organizations.models import Organization
from apps.purchase_orders.models import PurchaseOrder, POLine
from apps.receiving.models import GoodsReceipt, GoodsReceiptLine
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def matching_config(db, organization):
    """Create matching configuration with default tolerances."""
    return MatchingConfiguration.objects.create(
        organization=organization,
        price_tolerance_percent=Decimal('5.00'),
        quantity_tolerance_percent=Decimal('2.00'),
        auto_match_max_amount=Decimal('10000.00'),
    )


@pytest.fixture
def user(db, organization):
    """Create a test user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def supplier(db, organization):
    """Create a test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP001',
        name='Test Supplier',
        status='APPROVED',
    )


@pytest.fixture
def budget_line(db, organization):
    """Create a test budget line."""
    fy = FiscalYear.objects.create(
        organization=organization,
        year=2025,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
    )
    return BudgetLine.objects.create(
        fiscal_year=fy,
        code='IT-2025-001',
        name='IT Equipment',
        allocated_amount=Decimal('100000.00'),
    )


@pytest.fixture
def sent_po(db, organization, user, supplier, budget_line):
    """Create a PO in SENT status."""
    po = PurchaseOrder.objects.create(
        organization=organization,
        created_by=user,
        supplier=supplier,
        budget_line=budget_line,
        title='Test PO',
    )
    POLine.objects.create(
        purchase_order=po,
        description='Test Item',
        quantity=Decimal('100'),
        unit_price=Decimal('50.00'),
        unit_of_measure='EA',
    )
    po.submit()
    po.approve(approved_by=user)
    po.send()
    return po


def create_gr_with_quantity(organization, po, user, quantity):
    """Helper to create a posted GR with specified quantity."""
    gr = GoodsReceipt.objects.create(
        organization=organization,
        purchase_order=po,
        received_by=user,
    )
    po_line = po.lines.first()
    GoodsReceiptLine.objects.create(
        goods_receipt=gr,
        po_line=po_line,
        quantity_received=quantity,
    )
    gr.post()
    return gr


def create_invoice_with_line(organization, po, supplier, user, qty, price):
    """Helper to create invoice with specified qty and price."""
    invoice = Invoice.objects.create(
        organization=organization,
        purchase_order=po,
        supplier=supplier,
        created_by=user,
        supplier_invoice_number='TEST-INV',
    )
    po_line = po.lines.first()
    InvoiceLine.objects.create(
        invoice=invoice,
        po_line=po_line,
        quantity_invoiced=qty,
        unit_price=price,
    )
    invoice.calculate_subtotal()
    invoice.save()
    return invoice


@pytest.mark.django_db
class TestThreeWayMatchingPerfectMatch:
    """Tests for perfect 3-way match scenarios."""

    def test_perfect_match_auto_matches(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Invoice matching PO and GR exactly results in MATCHED."""
        # GR received exact quantity
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice exact quantity and price
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('50.00'),
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is True
        assert results['can_auto_match'] is True
        assert results['lines'][0]['match_status'] == 'MATCHED'

    def test_match_within_both_tolerances(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Match passes when within both qty and price tolerances."""
        # GR received 100 units
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice with 1% qty variance (within 2%) and 4% price variance (within 5%)
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('101'),  # 1% over GR
            price=Decimal('52.00'),  # 4% over PO price
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is True
        assert results['lines'][0]['within_qty_tolerance'] is True
        assert results['lines'][0]['within_price_tolerance'] is True


@pytest.mark.django_db
class TestThreeWayMatchingQuantityMismatch:
    """Tests for quantity mismatch scenarios."""

    def test_quantity_outside_tolerance_flags(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Quantity variance beyond tolerance flags as mismatch."""
        # GR received 100 units
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice with 5% qty variance (beyond 2% tolerance)
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('105'),  # 5% over GR
            price=Decimal('50.00'),
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is False
        assert results['lines'][0]['match_status'] == 'QUANTITY_MISMATCH'
        assert results['lines'][0]['within_qty_tolerance'] is False
        assert results['lines'][0]['within_price_tolerance'] is True

    def test_under_invoicing_quantity(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Under-invoicing beyond tolerance also flags mismatch."""
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice for 95 when received 100 (5% under, beyond 2% tolerance)
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('95'),
            price=Decimal('50.00'),
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is False
        assert results['lines'][0]['match_status'] == 'QUANTITY_MISMATCH'


@pytest.mark.django_db
class TestThreeWayMatchingPriceMismatch:
    """Tests for price mismatch scenarios."""

    def test_price_variance_requires_review(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Price variance beyond tolerance flags as mismatch."""
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice with 10% price increase (beyond 5% tolerance)
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('55.00'),  # 10% over PO price
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is False
        assert results['lines'][0]['match_status'] == 'PRICE_MISMATCH'
        assert results['lines'][0]['within_qty_tolerance'] is True
        assert results['lines'][0]['within_price_tolerance'] is False

    def test_price_under_tolerance_matches(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Lower price within tolerance matches."""
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice with 4% lower price (within 5% tolerance)
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('48.00'),  # 4% under PO price
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is True
        assert results['lines'][0]['within_price_tolerance'] is True


@pytest.mark.django_db
class TestThreeWayMatchingBothMismatch:
    """Tests for combined qty and price mismatch."""

    def test_both_mismatch_flags_correctly(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Both qty and price outside tolerance flags as BOTH_MISMATCH."""
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice with both variances beyond tolerance
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('110'),  # 10% over GR
            price=Decimal('60.00'),  # 20% over PO price
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is False
        assert results['lines'][0]['match_status'] == 'BOTH_MISMATCH'
        assert results['lines'][0]['within_qty_tolerance'] is False
        assert results['lines'][0]['within_price_tolerance'] is False


@pytest.mark.django_db
class TestThreeWayMatchingAutoMatchThreshold:
    """Tests for auto-match amount threshold."""

    def test_above_threshold_cannot_auto_match(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Invoice above auto-match threshold cannot auto-match."""
        # Config has auto_match_max_amount = 10,000
        # Invoice total will be 100 * 150 = 15,000

        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('150.00'),  # Higher price = $15,000 total
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        # May match on tolerances but cannot auto-match due to amount
        assert results['can_auto_match'] is False

    def test_below_threshold_can_auto_match(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Invoice below auto-match threshold can auto-match."""
        create_gr_with_quantity(organization, sent_po, user, Decimal('100'))

        # Invoice total = 100 * 50 = 5,000 (below 10,000 threshold)
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('50.00'),
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['can_auto_match'] is True


@pytest.mark.django_db
class TestThreeWayMatchingGRRequired:
    """Tests for goods receipt requirement."""

    def test_gr_required_blocks_matching(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Matching fails when GR required but not posted."""
        # No GR created
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('50.00'),
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        assert results['overall_match'] is False
        assert 'Goods receipt required' in results['errors'][0]

    def test_gr_not_required_allows_matching(
        self, organization, sent_po, supplier, user, matching_config
    ):
        """Matching proceeds when GR not required (2-way match)."""
        matching_config.require_goods_receipt = False
        matching_config.save()

        # No GR, but config doesn't require it
        invoice = create_invoice_with_line(
            organization, sent_po, supplier, user,
            qty=Decimal('100'),
            price=Decimal('50.00'),
        )

        service = ThreeWayMatchingService(organization)
        results = service.match_invoice(invoice)

        # Will fail qty match against GR qty (0), but no "GR required" error
        assert 'Goods receipt required' not in str(results.get('errors', []))


@pytest.mark.django_db
class TestInvoiceServiceValidation:
    """Tests for InvoiceService validation."""

    def test_validation_requires_lines(
        self, organization, sent_po, supplier, user
    ):
        """Invoice without lines fails validation."""
        invoice = Invoice.objects.create(
            organization=organization,
            purchase_order=sent_po,
            supplier=supplier,
            created_by=user,
            supplier_invoice_number='TEST-INV',
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert 'at least one line item' in errors[0]

    def test_validation_checks_po_status(
        self, organization, user, supplier, budget_line
    ):
        """Invoice against non-sent PO fails validation."""
        # Create PO but don't send it
        po = PurchaseOrder.objects.create(
            organization=organization,
            created_by=user,
            supplier=supplier,
            budget_line=budget_line,
            title='Draft PO',
        )
        POLine.objects.create(
            purchase_order=po,
            description='Item',
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
        )

        invoice = Invoice.objects.create(
            organization=organization,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
            supplier_invoice_number='TEST',
        )
        InvoiceLine.objects.create(
            invoice=invoice,
            po_line=po.lines.first(),
            quantity_invoiced=Decimal('10'),
            unit_price=Decimal('100.00'),
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert 'Cannot invoice PO in DRAFT status' in errors[0]

    def test_validation_checks_supplier_match(
        self, organization, sent_po, user, matching_config
    ):
        """Invoice must match PO supplier."""
        # Create different supplier
        other_supplier = Supplier.objects.create(
            organization=organization,
            code='SUP002',
            name='Other Supplier',
            status='APPROVED',
        )

        invoice = Invoice.objects.create(
            organization=organization,
            purchase_order=sent_po,
            supplier=other_supplier,  # Different supplier
            created_by=user,
            supplier_invoice_number='TEST',
        )
        InvoiceLine.objects.create(
            invoice=invoice,
            po_line=sent_po.lines.first(),
            quantity_invoiced=Decimal('10'),
            unit_price=Decimal('50.00'),
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert 'supplier must match' in errors[0].lower()

"""
Tests for Invoice models.

Tests cover:
- MatchingConfiguration creation and defaults
- Invoice state machine workflow
- InvoiceLine creation and variance tracking
- Budget integration (encumbrance liquidation)
"""

import pytest
from decimal import Decimal
from datetime import date

from apps.budget.models import BudgetLine, FiscalYear
from apps.core.exceptions import InvalidStateTransitionError
from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration
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
    """Create a test budget line with funds."""
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
        allocated_amount=Decimal('50000.00'),
    )


@pytest.fixture
def sent_po(db, organization, user, supplier, budget_line):
    """Create a PO in SENT status ready for receiving/invoicing."""
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
        quantity=Decimal('10'),
        unit_price=Decimal('100.00'),
        unit_of_measure='EA',
    )
    po.submit()
    po.approve(approved_by=user)
    po.send()
    return po


@pytest.fixture
def posted_gr(db, organization, sent_po, user):
    """Create a posted goods receipt."""
    gr = GoodsReceipt.objects.create(
        organization=organization,
        purchase_order=sent_po,
        received_by=user,
    )
    po_line = sent_po.lines.first()
    GoodsReceiptLine.objects.create(
        goods_receipt=gr,
        po_line=po_line,
        quantity_received=Decimal('10'),
    )
    gr.post()
    return gr


@pytest.fixture
def invoice(db, organization, sent_po, supplier, user):
    """Create a draft invoice."""
    return Invoice.objects.create(
        organization=organization,
        purchase_order=sent_po,
        supplier=supplier,
        created_by=user,
        supplier_invoice_number='SUP-INV-001',
    )


@pytest.fixture
def invoice_with_line(invoice, sent_po):
    """Create an invoice with a line item."""
    po_line = sent_po.lines.first()
    InvoiceLine.objects.create(
        invoice=invoice,
        po_line=po_line,
        quantity_invoiced=Decimal('10'),
        unit_price=Decimal('100.00'),
    )
    invoice.calculate_subtotal()
    invoice.save()
    return invoice


@pytest.mark.django_db
class TestMatchingConfiguration:
    """Tests for MatchingConfiguration model."""

    def test_config_creation_with_defaults(self, organization):
        """Configuration created with sensible defaults."""
        config = MatchingConfiguration.objects.create(
            organization=organization
        )
        assert config.price_tolerance_percent == Decimal('5.00')
        assert config.quantity_tolerance_percent == Decimal('2.00')
        assert config.auto_match_max_amount == Decimal('10000.00')
        assert config.require_goods_receipt is True
        assert config.allow_over_receipt is False
        assert config.allow_over_invoice is False

    def test_config_one_per_organization(self, organization):
        """Only one configuration per organization allowed."""
        MatchingConfiguration.objects.create(organization=organization)

        with pytest.raises(Exception):  # IntegrityError
            MatchingConfiguration.objects.create(organization=organization)

    def test_config_custom_tolerances(self, organization):
        """Can set custom tolerance values."""
        config = MatchingConfiguration.objects.create(
            organization=organization,
            price_tolerance_percent=Decimal('10.00'),
            quantity_tolerance_percent=Decimal('5.00'),
            auto_match_max_amount=Decimal('25000.00'),
        )
        assert config.price_tolerance_percent == Decimal('10.00')
        assert config.quantity_tolerance_percent == Decimal('5.00')
        assert config.auto_match_max_amount == Decimal('25000.00')


@pytest.mark.django_db
class TestInvoiceModel:
    """Tests for Invoice model."""

    def test_invoice_creation_defaults_to_draft(self, invoice):
        """New invoice starts in DRAFT status."""
        assert invoice.status == 'DRAFT'

    def test_invoice_auto_generates_number(self, invoice):
        """Invoice number auto-generated."""
        assert invoice.number.startswith('INV-')
        assert len(invoice.number) == 15  # INV-YYYY-XXXXXX

    def test_invoice_total_amount_calculation(self, invoice_with_line):
        """Total amount calculated correctly."""
        invoice_with_line.tax_amount = Decimal('100.00')
        invoice_with_line.shipping_amount = Decimal('50.00')
        invoice_with_line.discount_amount = Decimal('25.00')
        invoice_with_line.save()

        # subtotal (1000) + tax (100) + shipping (50) - discount (25) = 1125
        assert invoice_with_line.total_amount == Decimal('1125.00')

    def test_invoice_calculate_subtotal(self, invoice_with_line):
        """Subtotal calculated from lines."""
        assert invoice_with_line.subtotal == Decimal('1000.00')


@pytest.mark.django_db
class TestInvoiceWorkflow:
    """Tests for Invoice state machine workflow."""

    def test_draft_to_validated(self, invoice_with_line, user):
        """DRAFT -> VALIDATED transition."""
        invoice_with_line.validate(validated_by=user)
        assert invoice_with_line.status == 'VALIDATED'
        assert invoice_with_line.validated_by == user
        assert invoice_with_line.validated_at is not None

    def test_validated_to_matched(self, invoice_with_line, user):
        """VALIDATED -> MATCHED transition."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched(match_type='AUTO')

        assert invoice_with_line.status == 'MATCHED'
        assert invoice_with_line.match_type == 'AUTO'
        assert invoice_with_line.matched_at is not None

    def test_matched_to_approved(self, invoice_with_line, user, posted_gr):
        """MATCHED -> APPROVED transition."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.approve(approved_by=user)

        assert invoice_with_line.status == 'APPROVED'
        assert invoice_with_line.approved_by == user
        assert invoice_with_line.approved_at is not None

    def test_approved_to_paid(self, invoice_with_line, user, posted_gr):
        """APPROVED -> PAID transition."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.approve(approved_by=user)
        invoice_with_line.mark_paid()

        assert invoice_with_line.status == 'PAID'
        assert invoice_with_line.paid_at is not None

    def test_validated_to_rejected(self, invoice_with_line, user):
        """VALIDATED -> REJECTED transition."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.reject(reason='Price mismatch')

        assert invoice_with_line.status == 'REJECTED'
        assert invoice_with_line.rejection_reason == 'Price mismatch'

    def test_rejected_to_draft(self, invoice_with_line, user):
        """REJECTED -> DRAFT transition (revise)."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.reject()
        invoice_with_line.revise()

        assert invoice_with_line.status == 'DRAFT'
        assert invoice_with_line.rejection_reason == ''

    def test_matched_to_disputed(self, invoice_with_line, user):
        """MATCHED -> DISPUTED transition."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.dispute(reason='Quantity discrepancy')

        assert invoice_with_line.status == 'DISPUTED'
        assert invoice_with_line.dispute_reason == 'Quantity discrepancy'

    def test_disputed_to_matched(self, invoice_with_line, user):
        """DISPUTED -> MATCHED transition (resolve)."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.dispute(reason='Issue')
        invoice_with_line.resolve_dispute()

        assert invoice_with_line.status == 'MATCHED'

    def test_cancel_from_draft(self, invoice):
        """DRAFT -> CANCELLED transition."""
        invoice.cancel()
        assert invoice.status == 'CANCELLED'

    def test_cancel_from_matched(self, invoice_with_line, user):
        """MATCHED -> CANCELLED transition."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.cancel()

        assert invoice_with_line.status == 'CANCELLED'

    def test_cannot_cancel_paid(self, invoice_with_line, user, posted_gr):
        """Cannot cancel a paid invoice."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.approve(approved_by=user)
        invoice_with_line.mark_paid()

        with pytest.raises(InvalidStateTransitionError):
            invoice_with_line.cancel()


@pytest.mark.django_db
class TestInvoiceInvalidTransitions:
    """Tests for invalid Invoice state transitions."""

    def test_cannot_match_from_draft(self, invoice_with_line):
        """Cannot match invoice directly from draft."""
        with pytest.raises(InvalidStateTransitionError):
            invoice_with_line.mark_matched()

    def test_cannot_approve_from_draft(self, invoice_with_line, user):
        """Cannot approve invoice from draft."""
        with pytest.raises(InvalidStateTransitionError):
            invoice_with_line.approve(approved_by=user)

    def test_cannot_pay_from_matched(self, invoice_with_line, user):
        """Cannot pay invoice from matched (must be approved)."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()

        with pytest.raises(InvalidStateTransitionError):
            invoice_with_line.mark_paid()


@pytest.mark.django_db
class TestInvoiceLine:
    """Tests for InvoiceLine model."""

    def test_line_auto_increment(self, invoice, sent_po):
        """Line numbers auto-increment within invoice."""
        po_line = sent_po.lines.first()

        line1 = InvoiceLine.objects.create(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('5'),
            unit_price=Decimal('100.00'),
        )
        line2 = InvoiceLine.objects.create(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('5'),
            unit_price=Decimal('100.00'),
        )

        assert line1.line_number == 1
        assert line2.line_number == 2

    def test_line_extended_amount(self, invoice_with_line):
        """Extended amount calculated correctly."""
        line = invoice_with_line.lines.first()
        assert line.extended_amount == Decimal('1000.00')

    def test_line_po_unit_price_property(self, invoice_with_line):
        """Can access original PO unit price."""
        line = invoice_with_line.lines.first()
        assert line.po_unit_price == Decimal('100.00')

    def test_line_gr_quantity_property(self, invoice_with_line, posted_gr):
        """Can access GR quantity via po_line."""
        line = invoice_with_line.lines.first()
        assert line.gr_quantity == Decimal('10')

    def test_line_calculate_variances(self, invoice_with_line, posted_gr):
        """Can calculate quantity and price variances."""
        line = invoice_with_line.lines.first()
        variances = line.calculate_variances()

        # Invoice qty (10) - GR qty (10) = 0
        assert variances['quantity_variance'] == Decimal('0')
        # Invoice price (100) - PO price (100) = 0
        assert variances['price_variance'] == Decimal('0')


@pytest.mark.django_db
class TestInvoiceBudgetIntegration:
    """Tests for Invoice-Budget encumbrance integration."""

    def test_po_approval_creates_encumbrance(self, sent_po):
        """Verify PO approval created encumbrance."""
        assert sent_po.encumbrance is not None
        assert sent_po.encumbrance.status == 'ACTIVE'
        assert sent_po.encumbrance.amount == sent_po.total_amount

    def test_invoice_approval_liquidates_encumbrance(
        self, invoice_with_line, user, posted_gr, sent_po
    ):
        """Invoice approval liquidates the PO encumbrance."""
        encumbrance = sent_po.encumbrance

        # Link encumbrance to invoice
        invoice_with_line.encumbrance = encumbrance
        invoice_with_line.save()

        # Progress through workflow
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.approve(approved_by=user)

        # Check encumbrance was liquidated
        encumbrance.refresh_from_db()
        assert encumbrance.status == 'LIQUIDATED'

"""
Model tests for Goods Receipt models.

Tests for GR workflow, GRLine, and PO integration.
"""

import pytest
from decimal import Decimal
from datetime import date

from apps.core.exceptions import InvalidStateTransitionError
from apps.budget.models import BudgetLine, FiscalYear
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
    """Create a test budget line with $50,000."""
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
def purchase_order(db, organization, user, supplier, budget_line):
    """Create a test purchase order in SENT status."""
    po = PurchaseOrder.objects.create(
        organization=organization,
        created_by=user,
        supplier=supplier,
        budget_line=budget_line,
        title='Test PO',
    )
    return po


@pytest.fixture
def po_with_line(purchase_order):
    """Create a PO with a line item."""
    POLine.objects.create(
        purchase_order=purchase_order,
        description='Test Item',
        quantity=Decimal('10'),
        unit_price=Decimal('100.00'),
        unit_of_measure='EA',
    )
    return purchase_order


@pytest.fixture
def sent_po(po_with_line, user):
    """Create a PO in SENT status ready for receiving."""
    po_with_line.submit()
    po_with_line.approve(approved_by=user)
    po_with_line.send()
    return po_with_line


@pytest.fixture
def goods_receipt(db, organization, sent_po, user):
    """Create a draft goods receipt."""
    return GoodsReceipt.objects.create(
        organization=organization,
        purchase_order=sent_po,
        received_by=user,
    )


@pytest.fixture
def gr_with_line(goods_receipt, sent_po):
    """Create a goods receipt with a line item."""
    po_line = sent_po.lines.first()
    GoodsReceiptLine.objects.create(
        goods_receipt=goods_receipt,
        po_line=po_line,
        quantity_received=Decimal('10'),
    )
    return goods_receipt


# =============================================================================
# GoodsReceipt Model Tests
# =============================================================================

@pytest.mark.django_db
class TestGoodsReceiptModel:
    """Tests for GoodsReceipt model."""

    def test_gr_creation_defaults_to_draft(self, organization, sent_po, user):
        """New GR defaults to DRAFT status."""
        gr = GoodsReceipt.objects.create(
            organization=organization,
            purchase_order=sent_po,
            received_by=user,
        )
        assert gr.status == 'DRAFT'
        assert gr.number.startswith('GR-')

    def test_gr_auto_generates_number(self, organization, sent_po, user):
        """GR number is auto-generated."""
        gr = GoodsReceipt.objects.create(
            organization=organization,
            purchase_order=sent_po,
            received_by=user,
        )
        assert gr.number is not None
        assert len(gr.number) > 0

    def test_gr_total_quantity_received(self, goods_receipt, sent_po):
        """Total quantity is calculated from lines."""
        po_line = sent_po.lines.first()
        GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('5'),
        )
        assert goods_receipt.total_quantity_received == Decimal('5')


@pytest.mark.django_db
class TestGoodsReceiptWorkflow:
    """Tests for GR workflow state transitions."""

    def test_post_receipt(self, gr_with_line):
        """DRAFT -> POSTED via post()."""
        gr_with_line.post()
        assert gr_with_line.status == 'POSTED'
        assert gr_with_line.posted_at is not None

    def test_post_receipt_updates_po_line_quantity(self, gr_with_line, sent_po):
        """Posting GR updates POLine.quantity_received."""
        po_line = sent_po.lines.first()
        assert po_line.quantity_received == Decimal('0.00')

        gr_with_line.post()

        po_line.refresh_from_db()
        assert po_line.quantity_received == Decimal('10')

    def test_post_receipt_triggers_po_received_status(self, gr_with_line, sent_po):
        """Posting full receipt triggers PO RECEIVED status."""
        assert sent_po.status == 'SENT'

        gr_with_line.post()

        sent_po.refresh_from_db()
        assert sent_po.status == 'RECEIVED'

    def test_cancel_receipt(self, goods_receipt):
        """DRAFT -> CANCELLED via cancel()."""
        goods_receipt.cancel()
        assert goods_receipt.status == 'CANCELLED'

    def test_cannot_cancel_posted(self, gr_with_line):
        """Cannot cancel a posted GR."""
        gr_with_line.post()
        with pytest.raises(InvalidStateTransitionError):
            gr_with_line.cancel()


@pytest.mark.django_db
class TestGoodsReceiptValidation:
    """Tests for GR validation rules."""

    def test_cannot_receive_more_than_ordered(self, goods_receipt, sent_po):
        """Cannot receive more than PO quantity."""
        po_line = sent_po.lines.first()
        GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('15'),  # PO qty is 10
        )

        with pytest.raises(ValueError, match='exceed'):
            goods_receipt.post()

    def test_cannot_receive_on_draft_po(self, organization, user, supplier, budget_line):
        """Cannot create receipt for non-SENT PO."""
        po = PurchaseOrder.objects.create(
            organization=organization,
            created_by=user,
            supplier=supplier,
            budget_line=budget_line,
            title='Draft PO',
        )
        POLine.objects.create(
            purchase_order=po,
            description='Test Item',
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
        )

        gr = GoodsReceipt.objects.create(
            organization=organization,
            purchase_order=po,
            received_by=user,
        )
        GoodsReceiptLine.objects.create(
            goods_receipt=gr,
            po_line=po.lines.first(),
            quantity_received=Decimal('5'),
        )

        with pytest.raises(InvalidStateTransitionError):
            gr.post()

    def test_partial_receipt_allowed(self, goods_receipt, sent_po):
        """Can receive partial quantity."""
        po_line = sent_po.lines.first()
        GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('5'),  # Partial of 10
        )

        goods_receipt.post()
        assert goods_receipt.status == 'POSTED'

        po_line.refresh_from_db()
        assert po_line.quantity_received == Decimal('5')
        assert po_line.remaining_quantity == Decimal('5')

        # PO should still be SENT (not fully received)
        sent_po.refresh_from_db()
        assert sent_po.status == 'SENT'

    def test_multiple_receipts_per_po(self, organization, sent_po, user):
        """Multiple GRs can be created for same PO."""
        po_line = sent_po.lines.first()

        # First receipt for 5 units
        gr1 = GoodsReceipt.objects.create(
            organization=organization,
            purchase_order=sent_po,
            received_by=user,
        )
        GoodsReceiptLine.objects.create(
            goods_receipt=gr1,
            po_line=po_line,
            quantity_received=Decimal('5'),
        )
        gr1.post()

        # Second receipt for remaining 5 units
        gr2 = GoodsReceipt.objects.create(
            organization=organization,
            purchase_order=sent_po,
            received_by=user,
        )
        GoodsReceiptLine.objects.create(
            goods_receipt=gr2,
            po_line=po_line,
            quantity_received=Decimal('5'),
        )
        gr2.post()

        po_line.refresh_from_db()
        assert po_line.quantity_received == Decimal('10')
        assert po_line.is_fully_received

        sent_po.refresh_from_db()
        assert sent_po.status == 'RECEIVED'


# =============================================================================
# GoodsReceiptLine Model Tests
# =============================================================================

@pytest.mark.django_db
class TestGoodsReceiptLineModel:
    """Tests for GoodsReceiptLine model."""

    def test_gr_line_creation(self, goods_receipt, sent_po):
        """Can create a GR line."""
        po_line = sent_po.lines.first()
        line = GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('5'),
        )
        assert line.line_number == 1
        assert line.quantity_accepted == Decimal('5')  # Defaults to received

    def test_gr_line_auto_increments(self, goods_receipt, sent_po):
        """Line numbers auto-increment."""
        po_line = sent_po.lines.first()

        line1 = GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('3'),
        )
        line2 = GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('2'),
        )

        assert line1.line_number == 1
        assert line2.line_number == 2

    def test_gr_line_quantity_accepted_override(self, goods_receipt, sent_po):
        """Can override quantity_accepted."""
        po_line = sent_po.lines.first()
        line = GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('10'),
            quantity_accepted=Decimal('8'),
            quantity_rejected=Decimal('2'),
            rejection_reason='Damaged',
        )
        assert line.quantity_accepted == Decimal('8')
        assert line.quantity_rejected == Decimal('2')

    def test_gr_line_cascade_delete(self, gr_with_line):
        """Lines are deleted when GR is hard deleted."""
        gr_id = gr_with_line.id
        assert GoodsReceiptLine.objects.filter(goods_receipt_id=gr_id).count() == 1
        gr_with_line.hard_delete()
        assert GoodsReceiptLine.objects.filter(goods_receipt_id=gr_id).count() == 0

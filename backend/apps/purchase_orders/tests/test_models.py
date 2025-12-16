"""
Model tests for Purchase Order models.

Tests for PO workflow, POLine, and budget integration.
"""

import pytest
from decimal import Decimal
from datetime import date

from apps.core.exceptions import InvalidStateTransitionError
from apps.organizations.models import Organization
from apps.suppliers.models import Supplier
from apps.users.models import User
from apps.budget.models import BudgetLine, FiscalYear
from apps.rfqs.models import RFQ, RFQLine, SupplierInvitation, Bid, BidLine
from apps.purchase_orders.models import PurchaseOrder, POLine


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
def approver(db, organization):
    """Create an approver user."""
    return User.objects.create_user(
        email='approver@example.com',
        password='testpass123',
        first_name='Approver',
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
def rfq(db, organization, user, supplier):
    """Create an awarded RFQ."""
    rfq = RFQ.objects.create(
        organization=organization,
        created_by=user,
        title='Test RFQ',
    )
    RFQLine.objects.create(
        rfq=rfq,
        description='Test Item',
        quantity=Decimal('10'),
        unit_of_measure='EA',
        target_unit_price=Decimal('100.00'),
    )
    SupplierInvitation.objects.create(
        rfq=rfq,
        supplier=supplier,
        invited_by=user,
    )
    return rfq


@pytest.fixture
def awarded_bid(rfq, supplier, user):
    """Create an awarded bid."""
    rfq.open_for_bids()
    bid = Bid.objects.create(
        rfq=rfq,
        supplier=supplier,
        submitted_by=user,
    )
    rfq_line = rfq.lines.first()
    BidLine.objects.create(
        bid=bid,
        rfq_line=rfq_line,
        unit_price=Decimal('90.00'),
        lead_time_days=5,
    )
    bid.submit()
    rfq.close_bids()
    rfq.award(bid)
    return bid


@pytest.fixture
def purchase_order(db, organization, user, supplier, budget_line):
    """Create a test purchase order in DRAFT status."""
    return PurchaseOrder.objects.create(
        organization=organization,
        created_by=user,
        supplier=supplier,
        budget_line=budget_line,
        title='Test PO',
    )


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


# =============================================================================
# PurchaseOrder Model Tests
# =============================================================================

@pytest.mark.django_db
class TestPurchaseOrderModel:
    """Tests for PurchaseOrder model."""

    def test_po_creation_defaults_to_draft(self, organization, user, supplier, budget_line):
        """New PO defaults to DRAFT status."""
        po = PurchaseOrder.objects.create(
            organization=organization,
            created_by=user,
            supplier=supplier,
            budget_line=budget_line,
            title='Test PO',
        )
        assert po.status == 'DRAFT'
        assert po.number.startswith('PO-')

    def test_po_auto_generates_number(self, organization, user, supplier, budget_line):
        """PO number is auto-generated."""
        po = PurchaseOrder.objects.create(
            organization=organization,
            created_by=user,
            supplier=supplier,
            budget_line=budget_line,
            title='Test PO',
        )
        assert po.number is not None
        assert len(po.number) > 0

    def test_po_total_amount_calculation(self, po_with_line):
        """Total amount is calculated from lines."""
        # 10 qty * $100 = $1000
        assert po_with_line.total_amount == Decimal('1000.00')

    def test_po_total_amount_with_multiple_lines(self, purchase_order):
        """Total amount sums all lines."""
        POLine.objects.create(
            purchase_order=purchase_order,
            description='Item 1',
            quantity=Decimal('5'),
            unit_price=Decimal('100.00'),
        )
        POLine.objects.create(
            purchase_order=purchase_order,
            description='Item 2',
            quantity=Decimal('10'),
            unit_price=Decimal('50.00'),
        )
        # 5*100 + 10*50 = 500 + 500 = 1000
        assert purchase_order.total_amount == Decimal('1000.00')


@pytest.mark.django_db
class TestPurchaseOrderWorkflow:
    """Tests for PO workflow state transitions."""

    def test_submit_po(self, po_with_line):
        """DRAFT -> SUBMITTED via submit()."""
        po_with_line.submit()
        assert po_with_line.status == 'SUBMITTED'
        assert po_with_line.submitted_at is not None

    def test_cannot_submit_empty_po(self, purchase_order):
        """Cannot submit PO without lines."""
        with pytest.raises(ValueError, match='line'):
            purchase_order.submit()

    def test_approve_po(self, po_with_line, approver):
        """SUBMITTED -> APPROVED via approve()."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        assert po_with_line.status == 'APPROVED'
        assert po_with_line.approved_by == approver
        assert po_with_line.approved_at is not None

    def test_send_po(self, po_with_line, approver):
        """APPROVED -> SENT via send()."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        assert po_with_line.status == 'SENT'
        assert po_with_line.sent_at is not None

    def test_receive_po(self, po_with_line, approver):
        """SENT -> RECEIVED via receive()."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        po_with_line.receive()
        assert po_with_line.status == 'RECEIVED'
        assert po_with_line.received_at is not None

    def test_complete_po(self, po_with_line, approver):
        """RECEIVED -> COMPLETED via complete()."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        po_with_line.receive()
        po_with_line.complete()
        assert po_with_line.status == 'COMPLETED'
        assert po_with_line.completed_at is not None

    def test_cancel_draft_po(self, purchase_order):
        """DRAFT -> CANCELLED via cancel()."""
        purchase_order.cancel()
        assert purchase_order.status == 'CANCELLED'

    def test_cancel_submitted_po(self, po_with_line):
        """SUBMITTED -> CANCELLED via cancel()."""
        po_with_line.submit()
        po_with_line.cancel()
        assert po_with_line.status == 'CANCELLED'

    def test_reject_po(self, po_with_line, approver):
        """SUBMITTED -> REJECTED via reject()."""
        po_with_line.submit()
        po_with_line.reject(rejected_by=approver, reason='Budget concerns')
        assert po_with_line.status == 'REJECTED'
        assert po_with_line.rejected_by == approver
        assert po_with_line.rejection_reason == 'Budget concerns'

    def test_revise_rejected_po(self, po_with_line, approver):
        """REJECTED -> DRAFT via revise()."""
        po_with_line.submit()
        po_with_line.reject(rejected_by=approver, reason='Budget concerns')
        po_with_line.revise()
        assert po_with_line.status == 'DRAFT'


@pytest.mark.django_db
class TestPurchaseOrderInvalidTransitions:
    """Tests for invalid PO state transitions."""

    def test_cannot_approve_draft(self, po_with_line, approver):
        """Cannot approve directly from DRAFT."""
        with pytest.raises(InvalidStateTransitionError):
            po_with_line.approve(approved_by=approver)

    def test_cannot_send_draft(self, po_with_line):
        """Cannot send from DRAFT."""
        with pytest.raises(InvalidStateTransitionError):
            po_with_line.send()

    def test_cannot_send_submitted(self, po_with_line):
        """Cannot send from SUBMITTED (must be approved first)."""
        po_with_line.submit()
        with pytest.raises(InvalidStateTransitionError):
            po_with_line.send()

    def test_cannot_complete_sent(self, po_with_line, approver):
        """Cannot complete from SENT (must be received first)."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        with pytest.raises(InvalidStateTransitionError):
            po_with_line.complete()

    def test_cannot_cancel_completed(self, po_with_line, approver):
        """Cannot cancel a completed PO."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        po_with_line.receive()
        po_with_line.complete()
        with pytest.raises(InvalidStateTransitionError):
            po_with_line.cancel()


@pytest.mark.django_db
class TestPurchaseOrderFromRFQ:
    """Tests for creating PO from awarded RFQ."""

    def test_create_po_from_awarded_bid(self, awarded_bid, budget_line, user):
        """Can create PO from awarded bid."""
        po = PurchaseOrder.create_from_bid(
            bid=awarded_bid,
            budget_line=budget_line,
            created_by=user,
        )
        assert po.supplier == awarded_bid.supplier
        assert po.organization == awarded_bid.rfq.organization
        assert po.rfq == awarded_bid.rfq
        assert po.bid == awarded_bid
        assert po.lines.count() == 1

        # Check line item copied correctly
        po_line = po.lines.first()
        bid_line = awarded_bid.lines.first()
        assert po_line.unit_price == bid_line.unit_price
        assert po_line.quantity == bid_line.rfq_line.quantity


# =============================================================================
# POLine Model Tests
# =============================================================================

@pytest.mark.django_db
class TestPOLineModel:
    """Tests for POLine model."""

    def test_po_line_creation(self, purchase_order):
        """Can create a PO line."""
        line = POLine.objects.create(
            purchase_order=purchase_order,
            description='Test Item',
            quantity=Decimal('5'),
            unit_price=Decimal('100.00'),
            unit_of_measure='EA',
        )
        assert line.line_number == 1
        assert line.extended_amount == Decimal('500.00')

    def test_po_line_auto_increments(self, purchase_order):
        """Line numbers auto-increment."""
        line1 = POLine.objects.create(
            purchase_order=purchase_order,
            description='Item 1',
            quantity=Decimal('1'),
            unit_price=Decimal('100.00'),
        )
        line2 = POLine.objects.create(
            purchase_order=purchase_order,
            description='Item 2',
            quantity=Decimal('1'),
            unit_price=Decimal('200.00'),
        )
        assert line1.line_number == 1
        assert line2.line_number == 2

    def test_po_line_extended_amount(self, purchase_order):
        """Extended amount is quantity * unit_price."""
        line = POLine.objects.create(
            purchase_order=purchase_order,
            description='Test Item',
            quantity=Decimal('7'),
            unit_price=Decimal('15.50'),
        )
        # 7 * 15.50 = 108.50
        assert line.extended_amount == Decimal('108.50')

    def test_po_line_cascade_delete(self, po_with_line):
        """Lines are deleted when PO is hard deleted."""
        po_id = po_with_line.id
        assert POLine.objects.filter(purchase_order_id=po_id).count() == 1
        po_with_line.hard_delete()
        assert POLine.objects.filter(purchase_order_id=po_id).count() == 0

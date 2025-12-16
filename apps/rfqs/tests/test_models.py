"""
Model tests for RFQ module.

Tests RFQ workflow state machine, line items, invitations, and bids.
"""

import pytest
from datetime import date
from decimal import Decimal

from apps.core.exceptions import (
    DuplicateInvitationError,
    InvalidStateTransitionError,
    RFQNotOpenError,
)
from apps.organizations.models import Organization
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
        email='buyer@example.com',
        password='testpass123',
        first_name='Test',
        last_name='Buyer',
        organization=organization,
    )


@pytest.fixture
def supplier(db, organization):
    """Create a test approved supplier."""
    supplier = Supplier.objects.create(
        organization=organization,
        name='Test Supplier',
        code='SUP001',
    )
    supplier.submit_for_review()
    supplier.approve()
    return supplier


@pytest.fixture
def supplier2(db, organization):
    """Create a second approved supplier."""
    supplier = Supplier.objects.create(
        organization=organization,
        name='Second Supplier',
        code='SUP002',
    )
    supplier.submit_for_review()
    supplier.approve()
    return supplier


@pytest.fixture
def rfq(db, organization, user):
    """Create a test RFQ in DRAFT status."""
    from apps.rfqs.models import RFQ
    return RFQ.objects.create(
        organization=organization,
        created_by=user,
        title='Test RFQ',
        description='Test description for RFQ',
    )


@pytest.fixture
def rfq_with_line(rfq):
    """Create an RFQ with a line item."""
    from apps.rfqs.models import RFQLine
    RFQLine.objects.create(
        rfq=rfq,
        description='Test Item',
        quantity=Decimal('10.00'),
        unit_of_measure='EA',
    )
    return rfq


@pytest.fixture
def rfq_with_invitation(rfq_with_line, supplier, user):
    """Create an RFQ with a line item and supplier invitation."""
    from apps.rfqs.models import SupplierInvitation
    SupplierInvitation.objects.create(
        rfq=rfq_with_line,
        supplier=supplier,
        invited_by=user,
    )
    return rfq_with_line


@pytest.mark.django_db
class TestRFQModel:
    """Tests for RFQ model."""

    def test_rfq_creation_defaults_to_draft(self, organization, user):
        """New RFQ should default to DRAFT status."""
        from apps.rfqs.models import RFQ
        rfq = RFQ.objects.create(
            organization=organization,
            created_by=user,
            title='New RFQ',
        )
        assert rfq.status == 'DRAFT'

    def test_rfq_auto_generates_number(self, rfq):
        """RFQ number should be auto-generated on save."""
        assert rfq.number is not None
        assert rfq.number.startswith('RFQ-')

    def test_rfq_number_is_unique(self, organization, user):
        """RFQ numbers should be unique."""
        from apps.rfqs.models import RFQ
        rfq1 = RFQ.objects.create(
            organization=organization,
            created_by=user,
            title='RFQ 1',
        )
        rfq2 = RFQ.objects.create(
            organization=organization,
            created_by=user,
            title='RFQ 2',
        )
        assert rfq1.number != rfq2.number

    def test_rfq_str_representation(self, rfq):
        """String representation should include number and title."""
        assert rfq.number in str(rfq)
        assert rfq.title in str(rfq)


@pytest.mark.django_db
class TestRFQTotalAmount:
    """Tests for RFQ total amount calculation."""

    def test_rfq_total_amount_no_lines(self, rfq):
        """RFQ with no lines should have zero total."""
        assert rfq.total_amount == Decimal('0.00')

    def test_rfq_total_amount_with_lines(self, rfq):
        """RFQ total should be sum of line amounts."""
        from apps.rfqs.models import RFQLine
        RFQLine.objects.create(
            rfq=rfq,
            description='Item 1',
            quantity=Decimal('5.00'),
            unit_of_measure='EA',
            target_unit_price=Decimal('100.00'),
        )
        RFQLine.objects.create(
            rfq=rfq,
            description='Item 2',
            quantity=Decimal('2.00'),
            unit_of_measure='EA',
            target_unit_price=Decimal('250.00'),
        )
        # 5*100 + 2*250 = 500 + 500 = 1000
        assert rfq.total_amount == Decimal('1000.00')

    def test_rfq_total_amount_with_null_prices(self, rfq):
        """Lines without target price should not contribute to total."""
        from apps.rfqs.models import RFQLine
        RFQLine.objects.create(
            rfq=rfq,
            description='Item with price',
            quantity=Decimal('5.00'),
            unit_of_measure='EA',
            target_unit_price=Decimal('100.00'),
        )
        RFQLine.objects.create(
            rfq=rfq,
            description='Item without price',
            quantity=Decimal('10.00'),
            unit_of_measure='EA',
            # target_unit_price is null
        )
        assert rfq.total_amount == Decimal('500.00')


@pytest.mark.django_db
class TestRFQWorkflow:
    """Tests for RFQ state machine workflow."""

    def test_draft_to_open_transition(self, rfq_with_invitation):
        """DRAFT -> OPEN is valid when lines and invitations exist."""
        rfq_with_invitation.open_for_bids()
        assert rfq_with_invitation.status == 'OPEN'
        assert rfq_with_invitation.open_date is not None

    def test_cannot_open_without_lines(self, rfq, supplier, user):
        """Cannot open RFQ without any line items."""
        from apps.rfqs.models import SupplierInvitation
        # Add invitation but no lines
        SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        with pytest.raises(ValueError, match='line'):
            rfq.open_for_bids()

    def test_cannot_open_without_invitations(self, rfq_with_line):
        """Cannot open RFQ without any supplier invitations."""
        with pytest.raises(ValueError, match='invitation'):
            rfq_with_line.open_for_bids()

    def test_open_to_closed_transition(self, rfq_with_invitation):
        """OPEN -> CLOSED is valid."""
        rfq_with_invitation.open_for_bids()
        rfq_with_invitation.close_bids()
        assert rfq_with_invitation.status == 'CLOSED'
        assert rfq_with_invitation.close_date is not None

    def test_closed_to_awarded_transition(self, rfq_with_invitation, supplier, user):
        """CLOSED -> AWARDED requires selecting a winning bid."""
        from apps.rfqs.models import Bid, BidLine
        rfq = rfq_with_invitation
        rfq.open_for_bids()

        # Create and submit a bid
        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        BidLine.objects.create(
            bid=bid,
            rfq_line=rfq.lines.first(),
            unit_price=Decimal('50.00'),
        )
        bid.submit()

        rfq.close_bids()
        rfq.award(bid)

        assert rfq.status == 'AWARDED'
        assert rfq.awarded_date is not None
        assert rfq.awarded_supplier == supplier

    def test_cannot_award_without_bid(self, rfq_with_invitation):
        """Cannot award RFQ without a valid bid."""
        rfq = rfq_with_invitation
        rfq.open_for_bids()
        rfq.close_bids()

        with pytest.raises(ValueError, match='bid'):
            rfq.award(None)

    def test_invalid_transition_raises_error(self, rfq):
        """Invalid state transition should raise error."""
        # Cannot go from DRAFT to AWARDED directly
        with pytest.raises(InvalidStateTransitionError):
            rfq._transition_to('AWARDED')

    def test_cancel_from_draft(self, rfq):
        """Can cancel from DRAFT status."""
        rfq.cancel()
        assert rfq.status == 'CANCELLED'

    def test_cancel_from_open(self, rfq_with_invitation):
        """Can cancel from OPEN status."""
        rfq_with_invitation.open_for_bids()
        rfq_with_invitation.cancel()
        assert rfq_with_invitation.status == 'CANCELLED'

    def test_cancel_from_closed(self, rfq_with_invitation):
        """Can cancel from CLOSED status."""
        rfq_with_invitation.open_for_bids()
        rfq_with_invitation.close_bids()
        rfq_with_invitation.cancel()
        assert rfq_with_invitation.status == 'CANCELLED'


@pytest.mark.django_db
class TestRFQLineModel:
    """Tests for RFQLine model."""

    def test_rfqline_creation(self, rfq):
        """Can create an RFQ line item."""
        from apps.rfqs.models import RFQLine
        line = RFQLine.objects.create(
            rfq=rfq,
            description='Office Supplies',
            quantity=Decimal('100.00'),
            unit_of_measure='EA',
            target_unit_price=Decimal('10.00'),
        )
        assert line.rfq == rfq
        assert line.description == 'Office Supplies'

    def test_rfqline_auto_assigns_line_number(self, rfq):
        """Line numbers should auto-increment."""
        from apps.rfqs.models import RFQLine
        line1 = RFQLine.objects.create(
            rfq=rfq,
            description='Item 1',
            quantity=Decimal('1.00'),
            unit_of_measure='EA',
        )
        line2 = RFQLine.objects.create(
            rfq=rfq,
            description='Item 2',
            quantity=Decimal('1.00'),
            unit_of_measure='EA',
        )
        assert line1.line_number == 1
        assert line2.line_number == 2

    def test_rfqline_extended_amount_with_target_price(self, rfq):
        """Extended amount is quantity * target_unit_price."""
        from apps.rfqs.models import RFQLine
        line = RFQLine.objects.create(
            rfq=rfq,
            description='Item',
            quantity=Decimal('5.00'),
            unit_of_measure='EA',
            target_unit_price=Decimal('20.00'),
        )
        assert line.extended_amount == Decimal('100.00')

    def test_rfqline_extended_amount_without_target_price(self, rfq):
        """Extended amount is zero if no target price."""
        from apps.rfqs.models import RFQLine
        line = RFQLine.objects.create(
            rfq=rfq,
            description='Item',
            quantity=Decimal('5.00'),
            unit_of_measure='EA',
        )
        assert line.extended_amount == Decimal('0.00')

    def test_rfqline_cascade_delete(self, rfq):
        """Lines should be deleted when RFQ is deleted."""
        from apps.rfqs.models import RFQLine
        RFQLine.objects.create(
            rfq=rfq,
            description='Item',
            quantity=Decimal('1.00'),
            unit_of_measure='EA',
        )
        rfq_id = rfq.id
        rfq.hard_delete()
        assert RFQLine.objects.filter(rfq_id=rfq_id).count() == 0


@pytest.mark.django_db
class TestSupplierInvitationModel:
    """Tests for SupplierInvitation model."""

    def test_invitation_creation(self, rfq, supplier, user):
        """Can create a supplier invitation."""
        from apps.rfqs.models import SupplierInvitation
        invitation = SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        assert invitation.status == 'PENDING'
        assert invitation.invited_at is not None

    def test_cannot_invite_same_supplier_twice(self, rfq, supplier, user):
        """Cannot invite the same supplier twice to same RFQ."""
        from apps.rfqs.models import SupplierInvitation
        SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        with pytest.raises(DuplicateInvitationError):
            SupplierInvitation.objects.create(
                rfq=rfq,
                supplier=supplier,
                invited_by=user,
            )

    def test_invitation_mark_viewed(self, rfq, supplier, user):
        """Can mark invitation as viewed."""
        from apps.rfqs.models import SupplierInvitation
        invitation = SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        invitation.mark_viewed()
        assert invitation.status == 'VIEWED'
        assert invitation.viewed_at is not None

    def test_invitation_mark_declined(self, rfq, supplier, user):
        """Can decline an invitation."""
        from apps.rfqs.models import SupplierInvitation
        invitation = SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        invitation.decline(reason='Not interested')
        assert invitation.status == 'DECLINED'
        assert invitation.decline_reason == 'Not interested'
        assert invitation.responded_at is not None


@pytest.mark.django_db
class TestBidModel:
    """Tests for Bid model."""

    def test_bid_creation_defaults_to_draft(self, rfq_with_invitation, supplier, user):
        """New bid should default to DRAFT status."""
        from apps.rfqs.models import Bid
        rfq = rfq_with_invitation
        rfq.open_for_bids()

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        assert bid.status == 'DRAFT'

    def test_bid_submit_changes_status(self, rfq_with_invitation, supplier, user):
        """Submitting bid changes status to SUBMITTED."""
        from apps.rfqs.models import Bid, BidLine
        rfq = rfq_with_invitation
        rfq.open_for_bids()

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        BidLine.objects.create(
            bid=bid,
            rfq_line=rfq.lines.first(),
            unit_price=Decimal('50.00'),
        )
        bid.submit()

        assert bid.status == 'SUBMITTED'
        assert bid.submitted_at is not None

    def test_cannot_submit_bid_without_lines(self, rfq_with_invitation, supplier, user):
        """Cannot submit bid without any bid lines."""
        from apps.rfqs.models import Bid
        rfq = rfq_with_invitation
        rfq.open_for_bids()

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        with pytest.raises(ValueError, match='line'):
            bid.submit()

    def test_cannot_submit_bid_on_closed_rfq(self, rfq_with_invitation, supplier, user):
        """Cannot submit bid on closed RFQ."""
        from apps.rfqs.models import Bid, BidLine
        rfq = rfq_with_invitation
        rfq.open_for_bids()
        rfq.close_bids()

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        BidLine.objects.create(
            bid=bid,
            rfq_line=rfq.lines.first(),
            unit_price=Decimal('50.00'),
        )
        with pytest.raises(RFQNotOpenError):
            bid.submit()

    def test_bid_total_amount_calculation(self, rfq, supplier, user):
        """Bid total amount is sum of bid line amounts."""
        from apps.rfqs.models import Bid, BidLine, RFQLine, SupplierInvitation
        # Create RFQ lines
        line1 = RFQLine.objects.create(
            rfq=rfq,
            description='Item 1',
            quantity=Decimal('10.00'),
            unit_of_measure='EA',
        )
        line2 = RFQLine.objects.create(
            rfq=rfq,
            description='Item 2',
            quantity=Decimal('5.00'),
            unit_of_measure='EA',
        )
        SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        rfq.open_for_bids()

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        BidLine.objects.create(
            bid=bid,
            rfq_line=line1,
            unit_price=Decimal('100.00'),
        )
        BidLine.objects.create(
            bid=bid,
            rfq_line=line2,
            unit_price=Decimal('200.00'),
        )
        # 10*100 + 5*200 = 1000 + 1000 = 2000
        assert bid.total_amount == Decimal('2000.00')


@pytest.mark.django_db
class TestBidLineModel:
    """Tests for BidLine model."""

    def test_bidline_extended_amount(self, rfq, supplier, user):
        """BidLine extended_amount is rfq_line.quantity * unit_price."""
        from apps.rfqs.models import Bid, BidLine, RFQLine, SupplierInvitation
        rfq_line = RFQLine.objects.create(
            rfq=rfq,
            description='Item',
            quantity=Decimal('10.00'),
            unit_of_measure='EA',
        )
        SupplierInvitation.objects.create(
            rfq=rfq,
            supplier=supplier,
            invited_by=user,
        )
        rfq.open_for_bids()

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        bid_line = BidLine.objects.create(
            bid=bid,
            rfq_line=rfq_line,
            unit_price=Decimal('25.00'),
        )
        # 10 * 25 = 250
        assert bid_line.extended_amount == Decimal('250.00')

    def test_bidline_must_reference_rfqline(self, rfq_with_invitation, supplier, user):
        """BidLine must reference an RFQLine from the same RFQ."""
        from apps.rfqs.models import Bid, BidLine, RFQ, RFQLine
        rfq = rfq_with_invitation
        rfq.open_for_bids()

        # Create a different RFQ with a line
        other_rfq = RFQ.objects.create(
            organization=rfq.organization,
            created_by=user,
            title='Other RFQ',
        )
        other_line = RFQLine.objects.create(
            rfq=other_rfq,
            description='Other Item',
            quantity=Decimal('1.00'),
            unit_of_measure='EA',
        )

        bid = Bid.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=user,
        )
        with pytest.raises(ValueError, match='RFQ'):
            BidLine.objects.create(
                bid=bid,
                rfq_line=other_line,  # Wrong RFQ!
                unit_price=Decimal('50.00'),
            )

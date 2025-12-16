"""
API tests for RFQ endpoints.

Tests workflow actions and bid management.
"""

import pytest
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Organization
from apps.rfqs.models import RFQ, RFQLine, SupplierInvitation, Bid, BidLine
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


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
def supplier_user(db, organization):
    """Create a test supplier user."""
    return User.objects.create_user(
        email='supplier.user@example.com',
        password='testpass123',
        first_name='Supplier',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def supplier_client(api_client, supplier_user):
    """Return an authenticated API client for supplier user."""
    api_client.force_authenticate(user=supplier_user)
    return api_client


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
def supplier2(db, organization):
    """Create a second test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP002',
        name='Second Supplier',
        status='APPROVED',
    )


@pytest.fixture
def rfq(db, organization, user):
    """Create a test RFQ in DRAFT status."""
    return RFQ.objects.create(
        organization=organization,
        created_by=user,
        title='Test RFQ',
        description='Test RFQ description',
    )


@pytest.fixture
def rfq_with_line(rfq):
    """Create an RFQ with a line item."""
    RFQLine.objects.create(
        rfq=rfq,
        description='Test Item',
        quantity=Decimal('10'),
        unit_of_measure='EA',
        target_unit_price=Decimal('100.00'),
    )
    return rfq


@pytest.fixture
def rfq_with_invitation(rfq_with_line, supplier, user):
    """Create an RFQ with a line and invitation."""
    SupplierInvitation.objects.create(
        rfq=rfq_with_line,
        supplier=supplier,
        invited_by=user,
    )
    return rfq_with_line


@pytest.fixture
def open_rfq(rfq_with_invitation):
    """Create an RFQ in OPEN status."""
    rfq_with_invitation.open_for_bids()
    return rfq_with_invitation


@pytest.fixture
def bid(open_rfq, supplier, supplier_user):
    """Create a draft bid."""
    return Bid.objects.create(
        rfq=open_rfq,
        supplier=supplier,
        submitted_by=supplier_user,
    )


@pytest.fixture
def bid_with_lines(bid, open_rfq):
    """Create a bid with lines."""
    rfq_line = open_rfq.lines.first()
    BidLine.objects.create(
        bid=bid,
        rfq_line=rfq_line,
        unit_price=Decimal('90.00'),
        lead_time_days=5,
    )
    return bid


@pytest.mark.django_db
class TestRFQViewSet:
    """Tests for /api/v1/rfqs/ endpoints."""

    def test_list_rfqs(self, authenticated_client, rfq):
        """Can list RFQs in user's organization."""
        response = authenticated_client.get('/api/v1/rfqs/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_rfq(self, authenticated_client, organization, user):
        """Can create a new RFQ."""
        response = authenticated_client.post(
            '/api/v1/rfqs/',
            {
                'organization': str(organization.id),
                'created_by': str(user.id),
                'title': 'New RFQ',
                'description': 'New RFQ description',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert RFQ.objects.filter(title='New RFQ').exists()

    def test_create_rfq_with_lines(self, authenticated_client, organization, user):
        """Can create an RFQ with line items."""
        response = authenticated_client.post(
            '/api/v1/rfqs/',
            {
                'organization': str(organization.id),
                'created_by': str(user.id),
                'title': 'RFQ with Lines',
                'lines': [
                    {
                        'description': 'Item 1',
                        'quantity': '10',
                        'unit_of_measure': 'EA',
                        'target_unit_price': '100.00',
                    },
                    {
                        'description': 'Item 2',
                        'quantity': '5',
                        'unit_of_measure': 'EA',
                    },
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        rfq = RFQ.objects.get(title='RFQ with Lines')
        assert rfq.lines.count() == 2

    def test_get_rfq_detail(self, authenticated_client, rfq_with_line):
        """Can get RFQ details with lines."""
        response = authenticated_client.get(f'/api/v1/rfqs/{rfq_with_line.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Test RFQ'
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['lines']) == 1


@pytest.mark.django_db
class TestRFQWorkflow:
    """Tests for RFQ workflow actions."""

    def test_open_rfq_for_bids(self, authenticated_client, rfq_with_invitation):
        """DRAFT -> OPEN via open_for_bids action."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{rfq_with_invitation.id}/open_for_bids/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'OPEN'

        rfq_with_invitation.refresh_from_db()
        assert rfq_with_invitation.status == 'OPEN'
        assert rfq_with_invitation.open_date is not None

    def test_cannot_open_rfq_without_lines(self, authenticated_client, rfq, supplier, user):
        """Cannot open RFQ without line items."""
        SupplierInvitation.objects.create(rfq=rfq, supplier=supplier, invited_by=user)

        response = authenticated_client.post(
            f'/api/v1/rfqs/{rfq.id}/open_for_bids/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'line' in response.data['error'].lower()

    def test_cannot_open_rfq_without_invitations(self, authenticated_client, rfq_with_line):
        """Cannot open RFQ without supplier invitations."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{rfq_with_line.id}/open_for_bids/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'invitation' in response.data['error'].lower()

    def test_close_rfq_bids(self, authenticated_client, open_rfq):
        """OPEN -> CLOSED via close_bids action."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{open_rfq.id}/close_bids/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CLOSED'

        open_rfq.refresh_from_db()
        assert open_rfq.status == 'CLOSED'
        assert open_rfq.close_date is not None

    def test_award_rfq(self, authenticated_client, open_rfq, bid_with_lines):
        """CLOSED -> AWARDED via award action."""
        # Submit the bid while RFQ is OPEN
        bid_with_lines.submit()
        # Then close the RFQ
        open_rfq.close_bids()

        response = authenticated_client.post(
            f'/api/v1/rfqs/{open_rfq.id}/award/',
            {'bid_id': str(bid_with_lines.id)},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'AWARDED'
        assert str(response.data['awarded_bid']) == str(bid_with_lines.id)

        open_rfq.refresh_from_db()
        assert open_rfq.status == 'AWARDED'
        assert open_rfq.awarded_supplier == bid_with_lines.supplier

    def test_cancel_rfq(self, authenticated_client, rfq):
        """DRAFT -> CANCELLED via cancel action."""
        response = authenticated_client.post(f'/api/v1/rfqs/{rfq.id}/cancel/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'

    def test_cancel_open_rfq(self, authenticated_client, open_rfq):
        """OPEN -> CANCELLED via cancel action."""
        response = authenticated_client.post(f'/api/v1/rfqs/{open_rfq.id}/cancel/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'

    def test_cannot_cancel_awarded_rfq(self, authenticated_client, open_rfq, bid_with_lines):
        """Cannot cancel an awarded RFQ."""
        # Submit bid while RFQ is OPEN, then close and award
        bid_with_lines.submit()
        open_rfq.close_bids()
        open_rfq.award(bid_with_lines)

        response = authenticated_client.post(f'/api/v1/rfqs/{open_rfq.id}/cancel/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRFQLines:
    """Tests for RFQ line management via API."""

    def test_get_rfq_lines(self, authenticated_client, rfq_with_line):
        """Can get lines for an RFQ."""
        response = authenticated_client.get(f'/api/v1/rfqs/{rfq_with_line.id}/lines/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['description'] == 'Test Item'

    def test_add_line_to_draft_rfq(self, authenticated_client, rfq):
        """Can add line to draft RFQ."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{rfq.id}/lines/',
            {
                'description': 'New Item',
                'quantity': '5',
                'unit_of_measure': 'EA',
                'target_unit_price': '50.00',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert rfq.lines.count() == 1

    def test_cannot_add_line_to_open_rfq(self, authenticated_client, open_rfq):
        """Cannot add line to non-draft RFQ."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{open_rfq.id}/lines/',
            {
                'description': 'Another Item',
                'quantity': '3',
                'unit_of_measure': 'EA',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSupplierInvitations:
    """Tests for supplier invitation management via API."""

    def test_get_rfq_invitations(self, authenticated_client, rfq_with_invitation):
        """Can get invitations for an RFQ."""
        response = authenticated_client.get(
            f'/api/v1/rfqs/{rfq_with_invitation.id}/invitations/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['status'] == 'PENDING'

    def test_invite_supplier(self, authenticated_client, rfq_with_line, supplier):
        """Can invite a supplier to an RFQ."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{rfq_with_line.id}/invitations/',
            {'supplier': str(supplier.id)},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert rfq_with_line.invitations.count() == 1

    def test_cannot_invite_same_supplier_twice(
        self, authenticated_client, rfq_with_invitation, supplier
    ):
        """Cannot invite the same supplier twice."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{rfq_with_invitation.id}/invitations/',
            {'supplier': str(supplier.id)},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already' in response.data['error'].lower()

    def test_cannot_invite_to_open_rfq(self, authenticated_client, open_rfq, supplier2):
        """Cannot invite suppliers to non-draft RFQ."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{open_rfq.id}/invitations/',
            {'supplier': str(supplier2.id)},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_mark_invitation_viewed(self, authenticated_client, rfq_with_invitation):
        """Can mark invitation as viewed."""
        invitation = rfq_with_invitation.invitations.first()
        response = authenticated_client.post(
            f'/api/v1/rfqs/invitations/{invitation.id}/mark_viewed/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'VIEWED'

    def test_decline_invitation(self, authenticated_client, rfq_with_invitation):
        """Can decline an invitation."""
        invitation = rfq_with_invitation.invitations.first()
        response = authenticated_client.post(
            f'/api/v1/rfqs/invitations/{invitation.id}/decline/',
            {'reason': 'Not interested'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DECLINED'
        assert response.data['decline_reason'] == 'Not interested'


@pytest.mark.django_db
class TestBidViewSet:
    """Tests for /api/v1/rfqs/bids/ endpoints."""

    def test_list_bids(self, authenticated_client, bid):
        """Can list bids."""
        response = authenticated_client.get('/api/v1/rfqs/bids/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_bid(self, authenticated_client, open_rfq, supplier, user):
        """Can create a new bid."""
        response = authenticated_client.post(
            '/api/v1/rfqs/bids/',
            {
                'rfq': str(open_rfq.id),
                'supplier': str(supplier.id),
                'submitted_by': str(user.id),
                'notes': 'Our best offer',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Bid.objects.filter(notes='Our best offer').exists()

    def test_create_bid_with_lines(
        self, authenticated_client, open_rfq, supplier, user
    ):
        """Can create a bid with lines."""
        rfq_line = open_rfq.lines.first()
        response = authenticated_client.post(
            '/api/v1/rfqs/bids/',
            {
                'rfq': str(open_rfq.id),
                'supplier': str(supplier.id),
                'submitted_by': str(user.id),
                'lines': [
                    {
                        'rfq_line': str(rfq_line.id),
                        'unit_price': '95.00',
                        'lead_time_days': 7,
                    }
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        bid = Bid.objects.get(rfq=open_rfq, supplier=supplier)
        assert bid.lines.count() == 1

    def test_get_bid_detail(self, authenticated_client, bid_with_lines):
        """Can get bid details with lines."""
        response = authenticated_client.get(f'/api/v1/rfqs/bids/{bid_with_lines.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['lines']) == 1


@pytest.mark.django_db
class TestBidWorkflow:
    """Tests for bid workflow actions."""

    def test_submit_bid(self, authenticated_client, bid_with_lines):
        """DRAFT -> SUBMITTED via submit action."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/bids/{bid_with_lines.id}/submit/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SUBMITTED'

        bid_with_lines.refresh_from_db()
        assert bid_with_lines.status == 'SUBMITTED'
        assert bid_with_lines.submitted_at is not None

    def test_cannot_submit_bid_without_lines(self, authenticated_client, bid):
        """Cannot submit bid without lines."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/bids/{bid.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'line' in response.data['error'].lower()

    def test_cannot_submit_bid_on_closed_rfq(
        self, authenticated_client, open_rfq, bid_with_lines
    ):
        """Cannot submit bid when RFQ is closed."""
        open_rfq.close_bids()

        response = authenticated_client.post(
            f'/api/v1/rfqs/bids/{bid_with_lines.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'open' in response.data['error'].lower()


@pytest.mark.django_db
class TestBidLines:
    """Tests for bid line management via API."""

    def test_get_bid_lines(self, authenticated_client, bid_with_lines):
        """Can get lines for a bid."""
        response = authenticated_client.get(
            f'/api/v1/rfqs/bids/{bid_with_lines.id}/lines/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['unit_price'] == '90.00'

    def test_add_line_to_draft_bid(self, authenticated_client, bid, open_rfq):
        """Can add line to draft bid."""
        rfq_line = open_rfq.lines.first()
        response = authenticated_client.post(
            f'/api/v1/rfqs/bids/{bid.id}/lines/',
            {
                'rfq_line': str(rfq_line.id),
                'unit_price': '85.00',
                'lead_time_days': 10,
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert bid.lines.count() == 1

    def test_cannot_add_line_to_submitted_bid(
        self, authenticated_client, bid_with_lines, open_rfq
    ):
        """Cannot add line to submitted bid."""
        bid_with_lines.submit()
        rfq_line = open_rfq.lines.first()

        response = authenticated_client.post(
            f'/api/v1/rfqs/bids/{bid_with_lines.id}/lines/',
            {
                'rfq_line': str(rfq_line.id),
                'unit_price': '80.00',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestBidComparison:
    """Tests for bid comparison endpoint."""

    def test_compare_bids(self, authenticated_client, open_rfq, bid_with_lines, supplier2, supplier_user):
        """Can compare submitted bids."""
        # Submit first bid
        bid_with_lines.submit()

        # Create and submit second bid
        bid2 = Bid.objects.create(
            rfq=open_rfq,
            supplier=supplier2,
            submitted_by=supplier_user,
        )
        BidLine.objects.create(
            bid=bid2,
            rfq_line=open_rfq.lines.first(),
            unit_price=Decimal('95.00'),
            lead_time_days=3,
        )
        bid2.submit()

        # Close RFQ and compare
        open_rfq.close_bids()

        response = authenticated_client.get(f'/api/v1/rfqs/{open_rfq.id}/compare/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['rfq_number'] == open_rfq.number
        assert len(response.data['lines']) == 1
        assert len(response.data['lines'][0]['bids']) == 2
        assert response.data['summary']['total_bids'] == 2


@pytest.mark.django_db
class TestRFQInvalidTransitions:
    """Tests for invalid workflow transitions via API."""

    def test_cannot_close_draft_rfq(self, authenticated_client, rfq):
        """Cannot close RFQ directly from DRAFT status."""
        response = authenticated_client.post(f'/api/v1/rfqs/{rfq.id}/close_bids/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_award_open_rfq(self, authenticated_client, open_rfq, bid_with_lines):
        """Cannot award RFQ from OPEN status."""
        response = authenticated_client.post(
            f'/api/v1/rfqs/{open_rfq.id}/award/',
            {'bid_id': str(bid_with_lines.id)},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_open_closed_rfq(self, authenticated_client, open_rfq):
        """Cannot open RFQ from CLOSED status."""
        open_rfq.close_bids()

        response = authenticated_client.post(
            f'/api/v1/rfqs/{open_rfq.id}/open_for_bids/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

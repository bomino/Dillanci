"""
API tests for Purchase Order endpoints.

Tests workflow actions and PO management.
"""

import pytest
from decimal import Decimal
from datetime import date

from rest_framework import status
from rest_framework.test import APIClient

from apps.budget.models import BudgetLine, FiscalYear
from apps.organizations.models import Organization
from apps.purchase_orders.models import PurchaseOrder, POLine
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
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def approver_client(api_client, approver):
    """Return an authenticated client for approver."""
    api_client.force_authenticate(user=approver)
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
        allocated_amount=Decimal('50000.00'),
    )


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


@pytest.fixture
def awarded_bid(db, organization, user, supplier):
    """Create an awarded bid for PO creation."""
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


@pytest.mark.django_db
class TestPurchaseOrderViewSet:
    """Tests for /api/v1/purchase-orders/ endpoints."""

    def test_list_purchase_orders(self, authenticated_client, purchase_order):
        """Can list POs in user's organization."""
        response = authenticated_client.get('/api/v1/purchase-orders/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_purchase_order(self, authenticated_client, organization, user, supplier, budget_line):
        """Can create a new PO."""
        response = authenticated_client.post(
            '/api/v1/purchase-orders/',
            {
                'organization': str(organization.id),
                'created_by': str(user.id),
                'supplier': str(supplier.id),
                'budget_line': str(budget_line.id),
                'title': 'New PO',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert PurchaseOrder.objects.filter(title='New PO').exists()

    def test_create_po_with_lines(self, authenticated_client, organization, user, supplier, budget_line):
        """Can create a PO with line items."""
        response = authenticated_client.post(
            '/api/v1/purchase-orders/',
            {
                'organization': str(organization.id),
                'created_by': str(user.id),
                'supplier': str(supplier.id),
                'budget_line': str(budget_line.id),
                'title': 'PO with Lines',
                'lines': [
                    {
                        'description': 'Item 1',
                        'quantity': '5',
                        'unit_price': '100.00',
                        'unit_of_measure': 'EA',
                    },
                    {
                        'description': 'Item 2',
                        'quantity': '10',
                        'unit_price': '50.00',
                    },
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        po = PurchaseOrder.objects.get(title='PO with Lines')
        assert po.lines.count() == 2

    def test_get_po_detail(self, authenticated_client, po_with_line):
        """Can get PO details with lines."""
        response = authenticated_client.get(f'/api/v1/purchase-orders/{po_with_line.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Test PO'
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['lines']) == 1


@pytest.mark.django_db
class TestPurchaseOrderWorkflow:
    """Tests for PO workflow actions."""

    def test_submit_po(self, authenticated_client, po_with_line):
        """DRAFT -> SUBMITTED via submit action."""
        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/submit/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SUBMITTED'

    def test_cannot_submit_empty_po(self, authenticated_client, purchase_order):
        """Cannot submit PO without lines."""
        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{purchase_order.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'line' in response.data['error'].lower()

    def test_approve_po(self, approver_client, po_with_line, approver):
        """SUBMITTED -> APPROVED via approve action."""
        po_with_line.submit()

        response = approver_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/approve/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED'
        assert str(response.data['approved_by']) == str(approver.id)

    def test_reject_po(self, approver_client, po_with_line, approver):
        """SUBMITTED -> REJECTED via reject action."""
        po_with_line.submit()

        response = approver_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/reject/',
            {'reason': 'Budget concerns'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'REJECTED'
        assert response.data['rejection_reason'] == 'Budget concerns'

    def test_revise_rejected_po(self, authenticated_client, po_with_line, approver):
        """REJECTED -> DRAFT via revise action."""
        po_with_line.submit()
        po_with_line.reject(rejected_by=approver, reason='Budget concerns')

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/revise/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'

    def test_send_po(self, authenticated_client, po_with_line, approver):
        """APPROVED -> SENT via send action."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/send/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SENT'

    def test_receive_po(self, authenticated_client, po_with_line, approver):
        """SENT -> RECEIVED via receive action."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/receive/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'RECEIVED'

    def test_complete_po(self, authenticated_client, po_with_line, approver):
        """RECEIVED -> COMPLETED via complete action."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        po_with_line.receive()

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/complete/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'COMPLETED'

    def test_cancel_po(self, authenticated_client, purchase_order):
        """DRAFT -> CANCELLED via cancel action."""
        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{purchase_order.id}/cancel/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'


@pytest.mark.django_db
class TestPOLines:
    """Tests for PO line management via API."""

    def test_get_po_lines(self, authenticated_client, po_with_line):
        """Can get lines for a PO."""
        response = authenticated_client.get(
            f'/api/v1/purchase-orders/{po_with_line.id}/lines/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['description'] == 'Test Item'

    def test_add_line_to_draft_po(self, authenticated_client, purchase_order):
        """Can add line to draft PO."""
        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{purchase_order.id}/lines/',
            {
                'description': 'New Item',
                'quantity': '5',
                'unit_price': '200.00',
                'unit_of_measure': 'EA',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert purchase_order.lines.count() == 1

    def test_cannot_add_line_to_submitted_po(self, authenticated_client, po_with_line):
        """Cannot add line to non-draft PO."""
        po_with_line.submit()

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/lines/',
            {
                'description': 'Another Item',
                'quantity': '1',
                'unit_price': '100.00',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestCreatePOFromBid:
    """Tests for creating PO from awarded bid."""

    def test_create_po_from_bid(self, authenticated_client, awarded_bid, budget_line):
        """Can create PO from awarded bid."""
        response = authenticated_client.post(
            '/api/v1/purchase-orders/create_from_bid/',
            {
                'bid_id': str(awarded_bid.id),
                'budget_line_id': str(budget_line.id),
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert str(response.data['supplier']) == str(awarded_bid.supplier.id)
        assert len(response.data['lines']) == 1

    def test_create_po_from_non_awarded_bid_fails(
        self, authenticated_client, organization, user, supplier, budget_line
    ):
        """Cannot create PO from non-awarded bid."""
        rfq = RFQ.objects.create(
            organization=organization,
            created_by=user,
            title='Test RFQ',
        )
        RFQLine.objects.create(
            rfq=rfq,
            description='Test Item',
            quantity=Decimal('5'),
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

        response = authenticated_client.post(
            '/api/v1/purchase-orders/create_from_bid/',
            {
                'bid_id': str(bid.id),
                'budget_line_id': str(budget_line.id),
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'awarded' in response.data['error'].lower()


@pytest.mark.django_db
class TestPOInvalidTransitions:
    """Tests for invalid PO state transitions via API."""

    def test_cannot_approve_draft(self, authenticated_client, po_with_line):
        """Cannot approve directly from DRAFT."""
        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/approve/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_send_submitted(self, authenticated_client, po_with_line):
        """Cannot send from SUBMITTED (must approve first)."""
        po_with_line.submit()

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/send/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_cancel_completed(self, authenticated_client, po_with_line, approver):
        """Cannot cancel a completed PO."""
        po_with_line.submit()
        po_with_line.approve(approved_by=approver)
        po_with_line.send()
        po_with_line.receive()
        po_with_line.complete()

        response = authenticated_client.post(
            f'/api/v1/purchase-orders/{po_with_line.id}/cancel/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

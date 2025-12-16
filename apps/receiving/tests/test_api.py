"""
API tests for Goods Receipt endpoints.

Tests workflow actions and GR management.
"""

import pytest
from decimal import Decimal
from datetime import date

from rest_framework import status
from rest_framework.test import APIClient

from apps.budget.models import BudgetLine, FiscalYear
from apps.organizations.models import Organization
from apps.purchase_orders.models import PurchaseOrder, POLine
from apps.receiving.models import GoodsReceipt, GoodsReceiptLine
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
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
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
def sent_po(db, organization, user, supplier, budget_line):
    """Create a PO in SENT status ready for receiving."""
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


@pytest.mark.django_db
class TestGoodsReceiptViewSet:
    """Tests for /api/v1/receiving/ endpoints."""

    def test_list_goods_receipts(self, authenticated_client, goods_receipt):
        """Can list GRs in user's organization."""
        response = authenticated_client.get('/api/v1/receiving/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_goods_receipt(
        self, authenticated_client, organization, sent_po, user
    ):
        """Can create a new GR."""
        response = authenticated_client.post(
            '/api/v1/receiving/',
            {
                'organization': str(organization.id),
                'purchase_order': str(sent_po.id),
                'received_by': str(user.id),
                'receipt_date': '2025-12-15',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert GoodsReceipt.objects.filter(purchase_order=sent_po).count() == 1

    def test_create_gr_with_lines(
        self, authenticated_client, organization, sent_po, user
    ):
        """Can create a GR with line items."""
        po_line = sent_po.lines.first()
        response = authenticated_client.post(
            '/api/v1/receiving/',
            {
                'organization': str(organization.id),
                'purchase_order': str(sent_po.id),
                'received_by': str(user.id),
                'receipt_date': '2025-12-15',
                'lines': [
                    {
                        'po_line': str(po_line.id),
                        'quantity_received': '10',
                    },
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        gr = GoodsReceipt.objects.get(id=response.data['id'])
        assert gr.lines.count() == 1

    def test_get_gr_detail(self, authenticated_client, gr_with_line):
        """Can get GR details with lines."""
        response = authenticated_client.get(
            f'/api/v1/receiving/{gr_with_line.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['lines']) == 1


@pytest.mark.django_db
class TestGoodsReceiptWorkflow:
    """Tests for GR workflow actions."""

    def test_post_gr(self, authenticated_client, gr_with_line):
        """DRAFT -> POSTED via post action."""
        response = authenticated_client.post(
            f'/api/v1/receiving/{gr_with_line.id}/post/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'POSTED'

    def test_post_gr_updates_po_line(self, authenticated_client, gr_with_line, sent_po):
        """Posting GR updates PO line quantity_received."""
        po_line = sent_po.lines.first()
        assert po_line.quantity_received == Decimal('0.00')

        authenticated_client.post(f'/api/v1/receiving/{gr_with_line.id}/post/')

        po_line.refresh_from_db()
        assert po_line.quantity_received == Decimal('10')

    def test_cancel_gr(self, authenticated_client, goods_receipt):
        """DRAFT -> CANCELLED via cancel action."""
        response = authenticated_client.post(
            f'/api/v1/receiving/{goods_receipt.id}/cancel/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'

    def test_cannot_post_over_quantity(
        self, authenticated_client, goods_receipt, sent_po
    ):
        """Cannot post GR with quantity exceeding PO."""
        po_line = sent_po.lines.first()
        GoodsReceiptLine.objects.create(
            goods_receipt=goods_receipt,
            po_line=po_line,
            quantity_received=Decimal('15'),  # PO qty is 10
        )

        response = authenticated_client.post(
            f'/api/v1/receiving/{goods_receipt.id}/post/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'exceed' in response.data['error'].lower()


@pytest.mark.django_db
class TestGRLines:
    """Tests for GR line management via API."""

    def test_get_gr_lines(self, authenticated_client, gr_with_line):
        """Can get lines for a GR."""
        response = authenticated_client.get(
            f'/api/v1/receiving/{gr_with_line.id}/lines/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_add_line_to_draft_gr(self, authenticated_client, goods_receipt, sent_po):
        """Can add line to draft GR."""
        po_line = sent_po.lines.first()
        response = authenticated_client.post(
            f'/api/v1/receiving/{goods_receipt.id}/lines/',
            {
                'po_line': str(po_line.id),
                'quantity_received': '5',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert goods_receipt.lines.count() == 1

    def test_cannot_add_line_to_posted_gr(self, authenticated_client, gr_with_line, sent_po):
        """Cannot add line to posted GR."""
        gr_with_line.post()
        po_line = sent_po.lines.first()

        response = authenticated_client.post(
            f'/api/v1/receiving/{gr_with_line.id}/lines/',
            {
                'po_line': str(po_line.id),
                'quantity_received': '1',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestGRInvalidTransitions:
    """Tests for invalid GR state transitions via API."""

    def test_cannot_cancel_posted(self, authenticated_client, gr_with_line):
        """Cannot cancel a posted GR."""
        gr_with_line.post()

        response = authenticated_client.post(
            f'/api/v1/receiving/{gr_with_line.id}/cancel/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_post_twice(self, authenticated_client, gr_with_line):
        """Cannot post an already posted GR."""
        gr_with_line.post()

        response = authenticated_client.post(
            f'/api/v1/receiving/{gr_with_line.id}/post/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

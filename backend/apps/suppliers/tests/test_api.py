"""
API tests for Supplier endpoints.

Tests CRUD operations and state transition actions.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Organization
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
    """Create a test supplier in PROSPECT status."""
    return Supplier.objects.create(
        name='Test Supplier',
        code='SUP001',
        organization=organization,
        contact_name='John Contact',
        contact_email='contact@supplier.com',
    )


@pytest.mark.django_db
class TestSupplierViewSet:
    """Tests for /api/v1/suppliers/ endpoints."""

    def test_list_suppliers(self, authenticated_client, supplier):
        """Can list suppliers in user's organization."""
        response = authenticated_client.get('/api/v1/suppliers/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Test Supplier'

    def test_create_supplier(self, authenticated_client, organization):
        """Can create a new supplier."""
        response = authenticated_client.post(
            '/api/v1/suppliers/',
            {
                'name': 'New Supplier',
                'code': 'SUP002',
                'organization': str(organization.id),
                'contact_email': 'new@supplier.com',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Supplier.objects.filter(code='SUP002').exists()

    def test_get_supplier_detail(self, authenticated_client, supplier):
        """Can get supplier details."""
        response = authenticated_client.get(f'/api/v1/suppliers/{supplier.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Test Supplier'
        assert response.data['status'] == 'PROSPECT'

    def test_update_supplier(self, authenticated_client, supplier):
        """Can update supplier information."""
        response = authenticated_client.patch(
            f'/api/v1/suppliers/{supplier.id}/',
            {'contact_name': 'Jane Contact'},
        )
        assert response.status_code == status.HTTP_200_OK
        supplier.refresh_from_db()
        assert supplier.contact_name == 'Jane Contact'


@pytest.mark.django_db
class TestSupplierStateTransitions:
    """Tests for supplier state transition actions."""

    def test_submit_for_review(self, authenticated_client, supplier):
        """PROSPECT -> PENDING_REVIEW via submit_for_review action."""
        assert supplier.status == 'PROSPECT'

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/submit_for_review/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'PENDING_REVIEW'

        supplier.refresh_from_db()
        assert supplier.status == 'PENDING_REVIEW'

    def test_approve_supplier(self, authenticated_client, supplier):
        """PENDING_REVIEW -> APPROVED via approve action."""
        supplier.submit_for_review()

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/approve/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED'

        supplier.refresh_from_db()
        assert supplier.status == 'APPROVED'
        assert supplier.approved_at is not None

    def test_reject_supplier(self, authenticated_client, supplier):
        """PENDING_REVIEW -> REJECTED via reject action."""
        supplier.submit_for_review()

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/reject/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'REJECTED'

    def test_block_approved_supplier(self, authenticated_client, supplier):
        """APPROVED -> BLOCKED via block action."""
        supplier.submit_for_review()
        supplier.approve()

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/block/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'BLOCKED'

    def test_unblock_supplier(self, authenticated_client, supplier):
        """BLOCKED -> APPROVED via unblock action."""
        supplier.submit_for_review()
        supplier.approve()
        supplier.block()

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/unblock/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED'

    def test_resubmit_rejected_supplier(self, authenticated_client, supplier):
        """REJECTED -> PROSPECT via resubmit action."""
        supplier.submit_for_review()
        supplier.reject()

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/resubmit/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'PROSPECT'


@pytest.mark.django_db
class TestSupplierInvalidTransitions:
    """Tests for invalid state transitions via API."""

    def test_cannot_approve_prospect(self, authenticated_client, supplier):
        """Cannot approve directly from PROSPECT status."""
        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/approve/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    def test_cannot_block_prospect(self, authenticated_client, supplier):
        """Cannot block from PROSPECT status."""
        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/block/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_submit_approved_for_review(self, authenticated_client, supplier):
        """Cannot submit approved supplier for review."""
        supplier.submit_for_review()
        supplier.approve()

        response = authenticated_client.post(
            f'/api/v1/suppliers/{supplier.id}/submit_for_review/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

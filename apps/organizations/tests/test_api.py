"""
API tests for Organization endpoints.

Tests for organization viewset including status actions.
"""

import pytest

from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Organization
from apps.users.models import User


@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001', status='ACTIVE')


@pytest.fixture
def other_organization(db):
    """Create another organization."""
    return Organization.objects.create(name='Other Org', code='OTHER001', status='ACTIVE')


@pytest.fixture
def user(db, organization):
    """Create a regular user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def user_without_org(db):
    """Create a user without organization."""
    return User.objects.create_user(
        email='noorg@example.com',
        password='testpass123',
        first_name='No',
        last_name='Org',
        organization=None,
    )


@pytest.fixture
def admin_user(db, organization):
    """Create an admin user."""
    return User.objects.create_superuser(
        email='admin@example.com',
        password='adminpass123',
        first_name='Admin',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def noorg_client(api_client, user_without_org):
    """Return an authenticated client for user without org."""
    api_client.force_authenticate(user=user_without_org)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    """Return an authenticated admin API client."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.mark.django_db
class TestOrganizationViewSet:
    """Tests for /api/v1/organizations/ endpoints."""

    def test_list_organizations_regular_user(self, authenticated_client, organization, other_organization):
        """Regular user can only see their own organization."""
        response = authenticated_client.get('/api/v1/organizations/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Test Org'

    def test_list_organizations_admin(self, admin_client, organization, other_organization):
        """Admin user can see all organizations."""
        response = admin_client.get('/api/v1/organizations/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2

    def test_list_organizations_user_without_org(self, noorg_client, organization):
        """User without organization sees no organizations."""
        response = noorg_client.get('/api/v1/organizations/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 0

    def test_get_organization_detail(self, authenticated_client, organization):
        """Regular user can get their organization details."""
        response = authenticated_client.get(f'/api/v1/organizations/{organization.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Test Org'
        assert response.data['code'] == 'TEST001'

    def test_update_organization(self, authenticated_client, organization):
        """Can update organization details."""
        response = authenticated_client.patch(
            f'/api/v1/organizations/{organization.id}/',
            {'name': 'Updated Org Name'},
        )
        assert response.status_code == status.HTTP_200_OK
        organization.refresh_from_db()
        assert organization.name == 'Updated Org Name'


@pytest.mark.django_db
class TestOrganizationAdminActions:
    """Tests for admin-only organization actions."""

    def test_create_organization_admin(self, admin_client):
        """Admin can create a new organization."""
        response = admin_client.post(
            '/api/v1/organizations/',
            {
                'name': 'New Organization',
                'code': 'NEW001',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Organization.objects.filter(code='NEW001').exists()

    def test_create_organization_regular_user_forbidden(self, authenticated_client):
        """Regular user cannot create organizations."""
        response = authenticated_client.post(
            '/api/v1/organizations/',
            {
                'name': 'New Organization',
                'code': 'NEW001',
            },
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_organization_admin(self, admin_client, other_organization):
        """Admin can delete an organization."""
        response = admin_client.delete(f'/api/v1/organizations/{other_organization.id}/')
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_organization_regular_user_forbidden(self, authenticated_client, organization):
        """Regular user cannot delete organizations."""
        response = authenticated_client.delete(f'/api/v1/organizations/{organization.id}/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_activate_organization(self, admin_client, organization):
        """Admin can activate an organization."""
        organization.status = 'INACTIVE'
        organization.save()

        response = admin_client.post(f'/api/v1/organizations/{organization.id}/activate/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'ACTIVE'

        organization.refresh_from_db()
        assert organization.status == 'ACTIVE'

    def test_deactivate_organization(self, admin_client, organization):
        """Admin can deactivate an organization."""
        response = admin_client.post(f'/api/v1/organizations/{organization.id}/deactivate/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'INACTIVE'

        organization.refresh_from_db()
        assert organization.status == 'INACTIVE'

    def test_suspend_organization(self, admin_client, organization):
        """Admin can suspend an organization."""
        response = admin_client.post(f'/api/v1/organizations/{organization.id}/suspend/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SUSPENDED'

        organization.refresh_from_db()
        assert organization.status == 'SUSPENDED'

    def test_activate_action_regular_user_forbidden(self, authenticated_client, organization):
        """Regular user cannot activate organizations."""
        organization.status = 'INACTIVE'
        organization.save()

        response = authenticated_client.post(f'/api/v1/organizations/{organization.id}/activate/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_deactivate_action_regular_user_forbidden(self, authenticated_client, organization):
        """Regular user cannot deactivate organizations."""
        response = authenticated_client.post(f'/api/v1/organizations/{organization.id}/deactivate/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_suspend_action_regular_user_forbidden(self, authenticated_client, organization):
        """Regular user cannot suspend organizations."""
        response = authenticated_client.post(f'/api/v1/organizations/{organization.id}/suspend/')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestOrganizationFiltering:
    """Tests for organization filtering and search."""

    def test_filter_by_status(self, admin_client, organization, other_organization):
        """Admin can filter organizations by status."""
        other_organization.status = 'INACTIVE'
        other_organization.save()

        response = admin_client.get('/api/v1/organizations/?status=ACTIVE')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['status'] == 'ACTIVE'

    def test_search_organizations(self, admin_client, organization, other_organization):
        """Admin can search organizations by name."""
        response = admin_client.get('/api/v1/organizations/?search=Other')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Other Org'

    def test_search_by_code(self, admin_client, organization, other_organization):
        """Admin can search organizations by code."""
        response = admin_client.get('/api/v1/organizations/?search=TEST001')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['code'] == 'TEST001'

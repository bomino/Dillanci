"""
API tests for User endpoints.

Tests authentication, user management, and permissions.
"""

import pytest
from django.urls import reverse
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
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def user(db, organization):
    """Create a regular test user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def admin_user(db, organization):
    """Create an admin test user."""
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
def admin_client(api_client, admin_user):
    """Return an admin authenticated API client."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.mark.django_db
class TestLoginEndpoint:
    """Tests for /api/v1/users/auth/login/"""

    def test_login_with_valid_credentials(self, api_client, user):
        """Successful login returns user data."""
        response = api_client.post(
            '/api/v1/users/auth/login/',
            {'email': 'user@example.com', 'password': 'testpass123'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user']['email'] == 'user@example.com'
        assert 'message' in response.data

    def test_login_with_invalid_password(self, api_client, user):
        """Login fails with wrong password."""
        response = api_client.post(
            '/api/v1/users/auth/login/',
            {'email': 'user@example.com', 'password': 'wrongpassword'},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_with_nonexistent_user(self, api_client):
        """Login fails for non-existent user."""
        response = api_client.post(
            '/api/v1/users/auth/login/',
            {'email': 'nobody@example.com', 'password': 'testpass123'},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_with_suspended_user(self, api_client, user):
        """Login fails for suspended user."""
        user.status = 'SUSPENDED'
        user.save()

        response = api_client.post(
            '/api/v1/users/auth/login/',
            {'email': 'user@example.com', 'password': 'testpass123'},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMeEndpoint:
    """Tests for /api/v1/users/auth/me/"""

    def test_get_current_user(self, authenticated_client, user):
        """Returns current authenticated user's data."""
        response = authenticated_client.get('/api/v1/users/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == user.email
        assert response.data['full_name'] == user.full_name

    def test_unauthenticated_request(self, api_client):
        """Unauthenticated requests are rejected."""
        response = api_client.get('/api/v1/users/auth/me/')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestUserViewSet:
    """Tests for /api/v1/users/ (admin only)"""

    def test_list_users_requires_admin(self, authenticated_client):
        """Regular users cannot list all users."""
        response = authenticated_client.get('/api/v1/users/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_list_users(self, admin_client, user, admin_user):
        """Admin can list all users."""
        response = admin_client.get('/api/v1/users/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 2

    def test_admin_can_create_user(self, admin_client, organization):
        """Admin can create new users."""
        response = admin_client.post(
            '/api/v1/users/',
            {
                'email': 'newuser@example.com',
                'password': 'newpass123',
                'first_name': 'New',
                'last_name': 'User',
                'organization': str(organization.id),
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(email='newuser@example.com').exists()

    def test_admin_can_deactivate_user(self, admin_client, user):
        """Admin can deactivate a user."""
        response = admin_client.post(f'/api/v1/users/{user.id}/deactivate/')
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.status == 'INACTIVE'
        assert user.is_active is False

    def test_admin_can_activate_user(self, admin_client, user):
        """Admin can activate a user."""
        user.status = 'INACTIVE'
        user.is_active = False
        user.save()

        response = admin_client.post(f'/api/v1/users/{user.id}/activate/')
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.status == 'ACTIVE'
        assert user.is_active is True

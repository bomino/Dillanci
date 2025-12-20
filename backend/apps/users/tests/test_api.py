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
    """Tests for /api/v1/auth/login/"""

    def test_login_with_valid_credentials(self, api_client, user):
        """Successful login returns user data."""
        response = api_client.post(
            '/api/v1/auth/login/',
            {'email': 'user@example.com', 'password': 'testpass123'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user']['email'] == 'user@example.com'
        assert 'message' in response.data

    def test_login_with_invalid_password(self, api_client, user):
        """Login fails with wrong password."""
        response = api_client.post(
            '/api/v1/auth/login/',
            {'email': 'user@example.com', 'password': 'wrongpassword'},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_with_nonexistent_user(self, api_client):
        """Login fails for non-existent user."""
        response = api_client.post(
            '/api/v1/auth/login/',
            {'email': 'nobody@example.com', 'password': 'testpass123'},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_with_suspended_user(self, api_client, user):
        """Login fails for suspended user."""
        user.status = 'SUSPENDED'
        user.save()

        response = api_client.post(
            '/api/v1/auth/login/',
            {'email': 'user@example.com', 'password': 'testpass123'},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMeEndpoint:
    """Tests for /api/v1/auth/me/"""

    def test_get_current_user(self, authenticated_client, user):
        """Returns current authenticated user's data."""
        response = authenticated_client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == user.email
        assert response.data['full_name'] == user.full_name

    def test_unauthenticated_request(self, api_client):
        """Unauthenticated requests are rejected."""
        response = api_client.get('/api/v1/auth/me/')
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

    def test_admin_can_suspend_user(self, admin_client, user):
        """Admin can suspend a user."""
        response = admin_client.post(f'/api/v1/users/{user.id}/suspend/')
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.status == 'SUSPENDED'

    def test_admin_can_get_user_roles(self, admin_client, user):
        """Admin can get user's role assignments."""
        response = admin_client.get(f'/api/v1/users/{user.id}/roles/')
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data

    def test_admin_can_get_user_permissions(self, admin_client, user):
        """Admin can get user's effective permissions."""
        response = admin_client.get(f'/api/v1/users/{user.id}/permissions/')
        assert response.status_code == status.HTTP_200_OK
        assert 'permissions' in response.data

    def test_admin_can_filter_users_by_status(self, admin_client, user, admin_user):
        """Admin can filter users by status."""
        response = admin_client.get('/api/v1/users/?status=ACTIVE')
        assert response.status_code == status.HTTP_200_OK
        for u in response.data['results']:
            assert u['status'] == 'ACTIVE'

    def test_admin_can_filter_users_by_organization(self, admin_client, organization, user):
        """Admin can filter users by organization."""
        response = admin_client.get(f'/api/v1/users/?organization={organization.id}')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestLogoutEndpoint:
    """Tests for /api/v1/auth/logout/"""

    def test_logout_success(self, authenticated_client):
        """Authenticated user can logout."""
        response = authenticated_client.post('/api/v1/auth/logout/')
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data

    def test_logout_requires_auth(self, api_client):
        """Logout requires authentication."""
        response = api_client.post('/api/v1/auth/logout/')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestPasswordChangeEndpoint:
    """Tests for /api/v1/auth/password/"""

    def test_change_password_success(self, authenticated_client, user):
        """User can change their password with valid data."""
        response = authenticated_client.post(
            '/api/v1/auth/password/',
            {
                'old_password': 'testpass123',
                'new_password': 'NewSecure123!',
            },
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data

    def test_change_password_wrong_current(self, authenticated_client, user):
        """Password change fails with wrong current password."""
        response = authenticated_client.post(
            '/api/v1/auth/password/',
            {
                'old_password': 'wrongpassword',
                'new_password': 'NewSecure123!',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_too_short(self, authenticated_client, user):
        """Password change fails when new password too short."""
        response = authenticated_client.post(
            '/api/v1/auth/password/',
            {
                'old_password': 'testpass123',
                'new_password': 'short',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_requires_auth(self, api_client):
        """Password change requires authentication."""
        response = api_client.post(
            '/api/v1/auth/password/',
            {
                'old_password': 'testpass123',
                'new_password': 'NewSecure123!',
            },
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestMeEndpointPatch:
    """Tests for PATCH /api/v1/auth/me/"""

    def test_update_profile(self, authenticated_client, user):
        """User can update their own profile."""
        response = authenticated_client.patch(
            '/api/v1/auth/me/',
            {'first_name': 'Updated', 'last_name': 'Name'},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == 'Updated'
        assert user.last_name == 'Name'


@pytest.mark.django_db
class TestRoleViewSet:
    """Tests for /api/v1/roles/"""

    @pytest.fixture
    def role(self, db, organization):
        """Create a test role."""
        from apps.users.models import Role
        return Role.objects.create(
            organization=organization,
            name='Test Role',
            code='TEST_ROLE',
            permissions=['requisition.view', 'requisition.create'],
        )

    def test_list_roles_requires_auth(self, api_client):
        """Role list requires authentication."""
        response = api_client.get('/api/v1/roles/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_list_roles(self, admin_client, role):
        """Admin user can list roles."""
        response = admin_client.get('/api/v1/roles/')
        assert response.status_code == status.HTTP_200_OK

    def test_admin_can_create_role(self, admin_client, organization):
        """Admin can create a new role."""
        response = admin_client.post(
            '/api/v1/roles/',
            {
                'organization': str(organization.id),
                'name': 'New Role',
                'code': 'NEW_ROLE',
                'permissions': ['requisition.view'],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_get_role_presets(self, admin_client):
        """Admin can get role presets."""
        response = admin_client.get('/api/v1/roles/presets/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) > 0

    def test_get_permissions_list(self, admin_client):
        """Admin can get available permissions."""
        response = admin_client.get('/api/v1/roles/permissions/')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestRoleAssignment:
    """Tests for role assignment endpoints."""

    @pytest.fixture
    def role(self, db, organization):
        """Create a test role."""
        from apps.users.models import Role
        return Role.objects.create(
            organization=organization,
            name='Test Role',
            code='TEST_ROLE',
            permissions=['requisition.view'],
        )

    def test_assign_role_to_user(self, admin_client, user, role):
        """Admin can assign a role to a user."""
        response = admin_client.post(
            f'/api/v1/users/{user.id}/assign-role/',
            {'role_id': str(role.id)},
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_assign_duplicate_role_fails(self, admin_client, user, role):
        """Assigning the same role twice fails."""
        # First assignment
        admin_client.post(
            f'/api/v1/users/{user.id}/assign-role/',
            {'role_id': str(role.id)},
            format='json',
        )
        # Second assignment should fail
        response = admin_client.post(
            f'/api/v1/users/{user.id}/assign-role/',
            {'role_id': str(role.id)},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_remove_role_from_user(self, admin_client, user, role):
        """Admin can remove a role from a user."""
        # First assign the role
        admin_client.post(
            f'/api/v1/users/{user.id}/assign-role/',
            {'role_id': str(role.id)},
            format='json',
        )
        # Then remove it
        response = admin_client.post(
            f'/api/v1/users/{user.id}/remove-role/',
            {'role_id': str(role.id)},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK

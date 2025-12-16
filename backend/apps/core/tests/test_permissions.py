"""
Tests for custom permissions.
"""

import pytest
from unittest.mock import Mock

from apps.core.permissions import IsOrganizationMember, IsOwnerOrReadOnly
from apps.organizations.models import Organization
from apps.users.models import User


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def other_organization(db):
    """Create another organization."""
    return Organization.objects.create(name='Other Org', code='OTHER001')


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
def other_user(db, other_organization):
    """Create a user in a different organization."""
    return User.objects.create_user(
        email='other@example.com',
        password='testpass123',
        first_name='Other',
        last_name='User',
        organization=other_organization,
    )


class MockRequest:
    """Mock request object for permission tests."""

    def __init__(self, user, method='GET'):
        self.user = user
        self.method = method


class MockObject:
    """Mock object for permission tests."""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.mark.django_db
class TestIsOrganizationMember:
    """Tests for IsOrganizationMember permission."""

    def test_same_organization_via_organization_field(self, user, organization):
        """User can access object in same organization (organization field)."""
        permission = IsOrganizationMember()
        request = MockRequest(user)
        obj = MockObject(organization=organization)

        assert permission.has_object_permission(request, None, obj) is True

    def test_different_organization_via_organization_field(self, user, other_organization):
        """User cannot access object in different organization (organization field)."""
        permission = IsOrganizationMember()
        request = MockRequest(user)
        obj = MockObject(organization=other_organization)

        assert permission.has_object_permission(request, None, obj) is False

    def test_same_organization_via_organization_id(self, user, organization):
        """User can access object in same organization (organization_id field)."""
        permission = IsOrganizationMember()
        request = MockRequest(user)
        obj = MockObject(organization_id=organization.id)

        assert permission.has_object_permission(request, None, obj) is True

    def test_different_organization_via_organization_id(self, user, other_organization):
        """User cannot access object in different organization (organization_id field)."""
        permission = IsOrganizationMember()
        request = MockRequest(user)
        obj = MockObject(organization_id=other_organization.id)

        assert permission.has_object_permission(request, None, obj) is False

    def test_object_without_organization_field(self, user):
        """Objects without organization field are accessible."""
        permission = IsOrganizationMember()
        request = MockRequest(user)
        obj = MockObject(name='Test')  # No organization field

        assert permission.has_object_permission(request, None, obj) is True


@pytest.mark.django_db
class TestIsOwnerOrReadOnly:
    """Tests for IsOwnerOrReadOnly permission."""

    def test_owner_can_read(self, user):
        """Owner can read their own objects."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='GET')
        obj = MockObject(owner=user)

        assert permission.has_object_permission(request, None, obj) is True

    def test_owner_can_write(self, user):
        """Owner can write to their own objects."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='PUT')
        obj = MockObject(owner=user)

        assert permission.has_object_permission(request, None, obj) is True

    def test_non_owner_can_read(self, user, other_user):
        """Non-owner can read objects."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='GET')
        obj = MockObject(owner=other_user)

        assert permission.has_object_permission(request, None, obj) is True

    def test_non_owner_cannot_write(self, user, other_user):
        """Non-owner cannot write to objects."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='PUT')
        obj = MockObject(owner=other_user)

        assert permission.has_object_permission(request, None, obj) is False

    def test_created_by_can_write(self, user):
        """Creator can write to objects (via created_by field)."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='DELETE')
        obj = MockObject(created_by=user)

        assert permission.has_object_permission(request, None, obj) is True

    def test_non_creator_cannot_write(self, user, other_user):
        """Non-creator cannot write to objects (via created_by field)."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='DELETE')
        obj = MockObject(created_by=other_user)

        assert permission.has_object_permission(request, None, obj) is False

    def test_object_without_owner_allows_all(self, user):
        """Objects without owner/created_by allow all operations."""
        permission = IsOwnerOrReadOnly()
        request = MockRequest(user, method='DELETE')
        obj = MockObject(name='Test')  # No owner field

        assert permission.has_object_permission(request, None, obj) is True

    def test_safe_methods(self, user, other_user):
        """Safe methods (GET, HEAD, OPTIONS) are always allowed."""
        permission = IsOwnerOrReadOnly()
        obj = MockObject(owner=other_user)

        for method in ['GET', 'HEAD', 'OPTIONS']:
            request = MockRequest(user, method=method)
            assert permission.has_object_permission(request, None, obj) is True

    def test_unsafe_methods_require_ownership(self, user, other_user):
        """Unsafe methods (POST, PUT, PATCH, DELETE) require ownership."""
        permission = IsOwnerOrReadOnly()
        obj = MockObject(owner=other_user)

        for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            request = MockRequest(user, method=method)
            assert permission.has_object_permission(request, None, obj) is False

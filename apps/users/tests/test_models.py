"""
Tests for User model.

Following TDD: Verifying the custom User model works correctly.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.organizations.models import Organization

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    """Tests for custom User model."""

    def test_create_user_with_email(self):
        """Users should be created with email as username."""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        assert user.email == 'test@example.com'
        assert user.check_password('testpass123')

    def test_email_is_normalized(self):
        """Email should be normalized (lowercase domain)."""
        user = User.objects.create_user(
            email='Test@EXAMPLE.COM',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        assert user.email == 'Test@example.com'

    def test_email_required(self):
        """Creating user without email should raise error."""
        with pytest.raises(ValueError, match='Email'):
            User.objects.create_user(
                email='',
                password='testpass123',
                first_name='Test',
                last_name='User',
            )

    def test_user_has_uuid_id(self):
        """User should use UUID as primary key."""
        user = User.objects.create_user(
            email='uuid@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        assert len(str(user.id)) == 36

    def test_full_name_property(self):
        """full_name should combine first and last name."""
        user = User.objects.create_user(
            email='name@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe',
        )
        assert user.full_name == 'John Doe'

    def test_user_string_representation(self):
        """User string representation should be email."""
        user = User.objects.create_user(
            email='str@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        assert str(user) == 'str@example.com'

    def test_user_default_status_is_active(self):
        """New users should have ACTIVE status by default."""
        user = User.objects.create_user(
            email='status@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        assert user.status == 'ACTIVE'

    def test_user_can_be_linked_to_organization(self):
        """User can be associated with an organization."""
        org = Organization.objects.create(name='Test Org', code='ORG001')
        user = User.objects.create_user(
            email='org@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
            organization=org,
        )
        assert user.organization == org
        assert user in org.users.all()


@pytest.mark.django_db
class TestUserManager:
    """Tests for custom UserManager."""

    def test_create_superuser(self):
        """create_superuser should create user with correct flags."""
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
            first_name='Admin',
            last_name='User',
        )
        assert admin.is_staff is True
        assert admin.is_superuser is True

    def test_create_superuser_requires_is_staff(self):
        """create_superuser should fail if is_staff=False."""
        with pytest.raises(ValueError, match='is_staff'):
            User.objects.create_superuser(
                email='bad_admin@example.com',
                password='adminpass123',
                first_name='Bad',
                last_name='Admin',
                is_staff=False,
            )

    def test_create_superuser_requires_is_superuser(self):
        """create_superuser should fail if is_superuser=False."""
        with pytest.raises(ValueError, match='is_superuser'):
            User.objects.create_superuser(
                email='bad_super@example.com',
                password='adminpass123',
                first_name='Bad',
                last_name='Super',
                is_superuser=False,
            )


@pytest.mark.django_db
class TestUserSoftDelete:
    """Tests for User soft delete functionality."""

    def test_user_inherits_soft_delete(self):
        """User should have soft_delete and restore methods."""
        user = User.objects.create_user(
            email='delete@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        user.soft_delete()
        assert user.is_deleted is True
        assert user.deleted_at is not None

    def test_soft_deleted_user_can_be_restored(self):
        """Soft-deleted users can be restored."""
        user = User.objects.create_user(
            email='restore@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        user.soft_delete()
        user.restore()
        assert user.is_deleted is False
        assert user.deleted_at is None

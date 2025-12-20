"""
Tests for User admin configuration.
"""

import pytest
from decimal import Decimal
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory
from django.utils import timezone

from apps.users.admin import (
    UserAdmin,
    RoleAdmin,
    UserRoleAdmin,
    RoleChangeLogAdmin,
    UserCreationForm,
    UserChangeForm,
    RoleForm,
)
from apps.users.models import User, Role, UserRole, RoleChangeLog, Permissions

from tests.factories import (
    AdminUserFactory,
    OrganizationFactory,
    UserFactory,
)


@pytest.fixture
def admin_site():
    """Create an admin site for testing."""
    return AdminSite()


@pytest.fixture
def request_factory():
    """Create a request factory for testing."""
    return RequestFactory()


@pytest.fixture
def admin_request(request_factory, admin_user):
    """Create a mock admin request."""
    request = request_factory.get('/admin/')
    request.user = admin_user

    # Add message storage
    setattr(request, 'session', 'session')
    messages = FallbackStorage(request)
    setattr(request, '_messages', messages)

    return request


@pytest.fixture
def admin_user(db):
    """Create an admin user for testing."""
    return AdminUserFactory()


@pytest.mark.django_db
class TestUserCreationForm:
    """Tests for UserCreationForm."""

    def test_valid_form(self):
        """Should accept valid user data."""
        org = OrganizationFactory()
        form = UserCreationForm(data={
            'email': 'newuser@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'organization': org.id,
            'password1': 'testpass123',
            'password2': 'testpass123',
        })

        assert form.is_valid(), form.errors

    def test_password_mismatch(self):
        """Should reject mismatched passwords."""
        org = OrganizationFactory()
        form = UserCreationForm(data={
            'email': 'newuser@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'organization': org.id,
            'password1': 'testpass123',
            'password2': 'differentpass',
        })

        assert not form.is_valid()
        assert 'password2' in form.errors

    def test_save_creates_user_with_hashed_password(self):
        """Should save user with properly hashed password."""
        org = OrganizationFactory()
        form = UserCreationForm(data={
            'email': 'newuser@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'organization': org.id,
            'password1': 'testpass123',
            'password2': 'testpass123',
        })

        assert form.is_valid()
        user = form.save()

        assert user.check_password('testpass123')
        assert not user.password == 'testpass123'  # Should be hashed


@pytest.mark.django_db
class TestRoleForm:
    """Tests for RoleForm."""

    def test_form_fields(self):
        """RoleForm should have expected fields."""
        form = RoleForm()
        assert 'name' in form.fields
        assert 'code' in form.fields
        assert 'permission_choices' in form.fields

    def test_permission_choices_field(self):
        """Should have permission choices as multi-select."""
        form = RoleForm()
        assert form.fields['permission_choices'].required is False


@pytest.mark.django_db
class TestUserAdmin:
    """Tests for UserAdmin."""

    def test_list_display(self, admin_site):
        """Should have expected list display fields."""
        user_admin = UserAdmin(User, admin_site)

        assert 'email' in user_admin.list_display
        assert 'full_name' in user_admin.list_display
        assert 'organization' in user_admin.list_display
        assert 'status' in user_admin.list_display
        assert 'is_staff' in user_admin.list_display

    def test_search_fields(self, admin_site):
        """Should search expected fields."""
        user_admin = UserAdmin(User, admin_site)

        assert 'email' in user_admin.search_fields
        assert 'first_name' in user_admin.search_fields
        assert 'last_name' in user_admin.search_fields

    def test_roles_display(self, admin_site):
        """Should display user roles."""
        user_admin = UserAdmin(User, admin_site)
        user = UserFactory()
        org = user.organization

        # Create a role and assign to user
        role = Role.objects.create(
            organization=org,
            name='Test Role',
            code='TEST',
        )
        UserRole.objects.create(
            user=user,
            role=role,
            is_active=True,
        )

        result = user_admin.roles_display(user)

        assert 'Test Role' in str(result)

    def test_roles_display_no_roles(self, admin_site):
        """Should handle user with no roles."""
        user_admin = UserAdmin(User, admin_site)
        user = UserFactory()

        result = user_admin.roles_display(user)

        assert 'No roles' in str(result)

    def test_activate_users_action(self, admin_site, admin_request):
        """Should activate selected users."""
        user_admin = UserAdmin(User, admin_site)
        user = UserFactory(status='INACTIVE', is_active=False)

        queryset = User.objects.filter(id=user.id)
        user_admin.activate_users(admin_request, queryset)

        user.refresh_from_db()
        assert user.status == 'ACTIVE'
        assert user.is_active is True

    def test_deactivate_users_action(self, admin_site, admin_request):
        """Should deactivate selected users."""
        user_admin = UserAdmin(User, admin_site)
        user = UserFactory(status='ACTIVE', is_active=True)

        queryset = User.objects.filter(id=user.id)
        user_admin.deactivate_users(admin_request, queryset)

        user.refresh_from_db()
        assert user.status == 'INACTIVE'
        assert user.is_active is False

    def test_suspend_users_action(self, admin_site, admin_request):
        """Should suspend selected users."""
        user_admin = UserAdmin(User, admin_site)
        user = UserFactory(status='ACTIVE', is_active=True)

        queryset = User.objects.filter(id=user.id)
        user_admin.suspend_users(admin_request, queryset)

        user.refresh_from_db()
        assert user.status == 'SUSPENDED'
        assert user.is_active is False


@pytest.mark.django_db
class TestRoleAdmin:
    """Tests for RoleAdmin."""

    def test_list_display(self, admin_site):
        """Should have expected list display fields."""
        role_admin = RoleAdmin(Role, admin_site)

        assert 'name' in role_admin.list_display
        assert 'code' in role_admin.list_display
        assert 'role_type' in role_admin.list_display
        assert 'is_active' in role_admin.list_display

    def test_user_count(self, admin_site):
        """Should display user count for role."""
        role_admin = RoleAdmin(Role, admin_site)
        org = OrganizationFactory()
        role = Role.objects.create(
            organization=org,
            name='Test Role',
            code='TEST',
        )

        # Create users with this role
        user1 = UserFactory(organization=org)
        user2 = UserFactory(organization=org)
        UserRole.objects.create(user=user1, role=role, is_active=True)
        UserRole.objects.create(user=user2, role=role, is_active=True)

        # Need to annotate the role
        role = role_admin.get_queryset(None).get(id=role.id)
        result = role_admin.user_count(role)

        assert '2 users' in str(result)

    def test_permission_count(self, admin_site):
        """Should display permission count for role."""
        role_admin = RoleAdmin(Role, admin_site)
        org = OrganizationFactory()
        role = Role.objects.create(
            organization=org,
            name='Test Role',
            code='TEST',
            permissions=[
                Permissions.REQUISITION_VIEW,
                Permissions.REQUISITION_CREATE,
            ],
        )

        result = role_admin.permission_count(role)

        assert '2' in result

    def test_duplicate_role_action(self, admin_site, admin_request):
        """Should duplicate selected roles."""
        role_admin = RoleAdmin(Role, admin_site)
        org = OrganizationFactory()
        role = Role.objects.create(
            organization=org,
            name='Original Role',
            code='ORIGINAL',
        )

        queryset = Role.objects.filter(id=role.id)
        role_admin.duplicate_role(admin_request, queryset)

        # Check duplicate was created
        duplicate = Role.objects.filter(code='ORIGINAL_copy').first()
        assert duplicate is not None
        assert 'Copy' in duplicate.name


@pytest.mark.django_db
class TestUserRoleAdmin:
    """Tests for UserRoleAdmin."""

    def test_list_display(self, admin_site):
        """Should have expected list display fields."""
        user_role_admin = UserRoleAdmin(UserRole, admin_site)

        assert 'user' in user_role_admin.list_display
        assert 'role' in user_role_admin.list_display
        assert 'is_active' in user_role_admin.list_display

    def test_validity_display_permanent(self, admin_site):
        """Should display Permanent for no end date."""
        user_role_admin = UserRoleAdmin(UserRole, admin_site)
        org = OrganizationFactory()
        user = UserFactory(organization=org)
        role = Role.objects.create(organization=org, name='Test', code='TEST')
        user_role = UserRole.objects.create(
            user=user,
            role=role,
            valid_to=None,
        )

        result = user_role_admin.validity_display(user_role)

        assert 'Permanent' in str(result)

    def test_validity_display_expired(self, admin_site):
        """Should display Expired for past end date."""
        user_role_admin = UserRoleAdmin(UserRole, admin_site)
        org = OrganizationFactory()
        user = UserFactory(organization=org)
        role = Role.objects.create(organization=org, name='Test', code='TEST')
        user_role = UserRole.objects.create(
            user=user,
            role=role,
            valid_to=timezone.now() - timezone.timedelta(days=1),
        )

        result = user_role_admin.validity_display(user_role)

        assert 'Expired' in str(result)

    def test_extend_validity_action(self, admin_site, admin_request):
        """Should extend validity by 30 days."""
        user_role_admin = UserRoleAdmin(UserRole, admin_site)
        org = OrganizationFactory()
        user = UserFactory(organization=org)
        role = Role.objects.create(organization=org, name='Test', code='TEST')

        original_end = timezone.now() + timezone.timedelta(days=10)
        user_role = UserRole.objects.create(
            user=user,
            role=role,
            valid_to=original_end,
        )

        queryset = UserRole.objects.filter(id=user_role.id)
        user_role_admin.extend_validity(admin_request, queryset)

        user_role.refresh_from_db()
        # Should be extended by ~30 days
        expected = original_end + timezone.timedelta(days=30)
        assert user_role.valid_to.date() == expected.date()


@pytest.mark.django_db
class TestRoleChangeLogAdmin:
    """Tests for RoleChangeLogAdmin."""

    def test_readonly(self, admin_site, admin_request):
        """Should not allow add/change/delete."""
        log_admin = RoleChangeLogAdmin(RoleChangeLog, admin_site)

        assert log_admin.has_add_permission(admin_request) is False
        assert log_admin.has_change_permission(admin_request) is False
        assert log_admin.has_delete_permission(admin_request) is False

    def test_list_display(self, admin_site):
        """Should have expected list display fields."""
        log_admin = RoleChangeLogAdmin(RoleChangeLog, admin_site)

        assert 'created_at' in log_admin.list_display
        assert 'user' in log_admin.list_display
        assert 'action' in log_admin.list_display
        assert 'role_name' in log_admin.list_display
        assert 'performed_by' in log_admin.list_display

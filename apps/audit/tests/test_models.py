"""
Tests for Audit models.
"""

import pytest
from django.contrib.contenttypes.models import ContentType

from apps.audit.models import AuditConfiguration, AuditLog
from apps.organizations.models import Organization
from apps.suppliers.models import Supplier
from apps.users.models import User


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
def supplier(db, organization):
    """Create a test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP001',
        name='Test Supplier',
        status='PROSPECT',
    )


@pytest.mark.django_db
class TestAuditLog:
    """Tests for AuditLog model."""

    def test_audit_log_creation(self, organization, user, supplier):
        """Can create an audit log entry."""
        content_type = ContentType.objects.get_for_model(supplier)

        log = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.CREATE,
        )

        assert log.id is not None
        assert log.timestamp is not None
        assert log.user == user
        assert log.user_email == 'user@example.com'
        assert log.organization == organization
        assert log.action == 'CREATE'

    def test_audit_log_state_transition(self, organization, user, supplier):
        """Can create state transition audit log."""
        content_type = ContentType.objects.get_for_model(supplier)

        log = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.STATE_TRANSITION,
            from_state='PROSPECT',
            to_state='PENDING_REVIEW',
        )

        assert log.action == 'STATE_TRANSITION'
        assert log.from_state == 'PROSPECT'
        assert log.to_state == 'PENDING_REVIEW'

    def test_audit_log_with_changes(self, organization, user, supplier):
        """Can store field-level changes in audit log."""
        content_type = ContentType.objects.get_for_model(supplier)
        changes = {
            'name': {'old': 'Old Name', 'new': 'New Name'},
            'status': {'old': 'PROSPECT', 'new': 'APPROVED'},
        }

        log = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.UPDATE,
            changes=changes,
        )

        assert log.changes == changes
        assert log.changes['name']['old'] == 'Old Name'
        assert log.changes['name']['new'] == 'New Name'

    def test_audit_log_with_extra_data(self, organization, user, supplier):
        """Can store extra context data in audit log."""
        content_type = ContentType.objects.get_for_model(supplier)
        extra_data = {
            'reason': 'Bulk update from import',
            'batch_id': '123456',
        }

        log = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.UPDATE,
            extra_data=extra_data,
        )

        assert log.extra_data == extra_data
        assert log.extra_data['reason'] == 'Bulk update from import'

    def test_audit_log_with_ip_and_user_agent(self, organization, user, supplier):
        """Can store request metadata in audit log."""
        content_type = ContentType.objects.get_for_model(supplier)

        log = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            ip_address='192.168.1.100',
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.CREATE,
        )

        assert log.ip_address == '192.168.1.100'
        assert 'Mozilla' in log.user_agent

    def test_audit_log_without_user(self, organization, supplier):
        """Can create audit log for system actions without user."""
        content_type = ContentType.objects.get_for_model(supplier)

        log = AuditLog.objects.create(
            user=None,
            user_email='',
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.UPDATE,
        )

        assert log.user is None
        assert log.user_email == ''

    def test_audit_log_str(self, organization, user, supplier):
        """Audit log has meaningful string representation."""
        content_type = ContentType.objects.get_for_model(supplier)

        log = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr='Test Supplier',
            action=AuditLog.Action.CREATE,
        )

        log_str = str(log)
        assert 'CREATE' in log_str
        assert 'Test Supplier' in log_str
        assert 'user@example.com' in log_str

    def test_audit_log_ordering(self, organization, user, supplier):
        """Audit logs are ordered by timestamp descending."""
        content_type = ContentType.objects.get_for_model(supplier)

        log1 = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.CREATE,
        )

        log2 = AuditLog.objects.create(
            user=user,
            user_email=user.email,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.UPDATE,
        )

        logs = list(AuditLog.objects.all())
        assert logs[0] == log2  # Most recent first
        assert logs[1] == log1


@pytest.mark.django_db
class TestAuditConfiguration:
    """Tests for AuditConfiguration model."""

    def test_config_creation(self, organization):
        """Can create audit configuration."""
        config = AuditConfiguration.objects.create(
            organization=organization,
            enabled=True,
            retention_days=365,
        )

        assert config.organization == organization
        assert config.enabled is True
        assert config.retention_days == 365
        assert config.track_field_changes is True
        assert config.excluded_fields == []

    def test_get_for_organization_creates_if_not_exists(self, organization):
        """get_for_organization creates config if it doesn't exist."""
        assert not AuditConfiguration.objects.filter(organization=organization).exists()

        config = AuditConfiguration.get_for_organization(organization)

        assert config is not None
        assert config.organization == organization
        assert config.enabled is True  # Default

    def test_get_for_organization_returns_existing(self, organization):
        """get_for_organization returns existing config."""
        existing = AuditConfiguration.objects.create(
            organization=organization,
            enabled=False,
            retention_days=30,
        )

        config = AuditConfiguration.get_for_organization(organization)

        assert config == existing
        assert config.enabled is False
        assert config.retention_days == 30

    def test_should_exclude_field_system_fields(self, organization):
        """System fields are always excluded."""
        config = AuditConfiguration.objects.create(
            organization=organization,
        )

        assert config.should_exclude_field('updated_at') is True
        assert config.should_exclude_field('created_at') is True
        assert config.should_exclude_field('id') is True
        assert config.should_exclude_field('password') is True

    def test_should_exclude_field_custom_fields(self, organization):
        """Custom excluded fields are excluded."""
        config = AuditConfiguration.objects.create(
            organization=organization,
            excluded_fields=['internal_notes', 'temp_data'],
        )

        assert config.should_exclude_field('internal_notes') is True
        assert config.should_exclude_field('temp_data') is True
        assert config.should_exclude_field('name') is False

    def test_config_str(self, organization):
        """Config has meaningful string representation."""
        config = AuditConfiguration.objects.create(
            organization=organization,
        )

        config_str = str(config)
        assert organization.name in config_str

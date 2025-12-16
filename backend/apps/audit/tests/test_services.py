"""
Tests for Audit services.
"""

import pytest
from decimal import Decimal
from django.utils import timezone

from apps.audit.models import AuditConfiguration, AuditLog
from apps.audit.services import AuditService
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
def audit_config(db, organization):
    """Create audit configuration."""
    config, _ = AuditConfiguration.objects.get_or_create(
        organization=organization,
        defaults={
            'enabled': True,
            'track_field_changes': True,
        }
    )
    # Ensure enabled for tests
    config.enabled = True
    config.track_field_changes = True
    config.save()
    return config


@pytest.fixture
def supplier(db, organization, audit_config):
    """Create a test supplier (depends on audit_config to avoid signal race)."""
    # Clear any existing audit logs
    AuditLog.objects.all().delete()
    return Supplier.objects.create(
        organization=organization,
        code='SUP001',
        name='Test Supplier',
        status='PROSPECT',
    )


@pytest.mark.django_db
class TestAuditServiceLogCreate:
    """Tests for AuditService.log_create."""

    def test_log_create_basic(self, organization, user, audit_config):
        """log_create creates CREATE audit log."""
        supplier = Supplier.objects.create(
            organization=organization,
            code='SUP001',
            name='Test Supplier',
            status='PROSPECT',
        )

        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is not None
        assert log.action == AuditLog.Action.CREATE
        assert log.user == user
        assert log.user_email == user.email
        assert log.organization == organization
        assert log.object_id == supplier.pk

    def test_log_create_with_ip_and_user_agent(self, organization, user, audit_config):
        """log_create captures request metadata."""
        supplier = Supplier.objects.create(
            organization=organization,
            code='SUP001',
            name='Test Supplier',
            status='PROSPECT',
        )

        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
            ip_address='10.0.0.1',
            user_agent='TestAgent/1.0',
        )

        assert log.ip_address == '10.0.0.1'
        assert log.user_agent == 'TestAgent/1.0'

    def test_log_create_captures_changes(self, organization, user, audit_config):
        """log_create captures initial field values."""
        supplier = Supplier.objects.create(
            organization=organization,
            code='SUP001',
            name='Test Supplier',
            status='PROSPECT',
        )

        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        assert 'name' in log.changes
        assert log.changes['name']['old'] is None
        assert log.changes['name']['new'] == 'Test Supplier'

    def test_log_create_returns_none_when_disabled(self, organization, user):
        """log_create returns None when auditing is disabled."""
        AuditConfiguration.objects.create(
            organization=organization,
            enabled=False,
        )

        supplier = Supplier.objects.create(
            organization=organization,
            code='SUP001',
            name='Test Supplier',
            status='PROSPECT',
        )

        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is None

    def test_log_create_without_organization_returns_none(self, user):
        """log_create returns None if no organization provided."""
        # Create a mock instance without organization
        class MockInstance:
            pk = 'test-uuid'
            def __str__(self):
                return 'Mock'

        log = AuditService.log_create(
            instance=MockInstance(),
            user=user,
        )

        assert log is None


@pytest.mark.django_db
class TestAuditServiceLogUpdate:
    """Tests for AuditService.log_update."""

    def test_log_update_captures_changes(self, organization, user, supplier, audit_config):
        """log_update captures field-level changes."""
        old_name = supplier.name

        # Create a copy of the old state
        old_supplier = Supplier.objects.get(pk=supplier.pk)

        # Modify the supplier
        supplier.name = 'Updated Supplier'
        supplier.save()

        log = AuditService.log_update(
            old_instance=old_supplier,
            new_instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is not None
        assert log.action == AuditLog.Action.UPDATE
        assert 'name' in log.changes
        assert log.changes['name']['old'] == old_name
        assert log.changes['name']['new'] == 'Updated Supplier'

    def test_log_update_returns_none_when_no_changes(self, organization, user, supplier, audit_config):
        """log_update returns None when there are no actual changes."""
        # Create a copy with same values
        old_supplier = Supplier.objects.get(pk=supplier.pk)

        log = AuditService.log_update(
            old_instance=old_supplier,
            new_instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is None

    def test_log_update_excludes_system_fields(self, organization, user, supplier, audit_config):
        """log_update excludes system fields like updated_at."""
        old_supplier = Supplier.objects.get(pk=supplier.pk)

        # Touch the supplier to update updated_at
        supplier.name = 'Updated'
        supplier.save()

        log = AuditService.log_update(
            old_instance=old_supplier,
            new_instance=supplier,
            user=user,
            organization=organization,
        )

        assert 'updated_at' not in log.changes
        assert 'created_at' not in log.changes


@pytest.mark.django_db
class TestAuditServiceLogStateTransition:
    """Tests for AuditService.log_state_transition."""

    def test_log_state_transition(self, organization, user, supplier, audit_config):
        """log_state_transition creates STATE_TRANSITION audit log."""
        log = AuditService.log_state_transition(
            instance=supplier,
            from_state='PROSPECT',
            to_state='PENDING_REVIEW',
            user=user,
            organization=organization,
        )

        assert log is not None
        assert log.action == AuditLog.Action.STATE_TRANSITION
        assert log.from_state == 'PROSPECT'
        assert log.to_state == 'PENDING_REVIEW'
        assert log.changes['status']['old'] == 'PROSPECT'
        assert log.changes['status']['new'] == 'PENDING_REVIEW'


@pytest.mark.django_db
class TestAuditServiceLogSoftDelete:
    """Tests for AuditService.log_soft_delete."""

    def test_log_soft_delete(self, organization, user, supplier, audit_config):
        """log_soft_delete creates SOFT_DELETE audit log."""
        supplier.is_deleted = True
        supplier.save()

        log = AuditService.log_soft_delete(
            instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is not None
        assert log.action == AuditLog.Action.SOFT_DELETE
        assert log.changes['is_deleted']['old'] is False
        assert log.changes['is_deleted']['new'] is True


@pytest.mark.django_db
class TestAuditServiceLogRestore:
    """Tests for AuditService.log_restore."""

    def test_log_restore(self, organization, user, supplier, audit_config):
        """log_restore creates RESTORE audit log."""
        supplier.is_deleted = False
        supplier.save()

        log = AuditService.log_restore(
            instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is not None
        assert log.action == AuditLog.Action.RESTORE
        assert log.changes['is_deleted']['old'] is True
        assert log.changes['is_deleted']['new'] is False


@pytest.mark.django_db
class TestAuditServiceLogDelete:
    """Tests for AuditService.log_delete."""

    def test_log_delete(self, organization, user, supplier, audit_config):
        """log_delete creates DELETE audit log."""
        supplier_pk = supplier.pk

        log = AuditService.log_delete(
            instance=supplier,
            user=user,
            organization=organization,
        )

        assert log is not None
        assert log.action == AuditLog.Action.DELETE
        assert log.object_id == supplier_pk


@pytest.mark.django_db
class TestAuditServiceGetHistory:
    """Tests for AuditService.get_history_for_object."""

    def test_get_history_for_object(self, organization, user, supplier, audit_config):
        """get_history_for_object returns audit history."""
        # Clear auto-created logs from supplier fixture
        AuditLog.objects.all().delete()

        # Create some audit logs manually
        AuditService.log_create(instance=supplier, user=user, organization=organization)

        old_supplier = Supplier.objects.get(pk=supplier.pk)
        supplier.name = 'Updated'
        supplier.save()

        # Clear any auto-created logs from save, then create manually
        AuditLog.objects.filter(action=AuditLog.Action.UPDATE).delete()
        AuditService.log_update(
            old_instance=old_supplier,
            new_instance=supplier,
            user=user,
            organization=organization,
        )

        history = AuditService.get_history_for_object(supplier)

        assert history.count() == 2
        assert history[0].action == AuditLog.Action.UPDATE
        assert history[1].action == AuditLog.Action.CREATE

    def test_get_history_with_limit(self, organization, user, supplier, audit_config):
        """get_history_for_object respects limit parameter."""
        # Create multiple logs
        for i in range(5):
            AuditService.log_create(instance=supplier, user=user, organization=organization)

        history = AuditService.get_history_for_object(supplier, limit=3)

        assert len(list(history)) == 3


@pytest.mark.django_db
class TestAuditServiceGetUserActivity:
    """Tests for AuditService.get_user_activity."""

    def test_get_user_activity(self, organization, user, supplier, audit_config):
        """get_user_activity returns all activity for a user."""
        AuditService.log_create(instance=supplier, user=user, organization=organization)

        activity = AuditService.get_user_activity(user)

        assert activity.count() == 1
        assert activity[0].user == user


@pytest.mark.django_db
class TestAuditServiceCleanup:
    """Tests for AuditService.cleanup_old_logs."""

    def test_cleanup_old_logs(self, organization, user, supplier, audit_config):
        """cleanup_old_logs removes old logs based on retention."""
        # Create an old log
        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        # Manually set timestamp to old date
        old_date = timezone.now() - timezone.timedelta(days=400)
        AuditLog.objects.filter(pk=log.pk).update(timestamp=old_date)

        # Set retention to 365 days
        audit_config.retention_days = 365
        audit_config.save()

        deleted_count = AuditService.cleanup_old_logs(organization)

        assert deleted_count == 1
        assert not AuditLog.objects.filter(pk=log.pk).exists()

    def test_cleanup_preserves_recent_logs(self, organization, user, supplier, audit_config):
        """cleanup_old_logs preserves recent logs."""
        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        audit_config.retention_days = 365
        audit_config.save()

        deleted_count = AuditService.cleanup_old_logs(organization)

        assert deleted_count == 0
        assert AuditLog.objects.filter(pk=log.pk).exists()

    def test_cleanup_with_zero_retention_keeps_forever(self, organization, user, supplier, audit_config):
        """cleanup_old_logs keeps logs forever when retention is 0."""
        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        # Set old timestamp
        old_date = timezone.now() - timezone.timedelta(days=1000)
        AuditLog.objects.filter(pk=log.pk).update(timestamp=old_date)

        audit_config.retention_days = 0  # Keep forever
        audit_config.save()

        deleted_count = AuditService.cleanup_old_logs(organization)

        assert deleted_count == 0
        assert AuditLog.objects.filter(pk=log.pk).exists()


@pytest.mark.django_db
class TestAuditServiceSerialization:
    """Tests for AuditService value serialization."""

    def test_serialize_uuid(self, organization, user, supplier, audit_config):
        """UUIDs are serialized to strings."""
        log = AuditService.log_create(
            instance=supplier,
            user=user,
            organization=organization,
        )

        # Organization FK should be serialized as string
        assert 'organization' in log.changes
        assert isinstance(log.changes['organization']['new'], str)

    def test_serialize_decimal(self, organization, user, audit_config):
        """Decimals are serialized to strings."""
        value = AuditService._serialize_value(Decimal('123.45'))
        assert value == '123.45'
        assert isinstance(value, str)

    def test_serialize_datetime(self, organization, user, audit_config):
        """Datetimes are serialized to ISO format."""
        now = timezone.now()
        value = AuditService._serialize_value(now)
        assert value == now.isoformat()

    def test_serialize_none(self, organization, user, audit_config):
        """None values are preserved."""
        value = AuditService._serialize_value(None)
        assert value is None

"""
API tests for Audit endpoints.
"""

import pytest
from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditConfiguration, AuditLog
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
def other_organization(db):
    """Create another organization for isolation tests."""
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
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def audit_config(db, organization):
    """Create audit configuration."""
    config, _ = AuditConfiguration.objects.get_or_create(
        organization=organization,
        defaults={'enabled': True}
    )
    config.enabled = True
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


@pytest.fixture
def audit_log(db, organization, user, supplier):
    """Create a test audit log."""
    # Clear auto-created logs from signals
    AuditLog.objects.all().delete()
    content_type = ContentType.objects.get_for_model(supplier)
    return AuditLog.objects.create(
        user=user,
        user_email=user.email,
        organization=organization,
        content_type=content_type,
        object_id=supplier.pk,
        object_repr=str(supplier),
        action=AuditLog.Action.CREATE,
    )


@pytest.mark.django_db
class TestAuditLogViewSet:
    """Tests for /api/v1/audit/logs/ endpoints."""

    def test_list_audit_logs(self, authenticated_client, audit_log):
        """Can list audit logs for organization."""
        response = authenticated_client.get('/api/v1/audit/logs/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(audit_log.id)

    def test_list_audit_logs_organization_isolation(
        self, authenticated_client, audit_log, other_organization
    ):
        """Can only see audit logs for own organization."""
        # Create log in other organization
        other_supplier = Supplier.objects.create(
            organization=other_organization,
            code='OTHER-SUP',
            name='Other Supplier',
        )
        content_type = ContentType.objects.get_for_model(other_supplier)
        AuditLog.objects.create(
            organization=other_organization,
            content_type=content_type,
            object_id=other_supplier.pk,
            object_repr=str(other_supplier),
            action=AuditLog.Action.CREATE,
        )

        response = authenticated_client.get('/api/v1/audit/logs/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1  # Only own org's log

    def test_list_audit_logs_filter_by_action(
        self, authenticated_client, organization, user, audit_config
    ):
        """Can filter audit logs by action type."""
        # Clear existing logs and create fresh supplier
        AuditLog.objects.all().delete()
        supplier = Supplier.objects.create(
            organization=organization,
            code='SUP-FILTER',
            name='Filter Supplier',
            status='PROSPECT',
        )
        content_type = ContentType.objects.get_for_model(supplier)

        # Clear auto-created CREATE log and manually create for test control
        AuditLog.objects.all().delete()
        AuditLog.objects.create(
            user=user,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.CREATE,
        )
        AuditLog.objects.create(
            user=user,
            organization=organization,
            content_type=content_type,
            object_id=supplier.pk,
            object_repr=str(supplier),
            action=AuditLog.Action.UPDATE,
        )

        response = authenticated_client.get('/api/v1/audit/logs/?action=CREATE')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['action'] == 'CREATE'

    def test_list_audit_logs_filter_by_content_type(
        self, authenticated_client, audit_log
    ):
        """Can filter audit logs by content type."""
        response = authenticated_client.get(
            '/api/v1/audit/logs/?content_type=suppliers.supplier'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_get_audit_log_detail(self, authenticated_client, audit_log):
        """Can get audit log detail."""
        response = authenticated_client.get(f'/api/v1/audit/logs/{audit_log.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(audit_log.id)
        assert response.data['action'] == 'CREATE'
        assert 'changes' in response.data

    def test_audit_logs_read_only(self, authenticated_client, audit_log):
        """Audit logs cannot be modified via API."""
        # POST should fail (no create endpoint)
        response = authenticated_client.post(
            '/api/v1/audit/logs/',
            {'action': 'CREATE'},
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

        # PUT should fail
        response = authenticated_client.put(
            f'/api/v1/audit/logs/{audit_log.id}/',
            {'action': 'UPDATE'},
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

        # DELETE should fail
        response = authenticated_client.delete(f'/api/v1/audit/logs/{audit_log.id}/')
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_for_object_endpoint(self, authenticated_client, audit_log, supplier):
        """Can get audit history for specific object."""
        response = authenticated_client.get(
            f'/api/v1/audit/logs/for_object/'
            f'?content_type=suppliers.supplier&object_id={supplier.pk}'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['object_id'] == str(supplier.pk)

    def test_for_object_invalid_content_type(self, authenticated_client, supplier):
        """for_object returns 400 for invalid content type."""
        response = authenticated_client.get(
            f'/api/v1/audit/logs/for_object/'
            f'?content_type=invalid.model&object_id={supplier.pk}'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    def test_for_object_missing_params(self, authenticated_client):
        """for_object returns 400 for missing params."""
        response = authenticated_client.get('/api/v1/audit/logs/for_object/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_access_denied(self, api_client, audit_log):
        """Unauthenticated users cannot access audit logs."""
        response = api_client.get('/api/v1/audit/logs/')

        # DRF returns 403 for session auth when not authenticated
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestAuditConfigurationViewSet:
    """Tests for /api/v1/audit/config/ endpoints."""

    def test_list_config(self, authenticated_client, audit_config):
        """Can get audit configuration."""
        response = authenticated_client.get('/api/v1/audit/config/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['enabled'] is True

    def test_list_config_creates_if_not_exists(self, authenticated_client, organization):
        """List creates config if it doesn't exist."""
        assert not AuditConfiguration.objects.filter(organization=organization).exists()

        response = authenticated_client.get('/api/v1/audit/config/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert AuditConfiguration.objects.filter(organization=organization).exists()

    def test_update_config(self, authenticated_client, audit_config):
        """Can update audit configuration."""
        response = authenticated_client.patch(
            f'/api/v1/audit/config/{audit_config.organization_id}/',
            {
                'enabled': False,
                'retention_days': 30,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        audit_config.refresh_from_db()
        assert audit_config.enabled is False
        assert audit_config.retention_days == 30

    def test_update_excluded_fields(self, authenticated_client, audit_config):
        """Can update excluded fields list."""
        response = authenticated_client.patch(
            f'/api/v1/audit/config/{audit_config.organization_id}/',
            {
                'excluded_fields': ['internal_notes', 'temp_data'],
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        audit_config.refresh_from_db()
        assert 'internal_notes' in audit_config.excluded_fields
        assert 'temp_data' in audit_config.excluded_fields

    def test_create_config_not_allowed(self, authenticated_client, organization):
        """Cannot manually create config via POST."""
        response = authenticated_client.post(
            '/api/v1/audit/config/',
            {
                'organization': str(organization.id),
                'enabled': True,
            },
        )

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_config_organization_isolation(
        self, authenticated_client, audit_config, other_organization
    ):
        """Can only access own organization's config."""
        other_config = AuditConfiguration.objects.create(
            organization=other_organization,
            enabled=False,
        )

        response = authenticated_client.get(
            f'/api/v1/audit/config/{other_config.organization_id}/'
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

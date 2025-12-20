"""
Tests for SecurityEvent model and SecurityAuditService.

These tests verify that security-sensitive operations are properly logged.
"""

import pytest
from unittest.mock import MagicMock, patch
from django.test import RequestFactory

from apps.audit.security_models import SecurityEvent
from apps.audit.security_service import SecurityAuditService


class TestSecurityEventModel:
    """Tests for SecurityEvent model."""

    def test_event_type_choices(self):
        """Verify all expected event types are defined."""
        expected_types = [
            'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'SESSION_EXPIRED',
            'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE',
            'ROLE_ASSIGNED', 'ROLE_REMOVED', 'PERMISSION_DENIED',
            'RATE_LIMIT_EXCEEDED',
            'API_KEY_CREATED', 'API_KEY_REVOKED', 'API_KEY_USED',
            'BULK_EXPORT', 'SENSITIVE_DATA_ACCESS',
            'ACCOUNT_CREATED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_DEACTIVATED',
            'ACCOUNT_SUSPENDED', 'ACCOUNT_LOCKED',
            'PORTAL_LOGIN_SUCCESS', 'PORTAL_LOGIN_FAILED', 'PORTAL_REGISTRATION',
        ]
        actual_types = [choice[0] for choice in SecurityEvent.EventType.choices]
        for expected in expected_types:
            assert expected in actual_types, f"Missing event type: {expected}"

    def test_severity_choices(self):
        """Verify severity levels are defined."""
        expected_severities = ['INFO', 'WARNING', 'ERROR', 'CRITICAL']
        actual_severities = [choice[0] for choice in SecurityEvent.Severity.choices]
        for expected in expected_severities:
            assert expected in actual_severities

    def test_get_severity_for_login_failed(self):
        """Login failed should return WARNING severity."""
        severity = SecurityEvent.get_severity_for_event(SecurityEvent.EventType.LOGIN_FAILED)
        assert severity == SecurityEvent.Severity.WARNING

    def test_get_severity_for_account_suspended(self):
        """Account suspended should return CRITICAL severity."""
        severity = SecurityEvent.get_severity_for_event(SecurityEvent.EventType.ACCOUNT_SUSPENDED)
        assert severity == SecurityEvent.Severity.CRITICAL

    def test_get_severity_for_login_success(self):
        """Login success should return INFO severity."""
        severity = SecurityEvent.get_severity_for_event(SecurityEvent.EventType.LOGIN_SUCCESS)
        assert severity == SecurityEvent.Severity.INFO


class TestSecurityAuditService:
    """Tests for SecurityAuditService."""

    def test_log_event_creates_event(self):
        """log_event should create a SecurityEvent."""
        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock(id='test-id')

            result = SecurityAuditService.log_event(
                event_type=SecurityEvent.EventType.LOGIN_SUCCESS,
                ip_address='127.0.0.1',
                description='Test login',
            )

            assert mock_objects.create.called
            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.LOGIN_SUCCESS
            assert call_kwargs['ip_address'] == '127.0.0.1'
            assert call_kwargs['description'] == 'Test login'

    def test_log_event_extracts_ip_from_request(self):
        """log_event should extract IP from request."""
        factory = RequestFactory()
        request = factory.get('/test/')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_event(
                event_type=SecurityEvent.EventType.LOGIN_SUCCESS,
                request=request,
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['ip_address'] == '127.0.0.1'

    def test_log_event_extracts_forwarded_ip(self):
        """log_event should handle X-Forwarded-For header."""
        factory = RequestFactory()
        request = factory.get('/test/', HTTP_X_FORWARDED_FOR='192.168.1.1, 10.0.0.1')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_event(
                event_type=SecurityEvent.EventType.LOGIN_SUCCESS,
                request=request,
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['ip_address'] == '192.168.1.1'

    def test_log_login_success(self):
        """log_login_success should create LOGIN_SUCCESS event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/auth/login/')
        user = MagicMock(email='test@example.com', organization=None)

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_login_success(request=request, user=user)

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.LOGIN_SUCCESS
            assert call_kwargs['user'] == user
            assert 'logged in successfully' in call_kwargs['description']

    def test_log_login_failed(self):
        """log_login_failed should create LOGIN_FAILED event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/auth/login/')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_login_failed(
                request=request,
                email='hacker@example.com',
                reason='Invalid password',
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.LOGIN_FAILED
            assert call_kwargs['success'] is False
            assert call_kwargs['failure_reason'] == 'Invalid password'
            assert call_kwargs['details']['attempted_email'] == 'hacker@example.com'

    def test_log_logout(self):
        """log_logout should create LOGOUT event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/auth/logout/')
        user = MagicMock(email='test@example.com', organization=None)

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_logout(request=request, user=user)

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.LOGOUT
            assert call_kwargs['user'] == user

    def test_log_password_change(self):
        """log_password_change should create PASSWORD_CHANGE event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/auth/password/change/')
        user = MagicMock(email='test@example.com', organization=None)

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_password_change(request=request, user=user)

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.PASSWORD_CHANGE
            assert 'changed their password' in call_kwargs['description']

    def test_log_role_assigned(self):
        """log_role_assigned should create ROLE_ASSIGNED event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/users/1/assign-role/')
        admin_user = MagicMock(email='admin@example.com', organization=None)
        target_user = MagicMock(email='user@example.com')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_role_assigned(
                request=request,
                user=admin_user,
                target_user=target_user,
                role_name='Procurement Officer',
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.ROLE_ASSIGNED
            assert call_kwargs['target_user'] == target_user
            assert call_kwargs['details']['role_name'] == 'Procurement Officer'

    def test_log_role_removed(self):
        """log_role_removed should create ROLE_REMOVED event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/users/1/remove-role/')
        admin_user = MagicMock(email='admin@example.com', organization=None)
        target_user = MagicMock(email='user@example.com')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_role_removed(
                request=request,
                user=admin_user,
                target_user=target_user,
                role_name='Procurement Officer',
                reason='Role no longer needed',
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.ROLE_REMOVED
            assert call_kwargs['details']['reason'] == 'Role no longer needed'

    def test_log_rate_limit_exceeded(self):
        """log_rate_limit_exceeded should create RATE_LIMIT_EXCEEDED event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/auth/login/')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_rate_limit_exceeded(
                request=request,
                endpoint='/api/v1/auth/login/',
                limit='5/minute',
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.RATE_LIMIT_EXCEEDED
            assert call_kwargs['success'] is False
            assert call_kwargs['details']['endpoint'] == '/api/v1/auth/login/'
            assert call_kwargs['details']['limit'] == '5/minute'

    def test_log_account_suspended(self):
        """log_account_suspended should create ACCOUNT_SUSPENDED event with CRITICAL severity."""
        factory = RequestFactory()
        request = factory.post('/api/v1/users/1/suspend/')
        admin_user = MagicMock(email='admin@example.com', organization=None)
        target_user = MagicMock(email='baduser@example.com')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_account_suspended(
                request=request,
                user=admin_user,
                target_user=target_user,
                reason='Policy violation',
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.ACCOUNT_SUSPENDED
            assert call_kwargs['severity'] == SecurityEvent.Severity.CRITICAL
            assert call_kwargs['details']['reason'] == 'Policy violation'

    def test_log_bulk_export(self):
        """log_bulk_export should create BULK_EXPORT event."""
        factory = RequestFactory()
        request = factory.get('/api/v1/reports/export/')
        user = MagicMock(email='analyst@example.com', organization=None)

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_bulk_export(
                request=request,
                user=user,
                export_type='purchase_orders',
                record_count=1500,
                filters={'status': 'approved'},
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.BULK_EXPORT
            assert call_kwargs['details']['export_type'] == 'purchase_orders'
            assert call_kwargs['details']['record_count'] == 1500
            assert call_kwargs['details']['filters'] == {'status': 'approved'}

    def test_log_event_handles_exceptions_gracefully(self):
        """log_event should not raise exceptions on failure."""
        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.side_effect = Exception("Database error")

            # Should not raise, should return None
            result = SecurityAuditService.log_event(
                event_type=SecurityEvent.EventType.LOGIN_SUCCESS,
            )

            assert result is None

    def test_log_portal_login_success(self):
        """log_portal_login_success should create PORTAL_LOGIN_SUCCESS event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/portal/login/')
        portal_user = MagicMock(email='supplier@example.com')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_portal_login_success(
                request=request,
                portal_user=portal_user,
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.PORTAL_LOGIN_SUCCESS
            assert 'supplier@example.com' in call_kwargs['description']

    def test_log_account_created(self):
        """log_account_created should create ACCOUNT_CREATED event."""
        factory = RequestFactory()
        request = factory.post('/api/v1/users/invite/')
        admin_user = MagicMock(email='admin@example.com', organization=None)
        target_user = MagicMock(email='newuser@example.com')

        with patch('apps.audit.security_service.SecurityEvent.objects') as mock_objects:
            mock_objects.create.return_value = MagicMock()

            SecurityAuditService.log_account_created(
                request=request,
                user=admin_user,
                target_user=target_user,
            )

            call_kwargs = mock_objects.create.call_args[1]
            assert call_kwargs['event_type'] == SecurityEvent.EventType.ACCOUNT_CREATED
            assert call_kwargs['target_user'] == target_user

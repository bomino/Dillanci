"""
Security Audit models for tracking security-sensitive operations.

Separate from general AuditLog to handle events that don't relate to model changes.
"""

import uuid

from django.conf import settings
from django.db import models


class SecurityEvent(models.Model):
    """
    Security event log for tracking authentication and authorization events.

    Captures:
    - Login attempts (successful and failed)
    - Logout events
    - Password changes
    - Permission/role changes
    - Rate limit blocks
    - API key operations
    - Bulk data exports
    - Suspicious activity
    """

    class EventType(models.TextChoices):
        # Authentication events
        LOGIN_SUCCESS = 'LOGIN_SUCCESS', 'Login Success'
        LOGIN_FAILED = 'LOGIN_FAILED', 'Login Failed'
        LOGOUT = 'LOGOUT', 'Logout'
        SESSION_EXPIRED = 'SESSION_EXPIRED', 'Session Expired'

        # Password events
        PASSWORD_CHANGE = 'PASSWORD_CHANGE', 'Password Change'
        PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST', 'Password Reset Request'
        PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE', 'Password Reset Complete'

        # Authorization events
        ROLE_ASSIGNED = 'ROLE_ASSIGNED', 'Role Assigned'
        ROLE_REMOVED = 'ROLE_REMOVED', 'Role Removed'
        PERMISSION_DENIED = 'PERMISSION_DENIED', 'Permission Denied'

        # Rate limiting events
        RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED', 'Rate Limit Exceeded'

        # API key events
        API_KEY_CREATED = 'API_KEY_CREATED', 'API Key Created'
        API_KEY_REVOKED = 'API_KEY_REVOKED', 'API Key Revoked'
        API_KEY_USED = 'API_KEY_USED', 'API Key Used'

        # Data access events
        BULK_EXPORT = 'BULK_EXPORT', 'Bulk Data Export'
        SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS', 'Sensitive Data Access'

        # Account events
        ACCOUNT_CREATED = 'ACCOUNT_CREATED', 'Account Created'
        ACCOUNT_ACTIVATED = 'ACCOUNT_ACTIVATED', 'Account Activated'
        ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED', 'Account Deactivated'
        ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED', 'Account Suspended'
        ACCOUNT_LOCKED = 'ACCOUNT_LOCKED', 'Account Locked'

        # Portal events
        PORTAL_LOGIN_SUCCESS = 'PORTAL_LOGIN_SUCCESS', 'Portal Login Success'
        PORTAL_LOGIN_FAILED = 'PORTAL_LOGIN_FAILED', 'Portal Login Failed'
        PORTAL_REGISTRATION = 'PORTAL_REGISTRATION', 'Portal Registration'

    class Severity(models.TextChoices):
        INFO = 'INFO', 'Info'
        WARNING = 'WARNING', 'Warning'
        ERROR = 'ERROR', 'Error'
        CRITICAL = 'CRITICAL', 'Critical'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    # Event classification
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        db_index=True,
    )
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.INFO,
        db_index=True,
    )

    # User context (nullable for failed logins with unknown user)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_events',
    )
    # Denormalized for retention and failed login tracking
    user_email = models.EmailField(
        blank=True,
        default='',
        db_index=True,
    )

    # Organization context (nullable for pre-auth events)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_events',
    )

    # Request metadata
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        db_index=True,
    )
    user_agent = models.CharField(
        max_length=512,
        blank=True,
        default='',
    )

    # Event-specific data
    description = models.TextField(
        blank=True,
        default='',
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Event-specific details in JSON format',
    )

    # Target of the action (e.g., affected user for role changes)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_events_as_target',
    )
    target_email = models.EmailField(
        blank=True,
        default='',
    )

    # Correlation for request tracing
    correlation_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
    )

    # Success/failure indicator
    success = models.BooleanField(
        default=True,
    )
    failure_reason = models.CharField(
        max_length=255,
        blank=True,
        default='',
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['event_type', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['organization', 'timestamp']),
            models.Index(fields=['ip_address', 'timestamp']),
            models.Index(fields=['severity', 'timestamp']),
        ]
        verbose_name = 'Security Event'
        verbose_name_plural = 'Security Events'

    def __str__(self):
        user_str = self.user_email or 'anonymous'
        return f"{self.event_type} by {user_str} at {self.timestamp}"

    @classmethod
    def get_severity_for_event(cls, event_type: str) -> str:
        """Get default severity for an event type."""
        critical_events = {
            cls.EventType.ACCOUNT_SUSPENDED,
            cls.EventType.ACCOUNT_LOCKED,
        }
        warning_events = {
            cls.EventType.LOGIN_FAILED,
            cls.EventType.RATE_LIMIT_EXCEEDED,
            cls.EventType.PERMISSION_DENIED,
            cls.EventType.API_KEY_REVOKED,
            cls.EventType.PORTAL_LOGIN_FAILED,
        }
        error_events = {
            cls.EventType.ACCOUNT_DEACTIVATED,
        }

        if event_type in critical_events:
            return cls.Severity.CRITICAL
        elif event_type in error_events:
            return cls.Severity.ERROR
        elif event_type in warning_events:
            return cls.Severity.WARNING
        return cls.Severity.INFO

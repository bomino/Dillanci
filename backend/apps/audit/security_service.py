"""
Security Audit Service for logging security-sensitive operations.

Provides a simple API for logging authentication, authorization, and
other security-related events throughout the application.
"""

import logging
from typing import Any, Dict, Optional

from django.conf import settings
from django.http import HttpRequest

from apps.audit.security_models import SecurityEvent

logger = logging.getLogger(__name__)


def get_client_ip(request: HttpRequest) -> Optional[str]:
    """Extract client IP address from request, handling proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_user_agent(request: HttpRequest) -> str:
    """Extract user agent from request."""
    return request.META.get('HTTP_USER_AGENT', '')[:512]


def get_correlation_id(request: HttpRequest) -> str:
    """Get correlation ID from request if available."""
    return getattr(request, 'correlation_id', '') or ''


class SecurityAuditService:
    """
    Service for logging security events.

    All methods are static and can be called directly without instantiation.
    Failures in audit logging are logged but don't raise exceptions to
    avoid disrupting the main application flow.
    """

    @staticmethod
    def log_event(
        event_type: str,
        request: Optional[HttpRequest] = None,
        user=None,
        organization=None,
        target_user=None,
        description: str = '',
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
        failure_reason: str = '',
        severity: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        correlation_id: str = '',
    ) -> Optional[SecurityEvent]:
        """
        Log a security event.

        Args:
            event_type: Type of security event (from SecurityEvent.EventType)
            request: HTTP request object (optional, extracts IP, user agent, etc.)
            user: User who performed the action
            organization: Organization context
            target_user: User affected by the action (e.g., for role changes)
            description: Human-readable description
            details: Additional JSON details
            success: Whether the action succeeded
            failure_reason: Reason for failure if success=False
            severity: Override default severity
            ip_address: Override IP from request
            user_agent: Override user agent from request
            correlation_id: Request correlation ID for tracing

        Returns:
            SecurityEvent instance or None if logging failed
        """
        try:
            # Extract from request if provided
            if request:
                ip_address = ip_address or get_client_ip(request)
                user_agent = user_agent or get_user_agent(request)
                correlation_id = correlation_id or get_correlation_id(request)
                if user is None and hasattr(request, 'user') and request.user.is_authenticated:
                    user = request.user

            # Get organization from user if not provided
            if organization is None and user:
                organization = getattr(user, 'organization', None)

            # Determine severity
            if severity is None:
                severity = SecurityEvent.get_severity_for_event(event_type)

            event = SecurityEvent.objects.create(
                event_type=event_type,
                severity=severity,
                user=user,
                user_email=getattr(user, 'email', '') if user else '',
                organization=organization,
                ip_address=ip_address,
                user_agent=user_agent,
                description=description,
                details=details or {},
                target_user=target_user,
                target_email=getattr(target_user, 'email', '') if target_user else '',
                correlation_id=correlation_id,
                success=success,
                failure_reason=failure_reason,
            )

            # Log to standard logging as well for centralized log aggregation
            log_data = {
                'event_type': event_type,
                'user': str(user) if user else 'anonymous',
                'ip_address': ip_address,
                'success': success,
                'correlation_id': correlation_id,
            }
            if not success:
                log_data['failure_reason'] = failure_reason

            if severity == SecurityEvent.Severity.CRITICAL:
                logger.critical(f"Security event: {event_type}", extra=log_data)
            elif severity == SecurityEvent.Severity.ERROR:
                logger.error(f"Security event: {event_type}", extra=log_data)
            elif severity == SecurityEvent.Severity.WARNING:
                logger.warning(f"Security event: {event_type}", extra=log_data)
            else:
                logger.info(f"Security event: {event_type}", extra=log_data)

            return event

        except Exception as e:
            # Don't let audit failures break the application
            logger.exception(f"Failed to log security event: {event_type}", exc_info=e)
            return None

    # =========================================================================
    # Authentication Events
    # =========================================================================

    @classmethod
    def log_login_success(
        cls,
        request: HttpRequest,
        user,
    ) -> Optional[SecurityEvent]:
        """Log successful login."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.LOGIN_SUCCESS,
            request=request,
            user=user,
            description=f"User {user.email} logged in successfully",
        )

    @classmethod
    def log_login_failed(
        cls,
        request: HttpRequest,
        email: str,
        reason: str = 'Invalid credentials',
    ) -> Optional[SecurityEvent]:
        """Log failed login attempt."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.LOGIN_FAILED,
            request=request,
            description=f"Failed login attempt for {email}",
            details={'attempted_email': email},
            success=False,
            failure_reason=reason,
        )

    @classmethod
    def log_logout(
        cls,
        request: HttpRequest,
        user,
    ) -> Optional[SecurityEvent]:
        """Log user logout."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.LOGOUT,
            request=request,
            user=user,
            description=f"User {user.email} logged out",
        )

    # =========================================================================
    # Password Events
    # =========================================================================

    @classmethod
    def log_password_change(
        cls,
        request: HttpRequest,
        user,
    ) -> Optional[SecurityEvent]:
        """Log password change."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PASSWORD_CHANGE,
            request=request,
            user=user,
            description=f"User {user.email} changed their password",
        )

    @classmethod
    def log_password_reset_request(
        cls,
        request: HttpRequest,
        email: str,
    ) -> Optional[SecurityEvent]:
        """Log password reset request."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PASSWORD_RESET_REQUEST,
            request=request,
            description=f"Password reset requested for {email}",
            details={'requested_email': email},
        )

    @classmethod
    def log_password_reset_complete(
        cls,
        request: HttpRequest,
        user,
    ) -> Optional[SecurityEvent]:
        """Log password reset completion."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PASSWORD_RESET_COMPLETE,
            request=request,
            user=user,
            description=f"Password reset completed for {user.email}",
        )

    # =========================================================================
    # Authorization Events
    # =========================================================================

    @classmethod
    def log_role_assigned(
        cls,
        request: HttpRequest,
        user,  # Admin who assigned
        target_user,  # User who received the role
        role_name: str,
        details: Optional[Dict] = None,
    ) -> Optional[SecurityEvent]:
        """Log role assignment."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.ROLE_ASSIGNED,
            request=request,
            user=user,
            target_user=target_user,
            description=f"Role '{role_name}' assigned to {target_user.email} by {user.email}",
            details={'role_name': role_name, **(details or {})},
        )

    @classmethod
    def log_role_removed(
        cls,
        request: HttpRequest,
        user,  # Admin who removed
        target_user,  # User who lost the role
        role_name: str,
        reason: str = '',
    ) -> Optional[SecurityEvent]:
        """Log role removal."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.ROLE_REMOVED,
            request=request,
            user=user,
            target_user=target_user,
            description=f"Role '{role_name}' removed from {target_user.email} by {user.email}",
            details={'role_name': role_name, 'reason': reason},
        )

    @classmethod
    def log_permission_denied(
        cls,
        request: HttpRequest,
        user,
        permission: str,
        resource: str = '',
    ) -> Optional[SecurityEvent]:
        """Log permission denied event."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PERMISSION_DENIED,
            request=request,
            user=user,
            description=f"Permission denied for {user.email}: {permission}",
            details={'permission': permission, 'resource': resource},
            success=False,
            failure_reason='Insufficient permissions',
        )

    # =========================================================================
    # Rate Limiting Events
    # =========================================================================

    @classmethod
    def log_rate_limit_exceeded(
        cls,
        request: HttpRequest,
        endpoint: str,
        limit: str,
        user=None,
    ) -> Optional[SecurityEvent]:
        """Log rate limit exceeded."""
        email = getattr(user, 'email', 'anonymous') if user else 'anonymous'
        return cls.log_event(
            event_type=SecurityEvent.EventType.RATE_LIMIT_EXCEEDED,
            request=request,
            user=user,
            description=f"Rate limit exceeded on {endpoint} by {email}",
            details={'endpoint': endpoint, 'limit': limit},
            success=False,
            failure_reason=f'Rate limit exceeded: {limit}',
        )

    # =========================================================================
    # Account Events
    # =========================================================================

    @classmethod
    def log_account_created(
        cls,
        request: Optional[HttpRequest],
        user,  # Admin who created
        target_user,  # New user
    ) -> Optional[SecurityEvent]:
        """Log account creation."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.ACCOUNT_CREATED,
            request=request,
            user=user,
            target_user=target_user,
            description=f"Account created for {target_user.email} by {user.email if user else 'system'}",
        )

    @classmethod
    def log_account_activated(
        cls,
        request: HttpRequest,
        user,  # Admin
        target_user,  # Activated user
    ) -> Optional[SecurityEvent]:
        """Log account activation."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.ACCOUNT_ACTIVATED,
            request=request,
            user=user,
            target_user=target_user,
            description=f"Account activated for {target_user.email} by {user.email}",
        )

    @classmethod
    def log_account_deactivated(
        cls,
        request: HttpRequest,
        user,  # Admin
        target_user,  # Deactivated user
        reason: str = '',
    ) -> Optional[SecurityEvent]:
        """Log account deactivation."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.ACCOUNT_DEACTIVATED,
            request=request,
            user=user,
            target_user=target_user,
            description=f"Account deactivated for {target_user.email} by {user.email}",
            details={'reason': reason},
        )

    @classmethod
    def log_account_suspended(
        cls,
        request: HttpRequest,
        user,  # Admin
        target_user,  # Suspended user
        reason: str = '',
    ) -> Optional[SecurityEvent]:
        """Log account suspension."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.ACCOUNT_SUSPENDED,
            request=request,
            user=user,
            target_user=target_user,
            description=f"Account suspended for {target_user.email} by {user.email}",
            details={'reason': reason},
            severity=SecurityEvent.Severity.CRITICAL,
        )

    # =========================================================================
    # Data Access Events
    # =========================================================================

    @classmethod
    def log_bulk_export(
        cls,
        request: HttpRequest,
        user,
        export_type: str,
        record_count: int,
        filters: Optional[Dict] = None,
    ) -> Optional[SecurityEvent]:
        """Log bulk data export."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.BULK_EXPORT,
            request=request,
            user=user,
            description=f"Bulk export of {record_count} {export_type} records by {user.email}",
            details={
                'export_type': export_type,
                'record_count': record_count,
                'filters': filters or {},
            },
        )

    @classmethod
    def log_sensitive_data_access(
        cls,
        request: HttpRequest,
        user,
        data_type: str,
        resource_id: str = '',
    ) -> Optional[SecurityEvent]:
        """Log access to sensitive data."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.SENSITIVE_DATA_ACCESS,
            request=request,
            user=user,
            description=f"Sensitive data access ({data_type}) by {user.email}",
            details={'data_type': data_type, 'resource_id': resource_id},
        )

    # =========================================================================
    # Portal Events
    # =========================================================================

    @classmethod
    def log_portal_login_success(
        cls,
        request: HttpRequest,
        portal_user,
    ) -> Optional[SecurityEvent]:
        """Log successful portal login."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PORTAL_LOGIN_SUCCESS,
            request=request,
            description=f"Portal user {portal_user.email} logged in successfully",
            details={'portal_user_email': portal_user.email},
        )

    @classmethod
    def log_portal_login_failed(
        cls,
        request: HttpRequest,
        email: str,
        reason: str = 'Invalid credentials',
    ) -> Optional[SecurityEvent]:
        """Log failed portal login attempt."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PORTAL_LOGIN_FAILED,
            request=request,
            description=f"Failed portal login attempt for {email}",
            details={'attempted_email': email},
            success=False,
            failure_reason=reason,
        )

    @classmethod
    def log_portal_registration(
        cls,
        request: HttpRequest,
        email: str,
        supplier_name: str = '',
    ) -> Optional[SecurityEvent]:
        """Log portal registration."""
        return cls.log_event(
            event_type=SecurityEvent.EventType.PORTAL_REGISTRATION,
            request=request,
            description=f"Portal registration for {email}",
            details={'email': email, 'supplier_name': supplier_name},
        )

    # =========================================================================
    # Query Methods
    # =========================================================================

    @staticmethod
    def get_events_for_user(
        user,
        limit: int = 100,
        event_types: Optional[list] = None,
    ):
        """Get security events for a specific user."""
        qs = SecurityEvent.objects.filter(user=user)
        if event_types:
            qs = qs.filter(event_type__in=event_types)
        return qs.order_by('-timestamp')[:limit]

    @staticmethod
    def get_events_for_ip(
        ip_address: str,
        limit: int = 100,
        hours: int = 24,
    ):
        """Get security events from a specific IP address."""
        from django.utils import timezone
        from datetime import timedelta

        since = timezone.now() - timedelta(hours=hours)
        return SecurityEvent.objects.filter(
            ip_address=ip_address,
            timestamp__gte=since,
        ).order_by('-timestamp')[:limit]

    @staticmethod
    def get_failed_logins(
        email: Optional[str] = None,
        ip_address: Optional[str] = None,
        hours: int = 1,
    ) -> int:
        """Count failed login attempts."""
        from django.utils import timezone
        from datetime import timedelta

        since = timezone.now() - timedelta(hours=hours)
        qs = SecurityEvent.objects.filter(
            event_type__in=[
                SecurityEvent.EventType.LOGIN_FAILED,
                SecurityEvent.EventType.PORTAL_LOGIN_FAILED,
            ],
            timestamp__gte=since,
        )
        if email:
            qs = qs.filter(details__attempted_email=email)
        if ip_address:
            qs = qs.filter(ip_address=ip_address)
        return qs.count()

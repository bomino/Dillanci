"""
Audit Trail models for tracking all changes in the procurement platform.
"""

import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class AuditLog(models.Model):
    """
    Audit log entry tracking changes to any model in the system.

    Captures:
    - Who made the change (user + denormalized email for retention)
    - When the change was made (timestamp)
    - What was changed (content_type + object_id + changes)
    - Type of action (CREATE, UPDATE, DELETE, STATE_TRANSITION, etc.)
    - State transitions for workflow models
    - Request metadata (IP address, user agent)
    """

    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Create'
        UPDATE = 'UPDATE', 'Update'
        DELETE = 'DELETE', 'Delete'
        STATE_TRANSITION = 'STATE_TRANSITION', 'State Transition'
        SOFT_DELETE = 'SOFT_DELETE', 'Soft Delete'
        RESTORE = 'RESTORE', 'Restore'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    # User who made the change (nullable for system actions)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    # Denormalized for retention after user deletion
    user_email = models.EmailField(
        blank=True,
        default='',
    )

    # Request metadata
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )
    user_agent = models.CharField(
        max_length=512,
        blank=True,
        default='',
    )

    # Organization for multi-tenancy
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='audit_logs',
    )

    # Generic relation to the audited object
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
    )
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # String representation of the object at audit time
    object_repr = models.CharField(
        max_length=512,
        blank=True,
        default='',
    )

    # Action type
    action = models.CharField(
        max_length=20,
        choices=Action.choices,
    )

    # State transition fields
    from_state = models.CharField(
        max_length=50,
        blank=True,
        default='',
    )
    to_state = models.CharField(
        max_length=50,
        blank=True,
        default='',
    )

    # Field-level changes (JSON: {"field_name": {"old": value, "new": value}})
    changes = models.JSONField(
        default=dict,
        blank=True,
    )

    # Additional context data
    extra_data = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['organization', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action']),
        ]
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        return f"{self.action} on {self.object_repr} by {self.user_email or 'system'} at {self.timestamp}"


class AuditConfiguration(models.Model):
    """
    Per-organization audit configuration settings.

    Controls:
    - Whether audit logging is enabled
    - Retention period for audit logs
    - Which fields to exclude from change tracking
    """

    organization = models.OneToOneField(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='audit_config',
        primary_key=True,
    )
    enabled = models.BooleanField(
        default=True,
        help_text='Enable audit logging for this organization',
    )
    retention_days = models.PositiveIntegerField(
        default=365,
        help_text='Number of days to retain audit logs (0 = forever)',
    )
    track_field_changes = models.BooleanField(
        default=True,
        help_text='Track individual field changes in audit logs',
    )
    excluded_fields = models.JSONField(
        default=list,
        blank=True,
        help_text='List of field names to exclude from change tracking',
    )

    class Meta:
        verbose_name = 'Audit Configuration'
        verbose_name_plural = 'Audit Configurations'

    def __str__(self):
        return f"Audit Config for {self.organization.name}"

    @classmethod
    def get_for_organization(cls, organization):
        """Get or create audit configuration for an organization."""
        config, _ = cls.objects.get_or_create(organization=organization)
        return config

    def should_exclude_field(self, field_name):
        """Check if a field should be excluded from audit tracking."""
        # Always exclude these system fields
        system_excluded = ['updated_at', 'created_at', 'id', 'password']
        return field_name in system_excluded or field_name in self.excluded_fields

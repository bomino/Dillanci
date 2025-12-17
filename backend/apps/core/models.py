"""
Core models - Base classes for all models.
"""

import uuid

from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    """
    Abstract base model with common fields.

    Provides:
    - UUID primary key
    - Created/updated timestamps
    - Soft delete functionality
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )
    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def soft_delete(self):
        """Mark the record as deleted without removing from database."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])


class ActiveManager(models.Manager):
    """Manager that filters out soft-deleted records by default."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class SoftDeleteModel(BaseModel):
    """
    Base model with soft delete and active-only default manager.

    Use this for models where you want .objects to only return active records.
    Use .all_objects for including deleted records.
    """

    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def hard_delete(self):
        """Permanently delete the record from the database."""
        super().delete()


# =============================================================================
# Approval Threshold Model - Configure approval rules by amount
# =============================================================================

class ApprovalThreshold(BaseModel):
    """
    Defines approval thresholds for different document types.

    Example:
    - Requisitions under $1,000 auto-approve
    - Requisitions $1,000-$10,000 require manager approval
    - Requisitions over $10,000 require director approval
    """

    DOCUMENT_TYPES = [
        ('REQUISITION', 'Requisition'),
        ('PURCHASE_ORDER', 'Purchase Order'),
        ('INVOICE', 'Invoice'),
        ('CONTRACT', 'Contract'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='approval_thresholds'
    )
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES)

    min_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    max_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Leave empty for unlimited'
    )
    currency = models.CharField(max_length=3, default='USD')

    # Approval requirements
    required_role = models.ForeignKey(
        'users.Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_thresholds',
        help_text='Role required to approve at this level'
    )
    auto_approve = models.BooleanField(
        default=False,
        help_text='Automatically approve without manual review'
    )
    require_budget_check = models.BooleanField(
        default=True,
        help_text='Check budget availability before approval'
    )

    # Escalation
    escalation_hours = models.PositiveIntegerField(
        default=24,
        help_text='Hours before escalation if not approved'
    )
    escalation_role = models.ForeignKey(
        'users.Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalated_thresholds',
        help_text='Role to escalate to if not approved in time'
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'approval_threshold'
        verbose_name = 'Approval Threshold'
        verbose_name_plural = 'Approval Thresholds'
        ordering = ['document_type', 'min_amount']
        unique_together = [['organization', 'document_type', 'min_amount']]

    def __str__(self):
        max_str = f"${self.max_amount:,.2f}" if self.max_amount else "unlimited"
        return f"{self.document_type}: ${self.min_amount:,.2f} - {max_str}"


# =============================================================================
# System Preference Model - Key-value store for organization settings
# =============================================================================

class SystemPreference(BaseModel):
    """
    Key-value store for organization-level system preferences.

    Supports multiple data types via the value_type field.
    """

    VALUE_TYPES = [
        ('STRING', 'String'),
        ('INTEGER', 'Integer'),
        ('DECIMAL', 'Decimal'),
        ('BOOLEAN', 'Boolean'),
        ('JSON', 'JSON'),
    ]

    CATEGORIES = [
        ('GENERAL', 'General Settings'),
        ('NOTIFICATIONS', 'Notification Settings'),
        ('SECURITY', 'Security Settings'),
        ('WORKFLOW', 'Workflow Settings'),
        ('INTEGRATION', 'Integration Settings'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='preferences'
    )

    key = models.CharField(max_length=100)
    value = models.TextField(blank=True)
    value_type = models.CharField(max_length=10, choices=VALUE_TYPES, default='STRING')
    category = models.CharField(max_length=20, choices=CATEGORIES, default='GENERAL')

    label = models.CharField(max_length=200, blank=True, help_text='Human-readable label')
    description = models.TextField(blank=True, help_text='Description of what this setting does')

    is_secret = models.BooleanField(
        default=False,
        help_text='If true, value will be masked in responses'
    )
    is_editable = models.BooleanField(
        default=True,
        help_text='If false, cannot be changed via API'
    )

    class Meta:
        db_table = 'system_preference'
        verbose_name = 'System Preference'
        verbose_name_plural = 'System Preferences'
        ordering = ['category', 'key']
        unique_together = [['organization', 'key']]

    def __str__(self):
        return f"{self.organization.code}: {self.key}"

    def get_typed_value(self):
        """Return the value converted to its proper type."""
        if self.value_type == 'INTEGER':
            return int(self.value) if self.value else 0
        elif self.value_type == 'DECIMAL':
            from decimal import Decimal
            return Decimal(self.value) if self.value else Decimal('0')
        elif self.value_type == 'BOOLEAN':
            return self.value.lower() in ('true', '1', 'yes')
        elif self.value_type == 'JSON':
            import json
            return json.loads(self.value) if self.value else {}
        return self.value

    def set_typed_value(self, value):
        """Set the value, converting from its proper type."""
        if self.value_type == 'BOOLEAN':
            self.value = 'true' if value else 'false'
        elif self.value_type == 'JSON':
            import json
            self.value = json.dumps(value)
        else:
            self.value = str(value) if value is not None else ''


# =============================================================================
# API Key Model - For third-party integrations
# =============================================================================

class APIKey(BaseModel):
    """
    API keys for third-party integrations.
    """

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='api_keys'
    )

    name = models.CharField(max_length=100, help_text='Friendly name for this key')
    key_prefix = models.CharField(
        max_length=8,
        help_text='First 8 characters of the key (for identification)'
    )
    key_hash = models.CharField(
        max_length=256,
        help_text='Hashed version of the full key'
    )

    # Permissions
    scopes = models.JSONField(
        default=list,
        help_text='List of permission scopes this key has access to'
    )

    # Rate limiting
    rate_limit = models.PositiveIntegerField(
        default=1000,
        help_text='Maximum requests per hour'
    )

    # Validity
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Leave empty for no expiration'
    )
    last_used_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_api_keys'
    )

    class Meta:
        db_table = 'api_key'
        verbose_name = 'API Key'
        verbose_name_plural = 'API Keys'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"

    @property
    def is_expired(self):
        """Check if the key has expired."""
        if not self.expires_at:
            return False
        return self.expires_at < timezone.now()

    @property
    def is_valid(self):
        """Check if the key is valid (active and not expired)."""
        return self.is_active and not self.is_expired

    @classmethod
    def generate_key(cls):
        """Generate a new API key."""
        import secrets
        return f"dlc_{secrets.token_urlsafe(32)}"

    @classmethod
    def hash_key(cls, key):
        """Hash an API key for storage."""
        import hashlib
        return hashlib.sha256(key.encode()).hexdigest()

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


# =============================================================================
# Notification Model - In-app notifications for users
# =============================================================================

class Notification(BaseModel):
    """
    In-app notification for users.

    Supports various notification types for procurement events like:
    - Approval requests
    - Status changes
    - Expiring contracts
    - Budget alerts
    """

    NOTIFICATION_TYPES = [
        ('APPROVAL_REQUIRED', 'Approval Required'),
        ('APPROVAL_COMPLETED', 'Approval Completed'),
        ('APPROVAL_REJECTED', 'Approval Rejected'),
        ('DOCUMENT_SUBMITTED', 'Document Submitted'),
        ('BID_RECEIVED', 'Bid Received'),
        ('CONTRACT_EXPIRING', 'Contract Expiring'),
        ('INVOICE_MATCHED', 'Invoice Matched'),
        ('GOODS_RECEIVED', 'Goods Received'),
        ('BUDGET_ALERT', 'Budget Alert'),
        ('SYSTEM_ALERT', 'System Alert'),
        # RFP-specific notification types
        ('RFP_PUBLISHED', 'RFP Published'),
        ('RFP_INVITATION', 'RFP Invitation Received'),
        ('RFP_DEADLINE_REMINDER', 'RFP Deadline Reminder'),
        ('RFP_QA_ANSWERED', 'RFP Question Answered'),
        ('PROPOSAL_RECEIVED', 'Proposal Received'),
        ('PROPOSAL_SHORTLISTED', 'Proposal Shortlisted'),
        ('PROPOSAL_AWARDED', 'Proposal Awarded'),
        ('PROPOSAL_NOT_AWARDED', 'Proposal Not Awarded'),
        ('BAFO_REQUESTED', 'BAFO Requested'),
        ('BAFO_RECEIVED', 'BAFO Response Received'),
        ('RFP_EVALUATION_COMPLETE', 'RFP Evaluation Complete'),
        ('RFP_CLOSED', 'RFP Closed'),
        # RFQ-specific notification types (for symmetry)
        ('RFQ_PUBLISHED', 'RFQ Published'),
        ('RFQ_INVITATION', 'RFQ Invitation Received'),
        ('RFQ_DEADLINE_REMINDER', 'RFQ Deadline Reminder'),
        ('QUOTE_RECEIVED', 'Quote Received'),
        ('RFQ_AWARDED', 'RFQ Awarded'),
        ('RFQ_CLOSED', 'RFQ Closed'),
    ]

    STATUS_CHOICES = [
        ('UNREAD', 'Unread'),
        ('READ', 'Read'),
        ('ARCHIVED', 'Archived'),
    ]

    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    ]

    # Target user
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='User who will receive this notification'
    )

    # Notification content
    type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UNREAD')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='NORMAL')

    # Related object (generic relation)
    related_object_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Type of related object (e.g., requisition, purchase_order)'
    )
    related_object_id = models.UUIDField(
        null=True,
        blank=True,
        help_text='ID of the related object'
    )
    link = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Frontend URL to navigate to'
    )

    # Timestamps
    read_at = models.DateTimeField(null=True, blank=True)

    # Email tracking
    email_sent = models.BooleanField(
        default=False,
        help_text='Whether email notification was sent'
    )
    email_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When email was sent'
    )
    email_error = models.TextField(
        blank=True,
        help_text='Error message if email failed to send'
    )

    # Metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional data for the notification'
    )

    class Meta:
        db_table = 'notification'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['related_object_type', 'related_object_id']),
        ]

    def __str__(self):
        return f"{self.user.email}: {self.title}"

    def mark_as_read(self):
        """Mark the notification as read."""
        if self.status == 'UNREAD':
            self.status = 'READ'
            self.read_at = timezone.now()
            self.save(update_fields=['status', 'read_at', 'updated_at'])

    def archive(self):
        """Archive the notification."""
        self.status = 'ARCHIVED'
        self.save(update_fields=['status', 'updated_at'])

    @classmethod
    def create_notification(
        cls,
        user,
        notification_type,
        title,
        message,
        priority='NORMAL',
        related_object_type=None,
        related_object_id=None,
        link=None,
        metadata=None
    ):
        """
        Helper method to create a notification.

        Args:
            user: The user to notify
            notification_type: Type from NOTIFICATION_TYPES
            title: Short title
            message: Full message
            priority: Priority level
            related_object_type: Type of related object
            related_object_id: UUID of related object
            link: Frontend URL
            metadata: Additional JSON data

        Returns:
            Notification instance
        """
        return cls.objects.create(
            user=user,
            type=notification_type,
            title=title,
            message=message,
            priority=priority,
            related_object_type=related_object_type,
            related_object_id=related_object_id,
            link=link,
            metadata=metadata or {}
        )

    @classmethod
    def notify_users(
        cls,
        users,
        notification_type,
        title,
        message,
        priority='NORMAL',
        related_object_type=None,
        related_object_id=None,
        link=None,
        metadata=None
    ):
        """
        Create notifications for multiple users.

        Args:
            users: Queryset or list of users to notify
            ... (same as create_notification)

        Returns:
            List of created Notification instances
        """
        notifications = []
        for user in users:
            notification = cls.create_notification(
                user=user,
                notification_type=notification_type,
                title=title,
                message=message,
                priority=priority,
                related_object_type=related_object_type,
                related_object_id=related_object_id,
                link=link,
                metadata=metadata
            )
            notifications.append(notification)
        return notifications


# =============================================================================
# Comment Model - Generic comments for any object
# =============================================================================

class Comment(BaseModel):
    """
    Generic comment model that can be attached to any object.

    Uses string-based object type and UUID for flexible attachment to any model.
    Supports threaded comments via parent_id.
    """

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='comments',
    )
    author = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='comments',
    )

    # Generic relation
    object_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text='Type of object (e.g., requisition, rfq, rfp, po)',
    )
    object_id = models.UUIDField(
        db_index=True,
        help_text='UUID of the related object',
    )

    # Comment content
    content = models.TextField()

    # Threading support
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
    )

    class Meta:
        db_table = 'comment'
        verbose_name = 'Comment'
        verbose_name_plural = 'Comments'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['object_type', 'object_id']),
            models.Index(fields=['author', 'created_at']),
        ]

    def __str__(self):
        return f"Comment by {self.author.email} on {self.object_type}:{self.object_id}"

    @property
    def reply_count(self):
        """Get the count of replies to this comment."""
        return self.replies.filter(is_deleted=False).count()


# =============================================================================
# Attachment Model - Generic file attachments for any object
# =============================================================================

def attachment_upload_path(instance, filename):
    """Generate upload path for attachments."""
    return f'attachments/{instance.organization_id}/{instance.object_type}/{instance.object_id}/{filename}'


class Attachment(BaseModel):
    """
    Generic attachment model that can be attached to any object.

    Uses string-based object type and UUID for flexible attachment to any model.
    """

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    uploaded_by = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='uploaded_attachments',
    )

    # Generic relation
    object_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text='Type of object (e.g., requisition, rfq, rfp, po)',
    )
    object_id = models.UUIDField(
        db_index=True,
        help_text='UUID of the related object',
    )

    # File info
    file = models.FileField(upload_to=attachment_upload_path)
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveIntegerField(default=0)

    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attachment'
        verbose_name = 'Attachment'
        verbose_name_plural = 'Attachments'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['object_type', 'object_id']),
            models.Index(fields=['uploaded_by', 'uploaded_at']),
        ]

    def __str__(self):
        return f"{self.filename} attached to {self.object_type}:{self.object_id}"

    @property
    def url(self):
        """Get the URL for downloading this attachment."""
        if self.file:
            return self.file.url
        return None

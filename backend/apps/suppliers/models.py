"""
Supplier models with state machine for lifecycle management.

Includes:
- Supplier: Core supplier entity with approval workflow
- PortalUser: Links suppliers to authentication users for portal access
- PortalInvitation: Invitation for suppliers to create portal accounts
"""

import uuid
from datetime import timedelta

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

from apps.core.exceptions import InvalidStateTransitionError
from apps.core.models import SoftDeleteModel


class Supplier(SoftDeleteModel):
    """
    Supplier model with state machine for lifecycle management.

    Status transitions:
    - PROSPECT -> PENDING_REVIEW (submit_for_review)
    - PENDING_REVIEW -> APPROVED (approve)
    - PENDING_REVIEW -> REJECTED (reject)
    - APPROVED -> BLOCKED (block)
    - BLOCKED -> APPROVED (unblock)
    - REJECTED -> PROSPECT (resubmit)
    """

    STATUSES = [
        ('PROSPECT', 'Prospect'),
        ('PENDING_REVIEW', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('BLOCKED', 'Blocked'),
    ]

    # Valid state transitions: from_state -> [allowed_to_states]
    TRANSITIONS = {
        'PROSPECT': ['PENDING_REVIEW'],
        'PENDING_REVIEW': ['APPROVED', 'REJECTED'],
        'APPROVED': ['BLOCKED'],
        'REJECTED': ['PROSPECT'],
        'BLOCKED': ['APPROVED'],
    }

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='suppliers',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='PROSPECT',
    )

    # Status tracking timestamps
    approved_at = models.DateTimeField(null=True, blank=True)
    blocked_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    # Contact information
    contact_name = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)

    # Address
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default='USA')

    # Performance scores (0-100 scale)
    overall_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Overall performance score (0-100)',
    )
    delivery_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='On-time delivery score (0-100)',
    )
    quality_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Invoice accuracy/quality score (0-100)',
    )
    cost_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Order fulfillment/cost score (0-100)',
    )

    # Performance metadata
    scores_calculated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When scores were last calculated',
    )
    is_preferred = models.BooleanField(
        default=False,
        help_text='Preferred vendor flag',
    )

    TIER_CHOICES = [
        ('STRATEGIC', 'Strategic Partner'),
        ('PREFERRED', 'Preferred'),
        ('APPROVED', 'Approved'),
        ('CONDITIONAL', 'Conditional'),
        ('PROBATION', 'Probation'),
    ]
    performance_tier = models.CharField(
        max_length=20,
        choices=TIER_CHOICES,
        blank=True,
        help_text='Performance tier based on overall score',
    )

    class Meta:
        db_table = 'supplier'
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        unique_together = ['organization', 'code']

    def __str__(self):
        return f'{self.name} ({self.code})'

    def _transition_to(self, new_status: str):
        """
        Validate and execute a state transition.

        Raises:
            InvalidStateTransitionError: If the transition is not allowed.
        """
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='Supplier',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def submit_for_review(self):
        """Submit supplier for approval review."""
        self._transition_to('PENDING_REVIEW')

    def approve(self):
        """Approve the supplier."""
        self._transition_to('APPROVED')
        self.approved_at = timezone.now()
        self.save(update_fields=['approved_at'])

    def reject(self):
        """Reject the supplier."""
        self._transition_to('REJECTED')
        self.rejected_at = timezone.now()
        self.save(update_fields=['rejected_at'])

    def block(self):
        """Block an approved supplier."""
        self._transition_to('BLOCKED')
        self.blocked_at = timezone.now()
        self.save(update_fields=['blocked_at'])

    def unblock(self):
        """Unblock a blocked supplier (returns to APPROVED)."""
        self._transition_to('APPROVED')
        self.blocked_at = None
        self.save(update_fields=['blocked_at'])

    def resubmit(self):
        """Resubmit a rejected supplier (returns to PROSPECT)."""
        self._transition_to('PROSPECT')
        self.rejected_at = None
        self.save(update_fields=['rejected_at'])


# =============================================================================
# Portal Access Models
# =============================================================================

class PortalUser(SoftDeleteModel):
    """
    Links a supplier to an authentication user for portal access.

    Each PortalUser represents a user from a supplier organization who can
    access the supplier portal to view RFQs, submit bids, view POs, etc.

    A supplier can have multiple portal users (e.g., sales reps, account managers).
    """

    ROLES = [
        ('OWNER', 'Owner'),
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    ]

    ACCESS_STATUSES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('REVOKED', 'Revoked'),
    ]

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='portal_users',
        help_text='Supplier this portal user belongs to',
    )
    user = models.OneToOneField(
        'users.User',
        on_delete=models.CASCADE,
        related_name='portal_profile',
        help_text='Authentication user account',
    )
    role = models.CharField(
        max_length=20,
        choices=ROLES,
        default='MEMBER',
        help_text='Role within the supplier organization',
    )
    access_status = models.CharField(
        max_length=20,
        choices=ACCESS_STATUSES,
        default='ACTIVE',
        help_text='Current access status',
    )

    # Tracking
    invited_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_invitations_sent',
        help_text='Internal user who invited this portal user',
    )
    invited_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When the invitation was created',
    )
    last_login_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last portal login timestamp',
    )

    class Meta:
        db_table = 'portal_user'
        verbose_name = 'Portal User'
        verbose_name_plural = 'Portal Users'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} - {self.supplier.name} ({self.role})'

    @property
    def is_active(self) -> bool:
        """Check if portal user has active access."""
        return self.access_status == 'ACTIVE' and self.user.is_active

    def suspend(self, reason: str = ''):
        """Suspend portal access."""
        self.access_status = 'SUSPENDED'
        self.save(update_fields=['access_status', 'updated_at'])

    def revoke(self):
        """Permanently revoke portal access."""
        self.access_status = 'REVOKED'
        self.save(update_fields=['access_status', 'updated_at'])

    def reactivate(self):
        """Reactivate suspended portal access."""
        if self.access_status == 'SUSPENDED':
            self.access_status = 'ACTIVE'
            self.save(update_fields=['access_status', 'updated_at'])

    def update_last_login(self):
        """Update last login timestamp."""
        self.last_login_at = timezone.now()
        self.save(update_fields=['last_login_at', 'updated_at'])


class PortalInvitation(SoftDeleteModel):
    """
    Invitation for a supplier contact to create a portal account.

    Invitations are sent by internal users to supplier contacts.
    Each invitation contains a unique token that expires after a configured period.
    """

    STATUSES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('EXPIRED', 'Expired'),
        ('REVOKED', 'Revoked'),
    ]

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='portal_invitations',
        help_text='Supplier being invited to the portal',
    )
    email = models.EmailField(
        help_text='Email address to send invitation to',
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        help_text='Unique token for accepting the invitation',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='PENDING',
        help_text='Current invitation status',
    )

    # Timing
    expires_at = models.DateTimeField(
        help_text='When this invitation expires',
    )
    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the invitation was accepted',
    )

    # Tracking
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='portal_invitations_created',
        help_text='Internal user who created this invitation',
    )
    accepted_by_user = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accepted_portal_invitations',
        help_text='User account created when accepting',
    )

    # Optional personalization
    personal_message = models.TextField(
        blank=True,
        help_text='Optional personal message from inviter',
    )

    class Meta:
        db_table = 'portal_invitation'
        verbose_name = 'Portal Invitation'
        verbose_name_plural = 'Portal Invitations'
        ordering = ['-created_at']

    def __str__(self):
        return f'Invitation to {self.email} for {self.supplier.name}'

    def save(self, *args, **kwargs):
        # Set expiration if not already set
        if not self.expires_at:
            expiry_days = getattr(settings, 'PORTAL_INVITATION_EXPIRY_DAYS', 7)
            self.expires_at = timezone.now() + timedelta(days=expiry_days)
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        """Check if invitation has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if invitation can still be accepted."""
        return self.status == 'PENDING' and not self.is_expired

    def accept(self, user):
        """
        Mark invitation as accepted.

        Args:
            user: The User instance created during registration
        """
        self.status = 'ACCEPTED'
        self.accepted_at = timezone.now()
        self.accepted_by_user = user
        self.save(update_fields=['status', 'accepted_at', 'accepted_by_user', 'updated_at'])

    def revoke(self):
        """Revoke the invitation."""
        self.status = 'REVOKED'
        self.save(update_fields=['status', 'updated_at'])

    def expire(self):
        """Mark invitation as expired (called by cleanup task)."""
        if self.status == 'PENDING':
            self.status = 'EXPIRED'
            self.save(update_fields=['status', 'updated_at'])

    @classmethod
    def create_invitation(cls, supplier, email, created_by, personal_message=''):
        """
        Create and send a portal invitation.

        Args:
            supplier: Supplier instance
            email: Email address to invite
            created_by: User who is creating the invitation
            personal_message: Optional personal message

        Returns:
            PortalInvitation instance
        """
        from apps.core.tasks import send_portal_invitation_email

        # Revoke any existing pending invitations for this email/supplier
        cls.objects.filter(
            supplier=supplier,
            email=email,
            status='PENDING',
        ).update(status='REVOKED')

        # Create new invitation
        invitation = cls.objects.create(
            supplier=supplier,
            email=email,
            created_by=created_by,
            personal_message=personal_message,
        )

        # Queue email notification
        send_portal_invitation_email.delay(str(invitation.id))

        return invitation

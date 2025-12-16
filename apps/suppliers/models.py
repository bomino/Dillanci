"""
Supplier models with state machine for lifecycle management.
"""

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

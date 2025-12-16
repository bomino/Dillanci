"""
Contract models for managing supplier contracts.

Includes Contract, ContractLine, ContractMilestone, and ContractSpend models.
"""

import uuid
from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.core.exceptions import (
    ContractValidationError,
    InvalidStateTransitionError,
)
from apps.core.models import SoftDeleteModel


class Contract(SoftDeleteModel):
    """
    Contract model for managing supplier agreements.

    Workflow: DRAFT -> PENDING_APPROVAL -> ACTIVE -> EXPIRED | TERMINATED
              DRAFT/PENDING_APPROVAL -> CANCELLED
    """

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('TERMINATED', 'Terminated'),
        ('CANCELLED', 'Cancelled'),
    ]

    TRANSITIONS = {
        'DRAFT': ['PENDING_APPROVAL', 'CANCELLED'],
        'PENDING_APPROVAL': ['ACTIVE', 'DRAFT', 'CANCELLED'],
        'ACTIVE': ['EXPIRED', 'TERMINATED'],
        'EXPIRED': ['ACTIVE'],  # For renewal
        'TERMINATED': [],
        'CANCELLED': [],
    }

    CONTRACT_TYPES = [
        ('BLANKET', 'Blanket Order'),
        ('FIXED_PRICE', 'Fixed Price'),
        ('TIME_MATERIALS', 'Time & Materials'),
        ('FRAMEWORK', 'Framework Agreement'),
    ]

    PAYMENT_TERMS = [
        ('NET15', 'Net 15'),
        ('NET30', 'Net 30'),
        ('NET45', 'Net 45'),
        ('NET60', 'Net 60'),
        ('NET90', 'Net 90'),
        ('DUE_ON_RECEIPT', 'Due on Receipt'),
        ('ADVANCE', 'Advance Payment'),
    ]

    # Basic info
    number = models.CharField(max_length=50, unique=True, blank=True)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='contracts',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='contracts',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Status and type
    status = models.CharField(max_length=20, choices=STATUSES, default='DRAFT')
    contract_type = models.CharField(
        max_length=20,
        choices=CONTRACT_TYPES,
        default='BLANKET',
    )

    # Contract period
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # Financial terms
    total_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Maximum contract value',
    )
    currency = models.CharField(max_length=3, default='USD')

    # Renewal settings
    auto_renew = models.BooleanField(default=False)
    renewal_notice_days = models.PositiveIntegerField(
        default=30,
        help_text='Days before expiry to send renewal notice',
    )

    # Payment and terms
    payment_terms = models.CharField(
        max_length=20,
        choices=PAYMENT_TERMS,
        default='NET30',
    )
    terms_and_conditions = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    # Tracking
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='contracts_created',
    )
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contracts_approved',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.TextField(blank=True)

    # Links
    rfq = models.ForeignKey(
        'rfqs.RFQ',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contracts',
        help_text='RFQ this contract was created from',
    )

    # Amendments
    parent_contract = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='amendments',
        help_text='Original contract if this is an amendment',
    )
    amendment_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'contract'
        verbose_name = 'Contract'
        verbose_name_plural = 'Contracts'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.number} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        """Generate unique contract number."""
        prefix = f'CONTRACT-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    # Properties for spend tracking
    @property
    def total_spent(self) -> Decimal:
        """Calculate total spent against this contract."""
        result = self.spend_records.aggregate(total=Sum('amount'))
        return result['total'] or Decimal('0.00')

    @property
    def remaining_value(self) -> Decimal:
        """Calculate remaining contract value."""
        return self.total_value - self.total_spent

    @property
    def utilization_percent(self) -> Decimal:
        """Calculate utilization percentage."""
        if self.total_value == 0:
            return Decimal('0.00')
        return (self.total_spent / self.total_value) * 100

    @property
    def is_expired(self) -> bool:
        """Check if contract has passed end date."""
        if not self.end_date:
            return False
        return timezone.now().date() > self.end_date

    @property
    def days_until_expiry(self) -> int:
        """Days until contract expires (negative if expired)."""
        if not self.end_date:
            return 0
        delta = self.end_date - timezone.now().date()
        return delta.days

    @property
    def needs_renewal_notice(self) -> bool:
        """Check if renewal notice should be sent."""
        if not self.end_date or self.status != 'ACTIVE':
            return False
        return 0 < self.days_until_expiry <= self.renewal_notice_days

    # State machine methods
    def _transition_to(self, new_status: str):
        """Validate and execute a state transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='Contract',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def submit_for_approval(self):
        """Submit contract for approval (DRAFT -> PENDING_APPROVAL)."""
        # Validation
        if not self.lines.exists():
            raise ContractValidationError('Cannot submit contract without line items')
        if not self.start_date or not self.end_date:
            raise ContractValidationError('Contract must have start and end dates')
        if self.end_date <= self.start_date:
            raise ContractValidationError('End date must be after start date')
        if self.total_value <= 0:
            raise ContractValidationError('Contract must have a positive total value')

        self._transition_to('PENDING_APPROVAL')

    def return_to_draft(self):
        """Return contract to draft for revisions (PENDING_APPROVAL -> DRAFT)."""
        self._transition_to('DRAFT')
        self.approved_by = None
        self.approved_at = None
        self.save(update_fields=['approved_by', 'approved_at', 'updated_at'])

    def approve(self, approved_by):
        """Approve the contract (PENDING_APPROVAL -> ACTIVE)."""
        self._transition_to('ACTIVE')
        self.approved_by = approved_by
        self.approved_at = timezone.now()
        self.save(update_fields=['approved_by', 'approved_at', 'updated_at'])

    def expire(self):
        """Mark contract as expired (ACTIVE -> EXPIRED)."""
        self._transition_to('EXPIRED')

    def terminate(self, reason: str = ''):
        """Terminate the contract (ACTIVE -> TERMINATED)."""
        self._transition_to('TERMINATED')
        self.terminated_at = timezone.now()
        self.termination_reason = reason
        self.save(update_fields=['terminated_at', 'termination_reason', 'updated_at'])

    def cancel(self):
        """Cancel the contract (DRAFT/PENDING_APPROVAL -> CANCELLED)."""
        if self.status in ['ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED']:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state='CANCELLED',
                entity='Contract',
            )
        self.status = 'CANCELLED'
        self.save(update_fields=['status', 'updated_at'])

    def renew(self, new_end_date, new_total_value=None):
        """
        Renew an expired contract (EXPIRED -> ACTIVE).

        Creates a new amendment with updated dates.
        """
        if self.status != 'EXPIRED':
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state='ACTIVE',
                entity='Contract',
            )

        # Update dates
        self.start_date = timezone.now().date()
        self.end_date = new_end_date
        if new_total_value:
            self.total_value = new_total_value
        self.amendment_number += 1

        self._transition_to('ACTIVE')
        self.save(update_fields=[
            'start_date', 'end_date', 'total_value', 'amendment_number', 'updated_at'
        ])


class ContractLine(SoftDeleteModel):
    """Line item in a contract with pricing terms."""

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    line_number = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=500)
    catalog_item = models.ForeignKey(
        'catalog.Item',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contract_lines',
    )

    # Pricing
    unit_of_measure = models.CharField(max_length=20, default='EA')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    # Quantity limits
    min_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    max_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    # Time-limited pricing
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'contract_line'
        verbose_name = 'Contract Line'
        verbose_name_plural = 'Contract Lines'
        ordering = ['line_number']
        unique_together = ['contract', 'line_number']

    def __str__(self):
        return f'{self.contract.number} Line {self.line_number}: {self.description}'

    def save(self, *args, **kwargs):
        if self._state.adding:
            max_line = ContractLine.all_objects.filter(
                contract_id=self.contract_id
            ).order_by('-line_number').first()
            self.line_number = (max_line.line_number + 1) if max_line else 1
        super().save(*args, **kwargs)

    @property
    def is_price_valid(self) -> bool:
        """Check if pricing is currently valid."""
        if not self.is_active:
            return False
        today = timezone.now().date()
        if self.valid_from and today < self.valid_from:
            return False
        if self.valid_to and today > self.valid_to:
            return False
        return True


class ContractMilestone(SoftDeleteModel):
    """Milestone/deliverable tracking for a contract."""

    STATUSES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('MISSED', 'Missed'),
        ('WAIVED', 'Waived'),
    ]

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name='milestones',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='PENDING')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Payment amount tied to this milestone',
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'contract_milestone'
        verbose_name = 'Contract Milestone'
        verbose_name_plural = 'Contract Milestones'
        ordering = ['due_date']

    def __str__(self):
        return f'{self.contract.number} - {self.title}'

    @property
    def is_overdue(self) -> bool:
        """Check if milestone is overdue."""
        if self.status in ['COMPLETED', 'WAIVED']:
            return False
        return timezone.now().date() > self.due_date

    def complete(self, completed_date=None):
        """Mark milestone as completed."""
        self.status = 'COMPLETED'
        self.completed_date = completed_date or timezone.now().date()
        self.save(update_fields=['status', 'completed_date', 'updated_at'])

    def mark_missed(self):
        """Mark milestone as missed."""
        self.status = 'MISSED'
        self.save(update_fields=['status', 'updated_at'])

    def waive(self, reason: str = ''):
        """Waive the milestone."""
        self.status = 'WAIVED'
        if reason:
            self.notes = f'{self.notes}\nWaived: {reason}'.strip()
        self.save(update_fields=['status', 'notes', 'updated_at'])


class ContractSpend(models.Model):
    """Tracks spend/utilization against a contract."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name='spend_records',
    )
    purchase_order = models.ForeignKey(
        'purchase_orders.PurchaseOrder',
        on_delete=models.CASCADE,
        related_name='contract_spend_records',
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    recorded_at = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'contract_spend'
        verbose_name = 'Contract Spend'
        verbose_name_plural = 'Contract Spend Records'
        ordering = ['-recorded_at']
        unique_together = ['contract', 'purchase_order']

    def __str__(self):
        return f'{self.contract.number} - {self.purchase_order.number}: {self.amount}'

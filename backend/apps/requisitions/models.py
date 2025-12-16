"""
Requisition models with approval workflow and budget integration.
"""

from decimal import Decimal
import uuid

from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.core.exceptions import InvalidStateTransitionError
from apps.core.models import SoftDeleteModel


class Requisition(SoftDeleteModel):
    """
    Purchase requisition with approval workflow.

    Workflow:
    - DRAFT -> SUBMITTED (submit)
    - SUBMITTED -> APPROVED (approve)
    - SUBMITTED -> REJECTED (reject)
    - REJECTED -> DRAFT (revise)
    - APPROVED -> CANCELLED (cancel)
    - DRAFT -> CANCELLED (cancel)
    """

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]

    TRANSITIONS = {
        'DRAFT': ['SUBMITTED', 'CANCELLED'],
        'SUBMITTED': ['APPROVED', 'REJECTED'],
        'APPROVED': ['CANCELLED'],
        'REJECTED': ['DRAFT'],
        'CANCELLED': [],
    }

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='requisitions',
    )
    number = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    requester = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='requisitions',
    )
    budget_line = models.ForeignKey(
        'budget.BudgetLine',
        on_delete=models.PROTECT,
        related_name='requisitions',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='DRAFT',
    )

    # Approval tracking
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='approved_requisitions',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    # Budget integration
    encumbrance = models.ForeignKey(
        'budget.Encumbrance',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requisitions',
    )

    class Meta:
        db_table = 'requisition'
        verbose_name = 'Requisition'
        verbose_name_plural = 'Requisitions'

    def __str__(self):
        return f'{self.number} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self):
        """Generate unique requisition number."""
        prefix = f'REQ-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    @property
    def total_amount(self) -> Decimal:
        """Calculate total amount from all lines."""
        result = self.lines.aggregate(
            total=Sum(models.F('quantity') * models.F('unit_price'))
        )
        return result['total'] or Decimal('0.00')

    def _transition_to(self, new_status: str):
        """Validate and execute status transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='Requisition',
            )
        self.status = new_status

    def submit(self):
        """
        Submit requisition for approval.

        Creates budget encumbrance for the total amount.

        Raises:
            ValueError: If requisition has no lines.
            InsufficientBudgetError: If budget is insufficient.
        """
        if not self.lines.exists():
            raise ValueError('Cannot submit requisition without lines')

        # Check budget availability BEFORE changing status
        total = self.total_amount
        if not self.budget_line.check_availability(total):
            from apps.core.exceptions import InsufficientBudgetError
            raise InsufficientBudgetError(
                requested=total,
                available=self.budget_line.available_amount,
                budget_line=self.budget_line.code,
            )

        self._transition_to('SUBMITTED')

        # Create budget encumbrance
        self.encumbrance = self.budget_line.encumber(
            amount=total,
            reference_type='REQUISITION',
            reference_id=self.number,
        )
        self.save()

    def approve(self, approved_by):
        """
        Approve the requisition.

        Args:
            approved_by: User approving the requisition.
        """
        self._transition_to('APPROVED')
        self.approved_by = approved_by
        self.approved_at = timezone.now()
        self.save()

    def reject(self, rejected_by, reason: str):
        """
        Reject the requisition.

        Releases the budget encumbrance.

        Args:
            rejected_by: User rejecting the requisition.
            reason: Reason for rejection.
        """
        self._transition_to('REJECTED')
        self.rejection_reason = reason
        self.rejected_at = timezone.now()

        # Release encumbrance
        if self.encumbrance:
            self.encumbrance.release()

        self.save()

    def revise(self):
        """Return rejected requisition to draft for revision."""
        self._transition_to('DRAFT')
        self.rejection_reason = ''
        self.rejected_at = None
        self.encumbrance = None
        self.save()

    def cancel(self):
        """Cancel the requisition."""
        self._transition_to('CANCELLED')
        if self.encumbrance and self.encumbrance.status == 'ACTIVE':
            self.encumbrance.release()
        self.save()


class RequisitionLine(SoftDeleteModel):
    """
    Line item within a requisition.
    """

    requisition = models.ForeignKey(
        Requisition,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    line_number = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('1.00'),
    )
    unit_of_measure = models.CharField(max_length=20, default='EA')
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )

    # Optional catalog reference
    catalog_item = models.ForeignKey(
        'catalog.Item',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requisition_lines',
    )

    class Meta:
        db_table = 'requisition_line'
        verbose_name = 'Requisition Line'
        verbose_name_plural = 'Requisition Lines'
        ordering = ['line_number']

    def __str__(self):
        return f'{self.requisition.number} Line {self.line_number}'

    @property
    def extended_amount(self) -> Decimal:
        """Calculate extended amount (quantity * unit_price)."""
        return self.quantity * self.unit_price

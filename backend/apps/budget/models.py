"""
Budget models - FiscalYear, BudgetLine, Encumbrance.

Implements budget tracking with encumbrance lifecycle management.
"""

from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.core.exceptions import InsufficientBudgetError
from apps.core.models import SoftDeleteModel


class FiscalYear(SoftDeleteModel):
    """
    Fiscal year for budget planning and tracking.
    """

    STATUSES = [
        ('PLANNING', 'Planning'),
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='fiscal_years',
    )
    year = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='OPEN',
    )

    class Meta:
        db_table = 'fiscal_year'
        verbose_name = 'Fiscal Year'
        verbose_name_plural = 'Fiscal Years'
        unique_together = ['organization', 'year']

    def __str__(self):
        return f'FY{self.year} ({self.organization.code})'


class BudgetLine(SoftDeleteModel):
    """
    Budget line item within a fiscal year.

    Tracks allocated amount, encumbrances, and available balance.
    """

    STATUSES = [
        ('ACTIVE', 'Active'),
        ('FROZEN', 'Frozen'),
        ('CLOSED', 'Closed'),
    ]

    fiscal_year = models.ForeignKey(
        FiscalYear,
        on_delete=models.PROTECT,
        related_name='budget_lines',
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    allocated_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='ACTIVE',
    )

    # Optional parent for hierarchical budgets
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children',
    )

    class Meta:
        db_table = 'budget_line'
        verbose_name = 'Budget Line'
        verbose_name_plural = 'Budget Lines'
        unique_together = ['fiscal_year', 'code']

    def __str__(self):
        return f'{self.code} - {self.name}'

    @property
    def organization(self):
        """Get organization from fiscal year."""
        return self.fiscal_year.organization

    @property
    def encumbered_amount(self) -> Decimal:
        """
        Calculate total encumbered amount from active encumbrances.

        Returns:
            Decimal: Sum of active encumbrance amounts.
        """
        result = self.encumbrances.filter(
            status='ACTIVE'
        ).aggregate(total=Sum('amount'))
        return result['total'] or Decimal('0.00')

    @property
    def available_amount(self) -> Decimal:
        """
        Calculate available budget (allocated - encumbered).

        Returns:
            Decimal: Available amount for new encumbrances.
        """
        return self.allocated_amount - self.encumbered_amount

    def check_availability(self, amount: Decimal) -> bool:
        """
        Check if requested amount is available.

        Args:
            amount: Amount to check.

        Returns:
            bool: True if sufficient budget available.
        """
        return self.available_amount >= amount

    def encumber(
        self,
        amount: Decimal,
        reference_type: str,
        reference_id: str,
    ) -> 'Encumbrance':
        """
        Create an encumbrance against this budget line.

        Args:
            amount: Amount to encumber.
            reference_type: Type of document (REQUISITION, PO, etc.)
            reference_id: ID of the referencing document.

        Returns:
            Encumbrance: The created encumbrance.

        Raises:
            InsufficientBudgetError: If budget is insufficient.
        """
        if not self.check_availability(amount):
            raise InsufficientBudgetError(
                requested=amount,
                available=self.available_amount,
                budget_line=self.code,
            )

        return Encumbrance.objects.create(
            budget_line=self,
            amount=amount,
            reference_type=reference_type,
            reference_id=reference_id,
        )


class Encumbrance(SoftDeleteModel):
    """
    Budget encumbrance - a commitment against a budget line.

    Lifecycle:
    - ACTIVE: Funds are committed
    - RELEASED: Commitment cancelled (funds returned to available)
    - LIQUIDATED: Commitment converted to expense
    """

    STATUSES = [
        ('ACTIVE', 'Active'),
        ('RELEASED', 'Released'),
        ('LIQUIDATED', 'Liquidated'),
    ]

    REFERENCE_TYPES = [
        ('REQUISITION', 'Requisition'),
        ('PO', 'Purchase Order'),
        ('INVOICE', 'Invoice'),
    ]

    budget_line = models.ForeignKey(
        BudgetLine,
        on_delete=models.PROTECT,
        related_name='encumbrances',
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    reference_type = models.CharField(
        max_length=20,
        choices=REFERENCE_TYPES,
    )
    reference_id = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='ACTIVE',
    )
    released_at = models.DateTimeField(null=True, blank=True)
    liquidated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'encumbrance'
        verbose_name = 'Encumbrance'
        verbose_name_plural = 'Encumbrances'

    def __str__(self):
        return f'{self.reference_type}:{self.reference_id} - ${self.amount}'

    def release(self):
        """
        Release the encumbrance, returning funds to available.
        """
        self.status = 'RELEASED'
        self.released_at = timezone.now()
        self.save(update_fields=['status', 'released_at', 'updated_at'])

    def liquidate(self):
        """
        Liquidate the encumbrance (convert to actual expense).
        """
        self.status = 'LIQUIDATED'
        self.liquidated_at = timezone.now()
        self.save(update_fields=['status', 'liquidated_at', 'updated_at'])

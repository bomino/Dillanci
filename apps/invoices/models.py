"""
Invoice models for procure-to-pay cycle.

Includes:
- MatchingConfiguration: Per-org tolerance settings for 3-way matching
- Invoice: Supplier invoice with state machine workflow
- InvoiceLine: Line items with match status tracking
"""

from datetime import date
from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.core.exceptions import InvalidStateTransitionError
from apps.core.models import SoftDeleteModel


class MatchingConfiguration(models.Model):
    """
    Per-organization configuration for 3-way matching tolerances.

    Controls automatic matching behavior:
    - Price tolerance: How much invoice price can deviate from PO price
    - Quantity tolerance: How much invoice qty can deviate from GR qty
    - Auto-match threshold: Max invoice amount for automatic matching
    """

    organization = models.OneToOneField(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='matching_config',
    )
    price_tolerance_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.00'),
        help_text='Max price variance % for auto-match (default 5%)',
    )
    quantity_tolerance_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('2.00'),
        help_text='Max quantity variance % for auto-match (default 2%)',
    )
    auto_match_max_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('10000.00'),
        help_text='Max invoice total for auto-match (default $10,000)',
    )
    require_goods_receipt = models.BooleanField(
        default=True,
        help_text='Require GR before invoice can be matched',
    )
    allow_over_receipt = models.BooleanField(
        default=False,
        help_text='Allow receipt qty to exceed PO qty',
    )
    allow_over_invoice = models.BooleanField(
        default=False,
        help_text='Allow invoice qty to exceed PO qty',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Matching Configuration'
        verbose_name_plural = 'Matching Configurations'

    def __str__(self):
        return f"Matching Config for {self.organization.name}"


class Invoice(SoftDeleteModel):
    """
    Supplier invoice linked to a Purchase Order.

    Workflow:
    DRAFT → VALIDATED → MATCHED → APPROVED → PAID
                │           │          │
                └───────────┴──────────┴─→ CANCELLED/REJECTED/DISPUTED
    """

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('VALIDATED', 'Validated'),
        ('MATCHED', 'Matched'),
        ('APPROVED', 'Approved'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
        ('REJECTED', 'Rejected'),
        ('DISPUTED', 'Disputed'),
    ]

    TRANSITIONS = {
        'DRAFT': ['VALIDATED', 'CANCELLED'],
        'VALIDATED': ['MATCHED', 'REJECTED', 'CANCELLED'],
        'MATCHED': ['APPROVED', 'DISPUTED', 'CANCELLED'],
        'APPROVED': ['PAID', 'CANCELLED'],
        'PAID': [],
        'CANCELLED': [],
        'REJECTED': ['DRAFT'],  # Can revise rejected invoice
        'DISPUTED': ['MATCHED', 'CANCELLED'],  # Resolve dispute
    }

    MATCH_TYPES = [
        ('AUTO', 'Automatic Match'),
        ('MANUAL', 'Manual Match'),
        ('OVERRIDE', 'Override Match'),
    ]

    # Auto-generated number
    number = models.CharField(max_length=50, unique=True, blank=True)

    # Supplier reference
    supplier_invoice_number = models.CharField(
        max_length=100,
        help_text='Supplier invoice reference number',
    )

    # Relationships
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='invoices',
    )
    purchase_order = models.ForeignKey(
        'purchase_orders.PurchaseOrder',
        on_delete=models.PROTECT,
        related_name='invoices',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='invoices',
    )

    # Status and workflow
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='DRAFT',
    )
    match_type = models.CharField(
        max_length=20,
        choices=MATCH_TYPES,
        null=True,
        blank=True,
    )

    # Dates
    invoice_date = models.DateField(default=date.today)
    due_date = models.DateField(null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    matched_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    # Users
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_invoices',
    )
    validated_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_invoices',
    )
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_invoices',
    )

    # Amounts
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    shipping_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )

    # Budget integration
    encumbrance = models.ForeignKey(
        'budget.Encumbrance',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
        help_text='Encumbrance to liquidate on approval',
    )

    # Notes
    notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    dispute_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['purchase_order']),
            models.Index(fields=['supplier']),
            models.Index(fields=['number']),
        ]

    def __str__(self):
        return f"{self.number} - {self.supplier.name}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self):
        """Generate invoice number: INV-YYYY-XXXXXX."""
        year = timezone.now().year
        prefix = f'INV-{year}-'

        last_invoice = (
            Invoice.all_objects.filter(number__startswith=prefix)
            .order_by('-number')
            .first()
        )

        if last_invoice:
            last_num = int(last_invoice.number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1

        return f'{prefix}{new_num:06d}'

    def _transition_to(self, new_status):
        """Validate and execute state transition."""
        if new_status not in self.TRANSITIONS.get(self.status, []):
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='Invoice',
            )
        self.status = new_status

    @property
    def total_amount(self) -> Decimal:
        """Calculate total invoice amount."""
        return (
            self.subtotal
            + self.tax_amount
            + self.shipping_amount
            - self.discount_amount
        )

    def calculate_subtotal(self):
        """Calculate subtotal from line items."""
        self.subtotal = sum(
            line.extended_amount for line in self.lines.all()
        )
        return self.subtotal

    # Workflow methods

    def validate(self, validated_by):
        """Validate invoice (DRAFT -> VALIDATED)."""
        self._transition_to('VALIDATED')
        self.validated_by = validated_by
        self.validated_at = timezone.now()
        self.save(update_fields=['status', 'validated_by', 'validated_at', 'updated_at'])

    def mark_matched(self, match_type='AUTO'):
        """Mark invoice as matched (VALIDATED -> MATCHED)."""
        self._transition_to('MATCHED')
        self.match_type = match_type
        self.matched_at = timezone.now()
        self.save(update_fields=['status', 'match_type', 'matched_at', 'updated_at'])

    def approve(self, approved_by):
        """
        Approve invoice and liquidate encumbrance (MATCHED -> APPROVED).

        This triggers budget liquidation - converting encumbered funds to actual spend.
        """
        self._transition_to('APPROVED')
        self.approved_by = approved_by
        self.approved_at = timezone.now()

        # Liquidate encumbrance if linked
        if self.encumbrance and self.encumbrance.status == 'ACTIVE':
            self.encumbrance.liquidate()

        self.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

    def mark_paid(self):
        """Mark invoice as paid (APPROVED -> PAID)."""
        self._transition_to('PAID')
        self.paid_at = timezone.now()
        self.save(update_fields=['status', 'paid_at', 'updated_at'])

    def reject(self, reason=''):
        """Reject invoice (VALIDATED -> REJECTED)."""
        self._transition_to('REJECTED')
        self.rejection_reason = reason
        self.save(update_fields=['status', 'rejection_reason', 'updated_at'])

    def dispute(self, reason=''):
        """Dispute invoice (MATCHED -> DISPUTED)."""
        self._transition_to('DISPUTED')
        self.dispute_reason = reason
        self.save(update_fields=['status', 'dispute_reason', 'updated_at'])

    def resolve_dispute(self):
        """Resolve dispute and return to matched (DISPUTED -> MATCHED)."""
        self._transition_to('MATCHED')
        self.save(update_fields=['status', 'updated_at'])

    def revise(self):
        """Return rejected invoice to draft (REJECTED -> DRAFT)."""
        self._transition_to('DRAFT')
        self.rejection_reason = ''
        self.save(update_fields=['status', 'rejection_reason', 'updated_at'])

    def cancel(self):
        """Cancel invoice."""
        if self.status in ['PAID', 'CANCELLED']:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state='CANCELLED',
                entity='Invoice',
            )
        self.status = 'CANCELLED'
        self.save(update_fields=['status', 'updated_at'])


class InvoiceLine(SoftDeleteModel):
    """
    Invoice line item with 3-way match tracking.

    Tracks variance between:
    - PO line: Original order quantity and price
    - GR line: Actual quantity received
    - Invoice line: Quantity and price being billed
    """

    MATCH_STATUSES = [
        ('PENDING', 'Pending'),
        ('MATCHED', 'Matched'),
        ('QUANTITY_MISMATCH', 'Quantity Mismatch'),
        ('PRICE_MISMATCH', 'Price Mismatch'),
        ('BOTH_MISMATCH', 'Both Mismatch'),
    ]

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    po_line = models.ForeignKey(
        'purchase_orders.POLine',
        on_delete=models.PROTECT,
        related_name='invoice_lines',
    )
    line_number = models.PositiveIntegerField(default=1)

    # Invoiced amounts
    quantity_invoiced = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Match tracking
    match_status = models.CharField(
        max_length=20,
        choices=MATCH_STATUSES,
        default='PENDING',
    )
    quantity_variance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Invoice qty - GR qty',
    )
    price_variance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Invoice price - PO price',
    )
    quantity_matched = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Quantity successfully matched',
    )

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['line_number']
        unique_together = [['invoice', 'line_number']]
        indexes = [
            models.Index(fields=['invoice', 'match_status']),
        ]

    def __str__(self):
        return f"Line {self.line_number} - {self.po_line.description}"

    def save(self, *args, **kwargs):
        # Auto-assign line number on create
        if self._state.adding:
            max_line = InvoiceLine.all_objects.filter(
                invoice_id=self.invoice_id
            ).order_by('-line_number').first()
            self.line_number = (max_line.line_number + 1) if max_line else 1
        super().save(*args, **kwargs)

    @property
    def extended_amount(self) -> Decimal:
        """Calculate line total: quantity * unit_price."""
        return self.quantity_invoiced * self.unit_price

    @property
    def po_unit_price(self) -> Decimal:
        """Get the original PO unit price for comparison."""
        return self.po_line.unit_price

    @property
    def gr_quantity(self) -> Decimal:
        """Get the quantity received for this PO line."""
        return self.po_line.quantity_received

    def calculate_variances(self):
        """Calculate quantity and price variances."""
        # Quantity variance: invoice qty vs GR qty
        self.quantity_variance = self.quantity_invoiced - self.gr_quantity

        # Price variance: invoice price vs PO price
        self.price_variance = self.unit_price - self.po_unit_price

        return {
            'quantity_variance': self.quantity_variance,
            'price_variance': self.price_variance,
        }

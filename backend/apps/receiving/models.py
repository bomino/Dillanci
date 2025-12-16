"""
Goods Receipt models for tracking physical delivery of PO items.

Includes GoodsReceipt and GoodsReceiptLine models with workflow state machine.
"""

import uuid
from datetime import date
from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.core.exceptions import InvalidStateTransitionError
from apps.core.models import SoftDeleteModel


class GoodsReceipt(SoftDeleteModel):
    """
    Goods Receipt model for tracking physical delivery.

    Workflow: DRAFT -> POSTED | CANCELLED

    Multiple receipts can be created per PO for partial deliveries.
    """

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('CANCELLED', 'Cancelled'),
    ]

    TRANSITIONS = {
        'DRAFT': ['POSTED', 'CANCELLED'],
        'POSTED': [],  # Terminal state (cannot un-receive)
        'CANCELLED': [],  # Terminal state
    }

    INSPECTION_STATUSES = [
        ('PENDING', 'Pending'),
        ('PASSED', 'Passed'),
        ('FAILED', 'Failed'),
    ]

    # Identification
    number = models.CharField(max_length=50, unique=True, blank=True)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='goods_receipts',
    )

    # Linked PO
    purchase_order = models.ForeignKey(
        'purchase_orders.PurchaseOrder',
        on_delete=models.PROTECT,
        related_name='goods_receipts',
    )

    # Status
    status = models.CharField(max_length=20, choices=STATUSES, default='DRAFT')

    # Tracking
    received_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='goods_receipts_received',
    )
    receipt_date = models.DateField(default=date.today)
    posted_at = models.DateTimeField(null=True, blank=True)

    # Delivery info
    delivery_note_number = models.CharField(max_length=100, blank=True)
    carrier = models.CharField(max_length=100, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)

    # Quality inspection (optional)
    inspection_required = models.BooleanField(default=False)
    inspection_status = models.CharField(
        max_length=20,
        choices=INSPECTION_STATUSES,
        null=True,
        blank=True,
    )
    inspection_notes = models.TextField(blank=True)
    inspected_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='inspections_performed',
    )
    inspected_at = models.DateTimeField(null=True, blank=True)

    # Notes
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'goods_receipt'
        verbose_name = 'Goods Receipt'
        verbose_name_plural = 'Goods Receipts'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.number} - PO {self.purchase_order.number}'

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        """Generate unique GR number."""
        prefix = f'GR-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    def _transition_to(self, new_status: str):
        """Validate and execute a state transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='GoodsReceipt',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def post(self):
        """
        Post the goods receipt (DRAFT -> POSTED).

        Updates POLine received quantities.
        """
        from apps.receiving.services import GoodsReceiptService

        # Validate PO status
        GoodsReceiptService.validate_po_status(self.purchase_order)

        # Validate line quantities
        errors = GoodsReceiptService.validate_line_quantities(self)
        if errors:
            raise ValueError('; '.join(errors))

        # Transition to POSTED
        self._transition_to('POSTED')
        self.posted_at = timezone.now()

        # Update PO line received quantities
        for gr_line in self.lines.all():
            po_line = gr_line.po_line
            accepted = gr_line.quantity_accepted or gr_line.quantity_received
            po_line.quantity_received += accepted
            po_line.save(update_fields=['quantity_received', 'updated_at'])

        # Check if PO is fully received
        po = self.purchase_order
        all_received = all(line.is_fully_received for line in po.lines.all())

        if all_received and po.status == 'SENT':
            po.receive()

        self.save(update_fields=['posted_at', 'updated_at'])

    def cancel(self):
        """Cancel the goods receipt (DRAFT -> CANCELLED)."""
        self._transition_to('CANCELLED')

    @property
    def total_quantity_received(self) -> Decimal:
        """Calculate total quantity received across all lines."""
        total = self.lines.aggregate(
            total=models.Sum('quantity_received')
        )['total']
        return total or Decimal('0.00')


class GoodsReceiptLine(SoftDeleteModel):
    """Line item in a Goods Receipt, linked to a specific PO line."""

    goods_receipt = models.ForeignKey(
        GoodsReceipt,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    po_line = models.ForeignKey(
        'purchase_orders.POLine',
        on_delete=models.PROTECT,
        related_name='receipt_lines',
    )
    line_number = models.PositiveIntegerField(default=1)

    # Quantities
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_accepted = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    quantity_rejected = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00')
    )
    rejection_reason = models.CharField(max_length=500, blank=True)

    # Storage info
    storage_location = models.CharField(max_length=100, blank=True)
    batch_number = models.CharField(max_length=100, blank=True)
    serial_numbers = models.JSONField(default=list, blank=True)

    # Notes
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'goods_receipt_line'
        verbose_name = 'Goods Receipt Line'
        verbose_name_plural = 'Goods Receipt Lines'
        ordering = ['line_number']
        unique_together = ['goods_receipt', 'line_number']

    def __str__(self):
        return f'{self.goods_receipt.number} Line {self.line_number}'

    def save(self, *args, **kwargs):
        # Auto-assign line number on create
        if self._state.adding:
            max_line = GoodsReceiptLine.all_objects.filter(
                goods_receipt_id=self.goods_receipt_id
            ).order_by('-line_number').first()
            self.line_number = (max_line.line_number + 1) if max_line else 1

        # Default quantity_accepted to quantity_received if not set
        if self.quantity_accepted is None:
            self.quantity_accepted = self.quantity_received

        super().save(*args, **kwargs)

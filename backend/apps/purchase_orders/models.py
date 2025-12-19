"""
Purchase Order models for procurement management.

Includes PurchaseOrder and POLine models with workflow state machine.
"""

import uuid
from decimal import Decimal

from django.db import models
from django.db.models import F, Sum
from django.utils import timezone

from apps.core.exceptions import InvalidStateTransitionError
from apps.core.models import SoftDeleteModel


class PurchaseOrder(SoftDeleteModel):
    """
    Purchase Order model.

    Workflow: DRAFT -> SUBMITTED -> APPROVED -> SENT -> RECEIVED -> COMPLETED
                 |         |           |         |
                 v         v           v         v
              CANCELLED  REJECTED  CANCELLED  CANCELLED
    """

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('SENT', 'Sent to Supplier'),
        ('RECEIVED', 'Received'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    TRANSITIONS = {
        'DRAFT': ['SUBMITTED', 'CANCELLED'],
        'SUBMITTED': ['APPROVED', 'REJECTED', 'CANCELLED'],
        'APPROVED': ['SENT', 'CANCELLED'],
        'REJECTED': ['DRAFT'],  # Can revise
        'SENT': ['RECEIVED', 'CANCELLED'],
        'RECEIVED': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],  # Terminal state
        'CANCELLED': [],  # Terminal state
    }

    number = models.CharField(max_length=50, unique=True, blank=True)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='purchase_orders',
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='pos_created',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='purchase_orders',
    )
    budget_line = models.ForeignKey(
        'budget.BudgetLine',
        on_delete=models.PROTECT,
        related_name='purchase_orders',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='DRAFT')

    # Status timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Approval info
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pos_approved',
    )
    rejected_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pos_rejected',
    )
    rejection_reason = models.CharField(max_length=1000, blank=True)

    # Optional link to Requisition
    requisition = models.ForeignKey(
        'requisitions.Requisition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
        help_text='Source requisition this PO was created from',
    )

    # Optional links to RFQ/Bid
    rfq = models.ForeignKey(
        'rfqs.RFQ',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
    )
    bid = models.ForeignKey(
        'rfqs.Bid',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
    )

    # Optional links to RFP/Proposal
    rfp = models.ForeignKey(
        'rfps.RFP',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
    )
    proposal = models.ForeignKey(
        'rfps.Proposal',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
    )

    # Shipping info
    ship_to_address = models.TextField(blank=True)
    shipping_terms = models.CharField(max_length=100, blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    expected_delivery = models.DateField(null=True, blank=True)

    # Notes
    notes = models.TextField(blank=True)

    # Budget encumbrance link (created on approval)
    encumbrance = models.ForeignKey(
        'budget.Encumbrance',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
    )

    # Optional contract link
    contract = models.ForeignKey(
        'contracts.Contract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
        help_text='Contract this PO is placed against',
    )

    class Meta:
        db_table = 'purchase_order'
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.number} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        """Generate unique PO number."""
        prefix = f'PO-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    @property
    def total_amount(self) -> Decimal:
        """Calculate total from lines."""
        result = self.lines.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )
        return result['total'] or Decimal('0.00')

    def _transition_to(self, new_status: str):
        """Validate and execute a state transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='PurchaseOrder',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def submit(self):
        """Submit PO for approval (DRAFT -> SUBMITTED)."""
        if not self.lines.exists():
            raise ValueError('Cannot submit PO without line items')

        self._transition_to('SUBMITTED')
        self.submitted_at = timezone.now()
        self.save(update_fields=['submitted_at', 'updated_at'])

    def approve(self, approved_by):
        """Approve the PO and create budget encumbrance (SUBMITTED -> APPROVED)."""
        self._transition_to('APPROVED')
        self.approved_by = approved_by
        self.approved_at = timezone.now()

        # Create budget encumbrance
        self.encumbrance = self.budget_line.encumber(
            amount=self.total_amount,
            reference_type='PO',
            reference_id=self.number,
        )

        self.save(update_fields=['approved_by', 'approved_at', 'encumbrance', 'updated_at'])

    def reject(self, rejected_by, reason: str):
        """Reject the PO (SUBMITTED -> REJECTED)."""
        self._transition_to('REJECTED')
        self.rejected_by = rejected_by
        self.rejection_reason = reason
        self.save(update_fields=['rejected_by', 'rejection_reason', 'updated_at'])

    def revise(self):
        """Return rejected PO to draft (REJECTED -> DRAFT)."""
        self._transition_to('DRAFT')
        # Clear rejection info
        self.rejected_by = None
        self.rejection_reason = ''
        self.save(update_fields=['rejected_by', 'rejection_reason', 'updated_at'])

    def send(self):
        """Send PO to supplier (APPROVED -> SENT)."""
        self._transition_to('SENT')
        self.sent_at = timezone.now()
        self.save(update_fields=['sent_at', 'updated_at'])

    def receive(self):
        """Mark PO as received (SENT -> RECEIVED)."""
        self._transition_to('RECEIVED')
        self.received_at = timezone.now()
        self.save(update_fields=['received_at', 'updated_at'])

    def complete(self):
        """Complete the PO (RECEIVED -> COMPLETED)."""
        self._transition_to('COMPLETED')
        self.completed_at = timezone.now()
        self.save(update_fields=['completed_at', 'updated_at'])

    def cancel(self):
        """Cancel the PO and release encumbrance if exists."""
        if self.status in ['COMPLETED', 'CANCELLED']:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state='CANCELLED',
                entity='PurchaseOrder',
            )
        self.status = 'CANCELLED'

        # Release encumbrance if exists
        if self.encumbrance and self.encumbrance.status == 'ACTIVE':
            self.encumbrance.release()

        self.save(update_fields=['status', 'updated_at'])

    @classmethod
    def create_from_bid(cls, bid, budget_line, created_by):
        """
        Create a PO from an awarded bid.

        Copies bid line items to PO lines.
        """
        if bid.status != 'AWARDED':
            raise ValueError('Can only create PO from awarded bid')

        po = cls.objects.create(
            organization=bid.rfq.organization,
            created_by=created_by,
            supplier=bid.supplier,
            budget_line=budget_line,
            title=f'PO from {bid.rfq.title}',
            rfq=bid.rfq,
            bid=bid,
        )

        # Copy bid lines to PO lines
        for bid_line in bid.lines.all():
            POLine.objects.create(
                purchase_order=po,
                description=bid_line.rfq_line.description,
                quantity=bid_line.rfq_line.quantity,
                unit_price=bid_line.unit_price,
                unit_of_measure=bid_line.rfq_line.unit_of_measure,
                catalog_item=bid_line.rfq_line.catalog_item,
                rfq_line=bid_line.rfq_line,
                bid_line=bid_line,
            )

        return po

    @classmethod
    def create_from_requisition(cls, requisition, supplier, created_by):
        """
        Create a PO from an approved requisition.

        Copies requisition line items to PO lines.

        Args:
            requisition: The approved requisition to convert
            supplier: The supplier for the PO
            created_by: User creating the PO

        Returns:
            PurchaseOrder: The created purchase order

        Raises:
            ValueError: If requisition is not approved
        """
        if requisition.status != 'APPROVED':
            raise ValueError('Can only create PO from approved requisition')

        po = cls.objects.create(
            organization=requisition.organization,
            created_by=created_by,
            supplier=supplier,
            budget_line=requisition.budget_line,
            title=f'PO from {requisition.title}',
            requisition=requisition,
            description=requisition.description,
        )

        # Copy requisition lines to PO lines
        for req_line in requisition.lines.all():
            POLine.objects.create(
                purchase_order=po,
                description=req_line.description,
                quantity=req_line.quantity,
                unit_price=req_line.unit_price,
                unit_of_measure=req_line.unit_of_measure,
                catalog_item=req_line.catalog_item,
                requisition_line=req_line,
            )

        return po

    @classmethod
    def create_from_proposal(cls, proposal, budget_line, created_by, contract=None):
        """
        Create a PO from an awarded RFP proposal.

        Args:
            proposal: The awarded proposal
            budget_line: Budget line to charge
            created_by: User creating the PO
            contract: Optional contract to link (if Contract was created first)

        Returns:
            PurchaseOrder: The created purchase order

        Raises:
            ValueError: If proposal is not awarded
        """
        if proposal.status != 'AWARDED':
            raise ValueError('Can only create PO from awarded proposal')

        rfp = proposal.rfp

        po = cls.objects.create(
            organization=rfp.organization,
            created_by=created_by,
            supplier=proposal.supplier,
            budget_line=budget_line,
            title=f'PO from {rfp.title}',
            description=rfp.description,
            rfp=rfp,
            proposal=proposal,
            requisition=rfp.requisition,
            contract=contract,
        )

        # Copy proposal line items to PO lines
        for prop_line in proposal.line_items.all():
            POLine.objects.create(
                purchase_order=po,
                description=prop_line.rfp_line_item.description,
                quantity=prop_line.quantity,
                unit_price=prop_line.unit_price,
                unit_of_measure=prop_line.rfp_line_item.unit_of_measure,
                catalog_item=prop_line.rfp_line_item.catalog_item,
                proposal_line=prop_line,
            )

        return po


class POLine(SoftDeleteModel):
    """Line item in a Purchase Order."""

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    line_number = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    unit_of_measure = models.CharField(max_length=20, default='EA')

    # Optional links
    catalog_item = models.ForeignKey(
        'catalog.Item',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
    )
    requisition_line = models.ForeignKey(
        'requisitions.RequisitionLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
        help_text='Source requisition line this PO line was created from',
    )
    rfq_line = models.ForeignKey(
        'rfqs.RFQLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
    )
    bid_line = models.ForeignKey(
        'rfqs.BidLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
    )
    proposal_line = models.ForeignKey(
        'rfps.ProposalLineItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
        help_text='Source proposal line this PO line was created from',
    )

    # Receiving tracking
    quantity_received = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00')
    )

    # Invoice tracking
    quantity_invoiced = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00')
    )

    class Meta:
        db_table = 'po_line'
        verbose_name = 'PO Line'
        verbose_name_plural = 'PO Lines'
        ordering = ['line_number']
        unique_together = ['purchase_order', 'line_number']

    def __str__(self):
        return f'{self.purchase_order.number} Line {self.line_number}: {self.description}'

    def save(self, *args, **kwargs):
        # Auto-assign line number on create
        if self._state.adding:
            max_line = POLine.all_objects.filter(
                purchase_order_id=self.purchase_order_id
            ).order_by('-line_number').first()
            self.line_number = (max_line.line_number + 1) if max_line else 1
        super().save(*args, **kwargs)

    @property
    def extended_amount(self) -> Decimal:
        """Calculate extended amount (quantity * unit_price)."""
        return self.quantity * self.unit_price

    @property
    def remaining_quantity(self) -> Decimal:
        """Calculate remaining quantity to receive."""
        return self.quantity - self.quantity_received

    @property
    def remaining_to_invoice(self) -> Decimal:
        """Calculate remaining quantity to invoice."""
        return self.quantity - self.quantity_invoiced

    @property
    def is_fully_received(self) -> bool:
        """Check if line is fully received."""
        return self.quantity_received >= self.quantity

    @property
    def is_fully_invoiced(self) -> bool:
        """Check if line is fully invoiced."""
        return self.quantity_invoiced >= self.quantity


# =============================================================================
# Supplier Portal - PO Acknowledgment
# =============================================================================

class POAcknowledgment(SoftDeleteModel):
    """
    Track supplier acknowledgment of purchase orders via the portal.

    When a PO is sent to a supplier, they can acknowledge receipt through
    the supplier portal. This tracks their response including any revised
    delivery dates or comments.
    """

    STATUSES = [
        ('PENDING', 'Pending'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('REJECTED', 'Rejected'),
    ]

    purchase_order = models.OneToOneField(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='acknowledgment',
        help_text='Purchase order being acknowledged',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='PENDING',
        help_text='Acknowledgment status',
    )

    # Response details
    acknowledged_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the supplier acknowledged the PO',
    )
    acknowledged_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_acknowledgments',
        help_text='Portal user who acknowledged',
    )

    # Supplier can propose revised delivery date
    revised_delivery_date = models.DateField(
        null=True,
        blank=True,
        help_text='Supplier proposed delivery date (if different from PO)',
    )
    delivery_date_reason = models.CharField(
        max_length=500,
        blank=True,
        help_text='Reason for revised delivery date',
    )

    # Supplier comments
    comments = models.TextField(
        blank=True,
        help_text='Supplier comments or notes',
    )

    # Rejection details (if rejected)
    rejection_reason = models.TextField(
        blank=True,
        help_text='Reason for rejection (if status is REJECTED)',
    )

    # Internal tracking
    reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When last acknowledgment reminder was sent',
    )
    reminders_sent = models.PositiveIntegerField(
        default=0,
        help_text='Number of reminder emails sent',
    )

    class Meta:
        db_table = 'po_acknowledgment'
        verbose_name = 'PO Acknowledgment'
        verbose_name_plural = 'PO Acknowledgments'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.purchase_order.number} - {self.status}'

    @property
    def is_pending(self) -> bool:
        """Check if acknowledgment is still pending."""
        return self.status == 'PENDING'

    @property
    def has_revised_delivery(self) -> bool:
        """Check if supplier proposed a different delivery date."""
        return (
            self.revised_delivery_date is not None and
            self.revised_delivery_date != self.purchase_order.expected_delivery
        )

    def acknowledge(self, user, comments='', revised_delivery_date=None, delivery_date_reason=''):
        """
        Mark the PO as acknowledged by the supplier.

        Args:
            user: Portal user acknowledging the PO
            comments: Optional supplier comments
            revised_delivery_date: Optional revised delivery date
            delivery_date_reason: Reason for revised delivery date
        """
        self.status = 'ACKNOWLEDGED'
        self.acknowledged_at = timezone.now()
        self.acknowledged_by = user
        self.comments = comments

        if revised_delivery_date:
            self.revised_delivery_date = revised_delivery_date
            self.delivery_date_reason = delivery_date_reason

        self.save(update_fields=[
            'status', 'acknowledged_at', 'acknowledged_by', 'comments',
            'revised_delivery_date', 'delivery_date_reason', 'updated_at'
        ])

    def reject(self, user, rejection_reason):
        """
        Reject the PO (supplier cannot fulfill).

        Args:
            user: Portal user rejecting the PO
            rejection_reason: Reason for rejection
        """
        self.status = 'REJECTED'
        self.acknowledged_at = timezone.now()
        self.acknowledged_by = user
        self.rejection_reason = rejection_reason
        self.save(update_fields=[
            'status', 'acknowledged_at', 'acknowledged_by',
            'rejection_reason', 'updated_at'
        ])

    @classmethod
    def create_for_po(cls, purchase_order):
        """
        Create an acknowledgment record when PO is sent to supplier.

        Args:
            purchase_order: PurchaseOrder instance

        Returns:
            POAcknowledgment instance
        """
        acknowledgment, created = cls.objects.get_or_create(
            purchase_order=purchase_order,
            defaults={'status': 'PENDING'}
        )
        return acknowledgment

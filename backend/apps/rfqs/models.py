"""
RFQ models for Request for Quote management.

Includes RFQ, RFQLine, SupplierInvitation, Bid, and BidLine models.
"""

import uuid
from decimal import Decimal

from django.db import models
from django.db.models import F, Sum
from django.utils import timezone

from apps.core.exceptions import (
    DuplicateInvitationError,
    InvalidStateTransitionError,
    RFQNotOpenError,
)
from apps.core.models import SoftDeleteModel


class RFQ(SoftDeleteModel):
    """
    Request for Quote model.

    Workflow: DRAFT -> OPEN -> CLOSED -> AWARDED | CANCELLED
    """

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('OPEN', 'Open for Bids'),
        ('CLOSED', 'Closed'),
        ('AWARDED', 'Awarded'),
        ('CANCELLED', 'Cancelled'),
    ]

    BID_TYPES = [
        ('OPEN', 'Open Bid'),
        ('SEALED', 'Sealed Bid'),
        ('INVITED', 'Invited Bid'),
    ]

    PAYMENT_TERMS_CHOICES = [
        ('NET15', 'Net 15'),
        ('NET30', 'Net 30'),
        ('NET45', 'Net 45'),
        ('NET60', 'Net 60'),
        ('NET90', 'Net 90'),
        ('DUE_ON_RECEIPT', 'Due on Receipt'),
        ('ADVANCE', '50% Advance, 50% on Delivery'),
        ('MILESTONE', 'Milestone-based'),
        ('OTHER', 'Other'),
    ]

    TRANSITIONS = {
        'DRAFT': ['OPEN', 'CANCELLED'],
        'OPEN': ['CLOSED', 'CANCELLED'],
        'CLOSED': ['AWARDED', 'CANCELLED'],
        'AWARDED': [],
        'CANCELLED': [],
    }

    # Basic Information
    number = models.CharField(max_length=50, unique=True, blank=True)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='rfqs',
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='rfqs_created',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='DRAFT')
    bid_type = models.CharField(max_length=20, choices=BID_TYPES, default='INVITED')

    # Buyer/Contact Information
    buyer_name = models.CharField(max_length=100, blank=True)
    buyer_email = models.EmailField(blank=True)
    buyer_phone = models.CharField(max_length=30, blank=True)
    department = models.CharField(max_length=100, blank=True)

    # Project Background
    project_background = models.TextField(
        blank=True,
        help_text='Brief summary of the project goals to provide context'
    )

    # Critical Timelines
    issue_date = models.DateTimeField(null=True, blank=True)
    qa_deadline = models.DateTimeField(
        null=True, blank=True,
        help_text='Deadline for supplier questions'
    )
    submission_deadline = models.DateTimeField(
        null=True, blank=True,
        help_text='Final deadline for bid submissions'
    )
    expected_award_date = models.DateTimeField(
        null=True, blank=True,
        help_text='Target date for announcing the winner'
    )

    # Legacy fields (mapped to new fields)
    open_date = models.DateTimeField(null=True, blank=True)
    close_date = models.DateTimeField(null=True, blank=True)
    awarded_date = models.DateTimeField(null=True, blank=True)

    # Commercial Terms
    payment_terms = models.CharField(
        max_length=20, choices=PAYMENT_TERMS_CHOICES, default='NET30'
    )
    payment_terms_notes = models.TextField(blank=True)
    contract_duration_months = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Proposed contract length in months'
    )
    contract_renewal_options = models.CharField(
        max_length=200, blank=True,
        help_text='e.g., "2 x 1-year renewals"'
    )
    currency = models.CharField(max_length=3, default='USD')

    # Delivery Requirements
    delivery_address = models.TextField(blank=True)
    delivery_terms = models.CharField(
        max_length=50, blank=True,
        help_text='Incoterms (e.g., FOB, CIF, DDP)'
    )
    required_delivery_date = models.DateField(null=True, blank=True)

    # Evaluation Criteria (stored as JSON for flexibility)
    evaluation_criteria = models.JSONField(
        null=True, blank=True,
        help_text='Weighted scoring criteria, e.g., [{"name": "Price", "weight": 60}, {"name": "Quality", "weight": 20}]'
    )
    required_certifications = models.TextField(
        blank=True,
        help_text='Required vendor certifications (e.g., ISO 9001, SOC 2)'
    )
    required_attachments_description = models.TextField(
        blank=True,
        help_text='Description of required attachments (licenses, NDAs, etc.)'
    )

    # Terms and Conditions
    terms_and_conditions = models.TextField(blank=True)
    nda_required = models.BooleanField(default=False)

    # Award info
    awarded_supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='rfqs_awarded',
    )
    awarded_bid = models.ForeignKey(
        'rfqs.Bid',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='rfq_awarded',
    )

    # Optional link to requisition
    requisition = models.ForeignKey(
        'requisitions.Requisition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfqs',
    )

    class Meta:
        db_table = 'rfq'
        verbose_name = 'RFQ'
        verbose_name_plural = 'RFQs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.number} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        """Generate unique RFQ number."""
        prefix = f'RFQ-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    @property
    def total_amount(self) -> Decimal:
        """Calculate total from lines with target prices."""
        result = self.lines.filter(
            target_unit_price__isnull=False
        ).aggregate(
            total=Sum(F('quantity') * F('target_unit_price'))
        )
        return result['total'] or Decimal('0.00')

    def _transition_to(self, new_status: str):
        """Validate and execute a state transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='RFQ',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def open_for_bids(self):
        """Open RFQ for bid submissions (DRAFT -> OPEN)."""
        if not self.lines.exists():
            raise ValueError('Cannot open RFQ without line items')
        if not self.invitations.exists():
            raise ValueError('Cannot open RFQ without supplier invitations')

        self._transition_to('OPEN')
        self.open_date = timezone.now()
        self.save(update_fields=['open_date', 'updated_at'])

    def close_bids(self):
        """Close RFQ for bid submissions (OPEN -> CLOSED)."""
        self._transition_to('CLOSED')
        self.close_date = timezone.now()
        self.save(update_fields=['close_date', 'updated_at'])

    def award(self, bid):
        """Award RFQ to a supplier (CLOSED -> AWARDED)."""
        if bid is None:
            raise ValueError('Cannot award RFQ without a valid bid')
        if bid.rfq_id != self.id:
            raise ValueError('Bid does not belong to this RFQ')
        if bid.status != 'SUBMITTED':
            raise ValueError('Can only award to submitted bids')

        self._transition_to('AWARDED')
        self.awarded_date = timezone.now()
        self.awarded_supplier = bid.supplier
        self.awarded_bid = bid
        self.save(update_fields=[
            'awarded_date', 'awarded_supplier', 'awarded_bid', 'updated_at'
        ])

        # Update bid status
        bid.status = 'AWARDED'
        bid.save(update_fields=['status', 'updated_at'])

        # Mark other bids as not awarded
        self.bids.exclude(id=bid.id).filter(status='SUBMITTED').update(
            status='NOT_AWARDED'
        )

    def cancel(self):
        """Cancel the RFQ (Any -> CANCELLED)."""
        if self.status == 'CANCELLED':
            return  # Already cancelled
        if self.status == 'AWARDED':
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state='CANCELLED',
                entity='RFQ',
            )
        self.status = 'CANCELLED'
        self.save(update_fields=['status', 'updated_at'])

    def duplicate(self, created_by):
        """
        Create a copy of this RFQ with all line items.

        The new RFQ will:
        - Have a new auto-generated number
        - Start in DRAFT status
        - Copy all line items
        - NOT copy supplier invitations or bids
        - Reset all dates to null

        Args:
            created_by: The user creating the duplicate

        Returns:
            RFQ: The newly created duplicate RFQ
        """
        # Create the new RFQ with copied fields
        new_rfq = RFQ.objects.create(
            organization=self.organization,
            created_by=created_by,
            title=f"{self.title} (Copy)",
            description=self.description,
            status='DRAFT',
            bid_type=self.bid_type,
            # Buyer info - use current user's info if available
            buyer_name=created_by.full_name or self.buyer_name,
            buyer_email=created_by.email or self.buyer_email,
            buyer_phone=self.buyer_phone,
            department=self.department,
            # Project background
            project_background=self.project_background,
            # Commercial terms
            payment_terms=self.payment_terms,
            payment_terms_notes=self.payment_terms_notes,
            contract_duration_months=self.contract_duration_months,
            contract_renewal_options=self.contract_renewal_options,
            currency=self.currency,
            # Delivery requirements
            delivery_address=self.delivery_address,
            delivery_terms=self.delivery_terms,
            required_delivery_date=self.required_delivery_date,
            # Evaluation criteria
            evaluation_criteria=self.evaluation_criteria,
            required_certifications=self.required_certifications,
            required_attachments_description=self.required_attachments_description,
            # Terms and conditions
            terms_and_conditions=self.terms_and_conditions,
            nda_required=self.nda_required,
            # Link to same requisition if applicable
            requisition=self.requisition,
            # Dates and award info are intentionally NOT copied
            # number is auto-generated, status is DRAFT
        )

        # Clone all line items
        for line in self.lines.all():
            RFQLine.objects.create(
                rfq=new_rfq,
                # line_number is auto-assigned in save()
                description=line.description,
                quantity=line.quantity,
                unit_of_measure=line.unit_of_measure,
                target_unit_price=line.target_unit_price,
                catalog_item=line.catalog_item,
            )

        return new_rfq


class RFQLine(SoftDeleteModel):
    """Line item in an RFQ."""

    rfq = models.ForeignKey(
        RFQ,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    line_number = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_of_measure = models.CharField(max_length=20, default='EA')
    target_unit_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    catalog_item = models.ForeignKey(
        'catalog.Item',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfq_lines',
    )

    class Meta:
        db_table = 'rfq_line'
        verbose_name = 'RFQ Line'
        verbose_name_plural = 'RFQ Lines'
        ordering = ['line_number']
        unique_together = ['rfq', 'line_number']

    def __str__(self):
        return f'{self.rfq.number} Line {self.line_number}: {self.description}'

    def save(self, *args, **kwargs):
        # Check if this is a new instance (not in database yet)
        # Note: self.pk exists due to UUID default, so check _state.adding instead
        if self._state.adding:
            # Always auto-assign line number on create using database query
            # Use all_objects to include soft-deleted, and filter by rfq_id directly
            max_line = RFQLine.all_objects.filter(rfq_id=self.rfq_id).order_by('-line_number').first()
            self.line_number = (max_line.line_number + 1) if max_line else 1
        super().save(*args, **kwargs)

    @property
    def extended_amount(self) -> Decimal:
        """Calculate extended amount (quantity * target_unit_price)."""
        if self.target_unit_price is None:
            return Decimal('0.00')
        return self.quantity * self.target_unit_price


class SupplierInvitation(SoftDeleteModel):
    """Tracks supplier invitations to an RFQ."""

    STATUSES = [
        ('PENDING', 'Pending'),
        ('VIEWED', 'Viewed'),
        ('BID_SUBMITTED', 'Bid Submitted'),
        ('DECLINED', 'Declined'),
    ]

    rfq = models.ForeignKey(
        RFQ,
        on_delete=models.CASCADE,
        related_name='invitations',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='rfq_invitations',
    )
    invited_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='rfq_invitations_sent',
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='PENDING')
    viewed_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'supplier_invitation'
        verbose_name = 'Supplier Invitation'
        verbose_name_plural = 'Supplier Invitations'
        unique_together = ['rfq', 'supplier']

    def __str__(self):
        return f'{self.supplier.name} invited to {self.rfq.number}'

    def save(self, *args, **kwargs):
        # Check for duplicate invitation on create
        # Note: self.pk exists due to UUID default, so check _state.adding instead
        if self._state.adding:
            if SupplierInvitation.objects.filter(
                rfq=self.rfq, supplier=self.supplier
            ).exists():
                raise DuplicateInvitationError(
                    rfq_number=self.rfq.number,
                    supplier_name=self.supplier.name,
                )
        super().save(*args, **kwargs)

    def mark_viewed(self):
        """Mark invitation as viewed."""
        self.status = 'VIEWED'
        self.viewed_at = timezone.now()
        self.save(update_fields=['status', 'viewed_at', 'updated_at'])

    def mark_bid_submitted(self):
        """Mark invitation as bid submitted."""
        self.status = 'BID_SUBMITTED'
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at', 'updated_at'])

    def decline(self, reason: str = ''):
        """Decline the invitation."""
        self.status = 'DECLINED'
        self.decline_reason = reason
        self.responded_at = timezone.now()
        self.save(update_fields=[
            'status', 'decline_reason', 'responded_at', 'updated_at'
        ])


class Bid(SoftDeleteModel):
    """Supplier bid for an RFQ."""

    STATUSES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('AWARDED', 'Awarded'),
        ('NOT_AWARDED', 'Not Awarded'),
    ]

    rfq = models.ForeignKey(
        RFQ,
        on_delete=models.CASCADE,
        related_name='bids',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='bids',
    )
    submitted_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='bids_submitted',
    )
    status = models.CharField(max_length=20, choices=STATUSES, default='DRAFT')
    submitted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    valid_until = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'bid'
        verbose_name = 'Bid'
        verbose_name_plural = 'Bids'
        ordering = ['-created_at']
        unique_together = ['rfq', 'supplier']

    def __str__(self):
        return f'{self.supplier.name} bid for {self.rfq.number}'

    @property
    def total_amount(self) -> Decimal:
        """Calculate total bid amount from bid lines."""
        result = self.lines.aggregate(
            total=Sum(F('unit_price') * F('rfq_line__quantity'))
        )
        return result['total'] or Decimal('0.00')

    def submit(self):
        """Submit the bid (DRAFT -> SUBMITTED)."""
        if self.rfq.status != 'OPEN':
            raise RFQNotOpenError(
                rfq_number=self.rfq.number,
                status=self.rfq.status,
            )
        if not self.lines.exists():
            raise ValueError('Cannot submit bid without line items')

        self.status = 'SUBMITTED'
        self.submitted_at = timezone.now()
        self.save(update_fields=['status', 'submitted_at', 'updated_at'])

        # Update invitation status
        try:
            invitation = SupplierInvitation.objects.get(
                rfq=self.rfq, supplier=self.supplier
            )
            invitation.mark_bid_submitted()
        except SupplierInvitation.DoesNotExist:
            pass


class BidLine(SoftDeleteModel):
    """Line item in a bid."""

    bid = models.ForeignKey(
        Bid,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    rfq_line = models.ForeignKey(
        RFQLine,
        on_delete=models.PROTECT,
        related_name='bid_lines',
    )
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    lead_time_days = models.PositiveIntegerField(null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'bid_line'
        verbose_name = 'Bid Line'
        verbose_name_plural = 'Bid Lines'
        unique_together = ['bid', 'rfq_line']

    def __str__(self):
        return f'{self.bid} - Line {self.rfq_line.line_number}'

    def save(self, *args, **kwargs):
        # Validate rfq_line belongs to the same RFQ
        if self.rfq_line.rfq_id != self.bid.rfq_id:
            raise ValueError(
                f'RFQ line belongs to different RFQ '
                f'(line RFQ: {self.rfq_line.rfq_id}, bid RFQ: {self.bid.rfq_id})'
            )
        super().save(*args, **kwargs)

    @property
    def extended_amount(self) -> Decimal:
        """Calculate extended amount (rfq_line.quantity * unit_price)."""
        return self.rfq_line.quantity * self.unit_price

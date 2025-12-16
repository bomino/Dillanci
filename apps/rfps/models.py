"""
RFP (Request for Proposal) models with multi-criteria scoring,
weighted evaluation, and BAFO (Best and Final Offer) support.
"""

import uuid

from decimal import Decimal
from django.db import models
from django.db.models import Avg, Sum
from django.utils import timezone

from apps.core.exceptions import (
    DuplicateInvitationError,
    InvalidStateTransitionError,
)
from apps.core.models import SoftDeleteModel


class RFP(SoftDeleteModel):
    """
    Request for Proposal with multi-criteria evaluation workflow.

    Workflow:
    DRAFT → PUBLISHED → EVALUATION → BAFO → CLOSED → AWARDED
                                                       ↓
                                                   CANCELLED
    """

    # Status choices
    STATUSES = [
        ('DRAFT', 'Draft'),
        ('PUBLISHED', 'Published'),
        ('EVALUATION', 'Evaluation'),
        ('BAFO', 'BAFO Round'),
        ('CLOSED', 'Closed'),
        ('AWARDED', 'Awarded'),
        ('CANCELLED', 'Cancelled'),
    ]

    # Valid state transitions
    TRANSITIONS = {
        'DRAFT': ['PUBLISHED', 'CANCELLED'],
        'PUBLISHED': ['EVALUATION', 'CANCELLED'],
        'EVALUATION': ['BAFO', 'CLOSED', 'CANCELLED'],
        'BAFO': ['EVALUATION', 'CLOSED', 'CANCELLED'],
        'CLOSED': ['AWARDED'],
        'AWARDED': [],
        'CANCELLED': [],
    }

    # RFP Type choices
    RFP_TYPES = [
        ('SERVICES', 'Services'),
        ('GOODS', 'Goods'),
        ('COMBINED', 'Combined'),
    ]

    # Bidding type choices
    BIDDING_TYPES = [
        ('OPEN', 'Open'),
        ('SEALED', 'Sealed'),
        ('MULTI_ROUND', 'Multi-Round'),
    ]

    # Visibility choices
    VISIBILITY_CHOICES = [
        ('INVITED', 'Invited Only'),
        ('PUBLIC', 'Public'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=30, unique=True, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='rfps',
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_rfps',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='DRAFT',
    )
    rfp_type = models.CharField(
        max_length=20,
        choices=RFP_TYPES,
        default='SERVICES',
    )
    estimated_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
    )
    publish_date = models.DateTimeField(null=True, blank=True)
    question_deadline = models.DateTimeField(null=True, blank=True)
    response_deadline = models.DateTimeField(null=True, blank=True)
    evaluation_start_date = models.DateTimeField(null=True, blank=True)
    award_target_date = models.DateField(null=True, blank=True)
    bidding_type = models.CharField(
        max_length=20,
        choices=BIDDING_TYPES,
        default='SEALED',
    )
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='INVITED',
    )
    awarded_supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='awarded_rfps',
    )
    awarded_proposal = models.ForeignKey(
        'Proposal',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='awarded_for_rfp',
    )
    awarded_date = models.DateTimeField(null=True, blank=True)
    requisition = models.ForeignKey(
        'requisitions.Requisition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfps',
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'rfp'
        verbose_name = 'Request for Proposal'
        verbose_name_plural = 'Requests for Proposal'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.number} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        """Generate unique RFP number."""
        prefix = f'RFP-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    def _transition_to(self, new_status: str):
        """Validate and execute a state transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='RFP',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def publish(self):
        """Publish the RFP (DRAFT → PUBLISHED)."""
        if not self.sections.exists():
            raise ValueError('Cannot publish RFP without sections')
        if not self.invitations.exists():
            raise ValueError('Cannot publish RFP without invitations')
        if not self.criteria.exists():
            raise ValueError('Cannot publish RFP without scoring criteria')

        self._transition_to('PUBLISHED')
        self.publish_date = timezone.now()
        self.save(update_fields=['publish_date', 'updated_at'])

    def start_evaluation(self):
        """Start evaluation phase (PUBLISHED → EVALUATION)."""
        self._transition_to('EVALUATION')
        self.evaluation_start_date = timezone.now()
        self.save(update_fields=['evaluation_start_date', 'updated_at'])

    def start_bafo_round(self):
        """Start BAFO round (EVALUATION → BAFO)."""
        # Must have at least one shortlisted proposal
        if not self.proposals.filter(status='SHORTLISTED').exists():
            raise ValueError('Cannot start BAFO without shortlisted proposals')
        self._transition_to('BAFO')

    def close_bafo_round(self):
        """Close BAFO round and return to evaluation (BAFO → EVALUATION)."""
        self._transition_to('EVALUATION')

    def close_evaluation(self):
        """Close evaluation (EVALUATION/BAFO → CLOSED)."""
        self._transition_to('CLOSED')

    def award(self, proposal):
        """Award the RFP to a proposal (CLOSED → AWARDED)."""
        if proposal.rfp_id != self.id:
            raise ValueError('Proposal does not belong to this RFP')
        if proposal.status not in ['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']:
            raise ValueError('Proposal must be submitted or shortlisted to be awarded')

        self._transition_to('AWARDED')
        self.awarded_proposal = proposal
        self.awarded_supplier = proposal.supplier
        self.awarded_date = timezone.now()
        self.save(update_fields=['awarded_proposal', 'awarded_supplier', 'awarded_date', 'updated_at'])

        # Update proposal statuses
        proposal.status = 'AWARDED'
        proposal.save(update_fields=['status', 'updated_at'])

        # Mark other proposals as not awarded
        self.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        ).exclude(id=proposal.id).update(status='NOT_AWARDED')

    def cancel(self):
        """Cancel the RFP."""
        if self.status == 'AWARDED':
            raise ValueError('Cannot cancel an awarded RFP')
        self._transition_to('CANCELLED')

    @property
    def total_section_weight(self) -> Decimal:
        """Sum of all scorable section weights."""
        result = self.sections.filter(is_scorable=True).aggregate(
            total=Sum('weight')
        )
        return result['total'] or Decimal('0')


class RFPSection(models.Model):
    """Multi-section structure for RFP with weights for scoring."""

    SECTION_TYPES = [
        ('ADMINISTRATIVE', 'Administrative'),
        ('TECHNICAL', 'Technical'),
        ('MANAGEMENT', 'Management'),
        ('PRICING', 'Pricing'),
        ('TERMS', 'Terms & Conditions'),
        ('QUALIFICATIONS', 'Qualifications'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='sections',
    )
    section_number = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=255)
    section_type = models.CharField(
        max_length=20,
        choices=SECTION_TYPES,
        default='TECHNICAL',
    )
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0'),
        help_text='Weight percentage for scoring (0-100)',
    )
    instructions = models.TextField(blank=True, default='')
    is_scorable = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rfp_section'
        verbose_name = 'RFP Section'
        verbose_name_plural = 'RFP Sections'
        ordering = ['order', 'section_number']
        constraints = [
            models.UniqueConstraint(
                fields=['rfp', 'section_number'],
                name='unique_rfp_section_number',
            ),
        ]

    def __str__(self):
        return f'{self.rfp.number} - Section {self.section_number}: {self.title}'

    def save(self, *args, **kwargs):
        if not self.section_number:
            max_num = RFPSection.objects.filter(rfp=self.rfp).aggregate(
                max_num=models.Max('section_number')
            )['max_num'] or 0
            self.section_number = max_num + 1
        super().save(*args, **kwargs)


class RFPQuestion(models.Model):
    """Questions within RFP sections."""

    QUESTION_TYPES = [
        ('TEXT', 'Short Text'),
        ('TEXTAREA', 'Long Text'),
        ('SINGLE_CHOICE', 'Single Choice'),
        ('MULTI_CHOICE', 'Multiple Choice'),
        ('NUMBER', 'Number'),
        ('DATE', 'Date'),
        ('FILE', 'File Upload'),
        ('RATING', 'Rating Scale'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        RFPSection,
        on_delete=models.CASCADE,
        related_name='questions',
    )
    question_number = models.PositiveSmallIntegerField()
    question_text = models.TextField()
    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPES,
        default='TEXT',
    )
    options = models.JSONField(
        null=True,
        blank=True,
        help_text='Options for choice-type questions',
    )
    is_required = models.BooleanField(default=True)
    max_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.0'),
    )
    scoring_guidance = models.TextField(
        blank=True,
        default='',
        help_text='Guidance for evaluators on how to score responses',
    )
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rfp_question'
        verbose_name = 'RFP Question'
        verbose_name_plural = 'RFP Questions'
        ordering = ['order', 'question_number']
        constraints = [
            models.UniqueConstraint(
                fields=['section', 'question_number'],
                name='unique_section_question_number',
            ),
        ]

    def __str__(self):
        return f'{self.section.rfp.number} - Q{self.question_number}: {self.question_text[:50]}'

    def save(self, *args, **kwargs):
        if not self.question_number:
            max_num = RFPQuestion.objects.filter(section=self.section).aggregate(
                max_num=models.Max('question_number')
            )['max_num'] or 0
            self.question_number = max_num + 1
        super().save(*args, **kwargs)


class RFPLineItem(models.Model):
    """Pricing line items for RFP."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='line_items',
    )
    section = models.ForeignKey(
        RFPSection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='line_items',
        help_text='Optional link to pricing section',
    )
    line_number = models.PositiveIntegerField()
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        default=Decimal('1'),
    )
    unit_of_measure = models.CharField(max_length=20, default='EA')
    target_unit_price = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
    )
    catalog_item = models.ForeignKey(
        'catalog.Item',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfp_line_items',
    )
    notes = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rfp_line_item'
        verbose_name = 'RFP Line Item'
        verbose_name_plural = 'RFP Line Items'
        ordering = ['line_number']
        constraints = [
            models.UniqueConstraint(
                fields=['rfp', 'line_number'],
                name='unique_rfp_line_number',
            ),
        ]

    def __str__(self):
        return f'{self.rfp.number} - Line {self.line_number}: {self.description[:50]}'

    def save(self, *args, **kwargs):
        if not self.line_number:
            max_num = RFPLineItem.objects.filter(rfp=self.rfp).aggregate(
                max_num=models.Max('line_number')
            )['max_num'] or 0
            self.line_number = max_num + 1
        super().save(*args, **kwargs)

    @property
    def extended_amount(self) -> Decimal:
        """Calculate extended amount if target price is set."""
        if self.target_unit_price:
            return self.quantity * self.target_unit_price
        return Decimal('0')


class ScoringCriteria(models.Model):
    """Evaluation criteria with weights for scoring proposals."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='criteria',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Weight percentage (0-100)',
    )
    section = models.ForeignKey(
        RFPSection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scoring_criteria',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_criteria',
    )
    max_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.0'),
    )
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'scoring_criteria'
        verbose_name = 'Scoring Criteria'
        verbose_name_plural = 'Scoring Criteria'
        ordering = ['order']

    def __str__(self):
        return f'{self.rfp.number} - {self.name} ({self.weight}%)'


class RFPInvitation(models.Model):
    """Supplier invitations for RFP with tracking."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('VIEWED', 'Viewed'),
        ('PROPOSAL_SUBMITTED', 'Proposal Submitted'),
        ('DECLINED', 'Declined'),
        ('DISQUALIFIED', 'Disqualified'),
    ]

    INTENT_CHOICES = [
        ('YES', 'Yes'),
        ('NO', 'No'),
        ('UNDECIDED', 'Undecided'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='invitations',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='rfp_invitations',
    )
    invited_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='sent_rfp_invitations',
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
    )
    viewed_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    intent_to_bid = models.CharField(
        max_length=20,
        choices=INTENT_CHOICES,
        null=True,
        blank=True,
    )
    decline_reason = models.CharField(max_length=500, blank=True, default='')
    disqualified = models.BooleanField(default=False)
    disqualification_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rfp_invitation'
        verbose_name = 'RFP Invitation'
        verbose_name_plural = 'RFP Invitations'
        ordering = ['-invited_at']
        constraints = [
            models.UniqueConstraint(
                fields=['rfp', 'supplier'],
                name='unique_rfp_supplier_invitation',
            ),
        ]

    def __str__(self):
        return f'{self.rfp.number} - {self.supplier.name}'

    def save(self, *args, **kwargs):
        # Check for duplicate invitation on create
        if self._state.adding:
            if RFPInvitation.objects.filter(
                rfp=self.rfp, supplier=self.supplier
            ).exists():
                raise DuplicateInvitationError(
                    rfq_number=self.rfp.number,
                    supplier_name=self.supplier.name,
                )
        super().save(*args, **kwargs)

    def mark_viewed(self):
        """Mark invitation as viewed."""
        self.status = 'VIEWED'
        self.viewed_at = timezone.now()
        self.save(update_fields=['status', 'viewed_at', 'updated_at'])

    def mark_proposal_submitted(self):
        """Mark invitation when proposal is submitted."""
        self.status = 'PROPOSAL_SUBMITTED'
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at', 'updated_at'])

    def decline(self, reason: str = ''):
        """Decline the invitation."""
        self.status = 'DECLINED'
        self.decline_reason = reason
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'decline_reason', 'responded_at', 'updated_at'])

    def disqualify(self, reason: str):
        """Disqualify the supplier from this RFP."""
        self.status = 'DISQUALIFIED'
        self.disqualified = True
        self.disqualification_reason = reason
        self.save(update_fields=['status', 'disqualified', 'disqualification_reason', 'updated_at'])


class Proposal(SoftDeleteModel):
    """Supplier proposal/response to an RFP."""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('SHORTLISTED', 'Shortlisted'),
        ('BAFO_REQUESTED', 'BAFO Requested'),
        ('BAFO_SUBMITTED', 'BAFO Submitted'),
        ('AWARDED', 'Awarded'),
        ('NOT_AWARDED', 'Not Awarded'),
        ('WITHDRAWN', 'Withdrawn'),
        ('DISQUALIFIED', 'Disqualified'),
    ]

    TRANSITIONS = {
        'DRAFT': ['SUBMITTED', 'WITHDRAWN'],
        'SUBMITTED': ['SHORTLISTED', 'NOT_AWARDED', 'DISQUALIFIED', 'WITHDRAWN'],
        'SHORTLISTED': ['BAFO_REQUESTED', 'AWARDED', 'NOT_AWARDED', 'DISQUALIFIED'],
        'BAFO_REQUESTED': ['BAFO_SUBMITTED', 'NOT_AWARDED', 'DISQUALIFIED'],
        'BAFO_SUBMITTED': ['SHORTLISTED', 'AWARDED', 'NOT_AWARDED', 'DISQUALIFIED'],
        'AWARDED': [],
        'NOT_AWARDED': [],
        'WITHDRAWN': [],
        'DISQUALIFIED': [],
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='proposals',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='proposals',
    )
    submitted_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='submitted_proposals',
    )
    proposal_number = models.CharField(max_length=30, unique=True, editable=False)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    revision_number = models.PositiveSmallIntegerField(default=1)
    is_latest = models.BooleanField(default=True)

    # Scores (calculated)
    technical_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    management_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    pricing_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    overall_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    rank = models.PositiveSmallIntegerField(null=True, blank=True)

    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'proposal'
        verbose_name = 'Proposal'
        verbose_name_plural = 'Proposals'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['rfp', 'supplier', 'revision_number'],
                name='unique_rfp_supplier_revision',
            ),
        ]

    def __str__(self):
        return f'{self.proposal_number} - {self.supplier.name}'

    def save(self, *args, **kwargs):
        if not self.proposal_number:
            self.proposal_number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        """Generate unique proposal number."""
        prefix = f'PROP-{timezone.now().year}'
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{random_suffix}'

    def _transition_to(self, new_status: str):
        """Validate and execute a state transition."""
        allowed = self.TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionError(
                from_state=self.status,
                to_state=new_status,
                entity='Proposal',
            )
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])

    def submit(self):
        """Submit the proposal."""
        if self.rfp.status != 'PUBLISHED':
            raise ValueError('Cannot submit proposal: RFP is not open for submissions')

        if not self.question_responses.exists() and not self.line_items.exists():
            raise ValueError('Cannot submit proposal without responses')

        self._transition_to('SUBMITTED')
        self.submitted_at = timezone.now()
        self.save(update_fields=['submitted_at', 'updated_at'])

        # Update invitation status
        try:
            invitation = RFPInvitation.objects.get(
                rfp=self.rfp, supplier=self.supplier
            )
            invitation.mark_proposal_submitted()
        except RFPInvitation.DoesNotExist:
            pass

    def withdraw(self):
        """Withdraw the proposal."""
        if self.status not in ['DRAFT', 'SUBMITTED']:
            raise ValueError('Can only withdraw draft or submitted proposals')
        self._transition_to('WITHDRAWN')

    def shortlist(self):
        """Shortlist the proposal for further evaluation."""
        self._transition_to('SHORTLISTED')

    def request_bafo(self):
        """Request BAFO from this supplier."""
        self._transition_to('BAFO_REQUESTED')

    def submit_bafo(self):
        """Mark BAFO as submitted."""
        self._transition_to('BAFO_SUBMITTED')

    def disqualify(self, reason: str = ''):
        """Disqualify the proposal."""
        self._transition_to('DISQUALIFIED')
        self.notes = f'Disqualified: {reason}' if reason else self.notes
        self.save(update_fields=['notes', 'updated_at'])

    @property
    def total_amount(self) -> Decimal:
        """Calculate total pricing amount from line items."""
        result = self.line_items.aggregate(
            total=Sum('extended_price')
        )
        return result['total'] or Decimal('0')


class ProposalSection(models.Model):
    """Section-level response tracking for proposals."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        Proposal,
        on_delete=models.CASCADE,
        related_name='sections',
    )
    rfp_section = models.ForeignKey(
        RFPSection,
        on_delete=models.PROTECT,
        related_name='proposal_sections',
    )
    section_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    evaluator_comments = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'proposal_section'
        verbose_name = 'Proposal Section'
        verbose_name_plural = 'Proposal Sections'
        constraints = [
            models.UniqueConstraint(
                fields=['proposal', 'rfp_section'],
                name='unique_proposal_section',
            ),
        ]

    def __str__(self):
        return f'{self.proposal.proposal_number} - {self.rfp_section.title}'


class QuestionResponse(models.Model):
    """Supplier response to an RFP question."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        Proposal,
        on_delete=models.CASCADE,
        related_name='question_responses',
    )
    question = models.ForeignKey(
        RFPQuestion,
        on_delete=models.PROTECT,
        related_name='responses',
    )
    answer_text = models.TextField(blank=True, default='')
    answer_choice = models.JSONField(null=True, blank=True)
    answer_number = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
    )
    answer_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'question_response'
        verbose_name = 'Question Response'
        verbose_name_plural = 'Question Responses'
        constraints = [
            models.UniqueConstraint(
                fields=['proposal', 'question'],
                name='unique_proposal_question_response',
            ),
        ]

    def __str__(self):
        return f'{self.proposal.proposal_number} - Q{self.question.question_number}'

    def clean(self):
        """Validate that response belongs to correct RFP."""
        if self.question.section.rfp_id != self.proposal.rfp_id:
            raise ValueError('Question does not belong to the same RFP as the proposal')


class ProposalLineItem(models.Model):
    """Supplier pricing response for RFP line items."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        Proposal,
        on_delete=models.CASCADE,
        related_name='line_items',
    )
    rfp_line_item = models.ForeignKey(
        RFPLineItem,
        on_delete=models.PROTECT,
        related_name='proposal_responses',
    )
    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=4,
    )
    unit_price = models.DecimalField(
        max_digits=15,
        decimal_places=4,
    )
    extended_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        editable=False,
    )
    lead_time_days = models.PositiveIntegerField(null=True, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True, default='')
    part_number = models.CharField(max_length=100, blank=True, default='')
    notes = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'proposal_line_item'
        verbose_name = 'Proposal Line Item'
        verbose_name_plural = 'Proposal Line Items'
        constraints = [
            models.UniqueConstraint(
                fields=['proposal', 'rfp_line_item'],
                name='unique_proposal_line_item',
            ),
        ]

    def __str__(self):
        return f'{self.proposal.proposal_number} - Line {self.rfp_line_item.line_number}'

    def save(self, *args, **kwargs):
        self.extended_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def clean(self):
        """Validate that line item belongs to correct RFP."""
        if self.rfp_line_item.rfp_id != self.proposal.rfp_id:
            raise ValueError('Line item does not belong to the same RFP as the proposal')


class EvaluationTeam(models.Model):
    """Evaluators assigned to an RFP."""

    ROLE_CHOICES = [
        ('LEAD', 'Lead Evaluator'),
        ('TECHNICAL', 'Technical Evaluator'),
        ('PRICING', 'Pricing Evaluator'),
        ('GENERAL', 'General Evaluator'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='evaluation_team',
    )
    evaluator = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='rfp_evaluations',
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='GENERAL',
    )
    assigned_sections = models.ManyToManyField(
        RFPSection,
        blank=True,
        related_name='assigned_evaluators',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='assigned_evaluators',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluation_team'
        verbose_name = 'Evaluation Team Member'
        verbose_name_plural = 'Evaluation Team Members'
        constraints = [
            models.UniqueConstraint(
                fields=['rfp', 'evaluator'],
                name='unique_rfp_evaluator',
            ),
        ]

    def __str__(self):
        return f'{self.rfp.number} - {self.evaluator.email} ({self.role})'


class EvaluationScore(models.Model):
    """Individual evaluator scores for proposals."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        Proposal,
        on_delete=models.CASCADE,
        related_name='evaluation_scores',
    )
    evaluator = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='given_scores',
    )
    criteria = models.ForeignKey(
        ScoringCriteria,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='scores',
    )
    section = models.ForeignKey(
        RFPSection,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='evaluation_scores',
    )
    question = models.ForeignKey(
        RFPQuestion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='evaluation_scores',
    )
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )
    max_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.0'),
    )
    comments = models.TextField(blank=True, default='')
    is_final = models.BooleanField(default=False)
    scored_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluation_score'
        verbose_name = 'Evaluation Score'
        verbose_name_plural = 'Evaluation Scores'
        ordering = ['-scored_at']

    def __str__(self):
        return f'{self.proposal.proposal_number} - {self.evaluator.email}: {self.score}/{self.max_score}'

    @property
    def score_percentage(self) -> Decimal:
        """Calculate score as percentage of max score."""
        if self.max_score:
            return (self.score / self.max_score) * 100
        return Decimal('0')


class BAFORound(models.Model):
    """BAFO (Best and Final Offer) round tracking."""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='bafo_rounds',
    )
    round_number = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
    )
    opened_at = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    instructions = models.TextField(blank=True, default='')
    focus_areas = models.JSONField(
        null=True,
        blank=True,
        help_text='Areas to focus on (e.g., ["pricing", "delivery"])',
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='created_bafo_rounds',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bafo_round'
        verbose_name = 'BAFO Round'
        verbose_name_plural = 'BAFO Rounds'
        ordering = ['round_number']
        constraints = [
            models.UniqueConstraint(
                fields=['rfp', 'round_number'],
                name='unique_rfp_bafo_round',
            ),
        ]

    def __str__(self):
        return f'{self.rfp.number} - BAFO Round {self.round_number}'

    def save(self, *args, **kwargs):
        if not self.round_number:
            max_num = BAFORound.objects.filter(rfp=self.rfp).aggregate(
                max_num=models.Max('round_number')
            )['max_num'] or 0
            self.round_number = max_num + 1
        super().save(*args, **kwargs)

    def open(self):
        """Open the BAFO round."""
        if self.status != 'DRAFT':
            raise ValueError('Can only open a draft BAFO round')
        self.status = 'OPEN'
        self.opened_at = timezone.now()
        self.save(update_fields=['status', 'opened_at', 'updated_at'])

        # Request BAFO from shortlisted proposals
        self.rfp.proposals.filter(status='SHORTLISTED').update(status='BAFO_REQUESTED')

    def close(self):
        """Close the BAFO round."""
        if self.status != 'OPEN':
            raise ValueError('Can only close an open BAFO round')
        self.status = 'CLOSED'
        self.closed_at = timezone.now()
        self.save(update_fields=['status', 'closed_at', 'updated_at'])


class BAFOResponse(models.Model):
    """Supplier response to a BAFO round."""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bafo_round = models.ForeignKey(
        BAFORound,
        on_delete=models.CASCADE,
        related_name='responses',
    )
    proposal = models.ForeignKey(
        Proposal,
        on_delete=models.CASCADE,
        related_name='bafo_responses',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    response_data = models.JSONField(
        null=True,
        blank=True,
        help_text='Revised pricing, terms, or other data',
    )
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bafo_response'
        verbose_name = 'BAFO Response'
        verbose_name_plural = 'BAFO Responses'
        constraints = [
            models.UniqueConstraint(
                fields=['bafo_round', 'proposal'],
                name='unique_bafo_round_proposal',
            ),
        ]

    def __str__(self):
        return f'{self.bafo_round} - {self.proposal.supplier.name}'

    def submit(self):
        """Submit the BAFO response."""
        if self.bafo_round.status != 'OPEN':
            raise ValueError('Cannot submit BAFO: round is not open')

        self.status = 'SUBMITTED'
        self.submitted_at = timezone.now()
        self.save(update_fields=['status', 'submitted_at', 'updated_at'])

        # Update proposal status
        self.proposal.submit_bafo()


class RFPQA(models.Model):
    """Q&A management for RFP."""

    VISIBILITY_CHOICES = [
        ('PRIVATE', 'Private'),
        ('PUBLIC', 'Public'),
        ('ALL_BIDDERS', 'All Bidders'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfp = models.ForeignKey(
        RFP,
        on_delete=models.CASCADE,
        related_name='qa_items',
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfp_questions',
        help_text='Null if internal question',
    )
    asked_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='asked_rfp_questions',
    )
    question = models.TextField()
    answer = models.TextField(blank=True, default='')
    answered_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='answered_rfp_questions',
    )
    answered_at = models.DateTimeField(null=True, blank=True)
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='PRIVATE',
    )
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rfp_qa'
        verbose_name = 'RFP Q&A'
        verbose_name_plural = 'RFP Q&A Items'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.rfp.number} - Q: {self.question[:50]}'

    def publish_answer(self, answer: str, answered_by, visibility: str = 'ALL_BIDDERS'):
        """Publish an answer to the question."""
        self.answer = answer
        self.answered_by = answered_by
        self.answered_at = timezone.now()
        self.visibility = visibility
        self.is_published = True
        self.save(update_fields=[
            'answer', 'answered_by', 'answered_at', 'visibility', 'is_published', 'updated_at'
        ])

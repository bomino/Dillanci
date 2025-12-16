"""
Tests for RFP models.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.core.exceptions import (
    DuplicateInvitationError,
    InvalidStateTransitionError,
)
from apps.organizations.models import Organization
from apps.rfps.models import (
    BAFORound,
    BAFOResponse,
    EvaluationScore,
    EvaluationTeam,
    Proposal,
    ProposalLineItem,
    ProposalSection,
    QuestionResponse,
    RFP,
    RFPInvitation,
    RFPLineItem,
    RFPQuestion,
    RFPSection,
    RFPQA,
    ScoringCriteria,
)
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def user(db, organization):
    """Create a test user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def evaluator(db, organization):
    """Create a test evaluator."""
    return User.objects.create_user(
        email='evaluator@example.com',
        password='testpass123',
        first_name='Test',
        last_name='Evaluator',
        organization=organization,
    )


@pytest.fixture
def supplier(db, organization):
    """Create a test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP001',
        name='Test Supplier',
        status='APPROVED',
    )


@pytest.fixture
def supplier2(db, organization):
    """Create a second test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP002',
        name='Test Supplier 2',
        status='APPROVED',
    )


@pytest.fixture
def rfp(db, organization, user):
    """Create a test RFP."""
    return RFP.objects.create(
        organization=organization,
        created_by=user,
        title='Test RFP',
        description='Test description',
        rfp_type='SERVICES',
        estimated_value=Decimal('100000.00'),
        response_deadline=timezone.now() + timedelta(days=30),
    )


@pytest.fixture
def rfp_with_sections(rfp):
    """Create an RFP with sections and questions."""
    section = RFPSection.objects.create(
        rfp=rfp,
        title='Technical Requirements',
        section_type='TECHNICAL',
        weight=Decimal('40'),
        is_scorable=True,
    )
    RFPQuestion.objects.create(
        section=section,
        question_text='Describe your approach',
        question_type='TEXTAREA',
        is_required=True,
        max_score=Decimal('5.0'),
    )
    return rfp


@pytest.fixture
def rfp_with_criteria(rfp_with_sections, supplier, user):
    """Create an RFP with sections, criteria, and invitations."""
    rfp = rfp_with_sections
    ScoringCriteria.objects.create(
        rfp=rfp,
        name='Technical Approach',
        weight=Decimal('40'),
        max_score=Decimal('5.0'),
    )
    RFPInvitation.objects.create(
        rfp=rfp,
        supplier=supplier,
        invited_by=user,
    )
    return rfp


@pytest.fixture
def published_rfp(rfp_with_criteria):
    """Create a published RFP."""
    rfp = rfp_with_criteria
    rfp.publish()
    return rfp


@pytest.fixture
def proposal(db, published_rfp, supplier, user):
    """Create a test proposal."""
    return Proposal.objects.create(
        rfp=published_rfp,
        supplier=supplier,
        submitted_by=user,
    )


@pytest.mark.django_db
class TestRFP:
    """Tests for RFP model."""

    def test_rfp_creation(self, organization, user):
        """Can create an RFP."""
        rfp = RFP.objects.create(
            organization=organization,
            created_by=user,
            title='New RFP',
            estimated_value=Decimal('50000.00'),
        )

        assert rfp.id is not None
        assert rfp.title == 'New RFP'
        assert rfp.status == 'DRAFT'

    def test_rfp_auto_generates_number(self, rfp):
        """RFP number is auto-generated."""
        assert rfp.number is not None
        assert rfp.number.startswith('RFP-')
        assert str(timezone.now().year) in rfp.number

    def test_rfp_str(self, rfp):
        """RFP has meaningful string representation."""
        assert rfp.number in str(rfp)
        assert 'Test RFP' in str(rfp)

    def test_rfp_defaults(self, rfp):
        """RFP has correct defaults."""
        assert rfp.status == 'DRAFT'
        assert rfp.rfp_type == 'SERVICES'
        assert rfp.bidding_type == 'SEALED'
        assert rfp.visibility == 'INVITED'

    def test_total_section_weight(self, rfp_with_sections):
        """Total section weight is calculated correctly."""
        assert rfp_with_sections.total_section_weight == Decimal('40')

    def test_soft_delete(self, rfp):
        """RFP can be soft deleted."""
        rfp.soft_delete()
        rfp.refresh_from_db()

        assert rfp.is_deleted is True
        assert rfp.deleted_at is not None

    def test_soft_delete_excluded_from_queryset(self, rfp):
        """Soft deleted RFPs excluded from default queryset."""
        rfp_id = rfp.id
        rfp.soft_delete()

        assert not RFP.objects.filter(id=rfp_id).exists()
        assert RFP.all_objects.filter(id=rfp_id).exists()


@pytest.mark.django_db
class TestRFPStateMachine:
    """Tests for RFP state machine."""

    def test_rfp_creation_defaults_to_draft(self, rfp):
        """New RFPs start in DRAFT status."""
        assert rfp.status == 'DRAFT'

    def test_cannot_publish_without_sections(self, rfp, supplier, user):
        """Cannot publish RFP without sections."""
        ScoringCriteria.objects.create(
            rfp=rfp,
            name='Test',
            weight=Decimal('100'),
        )
        RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )

        with pytest.raises(ValueError) as exc_info:
            rfp.publish()
        assert 'sections' in str(exc_info.value)

    def test_cannot_publish_without_invitations(self, rfp_with_sections):
        """Cannot publish RFP without invitations."""
        rfp = rfp_with_sections
        ScoringCriteria.objects.create(
            rfp=rfp,
            name='Test',
            weight=Decimal('100'),
        )

        with pytest.raises(ValueError) as exc_info:
            rfp.publish()
        assert 'invitations' in str(exc_info.value)

    def test_cannot_publish_without_criteria(self, rfp_with_sections, supplier, user):
        """Cannot publish RFP without scoring criteria."""
        rfp = rfp_with_sections
        RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )

        with pytest.raises(ValueError) as exc_info:
            rfp.publish()
        assert 'criteria' in str(exc_info.value)

    def test_draft_to_published_transition(self, rfp_with_criteria):
        """Can publish RFP (DRAFT -> PUBLISHED)."""
        rfp_with_criteria.publish()
        assert rfp_with_criteria.status == 'PUBLISHED'
        assert rfp_with_criteria.publish_date is not None

    def test_published_to_evaluation_transition(self, published_rfp):
        """Can start evaluation (PUBLISHED -> EVALUATION)."""
        published_rfp.start_evaluation()
        assert published_rfp.status == 'EVALUATION'
        assert published_rfp.evaluation_start_date is not None

    def test_cannot_start_bafo_without_shortlisted(self, published_rfp):
        """Cannot start BAFO without shortlisted proposals."""
        published_rfp.start_evaluation()

        with pytest.raises(ValueError) as exc_info:
            published_rfp.start_bafo_round()
        assert 'shortlisted' in str(exc_info.value)

    def test_evaluation_to_bafo_transition(self, published_rfp, proposal, supplier, user):
        """Can start BAFO (EVALUATION -> BAFO) with shortlisted proposals."""
        # Add question response so submission works
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )

        # Submit proposal BEFORE starting evaluation
        proposal.submit()

        # Start evaluation
        published_rfp.start_evaluation()

        # Shortlist proposal
        proposal.shortlist()

        published_rfp.start_bafo_round()
        assert published_rfp.status == 'BAFO'

    def test_bafo_to_evaluation_transition(self, published_rfp, proposal, supplier, user):
        """Can close BAFO round (BAFO -> EVALUATION)."""
        # Setup proposal
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )

        # Submit proposal BEFORE starting evaluation
        proposal.submit()

        # Start evaluation and shortlist
        published_rfp.start_evaluation()
        proposal.shortlist()

        published_rfp.start_bafo_round()
        published_rfp.close_bafo_round()
        assert published_rfp.status == 'EVALUATION'

    def test_evaluation_to_closed_transition(self, published_rfp):
        """Can close evaluation (EVALUATION -> CLOSED)."""
        published_rfp.start_evaluation()
        published_rfp.close_evaluation()
        assert published_rfp.status == 'CLOSED'

    def test_award_transition(self, published_rfp, proposal):
        """Can award RFP (CLOSED -> AWARDED)."""
        # Setup proposal
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )

        # Submit proposal BEFORE starting evaluation
        proposal.submit()

        # Start and close evaluation
        published_rfp.start_evaluation()
        published_rfp.close_evaluation()
        published_rfp.award(proposal)

        assert published_rfp.status == 'AWARDED'
        assert published_rfp.awarded_proposal == proposal
        assert published_rfp.awarded_supplier == proposal.supplier
        assert published_rfp.awarded_date is not None

    def test_award_updates_proposal_statuses(self, published_rfp, proposal, supplier2, user):
        """Award updates proposal statuses correctly."""
        # Setup proposals
        section = published_rfp.sections.first()
        question = section.questions.first()

        # Invite second supplier
        RFPInvitation.objects.create(
            rfp=published_rfp,
            supplier=supplier2,
            invited_by=user,
        )

        # First proposal
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )
        proposal.submit()

        # Second proposal
        proposal2 = Proposal.objects.create(
            rfp=published_rfp,
            supplier=supplier2,
            submitted_by=user,
        )
        QuestionResponse.objects.create(
            proposal=proposal2,
            question=question,
            answer_text='Test answer 2',
        )
        proposal2.submit()

        # Start and close evaluation
        published_rfp.start_evaluation()
        published_rfp.close_evaluation()
        published_rfp.award(proposal)

        proposal.refresh_from_db()
        proposal2.refresh_from_db()

        assert proposal.status == 'AWARDED'
        assert proposal2.status == 'NOT_AWARDED'

    def test_cancel_from_draft(self, rfp):
        """Can cancel RFP from DRAFT status."""
        rfp.cancel()
        assert rfp.status == 'CANCELLED'

    def test_cannot_cancel_awarded_rfp(self, published_rfp, proposal):
        """Cannot cancel awarded RFP."""
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )

        # Submit proposal BEFORE starting evaluation
        proposal.submit()

        # Award the RFP
        published_rfp.start_evaluation()
        published_rfp.close_evaluation()
        published_rfp.award(proposal)

        with pytest.raises(ValueError):
            published_rfp.cancel()

    def test_invalid_transition_raises_error(self, rfp):
        """Invalid transition raises error."""
        with pytest.raises(InvalidStateTransitionError):
            rfp._transition_to('AWARDED')


@pytest.mark.django_db
class TestRFPSection:
    """Tests for RFPSection model."""

    def test_section_creation(self, rfp):
        """Can create RFP section."""
        section = RFPSection.objects.create(
            rfp=rfp,
            title='Technical Requirements',
            section_type='TECHNICAL',
            weight=Decimal('40'),
        )

        assert section.id is not None
        assert section.section_number == 1
        assert section.is_scorable is True

    def test_section_auto_increment(self, rfp):
        """Section number auto-increments."""
        section1 = RFPSection.objects.create(
            rfp=rfp,
            title='Section 1',
        )
        section2 = RFPSection.objects.create(
            rfp=rfp,
            title='Section 2',
        )

        assert section1.section_number == 1
        assert section2.section_number == 2

    def test_section_str(self, rfp):
        """Section has meaningful string representation."""
        section = RFPSection.objects.create(
            rfp=rfp,
            title='Technical',
        )
        assert rfp.number in str(section)
        assert 'Technical' in str(section)


@pytest.mark.django_db
class TestRFPQuestion:
    """Tests for RFPQuestion model."""

    def test_question_creation(self, rfp):
        """Can create RFP question."""
        section = RFPSection.objects.create(
            rfp=rfp,
            title='Technical',
        )
        question = RFPQuestion.objects.create(
            section=section,
            question_text='Describe your approach',
            question_type='TEXTAREA',
        )

        assert question.id is not None
        assert question.question_number == 1
        assert question.is_required is True
        assert question.max_score == Decimal('5.0')

    def test_question_auto_increment(self, rfp):
        """Question number auto-increments."""
        section = RFPSection.objects.create(
            rfp=rfp,
            title='Technical',
        )
        q1 = RFPQuestion.objects.create(
            section=section,
            question_text='Question 1',
        )
        q2 = RFPQuestion.objects.create(
            section=section,
            question_text='Question 2',
        )

        assert q1.question_number == 1
        assert q2.question_number == 2


@pytest.mark.django_db
class TestRFPLineItem:
    """Tests for RFPLineItem model."""

    def test_line_item_creation(self, rfp):
        """Can create RFP line item."""
        line = RFPLineItem.objects.create(
            rfp=rfp,
            description='Widget A',
            quantity=Decimal('100'),
            target_unit_price=Decimal('10.00'),
        )

        assert line.id is not None
        assert line.line_number == 1
        assert line.unit_of_measure == 'EA'

    def test_line_item_extended_amount(self, rfp):
        """Extended amount is calculated correctly."""
        line = RFPLineItem.objects.create(
            rfp=rfp,
            description='Widget A',
            quantity=Decimal('100'),
            target_unit_price=Decimal('10.00'),
        )

        assert line.extended_amount == Decimal('1000.00')

    def test_line_item_extended_amount_no_target(self, rfp):
        """Extended amount is zero without target price."""
        line = RFPLineItem.objects.create(
            rfp=rfp,
            description='Widget A',
            quantity=Decimal('100'),
        )

        assert line.extended_amount == Decimal('0')


@pytest.mark.django_db
class TestRFPInvitation:
    """Tests for RFPInvitation model."""

    def test_invitation_creation(self, rfp, supplier, user):
        """Can create invitation."""
        invitation = RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )

        assert invitation.id is not None
        assert invitation.status == 'PENDING'

    def test_duplicate_invitation_raises_error(self, rfp, supplier, user):
        """Duplicate invitation raises error."""
        RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )

        with pytest.raises(DuplicateInvitationError):
            RFPInvitation.objects.create(
                rfp=rfp,
                supplier=supplier,
                invited_by=user,
            )

    def test_mark_viewed(self, rfp, supplier, user):
        """Can mark invitation as viewed."""
        invitation = RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )
        invitation.mark_viewed()

        assert invitation.status == 'VIEWED'
        assert invitation.viewed_at is not None

    def test_decline_invitation(self, rfp, supplier, user):
        """Can decline invitation."""
        invitation = RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )
        invitation.decline('Not interested')

        assert invitation.status == 'DECLINED'
        assert invitation.decline_reason == 'Not interested'
        assert invitation.responded_at is not None

    def test_disqualify_supplier(self, rfp, supplier, user):
        """Can disqualify supplier."""
        invitation = RFPInvitation.objects.create(
            rfp=rfp,
            supplier=supplier,
            invited_by=user,
        )
        invitation.disqualify('Does not meet requirements')

        assert invitation.status == 'DISQUALIFIED'
        assert invitation.disqualified is True
        assert invitation.disqualification_reason == 'Does not meet requirements'


@pytest.mark.django_db
class TestProposal:
    """Tests for Proposal model."""

    def test_proposal_creation(self, published_rfp, supplier, user):
        """Can create proposal."""
        proposal = Proposal.objects.create(
            rfp=published_rfp,
            supplier=supplier,
            submitted_by=user,
        )

        assert proposal.id is not None
        assert proposal.status == 'DRAFT'
        assert proposal.revision_number == 1
        assert proposal.is_latest is True

    def test_proposal_auto_generates_number(self, proposal):
        """Proposal number is auto-generated."""
        assert proposal.proposal_number is not None
        assert proposal.proposal_number.startswith('PROP-')
        assert str(timezone.now().year) in proposal.proposal_number

    def test_proposal_str(self, proposal):
        """Proposal has meaningful string representation."""
        assert proposal.proposal_number in str(proposal)
        assert proposal.supplier.name in str(proposal)

    def test_proposal_total_amount(self, published_rfp, proposal):
        """Total amount is calculated from line items."""
        # Create RFP line item first
        rfp_line = RFPLineItem.objects.create(
            rfp=published_rfp,
            description='Widget',
            quantity=Decimal('10'),
        )

        ProposalLineItem.objects.create(
            proposal=proposal,
            rfp_line_item=rfp_line,
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
        )

        assert proposal.total_amount == Decimal('1000.00')

    def test_cannot_submit_without_responses(self, proposal):
        """Cannot submit proposal without responses."""
        with pytest.raises(ValueError) as exc_info:
            proposal.submit()
        assert 'responses' in str(exc_info.value)

    def test_submit_proposal(self, published_rfp, proposal):
        """Can submit proposal with responses."""
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )

        proposal.submit()

        assert proposal.status == 'SUBMITTED'
        assert proposal.submitted_at is not None

    def test_cannot_submit_when_rfp_not_published(self, rfp, supplier, user):
        """Cannot submit proposal when RFP is not published."""
        proposal = Proposal.objects.create(
            rfp=rfp,
            supplier=supplier,
            submitted_by=user,
        )

        with pytest.raises(ValueError) as exc_info:
            proposal.submit()
        assert 'not open for submissions' in str(exc_info.value)

    def test_withdraw_draft_proposal(self, proposal):
        """Can withdraw draft proposal."""
        proposal.withdraw()
        assert proposal.status == 'WITHDRAWN'

    def test_withdraw_submitted_proposal(self, published_rfp, proposal):
        """Can withdraw submitted proposal."""
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )
        proposal.submit()
        proposal.withdraw()
        assert proposal.status == 'WITHDRAWN'

    def test_shortlist_proposal(self, published_rfp, proposal):
        """Can shortlist submitted proposal."""
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )
        proposal.submit()
        proposal.shortlist()
        assert proposal.status == 'SHORTLISTED'

    def test_bafo_workflow(self, published_rfp, proposal):
        """Can go through BAFO workflow."""
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )
        proposal.submit()
        proposal.shortlist()
        proposal.request_bafo()
        assert proposal.status == 'BAFO_REQUESTED'

        proposal.submit_bafo()
        assert proposal.status == 'BAFO_SUBMITTED'

    def test_disqualify_proposal(self, published_rfp, proposal):
        """Can disqualify proposal."""
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )
        proposal.submit()
        proposal.disqualify('Does not meet requirements')

        assert proposal.status == 'DISQUALIFIED'
        assert 'Does not meet requirements' in proposal.notes


@pytest.mark.django_db
class TestProposalLineItem:
    """Tests for ProposalLineItem model."""

    def test_line_item_creation(self, published_rfp, proposal):
        """Can create proposal line item."""
        rfp_line = RFPLineItem.objects.create(
            rfp=published_rfp,
            description='Widget',
            quantity=Decimal('10'),
        )

        line = ProposalLineItem.objects.create(
            proposal=proposal,
            rfp_line_item=rfp_line,
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
        )

        assert line.id is not None
        assert line.extended_price == Decimal('1000.00')


@pytest.mark.django_db
class TestEvaluationTeam:
    """Tests for EvaluationTeam model."""

    def test_team_member_creation(self, rfp, user, evaluator):
        """Can create evaluation team member."""
        team_member = EvaluationTeam.objects.create(
            rfp=rfp,
            evaluator=evaluator,
            role='TECHNICAL',
            assigned_by=user,
        )

        assert team_member.id is not None
        assert team_member.role == 'TECHNICAL'


@pytest.mark.django_db
class TestEvaluationScore:
    """Tests for EvaluationScore model."""

    def test_score_creation(self, published_rfp, proposal, evaluator):
        """Can create evaluation score."""
        criteria = ScoringCriteria.objects.create(
            rfp=published_rfp,
            name='Technical',
            weight=Decimal('40'),
        )

        score = EvaluationScore.objects.create(
            proposal=proposal,
            evaluator=evaluator,
            criteria=criteria,
            score=Decimal('4.0'),
            max_score=Decimal('5.0'),
        )

        assert score.id is not None
        assert score.score_percentage == Decimal('80.0')


@pytest.mark.django_db
class TestBAFORound:
    """Tests for BAFORound model."""

    def test_bafo_round_creation(self, rfp, user):
        """Can create BAFO round."""
        bafo = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
            instructions='Please provide your best pricing',
        )

        assert bafo.id is not None
        assert bafo.round_number == 1
        assert bafo.status == 'DRAFT'

    def test_bafo_round_auto_increment(self, rfp, user):
        """Round number auto-increments."""
        bafo1 = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )
        bafo2 = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )

        assert bafo1.round_number == 1
        assert bafo2.round_number == 2

    def test_open_bafo_round(self, rfp, user):
        """Can open BAFO round."""
        bafo = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )
        bafo.open()

        assert bafo.status == 'OPEN'
        assert bafo.opened_at is not None

    def test_close_bafo_round(self, rfp, user):
        """Can close BAFO round."""
        bafo = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )
        bafo.open()
        bafo.close()

        assert bafo.status == 'CLOSED'
        assert bafo.closed_at is not None

    def test_cannot_open_non_draft(self, rfp, user):
        """Cannot open non-draft BAFO round."""
        bafo = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )
        bafo.open()

        with pytest.raises(ValueError):
            bafo.open()

    def test_cannot_close_non_open(self, rfp, user):
        """Cannot close non-open BAFO round."""
        bafo = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )

        with pytest.raises(ValueError):
            bafo.close()


@pytest.mark.django_db
class TestBAFOResponse:
    """Tests for BAFOResponse model."""

    def test_bafo_response_creation(self, rfp, user, proposal):
        """Can create BAFO response."""
        bafo_round = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )

        response = BAFOResponse.objects.create(
            bafo_round=bafo_round,
            proposal=proposal,
            response_data={'new_price': 90000},
        )

        assert response.id is not None
        assert response.status == 'DRAFT'

    def test_submit_bafo_response(self, published_rfp, user, proposal):
        """Can submit BAFO response."""
        # Setup
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal,
            question=question,
            answer_text='Test answer',
        )

        # Submit proposal BEFORE starting evaluation
        proposal.submit()

        # Start evaluation and shortlist
        published_rfp.start_evaluation()
        proposal.shortlist()

        # Request BAFO from this proposal
        proposal.request_bafo()

        bafo_round = BAFORound.objects.create(
            rfp=published_rfp,
            created_by=user,
        )
        bafo_round.open()

        response = BAFOResponse.objects.create(
            bafo_round=bafo_round,
            proposal=proposal,
            response_data={'new_price': 90000},
        )
        response.submit()

        assert response.status == 'SUBMITTED'
        assert response.submitted_at is not None

        proposal.refresh_from_db()
        assert proposal.status == 'BAFO_SUBMITTED'

    def test_cannot_submit_to_closed_round(self, rfp, user, proposal):
        """Cannot submit to closed BAFO round."""
        bafo_round = BAFORound.objects.create(
            rfp=rfp,
            created_by=user,
        )
        bafo_round.open()
        bafo_round.close()

        response = BAFOResponse.objects.create(
            bafo_round=bafo_round,
            proposal=proposal,
        )

        with pytest.raises(ValueError) as exc_info:
            response.submit()
        assert 'not open' in str(exc_info.value)


@pytest.mark.django_db
class TestRFPQA:
    """Tests for RFPQA model."""

    def test_qa_creation(self, rfp, supplier, user):
        """Can create Q&A item."""
        qa = RFPQA.objects.create(
            rfp=rfp,
            supplier=supplier,
            asked_by=user,
            question='What is the project timeline?',
        )

        assert qa.id is not None
        assert qa.visibility == 'PRIVATE'
        assert qa.is_published is False

    def test_publish_answer(self, rfp, supplier, user, evaluator):
        """Can publish answer to question."""
        qa = RFPQA.objects.create(
            rfp=rfp,
            supplier=supplier,
            asked_by=user,
            question='What is the project timeline?',
        )
        qa.publish_answer(
            answer='Project starts Q1 2025',
            answered_by=evaluator,
            visibility='ALL_BIDDERS',
        )

        assert qa.answer == 'Project starts Q1 2025'
        assert qa.answered_by == evaluator
        assert qa.answered_at is not None
        assert qa.visibility == 'ALL_BIDDERS'
        assert qa.is_published is True

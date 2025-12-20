"""
API tests for RFP endpoints.

Tests workflow actions and proposal management.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Organization
from apps.rfps.models import (
    BAFORound,
    Proposal,
    QuestionResponse,
    RFP,
    RFPInvitation,
    RFPLineItem,
    RFPQuestion,
    RFPSection,
    ScoringCriteria,
)
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


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
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


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
        name='Second Supplier',
        status='APPROVED',
    )


@pytest.fixture
def rfp(db, organization, user):
    """Create a test RFP in DRAFT status."""
    return RFP.objects.create(
        organization=organization,
        created_by=user,
        title='Test RFP',
        description='Test RFP description',
        estimated_value=Decimal('100000.00'),
        response_deadline=timezone.now() + timedelta(days=30),
    )


@pytest.fixture
def rfp_with_section(rfp):
    """Create an RFP with a section and questions."""
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
def rfp_with_criteria(rfp_with_section, supplier, user):
    """Create an RFP with sections, criteria, and invitations."""
    rfp = rfp_with_section
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


@pytest.fixture
def proposal_with_response(proposal, published_rfp):
    """Create a proposal with question response."""
    section = published_rfp.sections.first()
    question = section.questions.first()
    QuestionResponse.objects.create(
        proposal=proposal,
        question=question,
        answer_text='Our approach is comprehensive and efficient.',
    )
    return proposal


@pytest.mark.django_db
class TestRFPViewSet:
    """Tests for /api/v1/rfps/ endpoints."""

    def test_list_rfps(self, authenticated_client, rfp):
        """Can list RFPs in user's organization."""
        response = authenticated_client.get('/api/v1/rfps/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_rfp(self, authenticated_client, organization, user):
        """Can create a new RFP."""
        response = authenticated_client.post(
            '/api/v1/rfps/',
            {
                'organization': str(organization.id),
                'created_by': str(user.id),
                'title': 'New RFP',
                'description': 'New RFP description',
                'rfp_type': 'SERVICES',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert RFP.objects.filter(title='New RFP').exists()

    def test_create_rfp_with_sections(self, authenticated_client, organization, user):
        """Can create an RFP with sections."""
        response = authenticated_client.post(
            '/api/v1/rfps/',
            {
                'organization': str(organization.id),
                'created_by': str(user.id),
                'title': 'RFP with Sections',
                'sections': [
                    {
                        'title': 'Technical Requirements',
                        'section_type': 'TECHNICAL',
                        'weight': '40.00',
                        'is_scorable': True,
                        'questions': [
                            {
                                'question_text': 'What is your approach?',
                                'question_type': 'TEXTAREA',
                                'is_required': True,
                            }
                        ],
                    },
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        rfp = RFP.objects.get(title='RFP with Sections')
        assert rfp.sections.count() == 1
        assert rfp.sections.first().questions.count() == 1

    def test_get_rfp_detail(self, authenticated_client, rfp_with_section):
        """Can get RFP details with sections."""
        response = authenticated_client.get(f'/api/v1/rfps/{rfp_with_section.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Test RFP'
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['sections']) == 1

    def test_soft_delete_rfp(self, authenticated_client, rfp):
        """Can soft delete an RFP."""
        response = authenticated_client.delete(f'/api/v1/rfps/{rfp.id}/')
        assert response.status_code == status.HTTP_204_NO_CONTENT

        rfp.refresh_from_db()
        assert rfp.is_deleted is True


@pytest.mark.django_db
class TestRFPWorkflow:
    """Tests for RFP workflow actions."""

    def test_publish_rfp(self, authenticated_client, rfp_with_criteria):
        """DRAFT -> PUBLISHED via publish action."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp_with_criteria.id}/publish/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'PUBLISHED'

        rfp_with_criteria.refresh_from_db()
        assert rfp_with_criteria.status == 'PUBLISHED'
        assert rfp_with_criteria.publish_date is not None

    def test_cannot_publish_without_sections(
        self, authenticated_client, rfp, supplier, user
    ):
        """Cannot publish RFP without sections."""
        ScoringCriteria.objects.create(
            rfp=rfp, name='Test', weight=Decimal('100')
        )
        RFPInvitation.objects.create(rfp=rfp, supplier=supplier, invited_by=user)

        response = authenticated_client.post(f'/api/v1/rfps/{rfp.id}/publish/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'sections' in response.data['error'].lower()

    def test_cannot_publish_without_invitations(
        self, authenticated_client, rfp_with_section
    ):
        """Cannot publish RFP without invitations."""
        ScoringCriteria.objects.create(
            rfp=rfp_with_section, name='Test', weight=Decimal('100')
        )

        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp_with_section.id}/publish/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'invitations' in response.data['error'].lower()

    def test_cannot_publish_without_criteria(
        self, authenticated_client, rfp_with_section, supplier, user
    ):
        """Cannot publish RFP without scoring criteria."""
        RFPInvitation.objects.create(
            rfp=rfp_with_section, supplier=supplier, invited_by=user
        )

        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp_with_section.id}/publish/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'criteria' in response.data['error'].lower()

    def test_start_evaluation(self, authenticated_client, published_rfp):
        """PUBLISHED -> EVALUATION via start_evaluation action."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{published_rfp.id}/start_evaluation/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'EVALUATION'

        published_rfp.refresh_from_db()
        assert published_rfp.status == 'EVALUATION'
        assert published_rfp.evaluation_start_date is not None

    def test_close_evaluation(self, authenticated_client, published_rfp):
        """EVALUATION -> CLOSED via close_evaluation action."""
        published_rfp.start_evaluation()

        response = authenticated_client.post(
            f'/api/v1/rfps/{published_rfp.id}/close_evaluation/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CLOSED'

    def test_award_rfp(self, authenticated_client, published_rfp, proposal_with_response):
        """CLOSED -> AWARDED via award action."""
        # Submit proposal
        proposal_with_response.submit()

        # Close evaluation
        published_rfp.start_evaluation()
        published_rfp.close_evaluation()

        response = authenticated_client.post(
            f'/api/v1/rfps/{published_rfp.id}/award/',
            {'proposal_id': str(proposal_with_response.id)},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'AWARDED'
        assert str(response.data['awarded_proposal']) == str(proposal_with_response.id)

    def test_cancel_rfp(self, authenticated_client, rfp):
        """DRAFT -> CANCELLED via cancel action."""
        response = authenticated_client.post(f'/api/v1/rfps/{rfp.id}/cancel/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'

    def test_cannot_cancel_awarded_rfp(
        self, authenticated_client, published_rfp, proposal_with_response
    ):
        """Cannot cancel an awarded RFP."""
        proposal_with_response.submit()
        published_rfp.start_evaluation()
        published_rfp.close_evaluation()
        published_rfp.award(proposal_with_response)

        response = authenticated_client.post(f'/api/v1/rfps/{published_rfp.id}/cancel/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRFPSections:
    """Tests for RFP section management via API."""

    def test_get_rfp_sections(self, authenticated_client, rfp_with_section):
        """Can get sections for an RFP."""
        response = authenticated_client.get(
            f'/api/v1/rfps/{rfp_with_section.id}/sections/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['title'] == 'Technical Requirements'

    def test_add_section_to_draft_rfp(self, authenticated_client, rfp):
        """Can add section to draft RFP."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp.id}/sections/',
            {
                'title': 'Management Approach',
                'section_type': 'MANAGEMENT',
                'weight': '20.00',
                'is_scorable': True,
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert rfp.sections.count() == 1

    def test_cannot_add_section_to_published_rfp(
        self, authenticated_client, published_rfp
    ):
        """Cannot add section to non-draft RFP."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{published_rfp.id}/sections/',
            {
                'title': 'Another Section',
                'section_type': 'TECHNICAL',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRFPLineItems:
    """Tests for RFP line item management via API."""

    def test_get_rfp_line_items(self, authenticated_client, rfp):
        """Can get line items for an RFP."""
        RFPLineItem.objects.create(
            rfp=rfp,
            description='Widget A',
            quantity=Decimal('100'),
            target_unit_price=Decimal('10.00'),
        )

        response = authenticated_client.get(f'/api/v1/rfps/{rfp.id}/line_items/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['description'] == 'Widget A'

    def test_add_line_item_to_draft_rfp(self, authenticated_client, rfp):
        """Can add line item to draft RFP."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp.id}/line_items/',
            {
                'description': 'Widget B',
                'quantity': '50',
                'unit_of_measure': 'EA',
                'target_unit_price': '25.00',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert rfp.line_items.count() == 1


@pytest.mark.django_db
class TestRFPInvitations:
    """Tests for RFP invitation management via API."""

    def test_get_rfp_invitations(self, authenticated_client, rfp_with_criteria):
        """Can get invitations for an RFP."""
        response = authenticated_client.get(
            f'/api/v1/rfps/{rfp_with_criteria.id}/invitations/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['status'] == 'PENDING'

    def test_invite_supplier(self, authenticated_client, rfp_with_section, supplier):
        """Can invite a supplier to an RFP."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp_with_section.id}/invitations/',
            {'supplier': str(supplier.id)},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert rfp_with_section.invitations.count() == 1

    def test_cannot_invite_same_supplier_twice(
        self, authenticated_client, rfp_with_criteria, supplier
    ):
        """Cannot invite the same supplier twice."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp_with_criteria.id}/invitations/',
            {'supplier': str(supplier.id)},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already' in response.data['error'].lower()

    def test_mark_invitation_viewed(self, authenticated_client, rfp_with_criteria):
        """Can mark invitation as viewed."""
        invitation = rfp_with_criteria.invitations.first()
        response = authenticated_client.post(
            f'/api/v1/rfps/invitations/{invitation.id}/mark_viewed/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'VIEWED'

    def test_decline_invitation(self, authenticated_client, rfp_with_criteria):
        """Can decline an invitation."""
        invitation = rfp_with_criteria.invitations.first()
        response = authenticated_client.post(
            f'/api/v1/rfps/invitations/{invitation.id}/decline/',
            {'reason': 'Not interested'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DECLINED'
        assert response.data['decline_reason'] == 'Not interested'


@pytest.mark.django_db
class TestProposalViewSet:
    """Tests for /api/v1/rfps/proposals/ endpoints."""

    def test_list_proposals(self, authenticated_client, proposal):
        """Can list proposals."""
        response = authenticated_client.get('/api/v1/rfps/proposals/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_proposal(
        self, authenticated_client, published_rfp, supplier, user
    ):
        """Can create a new proposal."""
        response = authenticated_client.post(
            '/api/v1/rfps/proposals/',
            {
                'rfp': str(published_rfp.id),
                'supplier': str(supplier.id),
                'submitted_by': str(user.id),
                'notes': 'Our proposal',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Proposal.objects.filter(notes='Our proposal').exists()

    def test_get_proposal_detail(self, authenticated_client, proposal_with_response):
        """Can get proposal details with responses."""
        response = authenticated_client.get(
            f'/api/v1/rfps/proposals/{proposal_with_response.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['question_responses']) == 1


@pytest.mark.django_db
class TestProposalWorkflow:
    """Tests for proposal workflow actions."""

    def test_submit_proposal(self, authenticated_client, proposal_with_response):
        """DRAFT -> SUBMITTED via submit action."""
        response = authenticated_client.post(
            f'/api/v1/rfps/proposals/{proposal_with_response.id}/submit/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SUBMITTED'

        proposal_with_response.refresh_from_db()
        assert proposal_with_response.status == 'SUBMITTED'
        assert proposal_with_response.submitted_at is not None

    def test_cannot_submit_proposal_without_responses(
        self, authenticated_client, proposal
    ):
        """Cannot submit proposal without responses."""
        response = authenticated_client.post(
            f'/api/v1/rfps/proposals/{proposal.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'responses' in response.data['error'].lower()

    def test_withdraw_proposal(self, authenticated_client, proposal_with_response):
        """DRAFT -> WITHDRAWN via withdraw action."""
        response = authenticated_client.post(
            f'/api/v1/rfps/proposals/{proposal_with_response.id}/withdraw/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'WITHDRAWN'

    def test_shortlist_proposal(
        self, authenticated_client, published_rfp, proposal_with_response
    ):
        """SUBMITTED -> SHORTLISTED via shortlist action."""
        proposal_with_response.submit()

        response = authenticated_client.post(
            f'/api/v1/rfps/proposals/{proposal_with_response.id}/shortlist/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SHORTLISTED'

    def test_disqualify_proposal(
        self, authenticated_client, published_rfp, proposal_with_response
    ):
        """Can disqualify a proposal."""
        proposal_with_response.submit()

        response = authenticated_client.post(
            f'/api/v1/rfps/proposals/{proposal_with_response.id}/disqualify/',
            {'reason': 'Does not meet requirements'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DISQUALIFIED'


@pytest.mark.django_db
class TestProposalQuestionResponses:
    """Tests for proposal question response management."""

    def test_get_question_responses(
        self, authenticated_client, proposal_with_response
    ):
        """Can get question responses for a proposal."""
        response = authenticated_client.get(
            f'/api/v1/rfps/proposals/{proposal_with_response.id}/question_responses/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_add_question_response(
        self, authenticated_client, proposal, published_rfp
    ):
        """Can add question response to draft proposal."""
        section = published_rfp.sections.first()
        question = section.questions.first()

        response = authenticated_client.post(
            f'/api/v1/rfps/proposals/{proposal.id}/question_responses/',
            {
                'question': str(question.id),
                'answer_text': 'Our detailed response',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert proposal.question_responses.count() == 1


@pytest.mark.django_db
class TestBAFORounds:
    """Tests for BAFO round management."""

    def test_create_bafo_round(
        self, authenticated_client, published_rfp, proposal_with_response, user
    ):
        """Can create a BAFO round during evaluation."""
        # Submit and shortlist proposal
        proposal_with_response.submit()
        published_rfp.start_evaluation()

        response = authenticated_client.post(
            '/api/v1/rfps/bafo-rounds/',
            {
                'rfp': str(published_rfp.id),
                'instructions': 'Please provide your best pricing',
                'focus_areas': ['pricing', 'timeline'],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['round_number'] == 1
        assert published_rfp.bafo_rounds.count() == 1

    def test_get_bafo_rounds(
        self, authenticated_client, published_rfp, user
    ):
        """Can list BAFO rounds for an RFP."""
        published_rfp.start_evaluation()
        BAFORound.objects.create(rfp=published_rfp, created_by=user)

        response = authenticated_client.get(
            f'/api/v1/rfps/bafo-rounds/?rfp={published_rfp.id}'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_open_bafo_round(
        self, authenticated_client, published_rfp, user
    ):
        """DRAFT -> OPEN via open action."""
        published_rfp.start_evaluation()
        bafo_round = BAFORound.objects.create(rfp=published_rfp, created_by=user)

        response = authenticated_client.post(
            f'/api/v1/rfps/bafo-rounds/{bafo_round.id}/open/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'OPEN'

    def test_close_bafo_round(
        self, authenticated_client, published_rfp, user
    ):
        """OPEN -> CLOSED via close action."""
        published_rfp.start_evaluation()
        bafo_round = BAFORound.objects.create(rfp=published_rfp, created_by=user)
        bafo_round.open()

        response = authenticated_client.post(
            f'/api/v1/rfps/bafo-rounds/{bafo_round.id}/close/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CLOSED'


@pytest.mark.django_db
class TestRFPComparison:
    """Tests for proposal comparison endpoint."""

    def test_compare_proposals(
        self,
        authenticated_client,
        published_rfp,
        proposal_with_response,
        supplier2,
        user,
    ):
        """Can compare submitted proposals."""
        # Create line item for RFP
        rfp_line = RFPLineItem.objects.create(
            rfp=published_rfp,
            description='Widget',
            quantity=Decimal('10'),
            target_unit_price=Decimal('100.00'),
        )

        # Submit first proposal
        proposal_with_response.submit()

        # Invite second supplier
        RFPInvitation.objects.create(
            rfp=published_rfp, supplier=supplier2, invited_by=user
        )

        # Create and submit second proposal
        proposal2 = Proposal.objects.create(
            rfp=published_rfp,
            supplier=supplier2,
            submitted_by=user,
        )
        section = published_rfp.sections.first()
        question = section.questions.first()
        QuestionResponse.objects.create(
            proposal=proposal2,
            question=question,
            answer_text='Another approach',
        )
        proposal2.submit()

        # Start evaluation
        published_rfp.start_evaluation()

        response = authenticated_client.get(f'/api/v1/rfps/{published_rfp.id}/compare/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['rfp_number'] == published_rfp.number
        assert response.data['total_proposals'] == 2
        assert len(response.data['score_summary']) == 2


@pytest.mark.django_db
class TestEvaluationSummary:
    """Tests for evaluation summary endpoint."""

    def test_get_evaluation_summary(
        self,
        authenticated_client,
        published_rfp,
        proposal_with_response,
        evaluator,
        user,
    ):
        """Can get evaluation summary."""
        # Submit proposal
        proposal_with_response.submit()

        # Start evaluation
        published_rfp.start_evaluation()

        response = authenticated_client.get(
            f'/api/v1/rfps/{published_rfp.id}/evaluation_summary/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['rfp_number'] == published_rfp.number
        assert response.data['total_proposals'] == 1


@pytest.mark.django_db
class TestRFPInvalidTransitions:
    """Tests for invalid workflow transitions via API."""

    def test_cannot_start_evaluation_from_draft(
        self, authenticated_client, rfp
    ):
        """Cannot start evaluation directly from DRAFT status."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{rfp.id}/start_evaluation/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_award_from_evaluation(
        self, authenticated_client, published_rfp, proposal_with_response
    ):
        """Cannot award RFP from EVALUATION status."""
        proposal_with_response.submit()
        published_rfp.start_evaluation()

        response = authenticated_client.post(
            f'/api/v1/rfps/{published_rfp.id}/award/',
            {'proposal_id': str(proposal_with_response.id)},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_publish_published_rfp(
        self, authenticated_client, published_rfp
    ):
        """Cannot publish RFP from PUBLISHED status."""
        response = authenticated_client.post(
            f'/api/v1/rfps/{published_rfp.id}/publish/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

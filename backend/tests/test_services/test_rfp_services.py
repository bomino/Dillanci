"""
Tests for RFP services.
"""

import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from apps.rfps.services import (
    BAFOService,
    EvaluationService,
    RFPService,
    ScoringService,
)

from tests.factories import (
    BAFORoundFactory,
    DraftRFPFactory,
    EvaluationRFPFactory,
    EvaluationScoreFactory,
    EvaluationTeamFactory,
    FinalEvaluationScoreFactory,
    ProposalFactory,
    ProposalLineItemFactory,
    PublishedRFPFactory,
    RFPFactory,
    RFPInvitationFactory,
    RFPLineItemFactory,
    RFPSectionFactory,
    ScoringCriteriaFactory,
    ShortlistedProposalFactory,
    SubmittedProposalFactory,
    TechnicalSectionFactory,
    ManagementSectionFactory,
    PricingSectionFactory,
    UserFactory,
)


@pytest.mark.django_db
class TestRFPServiceValidateForPublish:
    """Tests for RFPService.validate_for_publish method."""

    def test_validate_no_sections(self):
        """RFP without sections should fail validation."""
        rfp = DraftRFPFactory()

        errors = RFPService.validate_for_publish(rfp)

        assert 'RFP must have at least one section' in errors

    def test_validate_no_invitations(self):
        """RFP without invitations should fail validation."""
        rfp = DraftRFPFactory()
        RFPSectionFactory(rfp=rfp)

        errors = RFPService.validate_for_publish(rfp)

        assert 'RFP must have at least one invited supplier' in errors

    def test_validate_no_criteria(self):
        """RFP without scoring criteria should fail validation."""
        rfp = DraftRFPFactory()
        RFPSectionFactory(rfp=rfp)
        RFPInvitationFactory(rfp=rfp)

        errors = RFPService.validate_for_publish(rfp)

        assert 'RFP must have scoring criteria defined' in errors

    def test_validate_section_weights_not_100(self):
        """RFP with scorable sections not totaling 100% should fail."""
        rfp = DraftRFPFactory()
        TechnicalSectionFactory(rfp=rfp, weight=Decimal('30.00'))
        ManagementSectionFactory(rfp=rfp, weight=Decimal('30.00'))
        RFPInvitationFactory(rfp=rfp)
        ScoringCriteriaFactory(rfp=rfp, weight=Decimal('100.00'))

        errors = RFPService.validate_for_publish(rfp)

        assert any('section weights must sum to 100%' in e for e in errors)

    def test_validate_criteria_weights_not_100(self):
        """RFP with top-level criteria not totaling 100% should fail."""
        rfp = DraftRFPFactory()
        TechnicalSectionFactory(rfp=rfp, weight=Decimal('100.00'))
        RFPInvitationFactory(rfp=rfp)
        ScoringCriteriaFactory(rfp=rfp, weight=Decimal('40.00'))
        ScoringCriteriaFactory(rfp=rfp, weight=Decimal('40.00'))

        errors = RFPService.validate_for_publish(rfp)

        assert any('criteria weights must sum to 100%' in e for e in errors)

    def test_validate_all_valid(self):
        """Valid RFP should have no validation errors."""
        rfp = DraftRFPFactory()
        TechnicalSectionFactory(rfp=rfp, weight=Decimal('50.00'))
        PricingSectionFactory(rfp=rfp, weight=Decimal('50.00'))
        RFPInvitationFactory(rfp=rfp)
        ScoringCriteriaFactory(rfp=rfp, weight=Decimal('100.00'))

        errors = RFPService.validate_for_publish(rfp)

        assert errors == []


@pytest.mark.django_db
class TestRFPServiceCreateWithSections:
    """Tests for RFPService.create_rfp_with_sections method."""

    def test_create_rfp_with_sections(self):
        """Should create RFP with sections and questions."""
        from apps.organizations.models import Organization
        org = Organization.objects.create(
            name='Test Org',
            code='TEST',
            status='ACTIVE',
        )
        user = UserFactory(organization=org)

        sections_data = [
            {
                'section_number': 1,
                'title': 'Technical',
                'section_type': 'TECHNICAL',
                'weight': Decimal('60.00'),
                'questions': [
                    {
                        'question_number': 1,
                        'question_text': 'Describe your approach',
                        'question_type': 'TEXTAREA',
                    },
                ],
            },
            {
                'section_number': 2,
                'title': 'Pricing',
                'section_type': 'PRICING',
                'weight': Decimal('40.00'),
                'questions': [],
            },
        ]

        rfp = RFPService.create_rfp_with_sections(
            organization=org,
            created_by=user,
            title='Test RFP',
            sections_data=sections_data,
        )

        assert rfp.title == 'Test RFP'
        assert rfp.sections.count() == 2
        tech_section = rfp.sections.filter(section_type='TECHNICAL').first()
        assert tech_section.questions.count() == 1


@pytest.mark.django_db
class TestRFPServiceGetProposalsForEvaluation:
    """Tests for RFPService.get_proposals_for_evaluation method."""

    def test_get_proposals_for_evaluation(self):
        """Should return submitted, shortlisted, and BAFO submitted proposals."""
        rfp = EvaluationRFPFactory()
        SubmittedProposalFactory(rfp=rfp)
        ShortlistedProposalFactory(rfp=rfp)
        ProposalFactory(rfp=rfp, status='BAFO_SUBMITTED')
        ProposalFactory(rfp=rfp, status='DRAFT')  # Should not be included
        ProposalFactory(rfp=rfp, status='NOT_AWARDED')  # Should not be included

        proposals = RFPService.get_proposals_for_evaluation(rfp)

        assert proposals.count() == 3

    def test_get_proposals_for_evaluation_empty(self):
        """Should return empty queryset when no eligible proposals."""
        rfp = EvaluationRFPFactory()
        ProposalFactory(rfp=rfp, status='DRAFT')

        proposals = RFPService.get_proposals_for_evaluation(rfp)

        assert proposals.count() == 0


@pytest.mark.django_db
class TestScoringServiceCalculateQuestionScore:
    """Tests for ScoringService.calculate_question_score method."""

    def test_calculate_question_score_with_scores(self):
        """Should calculate average score from evaluator scores."""
        proposal = SubmittedProposalFactory()
        section = RFPSectionFactory(rfp=proposal.rfp)
        from apps.rfps.models import RFPQuestion
        question = RFPQuestion.objects.create(
            section=section,
            question_number=1,
            question_text='Test question',
        )

        # Create multiple evaluator scores
        FinalEvaluationScoreFactory(
            proposal=proposal,
            section=section,
            question=question,
            score=Decimal('4.0'),
        )
        FinalEvaluationScoreFactory(
            proposal=proposal,
            section=section,
            question=question,
            score=Decimal('5.0'),
        )

        score = ScoringService.calculate_question_score(proposal, question.id)

        assert score == Decimal('4.5')

    def test_calculate_question_score_no_scores(self):
        """Should return None when no scores exist."""
        import uuid
        proposal = SubmittedProposalFactory()

        # Use a valid but non-existent UUID
        fake_uuid = str(uuid.uuid4())
        score = ScoringService.calculate_question_score(proposal, fake_uuid)

        assert score is None


@pytest.mark.django_db
class TestScoringServiceCalculateSectionScore:
    """Tests for ScoringService.calculate_section_score method."""

    def test_calculate_section_score(self):
        """Should calculate average score for section."""
        proposal = SubmittedProposalFactory()
        section = TechnicalSectionFactory(rfp=proposal.rfp)

        FinalEvaluationScoreFactory(
            proposal=proposal,
            section=section,
            score=Decimal('4.0'),
        )
        FinalEvaluationScoreFactory(
            proposal=proposal,
            section=section,
            score=Decimal('3.0'),
        )

        score = ScoringService.calculate_section_score(proposal, section)

        assert score == Decimal('3.5')

    def test_calculate_section_score_no_scores(self):
        """Should return None when no scores exist."""
        proposal = SubmittedProposalFactory()
        section = TechnicalSectionFactory(rfp=proposal.rfp)

        score = ScoringService.calculate_section_score(proposal, section)

        assert score is None


@pytest.mark.django_db
class TestScoringServiceCalculateOverallScore:
    """Tests for ScoringService.calculate_overall_score method."""

    def test_calculate_overall_score(self):
        """Should calculate weighted overall score."""
        proposal = SubmittedProposalFactory()
        rfp = proposal.rfp

        # Create scorable sections with weights
        tech_section = TechnicalSectionFactory(
            rfp=rfp,
            weight=Decimal('60.00'),
            is_scorable=True,
        )
        pricing_section = PricingSectionFactory(
            rfp=rfp,
            weight=Decimal('40.00'),
            is_scorable=True,
        )

        # Create scores (scale of 0-5)
        FinalEvaluationScoreFactory(
            proposal=proposal,
            section=tech_section,
            score=Decimal('4.0'),  # 80% of 60 weight = 48
        )
        FinalEvaluationScoreFactory(
            proposal=proposal,
            section=pricing_section,
            score=Decimal('5.0'),  # 100% of 40 weight = 40
        )

        score = ScoringService.calculate_overall_score(proposal)

        # Expected: (80 * 60 + 100 * 40) / 100 = 88
        assert score is not None
        assert Decimal('85') < score < Decimal('90')

    def test_calculate_overall_score_no_scorable_sections(self):
        """Should return None when no scorable sections exist."""
        proposal = SubmittedProposalFactory()
        RFPSectionFactory(rfp=proposal.rfp, is_scorable=False)

        score = ScoringService.calculate_overall_score(proposal)

        assert score is None


@pytest.mark.django_db
class TestScoringServiceCalculatePricingScore:
    """Tests for ScoringService.calculate_pricing_score method."""

    def test_calculate_pricing_score_lowest_bidder(self):
        """Lowest bidder should get max score."""
        proposal = SubmittedProposalFactory()
        RFPLineItemFactory(rfp=proposal.rfp)
        ProposalLineItemFactory(
            proposal=proposal,
            quantity=Decimal('10'),
            unit_price=Decimal('100'),
        )

        score = ScoringService.calculate_pricing_score(
            proposal,
            lowest_price=proposal.total_amount,
        )

        assert score == Decimal('5.0')

    def test_calculate_pricing_score_higher_bidder(self):
        """Higher bidder should get proportionally lower score."""
        proposal = SubmittedProposalFactory()
        RFPLineItemFactory(rfp=proposal.rfp)
        ProposalLineItemFactory(
            proposal=proposal,
            quantity=Decimal('1'),
            unit_price=Decimal('200'),
        )

        score = ScoringService.calculate_pricing_score(
            proposal,
            lowest_price=Decimal('100'),  # Half their price
        )

        assert score == Decimal('2.5')

    def test_calculate_pricing_score_zero_price(self):
        """Should return None for zero price."""
        proposal = SubmittedProposalFactory()

        score = ScoringService.calculate_pricing_score(
            proposal,
            lowest_price=Decimal('0'),
        )

        assert score is None


@pytest.mark.django_db
class TestScoringServiceRankProposals:
    """Tests for ScoringService.rank_proposals method."""

    def test_rank_proposals(self):
        """Should rank proposals by overall score."""
        rfp = EvaluationRFPFactory()

        # Create proposals with different scores
        p1 = SubmittedProposalFactory(rfp=rfp, overall_score=Decimal('90.0'))
        p2 = SubmittedProposalFactory(rfp=rfp, overall_score=Decimal('85.0'))
        p3 = SubmittedProposalFactory(rfp=rfp, overall_score=Decimal('80.0'))

        ranked = ScoringService.rank_proposals(rfp)

        assert len(ranked) == 3
        assert ranked[0].id == p1.id
        assert ranked[0].rank == 1
        assert ranked[1].id == p2.id
        assert ranked[1].rank == 2
        assert ranked[2].id == p3.id
        assert ranked[2].rank == 3


@pytest.mark.django_db
class TestEvaluationServiceGetEvaluatorCompletionStatus:
    """Tests for EvaluationService.get_evaluator_completion_status method."""

    def test_get_evaluator_completion_status(self):
        """Should return completion status for each evaluator."""
        rfp = EvaluationRFPFactory()
        section = TechnicalSectionFactory(rfp=rfp)
        evaluator = UserFactory(organization=rfp.organization)
        EvaluationTeamFactory(rfp=rfp, evaluator=evaluator)

        proposal = SubmittedProposalFactory(rfp=rfp)
        FinalEvaluationScoreFactory(
            proposal=proposal,
            evaluator=evaluator,
            section=section,
        )

        status = EvaluationService.get_evaluator_completion_status(rfp)

        assert evaluator.email in status
        assert status[evaluator.email]['scored'] == 1
        assert status[evaluator.email]['total'] == 1
        assert status[evaluator.email]['complete'] is True

    def test_get_evaluator_completion_status_incomplete(self):
        """Should show incomplete status when not all proposals scored."""
        rfp = EvaluationRFPFactory()
        section = TechnicalSectionFactory(rfp=rfp)
        evaluator = UserFactory(organization=rfp.organization)
        EvaluationTeamFactory(rfp=rfp, evaluator=evaluator)

        SubmittedProposalFactory(rfp=rfp)
        SubmittedProposalFactory(rfp=rfp)

        status = EvaluationService.get_evaluator_completion_status(rfp)

        assert evaluator.email in status
        assert status[evaluator.email]['scored'] == 0
        assert status[evaluator.email]['total'] == 2
        assert status[evaluator.email]['complete'] is False


@pytest.mark.django_db
class TestEvaluationServiceFinalizeScores:
    """Tests for EvaluationService.finalize_scores method."""

    def test_finalize_scores(self):
        """Should mark all draft scores as final."""
        proposal = SubmittedProposalFactory()
        section = TechnicalSectionFactory(rfp=proposal.rfp)
        evaluator = UserFactory(organization=proposal.rfp.organization)

        # Create draft scores
        score1 = EvaluationScoreFactory(
            proposal=proposal,
            evaluator=evaluator,
            section=section,
            is_final=False,
        )
        score2 = EvaluationScoreFactory(
            proposal=proposal,
            evaluator=evaluator,
            section=section,
            is_final=False,
        )

        count = EvaluationService.finalize_scores(proposal, evaluator)

        assert count == 2
        score1.refresh_from_db()
        score2.refresh_from_db()
        assert score1.is_final is True
        assert score2.is_final is True


@pytest.mark.django_db
class TestBAFOServiceCreateBAFORound:
    """Tests for BAFOService.create_bafo_round method."""

    def test_create_bafo_round(self):
        """Should create BAFO round successfully."""
        rfp = EvaluationRFPFactory()
        ShortlistedProposalFactory(rfp=rfp)
        user = UserFactory(organization=rfp.organization)

        bafo_round = BAFOService.create_bafo_round(
            rfp=rfp,
            created_by=user,
            instructions='Please revise your pricing',
            focus_areas=['pricing', 'delivery'],
        )

        assert bafo_round.rfp == rfp
        assert bafo_round.created_by == user
        assert bafo_round.instructions == 'Please revise your pricing'
        assert bafo_round.focus_areas == ['pricing', 'delivery']

    def test_create_bafo_round_wrong_status(self):
        """Should fail when RFP not in evaluation or BAFO phase."""
        rfp = PublishedRFPFactory()
        user = UserFactory(organization=rfp.organization)

        with pytest.raises(ValueError) as exc_info:
            BAFOService.create_bafo_round(rfp=rfp, created_by=user)

        assert 'evaluation or BAFO phase' in str(exc_info.value)

    def test_create_bafo_round_no_shortlisted_proposals(self):
        """Should fail when no shortlisted proposals exist."""
        rfp = EvaluationRFPFactory()
        SubmittedProposalFactory(rfp=rfp)  # Not shortlisted
        user = UserFactory(organization=rfp.organization)

        with pytest.raises(ValueError) as exc_info:
            BAFOService.create_bafo_round(rfp=rfp, created_by=user)

        assert 'shortlisted proposals' in str(exc_info.value)


@pytest.mark.django_db
class TestBAFOServiceGetBAFOSummary:
    """Tests for BAFOService.get_bafo_summary method."""

    def test_get_bafo_summary(self):
        """Should return BAFO round summary."""
        rfp = EvaluationRFPFactory()
        proposal = ShortlistedProposalFactory(rfp=rfp)
        proposal.status = 'BAFO_REQUESTED'
        proposal.save()

        bafo_round = BAFORoundFactory(rfp=rfp, status='OPEN')

        summary = BAFOService.get_bafo_summary(bafo_round)

        assert 'round_number' in summary
        assert 'status' in summary
        assert 'total_expected' in summary
        assert 'submitted' in summary
        assert 'pending' in summary
        assert 'responses' in summary

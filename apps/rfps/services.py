"""
RFP services for workflow management, scoring, and evaluation.
"""

from decimal import Decimal
from typing import Dict, List, Optional

from django.db import transaction
from django.db.models import Avg, Sum

from apps.core.exceptions import InvalidScoringWeightError

from .models import (
    BAFORound,
    EvaluationScore,
    Proposal,
    RFP,
    RFPSection,
    ScoringCriteria,
)


class RFPService:
    """Service for RFP workflow and validation operations."""

    @staticmethod
    def validate_for_publish(rfp: RFP) -> List[str]:
        """
        Validate that an RFP is ready for publication.

        Returns list of validation errors, empty if valid.
        """
        errors = []

        if not rfp.sections.exists():
            errors.append('RFP must have at least one section')

        if not rfp.invitations.exists():
            errors.append('RFP must have at least one invited supplier')

        if not rfp.criteria.exists():
            errors.append('RFP must have scoring criteria defined')

        # Validate section weights sum to 100% for scorable sections
        scorable_sections = rfp.sections.filter(is_scorable=True)
        if scorable_sections.exists():
            total_weight = scorable_sections.aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')
            if total_weight != Decimal('100'):
                errors.append(
                    f'Scorable section weights must sum to 100% (currently {total_weight}%)'
                )

        # Validate criteria weights
        top_level_criteria = rfp.criteria.filter(parent__isnull=True)
        if top_level_criteria.exists():
            criteria_weight = top_level_criteria.aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')
            if criteria_weight != Decimal('100'):
                errors.append(
                    f'Top-level criteria weights must sum to 100% (currently {criteria_weight}%)'
                )

        return errors

    @staticmethod
    @transaction.atomic
    def create_rfp_with_sections(
        organization,
        created_by,
        title: str,
        sections_data: List[Dict],
        **rfp_kwargs
    ) -> RFP:
        """Create an RFP with its sections in a single transaction."""
        rfp = RFP.objects.create(
            organization=organization,
            created_by=created_by,
            title=title,
            **rfp_kwargs
        )

        for section_data in sections_data:
            questions_data = section_data.pop('questions', [])
            section = RFPSection.objects.create(rfp=rfp, **section_data)

            for question_data in questions_data:
                from .models import RFPQuestion
                RFPQuestion.objects.create(section=section, **question_data)

        return rfp

    @staticmethod
    def get_proposals_for_evaluation(rfp: RFP):
        """Get all submitted proposals for evaluation."""
        return rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        ).select_related('supplier')


class ScoringService:
    """Service for proposal scoring calculations."""

    @staticmethod
    def calculate_question_score(
        proposal: Proposal,
        question_id,
        evaluator_scores: Optional[List[EvaluationScore]] = None
    ) -> Optional[Decimal]:
        """
        Calculate average score for a specific question.

        If evaluator_scores not provided, fetches from database.
        """
        if evaluator_scores is None:
            evaluator_scores = EvaluationScore.objects.filter(
                proposal=proposal,
                question_id=question_id,
                is_final=True,
            )

        if not evaluator_scores:
            return None

        total_score = sum(s.score for s in evaluator_scores)
        return total_score / len(evaluator_scores)

    @staticmethod
    def calculate_section_score(
        proposal: Proposal,
        section: RFPSection,
    ) -> Optional[Decimal]:
        """
        Calculate weighted average score for a section.

        Averages all evaluator scores for all questions in the section.
        """
        section_scores = EvaluationScore.objects.filter(
            proposal=proposal,
            section=section,
            is_final=True,
        )

        if not section_scores.exists():
            return None

        result = section_scores.aggregate(avg_score=Avg('score'))
        return result['avg_score']

    @staticmethod
    def calculate_overall_score(proposal: Proposal) -> Optional[Decimal]:
        """
        Calculate overall weighted score for a proposal.

        Uses section weights to compute weighted average.
        """
        rfp = proposal.rfp
        scorable_sections = rfp.sections.filter(is_scorable=True)

        if not scorable_sections.exists():
            return None

        weighted_sum = Decimal('0')
        total_weight = Decimal('0')

        for section in scorable_sections:
            section_score = ScoringService.calculate_section_score(proposal, section)

            if section_score is not None:
                # Normalize score to 0-100 scale (assuming max_score of 5)
                normalized_score = (section_score / Decimal('5')) * Decimal('100')
                weighted_sum += normalized_score * section.weight
                total_weight += section.weight

        if total_weight == 0:
            return None

        return weighted_sum / total_weight

    @staticmethod
    def calculate_pricing_score(
        proposal: Proposal,
        lowest_price: Decimal,
        max_score: Decimal = Decimal('5.0'),
    ) -> Optional[Decimal]:
        """
        Calculate pricing score using inverse relationship.

        Lower price = higher score.
        Formula: (lowest_price / proposal_price) * max_score
        """
        proposal_total = proposal.total_amount

        if proposal_total <= 0:
            return None

        if lowest_price <= 0:
            return None

        return (lowest_price / proposal_total) * max_score

    @staticmethod
    @transaction.atomic
    def update_proposal_scores(proposal: Proposal) -> Proposal:
        """
        Recalculate and update all scores for a proposal.

        Updates technical_score, management_score, pricing_score, and overall_score.
        """
        rfp = proposal.rfp

        # Calculate section scores by type
        technical_sections = rfp.sections.filter(
            section_type='TECHNICAL', is_scorable=True
        )
        management_sections = rfp.sections.filter(
            section_type='MANAGEMENT', is_scorable=True
        )
        pricing_sections = rfp.sections.filter(
            section_type='PRICING', is_scorable=True
        )

        # Technical score
        if technical_sections.exists():
            tech_scores = [
                ScoringService.calculate_section_score(proposal, s)
                for s in technical_sections
            ]
            tech_scores = [s for s in tech_scores if s is not None]
            proposal.technical_score = (
                sum(tech_scores) / len(tech_scores) if tech_scores else None
            )

        # Management score
        if management_sections.exists():
            mgmt_scores = [
                ScoringService.calculate_section_score(proposal, s)
                for s in management_sections
            ]
            mgmt_scores = [s for s in mgmt_scores if s is not None]
            proposal.management_score = (
                sum(mgmt_scores) / len(mgmt_scores) if mgmt_scores else None
            )

        # Pricing score - compare to lowest bid
        all_proposals = rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        )
        amounts = [p.total_amount for p in all_proposals if p.total_amount > 0]
        if amounts:
            lowest_price = min(amounts)
            proposal.pricing_score = ScoringService.calculate_pricing_score(
                proposal, lowest_price
            )

        # Overall score
        proposal.overall_score = ScoringService.calculate_overall_score(proposal)

        proposal.save(update_fields=[
            'technical_score', 'management_score', 'pricing_score',
            'overall_score', 'updated_at'
        ])

        return proposal

    @staticmethod
    @transaction.atomic
    def rank_proposals(rfp: RFP) -> List[Proposal]:
        """
        Rank all evaluated proposals by overall score.

        Updates the rank field on each proposal.
        Returns proposals ordered by rank.
        """
        proposals = rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED'],
            overall_score__isnull=False,
        ).order_by('-overall_score')

        for rank, proposal in enumerate(proposals, start=1):
            proposal.rank = rank
            proposal.save(update_fields=['rank', 'updated_at'])

        return list(proposals)


class EvaluationService:
    """Service for managing evaluation team and scoring workflow."""

    @staticmethod
    def get_evaluator_completion_status(rfp: RFP) -> Dict:
        """
        Get evaluation completion status for all team members.

        Returns dict with evaluator email as key and completion info as value.
        """
        team_members = rfp.evaluation_team.select_related('evaluator')
        proposals = rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        )

        total_proposals = proposals.count()
        status = {}

        for member in team_members:
            scored_proposals = EvaluationScore.objects.filter(
                evaluator=member.evaluator,
                proposal__in=proposals,
                is_final=True,
            ).values('proposal').distinct().count()

            status[member.evaluator.email] = {
                'role': member.role,
                'scored': scored_proposals,
                'total': total_proposals,
                'complete': scored_proposals >= total_proposals,
            }

        return status

    @staticmethod
    def get_consensus_scores(rfp: RFP) -> Dict:
        """
        Get consensus (averaged) scores across all evaluators.

        Returns dict with proposal_id as key and averaged scores as value.
        """
        proposals = rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        )

        consensus = {}

        for proposal in proposals:
            scores = EvaluationScore.objects.filter(
                proposal=proposal,
                is_final=True,
            ).aggregate(
                avg_score=Avg('score'),
                total_evaluators=models.Count('evaluator', distinct=True),
            )

            consensus[str(proposal.id)] = {
                'proposal_number': proposal.proposal_number,
                'supplier': proposal.supplier.name,
                'avg_score': scores['avg_score'],
                'evaluator_count': scores['total_evaluators'],
                'overall_score': proposal.overall_score,
                'rank': proposal.rank,
            }

        return consensus

    @staticmethod
    @transaction.atomic
    def finalize_scores(proposal: Proposal, evaluator) -> int:
        """
        Mark all draft scores from an evaluator as final.

        Returns count of scores finalized.
        """
        updated = EvaluationScore.objects.filter(
            proposal=proposal,
            evaluator=evaluator,
            is_final=False,
        ).update(is_final=True)

        return updated


class BAFOService:
    """Service for BAFO round management."""

    @staticmethod
    @transaction.atomic
    def create_bafo_round(
        rfp: RFP,
        created_by,
        instructions: str = '',
        deadline=None,
        focus_areas: List[str] = None,
    ) -> BAFORound:
        """Create a new BAFO round for an RFP."""
        if rfp.status not in ['EVALUATION', 'BAFO']:
            raise ValueError('Can only create BAFO round during evaluation or BAFO phase')

        # Check for shortlisted proposals
        shortlisted = rfp.proposals.filter(status='SHORTLISTED')
        if not shortlisted.exists():
            raise ValueError('Must have shortlisted proposals before creating BAFO round')

        round_instance = BAFORound.objects.create(
            rfp=rfp,
            created_by=created_by,
            instructions=instructions,
            deadline=deadline,
            focus_areas=focus_areas or [],
        )

        return round_instance

    @staticmethod
    def get_bafo_summary(bafo_round: BAFORound) -> Dict:
        """Get summary of BAFO round status."""
        responses = bafo_round.responses.select_related('proposal__supplier')

        total_expected = bafo_round.rfp.proposals.filter(
            status__in=['BAFO_REQUESTED', 'BAFO_SUBMITTED']
        ).count()

        submitted = responses.filter(status='SUBMITTED').count()

        return {
            'round_number': bafo_round.round_number,
            'status': bafo_round.status,
            'deadline': bafo_round.deadline,
            'total_expected': total_expected,
            'submitted': submitted,
            'pending': total_expected - submitted,
            'responses': [
                {
                    'supplier': r.proposal.supplier.name,
                    'status': r.status,
                    'submitted_at': r.submitted_at,
                }
                for r in responses
            ],
        }


# Import models for type hints
from django.db import models

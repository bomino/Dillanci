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


class RFPNotificationService:
    """Service for sending RFP-related notifications."""

    @staticmethod
    def notify_rfp_published(rfp: RFP):
        """
        Notify invited suppliers when an RFP is published.

        Creates notifications for all portal users associated with invited suppliers.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        invitations = rfp.invitations.select_related('supplier')

        for invitation in invitations:
            # Get all portal users for this supplier
            portal_users = PortalUser.objects.filter(
                supplier=invitation.supplier,
                is_active=True
            ).select_related('user')

            for portal_user in portal_users:
                if portal_user.user:
                    Notification.create_notification(
                        user=portal_user.user,
                        notification_type='RFP_INVITATION',
                        title=f'New RFP Invitation: {rfp.title}',
                        message=f'You have been invited to respond to RFP #{rfp.rfp_number}. '
                                f'Submission deadline: {rfp.submission_deadline.strftime("%Y-%m-%d %H:%M") if rfp.submission_deadline else "No deadline set"}.',
                        priority='HIGH',
                        related_object_type='rfp',
                        related_object_id=rfp.id,
                        link=f'/portal/rfps/{rfp.id}',
                        metadata={
                            'rfp_number': rfp.rfp_number,
                            'supplier_id': str(invitation.supplier.id),
                            'submission_deadline': rfp.submission_deadline.isoformat() if rfp.submission_deadline else None,
                        }
                    )

    @staticmethod
    def notify_proposal_received(proposal: Proposal):
        """
        Notify RFP owner when a proposal is submitted.
        """
        from apps.core.models import Notification

        rfp = proposal.rfp

        # Notify RFP creator
        Notification.create_notification(
            user=rfp.created_by,
            notification_type='PROPOSAL_RECEIVED',
            title=f'New Proposal Received: {rfp.title}',
            message=f'{proposal.supplier.name} has submitted a proposal for RFP #{rfp.rfp_number}. '
                    f'Proposal number: {proposal.proposal_number}.',
            priority='NORMAL',
            related_object_type='proposal',
            related_object_id=proposal.id,
            link=f'/rfps/{rfp.id}?tab=proposals',
            metadata={
                'rfp_id': str(rfp.id),
                'rfp_number': rfp.rfp_number,
                'proposal_number': proposal.proposal_number,
                'supplier_name': proposal.supplier.name,
            }
        )

    @staticmethod
    def notify_proposal_shortlisted(proposal: Proposal):
        """
        Notify supplier when their proposal is shortlisted.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        rfp = proposal.rfp

        # Get all portal users for this supplier
        portal_users = PortalUser.objects.filter(
            supplier=proposal.supplier,
            is_active=True
        ).select_related('user')

        for portal_user in portal_users:
            if portal_user.user:
                Notification.create_notification(
                    user=portal_user.user,
                    notification_type='PROPOSAL_SHORTLISTED',
                    title=f'Your Proposal Has Been Shortlisted',
                    message=f'Your proposal for RFP #{rfp.rfp_number} ({rfp.title}) has been shortlisted. '
                            f'You may be contacted for further evaluation or a BAFO request.',
                    priority='HIGH',
                    related_object_type='proposal',
                    related_object_id=proposal.id,
                    link=f'/portal/rfps/{rfp.id}',
                    metadata={
                        'rfp_id': str(rfp.id),
                        'rfp_number': rfp.rfp_number,
                        'proposal_number': proposal.proposal_number,
                    }
                )

    @staticmethod
    def notify_bafo_requested(bafo_round: BAFORound):
        """
        Notify suppliers when a BAFO round is opened.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        rfp = bafo_round.rfp

        # Get all shortlisted/BAFO requested proposals
        proposals = rfp.proposals.filter(
            status__in=['SHORTLISTED', 'BAFO_REQUESTED']
        ).select_related('supplier')

        for proposal in proposals:
            # Update proposal status
            proposal.status = 'BAFO_REQUESTED'
            proposal.save(update_fields=['status', 'updated_at'])

            # Get all portal users for this supplier
            portal_users = PortalUser.objects.filter(
                supplier=proposal.supplier,
                is_active=True
            ).select_related('user')

            for portal_user in portal_users:
                if portal_user.user:
                    Notification.create_notification(
                        user=portal_user.user,
                        notification_type='BAFO_REQUESTED',
                        title=f'BAFO Request: {rfp.title}',
                        message=f'A Best and Final Offer (BAFO) has been requested for RFP #{rfp.rfp_number}. '
                                f'Please submit your revised offer by '
                                f'{bafo_round.deadline.strftime("%Y-%m-%d %H:%M") if bafo_round.deadline else "the specified deadline"}.',
                        priority='URGENT',
                        related_object_type='bafo_round',
                        related_object_id=bafo_round.id,
                        link=f'/portal/rfps/{rfp.id}',
                        metadata={
                            'rfp_id': str(rfp.id),
                            'rfp_number': rfp.rfp_number,
                            'bafo_round_number': bafo_round.round_number,
                            'deadline': bafo_round.deadline.isoformat() if bafo_round.deadline else None,
                            'focus_areas': bafo_round.focus_areas,
                        }
                    )

    @staticmethod
    def notify_bafo_received(bafo_response):
        """
        Notify RFP owner when a BAFO response is submitted.
        """
        from apps.core.models import Notification

        rfp = bafo_response.proposal.rfp

        Notification.create_notification(
            user=rfp.created_by,
            notification_type='BAFO_RECEIVED',
            title=f'BAFO Response Received: {rfp.title}',
            message=f'{bafo_response.proposal.supplier.name} has submitted their BAFO response '
                    f'for RFP #{rfp.rfp_number} (Round {bafo_response.bafo_round.round_number}).',
            priority='NORMAL',
            related_object_type='bafo_response',
            related_object_id=bafo_response.id,
            link=f'/rfps/{rfp.id}?tab=bafo',
            metadata={
                'rfp_id': str(rfp.id),
                'rfp_number': rfp.rfp_number,
                'proposal_number': bafo_response.proposal.proposal_number,
                'supplier_name': bafo_response.proposal.supplier.name,
                'round_number': bafo_response.bafo_round.round_number,
            }
        )

    @staticmethod
    def notify_qa_answered(qa):
        """
        Notify supplier when their Q&A question is answered.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        rfp = qa.rfp

        if qa.visibility == 'ALL_BIDDERS':
            # Notify all invited suppliers
            invitations = rfp.invitations.select_related('supplier')
            suppliers = [inv.supplier for inv in invitations]
        elif qa.visibility == 'PRIVATE' and qa.supplier:
            # Notify only the asking supplier
            suppliers = [qa.supplier]
        else:
            # Public - notify all invited
            invitations = rfp.invitations.select_related('supplier')
            suppliers = [inv.supplier for inv in invitations]

        for supplier in suppliers:
            portal_users = PortalUser.objects.filter(
                supplier=supplier,
                is_active=True
            ).select_related('user')

            for portal_user in portal_users:
                if portal_user.user:
                    Notification.create_notification(
                        user=portal_user.user,
                        notification_type='RFP_QA_ANSWERED',
                        title=f'Q&A Update: {rfp.title}',
                        message=f'A question has been answered for RFP #{rfp.rfp_number}.',
                        priority='NORMAL',
                        related_object_type='rfp_qa',
                        related_object_id=qa.id,
                        link=f'/portal/rfps/{rfp.id}?tab=qa',
                        metadata={
                            'rfp_id': str(rfp.id),
                            'rfp_number': rfp.rfp_number,
                        }
                    )

    @staticmethod
    def notify_proposal_awarded(proposal: Proposal):
        """
        Notify supplier when their proposal is awarded.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        rfp = proposal.rfp

        # Get all portal users for this supplier
        portal_users = PortalUser.objects.filter(
            supplier=proposal.supplier,
            is_active=True
        ).select_related('user')

        for portal_user in portal_users:
            if portal_user.user:
                Notification.create_notification(
                    user=portal_user.user,
                    notification_type='PROPOSAL_AWARDED',
                    title=f'Congratulations! Your Proposal Has Been Awarded',
                    message=f'Your proposal for RFP #{rfp.rfp_number} ({rfp.title}) has been awarded. '
                            f'The procurement team will be in touch with next steps.',
                    priority='HIGH',
                    related_object_type='proposal',
                    related_object_id=proposal.id,
                    link=f'/portal/rfps/{rfp.id}',
                    metadata={
                        'rfp_id': str(rfp.id),
                        'rfp_number': rfp.rfp_number,
                        'proposal_number': proposal.proposal_number,
                    }
                )

    @staticmethod
    def notify_proposal_not_awarded(proposal: Proposal):
        """
        Notify supplier when their proposal is not awarded.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        rfp = proposal.rfp

        # Get all portal users for this supplier
        portal_users = PortalUser.objects.filter(
            supplier=proposal.supplier,
            is_active=True
        ).select_related('user')

        for portal_user in portal_users:
            if portal_user.user:
                Notification.create_notification(
                    user=portal_user.user,
                    notification_type='PROPOSAL_NOT_AWARDED',
                    title=f'RFP Award Notification: {rfp.title}',
                    message=f'Thank you for your proposal for RFP #{rfp.rfp_number}. '
                            f'After careful evaluation, we have decided to proceed with another vendor. '
                            f'We appreciate your participation and hope to work with you in the future.',
                    priority='NORMAL',
                    related_object_type='proposal',
                    related_object_id=proposal.id,
                    link=f'/portal/rfps/{rfp.id}',
                    metadata={
                        'rfp_id': str(rfp.id),
                        'rfp_number': rfp.rfp_number,
                        'proposal_number': proposal.proposal_number,
                    }
                )

    @staticmethod
    def notify_rfp_closed(rfp: RFP):
        """
        Notify all invited suppliers when an RFP is closed.
        """
        from apps.core.models import Notification
        from apps.suppliers.models import PortalUser

        invitations = rfp.invitations.select_related('supplier')

        for invitation in invitations:
            portal_users = PortalUser.objects.filter(
                supplier=invitation.supplier,
                is_active=True
            ).select_related('user')

            for portal_user in portal_users:
                if portal_user.user:
                    Notification.create_notification(
                        user=portal_user.user,
                        notification_type='RFP_CLOSED',
                        title=f'RFP Closed: {rfp.title}',
                        message=f'RFP #{rfp.rfp_number} has been closed. Thank you for your participation.',
                        priority='NORMAL',
                        related_object_type='rfp',
                        related_object_id=rfp.id,
                        link=f'/portal/rfps/{rfp.id}',
                        metadata={
                            'rfp_number': rfp.rfp_number,
                        }
                    )

    @staticmethod
    def notify_evaluation_complete(rfp: RFP):
        """
        Notify RFP owner when evaluation is complete (all evaluators scored).
        """
        from apps.core.models import Notification

        Notification.create_notification(
            user=rfp.created_by,
            notification_type='RFP_EVALUATION_COMPLETE',
            title=f'Evaluation Complete: {rfp.title}',
            message=f'All evaluators have completed scoring for RFP #{rfp.rfp_number}. '
                    f'You can now review the consensus scores and proceed with award.',
            priority='HIGH',
            related_object_type='rfp',
            related_object_id=rfp.id,
            link=f'/rfps/{rfp.id}?tab=evaluation',
            metadata={
                'rfp_number': rfp.rfp_number,
            }
        )


# Import models for type hints
from django.db import models

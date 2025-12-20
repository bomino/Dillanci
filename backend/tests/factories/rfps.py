"""
Factory Boy factories for RFP models.
"""

from decimal import Decimal

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

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
    RFPQA,
    RFPSection,
    ScoringCriteria,
)

from .base import OrganizationFactory, UserFactory
from .suppliers import SupplierFactory


class RFPFactory(DjangoModelFactory):
    """Factory for RFP model."""

    class Meta:
        model = RFP

    organization = factory.SubFactory(OrganizationFactory)
    created_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..organization'),
    )
    title = factory.Sequence(lambda n: f'Test RFP {n}')
    description = factory.Faker('paragraph')
    status = 'DRAFT'
    rfp_type = 'SERVICES'
    estimated_value = Decimal('100000.00')
    bidding_type = 'SEALED'
    visibility = 'INVITED'
    currency = 'USD'


class DraftRFPFactory(RFPFactory):
    """Factory for draft RFP."""

    status = 'DRAFT'


class PublishedRFPFactory(RFPFactory):
    """Factory for published RFP."""

    status = 'PUBLISHED'
    publish_date = factory.LazyFunction(timezone.now)
    response_deadline = factory.LazyFunction(
        lambda: timezone.now() + timezone.timedelta(days=30)
    )


class EvaluationRFPFactory(RFPFactory):
    """Factory for RFP in evaluation phase."""

    status = 'EVALUATION'
    publish_date = factory.LazyFunction(
        lambda: timezone.now() - timezone.timedelta(days=30)
    )
    evaluation_start_date = factory.LazyFunction(timezone.now)


class BAFORFPFactory(RFPFactory):
    """Factory for RFP in BAFO phase."""

    status = 'BAFO'
    publish_date = factory.LazyFunction(
        lambda: timezone.now() - timezone.timedelta(days=60)
    )
    evaluation_start_date = factory.LazyFunction(
        lambda: timezone.now() - timezone.timedelta(days=15)
    )


class ClosedRFPFactory(RFPFactory):
    """Factory for closed RFP."""

    status = 'CLOSED'
    publish_date = factory.LazyFunction(
        lambda: timezone.now() - timezone.timedelta(days=90)
    )


class AwardedRFPFactory(RFPFactory):
    """Factory for awarded RFP."""

    status = 'AWARDED'
    publish_date = factory.LazyFunction(
        lambda: timezone.now() - timezone.timedelta(days=120)
    )
    awarded_date = factory.LazyFunction(timezone.now)


class RFPSectionFactory(DjangoModelFactory):
    """Factory for RFP Section model."""

    class Meta:
        model = RFPSection

    rfp = factory.SubFactory(RFPFactory)
    section_number = factory.Sequence(lambda n: n + 1)
    title = factory.Sequence(lambda n: f'Section {n}')
    section_type = 'TECHNICAL'
    weight = Decimal('25.00')
    instructions = factory.Faker('paragraph')
    is_scorable = True
    order = factory.Sequence(lambda n: n)


class TechnicalSectionFactory(RFPSectionFactory):
    """Factory for technical section."""

    section_type = 'TECHNICAL'
    title = 'Technical Requirements'
    weight = Decimal('40.00')


class ManagementSectionFactory(RFPSectionFactory):
    """Factory for management section."""

    section_type = 'MANAGEMENT'
    title = 'Management Approach'
    weight = Decimal('30.00')


class PricingSectionFactory(RFPSectionFactory):
    """Factory for pricing section."""

    section_type = 'PRICING'
    title = 'Pricing'
    weight = Decimal('30.00')


class RFPQuestionFactory(DjangoModelFactory):
    """Factory for RFP Question model."""

    class Meta:
        model = RFPQuestion

    section = factory.SubFactory(RFPSectionFactory)
    question_number = factory.Sequence(lambda n: n + 1)
    question_text = factory.Faker('sentence')
    question_type = 'TEXT'
    is_required = True
    max_score = Decimal('5.0')
    order = factory.Sequence(lambda n: n)


class RFPLineItemFactory(DjangoModelFactory):
    """Factory for RFP Line Item model."""

    class Meta:
        model = RFPLineItem

    rfp = factory.SubFactory(RFPFactory)
    line_number = factory.Sequence(lambda n: n + 1)
    description = factory.Faker('sentence')
    quantity = Decimal('10')
    unit_of_measure = 'EA'
    target_unit_price = Decimal('100.00')


class ScoringCriteriaFactory(DjangoModelFactory):
    """Factory for Scoring Criteria model."""

    class Meta:
        model = ScoringCriteria

    rfp = factory.SubFactory(RFPFactory)
    name = factory.Sequence(lambda n: f'Criteria {n}')
    description = factory.Faker('paragraph')
    weight = Decimal('25.00')
    max_score = Decimal('5.0')
    order = factory.Sequence(lambda n: n)


class RFPInvitationFactory(DjangoModelFactory):
    """Factory for RFP Invitation model."""

    class Meta:
        model = RFPInvitation

    rfp = factory.SubFactory(RFPFactory)
    supplier = factory.SubFactory(
        SupplierFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    invited_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    status = 'PENDING'


class ViewedInvitationFactory(RFPInvitationFactory):
    """Factory for viewed invitation."""

    status = 'VIEWED'
    viewed_at = factory.LazyFunction(timezone.now)


class DeclinedInvitationFactory(RFPInvitationFactory):
    """Factory for declined invitation."""

    status = 'DECLINED'
    responded_at = factory.LazyFunction(timezone.now)
    decline_reason = 'Not interested'


class ProposalFactory(DjangoModelFactory):
    """Factory for Proposal model."""

    class Meta:
        model = Proposal

    rfp = factory.SubFactory(RFPFactory)
    supplier = factory.SubFactory(
        SupplierFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    submitted_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    status = 'DRAFT'
    revision_number = 1
    is_latest = True


class DraftProposalFactory(ProposalFactory):
    """Factory for draft proposal."""

    status = 'DRAFT'


class SubmittedProposalFactory(ProposalFactory):
    """Factory for submitted proposal."""

    status = 'SUBMITTED'
    submitted_at = factory.LazyFunction(timezone.now)


class ShortlistedProposalFactory(SubmittedProposalFactory):
    """Factory for shortlisted proposal."""

    status = 'SHORTLISTED'


class BAFORequestedProposalFactory(ShortlistedProposalFactory):
    """Factory for BAFO requested proposal."""

    status = 'BAFO_REQUESTED'


class BAFOSubmittedProposalFactory(BAFORequestedProposalFactory):
    """Factory for BAFO submitted proposal."""

    status = 'BAFO_SUBMITTED'


class AwardedProposalFactory(SubmittedProposalFactory):
    """Factory for awarded proposal."""

    status = 'AWARDED'
    overall_score = Decimal('4.5')
    rank = 1


class NotAwardedProposalFactory(SubmittedProposalFactory):
    """Factory for not awarded proposal."""

    status = 'NOT_AWARDED'


class ProposalSectionFactory(DjangoModelFactory):
    """Factory for Proposal Section model."""

    class Meta:
        model = ProposalSection

    proposal = factory.SubFactory(ProposalFactory)
    rfp_section = factory.SubFactory(
        RFPSectionFactory,
        rfp=factory.SelfAttribute('..proposal.rfp'),
    )


class QuestionResponseFactory(DjangoModelFactory):
    """Factory for Question Response model."""

    class Meta:
        model = QuestionResponse

    proposal = factory.SubFactory(ProposalFactory)
    question = factory.SubFactory(
        RFPQuestionFactory,
        section__rfp=factory.SelfAttribute('...proposal.rfp'),
    )
    answer_text = factory.Faker('paragraph')


class ProposalLineItemFactory(DjangoModelFactory):
    """Factory for Proposal Line Item model."""

    class Meta:
        model = ProposalLineItem

    proposal = factory.SubFactory(ProposalFactory)
    rfp_line_item = factory.SubFactory(
        RFPLineItemFactory,
        rfp=factory.SelfAttribute('..proposal.rfp'),
    )
    quantity = Decimal('10')
    unit_price = Decimal('95.00')


class EvaluationTeamFactory(DjangoModelFactory):
    """Factory for Evaluation Team model."""

    class Meta:
        model = EvaluationTeam

    rfp = factory.SubFactory(RFPFactory)
    evaluator = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    role = 'GENERAL'
    assigned_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )


class LeadEvaluatorFactory(EvaluationTeamFactory):
    """Factory for lead evaluator."""

    role = 'LEAD'


class TechnicalEvaluatorFactory(EvaluationTeamFactory):
    """Factory for technical evaluator."""

    role = 'TECHNICAL'


class EvaluationScoreFactory(DjangoModelFactory):
    """Factory for Evaluation Score model."""

    class Meta:
        model = EvaluationScore

    proposal = factory.SubFactory(ProposalFactory)
    evaluator = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..proposal.rfp.organization'),
    )
    section = factory.SubFactory(
        RFPSectionFactory,
        rfp=factory.SelfAttribute('..proposal.rfp'),
    )
    score = Decimal('4.0')
    max_score = Decimal('5.0')
    comments = factory.Faker('sentence')
    is_final = False


class FinalEvaluationScoreFactory(EvaluationScoreFactory):
    """Factory for finalized evaluation score."""

    is_final = True


class BAFORoundFactory(DjangoModelFactory):
    """Factory for BAFO Round model."""

    class Meta:
        model = BAFORound

    rfp = factory.SubFactory(RFPFactory)
    round_number = factory.Sequence(lambda n: n + 1)
    status = 'DRAFT'
    instructions = factory.Faker('paragraph')
    focus_areas = ['pricing', 'delivery']
    created_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )


class OpenBAFORoundFactory(BAFORoundFactory):
    """Factory for open BAFO round."""

    status = 'OPEN'
    opened_at = factory.LazyFunction(timezone.now)
    deadline = factory.LazyFunction(
        lambda: timezone.now() + timezone.timedelta(days=7)
    )


class ClosedBAFORoundFactory(BAFORoundFactory):
    """Factory for closed BAFO round."""

    status = 'CLOSED'
    opened_at = factory.LazyFunction(
        lambda: timezone.now() - timezone.timedelta(days=14)
    )
    closed_at = factory.LazyFunction(timezone.now)


class BAFOResponseFactory(DjangoModelFactory):
    """Factory for BAFO Response model."""

    class Meta:
        model = BAFOResponse

    bafo_round = factory.SubFactory(BAFORoundFactory)
    proposal = factory.SubFactory(
        ProposalFactory,
        rfp=factory.SelfAttribute('..bafo_round.rfp'),
    )
    status = 'DRAFT'
    response_data = {'revised_price': '95000.00'}


class SubmittedBAFOResponseFactory(BAFOResponseFactory):
    """Factory for submitted BAFO response."""

    status = 'SUBMITTED'
    submitted_at = factory.LazyFunction(timezone.now)


class RFPQAFactory(DjangoModelFactory):
    """Factory for RFP Q&A model."""

    class Meta:
        model = RFPQA

    rfp = factory.SubFactory(RFPFactory)
    supplier = factory.SubFactory(
        SupplierFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    asked_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    question = factory.Faker('sentence')
    visibility = 'PRIVATE'
    is_published = False


class AnsweredRFPQAFactory(RFPQAFactory):
    """Factory for answered Q&A."""

    answer = factory.Faker('paragraph')
    answered_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..rfp.organization'),
    )
    answered_at = factory.LazyFunction(timezone.now)
    visibility = 'ALL_BIDDERS'
    is_published = True

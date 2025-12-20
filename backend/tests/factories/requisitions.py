"""
Factories for requisition-related models.
"""

from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.requisitions.models import (
    Requisition,
    RequisitionLine,
    RequisitionTemplate,
    RequisitionTemplateLine,
)

from .base import OrganizationFactory, UserFactory
from .budget import BudgetLineFactory


class RequisitionFactory(DjangoModelFactory):
    """Factory for Requisition model."""

    class Meta:
        model = Requisition

    organization = factory.SubFactory(OrganizationFactory)
    title = factory.Sequence(lambda n: f'Requisition {n}')
    description = factory.Faker('paragraph')
    requester = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..organization')
    )
    budget_line = factory.SubFactory(BudgetLineFactory)
    status = 'DRAFT'


class DraftRequisitionFactory(RequisitionFactory):
    """Factory for draft requisitions."""

    status = 'DRAFT'


class SubmittedRequisitionFactory(RequisitionFactory):
    """Factory for submitted requisitions."""

    status = 'SUBMITTED'


class ApprovedRequisitionFactory(RequisitionFactory):
    """Factory for approved requisitions."""

    status = 'APPROVED'
    approved_by = factory.SubFactory(UserFactory)
    approved_at = factory.Faker('date_time_this_year')


class RequisitionLineFactory(DjangoModelFactory):
    """Factory for RequisitionLine model."""

    class Meta:
        model = RequisitionLine

    requisition = factory.SubFactory(RequisitionFactory)
    line_number = factory.Sequence(lambda n: n + 1)
    description = factory.Faker('sentence')
    quantity = Decimal('10.00')
    unit_of_measure = 'EA'
    unit_price = Decimal('25.00')


class RequisitionTemplateFactory(DjangoModelFactory):
    """Factory for RequisitionTemplate model."""

    class Meta:
        model = RequisitionTemplate

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f'Template {n}')
    description = factory.Faker('paragraph')
    department = 'IT'
    priority = 'MEDIUM'
    currency = 'USD'
    is_public = False
    created_by = factory.SubFactory(UserFactory)


class RequisitionTemplateLineFactory(DjangoModelFactory):
    """Factory for RequisitionTemplateLine model."""

    class Meta:
        model = RequisitionTemplateLine

    template = factory.SubFactory(RequisitionTemplateFactory)
    description = factory.Faker('sentence')
    quantity = '10'
    unit_of_measure = 'EA'
    estimated_unit_price = '25.00'

"""
Factories for budget-related models.
"""

from datetime import date
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.budget.models import BudgetLine, Encumbrance, FiscalYear

from .base import OrganizationFactory


class FiscalYearFactory(DjangoModelFactory):
    """Factory for FiscalYear model."""

    class Meta:
        model = FiscalYear

    organization = factory.SubFactory(OrganizationFactory)
    year = factory.LazyAttribute(lambda o: date.today().year)
    start_date = factory.LazyAttribute(lambda o: date(o.year, 1, 1))
    end_date = factory.LazyAttribute(lambda o: date(o.year, 12, 31))
    status = 'OPEN'


class BudgetLineFactory(DjangoModelFactory):
    """Factory for BudgetLine model."""

    class Meta:
        model = BudgetLine

    fiscal_year = factory.SubFactory(FiscalYearFactory)
    code = factory.Sequence(lambda n: f'BL-{n:04d}')
    name = factory.Sequence(lambda n: f'Budget Line {n}')
    description = factory.Faker('sentence')
    allocated_amount = Decimal('100000.00')
    status = 'ACTIVE'


class EncumbranceFactory(DjangoModelFactory):
    """Factory for Encumbrance model."""

    class Meta:
        model = Encumbrance

    budget_line = factory.SubFactory(BudgetLineFactory)
    amount = Decimal('1000.00')
    reference_type = 'REQUISITION'
    reference_id = factory.Sequence(lambda n: f'REQ-2025-{n:06d}')
    status = 'ACTIVE'


class ActiveEncumbranceFactory(EncumbranceFactory):
    """Factory for active encumbrances."""

    status = 'ACTIVE'


class ReleasedEncumbranceFactory(EncumbranceFactory):
    """Factory for released encumbrances."""

    status = 'RELEASED'
    released_at = factory.Faker('date_time_this_year')


class LiquidatedEncumbranceFactory(EncumbranceFactory):
    """Factory for liquidated encumbrances."""

    status = 'LIQUIDATED'
    liquidated_at = factory.Faker('date_time_this_year')

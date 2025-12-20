"""
Factories for contract-related models.
"""

from datetime import date, timedelta
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.contracts.models import (
    Contract,
    ContractLine,
    ContractMilestone,
    ContractSpend,
)

from .base import OrganizationFactory, UserFactory
from .purchase_orders import PurchaseOrderFactory
from .suppliers import ApprovedSupplierFactory


class ContractFactory(DjangoModelFactory):
    """Factory for Contract model."""

    class Meta:
        model = Contract

    organization = factory.SubFactory(OrganizationFactory)
    supplier = factory.SubFactory(
        ApprovedSupplierFactory,
        organization=factory.SelfAttribute('..organization')
    )
    title = factory.Sequence(lambda n: f'Contract {n}')
    description = factory.Faker('paragraph')
    status = 'DRAFT'
    contract_type = 'BLANKET'
    start_date = factory.LazyFunction(date.today)
    end_date = factory.LazyFunction(lambda: date.today() + timedelta(days=365))
    total_value = Decimal('100000.00')
    currency = 'USD'
    auto_renew = False
    renewal_notice_days = 30
    payment_terms = 'NET30'
    created_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..organization')
    )


class DraftContractFactory(ContractFactory):
    """Factory for draft contracts."""

    status = 'DRAFT'


class PendingApprovalContractFactory(ContractFactory):
    """Factory for pending approval contracts."""

    status = 'PENDING_APPROVAL'


class ActiveContractFactory(ContractFactory):
    """Factory for active contracts."""

    status = 'ACTIVE'
    approved_by = factory.SubFactory(UserFactory)
    approved_at = factory.Faker('date_time_this_year')


class ExpiredContractFactory(ContractFactory):
    """Factory for expired contracts."""

    status = 'EXPIRED'
    start_date = factory.LazyFunction(lambda: date.today() - timedelta(days=400))
    end_date = factory.LazyFunction(lambda: date.today() - timedelta(days=35))
    approved_by = factory.SubFactory(UserFactory)
    approved_at = factory.Faker('date_time_this_year')


class ExpiringContractFactory(ActiveContractFactory):
    """Factory for contracts expiring within renewal notice period."""

    end_date = factory.LazyFunction(lambda: date.today() + timedelta(days=15))


class ContractLineFactory(DjangoModelFactory):
    """Factory for ContractLine model."""

    class Meta:
        model = ContractLine

    contract = factory.SubFactory(ContractFactory)
    line_number = factory.Sequence(lambda n: n + 1)
    description = factory.Faker('sentence')
    unit_of_measure = 'EA'
    unit_price = Decimal('500.00')
    is_active = True


class ContractMilestoneFactory(DjangoModelFactory):
    """Factory for ContractMilestone model."""

    class Meta:
        model = ContractMilestone

    contract = factory.SubFactory(ActiveContractFactory)
    title = factory.Sequence(lambda n: f'Milestone {n}')
    description = factory.Faker('paragraph')
    due_date = factory.LazyFunction(lambda: date.today() + timedelta(days=30))
    status = 'PENDING'
    amount = Decimal('10000.00')


class CompletedMilestoneFactory(ContractMilestoneFactory):
    """Factory for completed milestones."""

    status = 'COMPLETED'
    completed_date = factory.Faker('date_this_year')


class OverdueMilestoneFactory(ContractMilestoneFactory):
    """Factory for overdue milestones."""

    due_date = factory.LazyFunction(lambda: date.today() - timedelta(days=10))
    status = 'PENDING'


class ContractSpendFactory(DjangoModelFactory):
    """Factory for ContractSpend model."""

    class Meta:
        model = ContractSpend

    contract = factory.SubFactory(ActiveContractFactory)
    purchase_order = factory.SubFactory(PurchaseOrderFactory)
    amount = Decimal('5000.00')
    notes = factory.Faker('sentence')

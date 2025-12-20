"""
Factories for purchase order related models.
"""

from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.purchase_orders.models import POAcknowledgment, POLine, PurchaseOrder

from .base import OrganizationFactory, UserFactory
from .budget import BudgetLineFactory
from .suppliers import ApprovedSupplierFactory


class PurchaseOrderFactory(DjangoModelFactory):
    """Factory for PurchaseOrder model."""

    class Meta:
        model = PurchaseOrder

    organization = factory.SubFactory(OrganizationFactory)
    created_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..organization')
    )
    supplier = factory.SubFactory(
        ApprovedSupplierFactory,
        organization=factory.SelfAttribute('..organization')
    )
    budget_line = factory.SubFactory(BudgetLineFactory)
    title = factory.Sequence(lambda n: f'Purchase Order {n}')
    description = factory.Faker('paragraph')
    status = 'DRAFT'
    ship_to_address = factory.Faker('address')
    shipping_terms = 'FOB Destination'
    payment_terms = 'Net 30'


class DraftPOFactory(PurchaseOrderFactory):
    """Factory for draft POs."""

    status = 'DRAFT'


class SubmittedPOFactory(PurchaseOrderFactory):
    """Factory for submitted POs."""

    status = 'SUBMITTED'
    submitted_at = factory.Faker('date_time_this_year')


class ApprovedPOFactory(PurchaseOrderFactory):
    """Factory for approved POs."""

    status = 'APPROVED'
    submitted_at = factory.Faker('date_time_this_year')
    approved_at = factory.Faker('date_time_this_year')
    approved_by = factory.SubFactory(UserFactory)


class SentPOFactory(ApprovedPOFactory):
    """Factory for sent POs."""

    status = 'SENT'
    sent_at = factory.Faker('date_time_this_year')


class ReceivedPOFactory(SentPOFactory):
    """Factory for received POs."""

    status = 'RECEIVED'
    received_at = factory.Faker('date_time_this_year')


class CompletedPOFactory(ReceivedPOFactory):
    """Factory for completed POs."""

    status = 'COMPLETED'
    completed_at = factory.Faker('date_time_this_year')


class POLineFactory(DjangoModelFactory):
    """Factory for POLine model."""

    class Meta:
        model = POLine

    purchase_order = factory.SubFactory(PurchaseOrderFactory)
    line_number = factory.Sequence(lambda n: n + 1)
    description = factory.Faker('sentence')
    quantity = Decimal('10.00')
    unit_price = Decimal('100.00')
    unit_of_measure = 'EA'
    quantity_received = Decimal('0.00')
    quantity_invoiced = Decimal('0.00')


class PartiallyReceivedPOLineFactory(POLineFactory):
    """Factory for partially received PO lines."""

    quantity = Decimal('10.00')
    quantity_received = Decimal('5.00')


class FullyReceivedPOLineFactory(POLineFactory):
    """Factory for fully received PO lines."""

    quantity = Decimal('10.00')
    quantity_received = Decimal('10.00')


class POAcknowledgmentFactory(DjangoModelFactory):
    """Factory for POAcknowledgment model."""

    class Meta:
        model = POAcknowledgment

    purchase_order = factory.SubFactory(SentPOFactory)
    status = 'PENDING'


class AcknowledgedPOAcknowledgmentFactory(POAcknowledgmentFactory):
    """Factory for acknowledged PO acknowledgments."""

    status = 'ACKNOWLEDGED'
    acknowledged_at = factory.Faker('date_time_this_year')
    acknowledged_by = factory.SubFactory(UserFactory)

"""
Factories for invoice-related models.
"""

from datetime import date, timedelta
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration

from .base import OrganizationFactory, UserFactory
from .purchase_orders import POLineFactory, SentPOFactory
from .suppliers import ApprovedSupplierFactory


class MatchingConfigurationFactory(DjangoModelFactory):
    """Factory for MatchingConfiguration model."""

    class Meta:
        model = MatchingConfiguration
        django_get_or_create = ('organization',)

    organization = factory.SubFactory(OrganizationFactory)
    price_tolerance_percent = Decimal('5.00')
    quantity_tolerance_percent = Decimal('2.00')
    auto_match_max_amount = Decimal('10000.00')
    require_goods_receipt = True
    allow_over_receipt = False
    allow_over_invoice = False


class InvoiceFactory(DjangoModelFactory):
    """Factory for Invoice model."""

    class Meta:
        model = Invoice

    supplier_invoice_number = factory.Sequence(lambda n: f'SINV-{n:06d}')
    organization = factory.SubFactory(OrganizationFactory)
    purchase_order = factory.SubFactory(
        SentPOFactory,
        organization=factory.SelfAttribute('..organization')
    )
    supplier = factory.SubFactory(
        ApprovedSupplierFactory,
        organization=factory.SelfAttribute('..organization')
    )
    status = 'DRAFT'
    invoice_date = factory.LazyFunction(date.today)
    due_date = factory.LazyFunction(lambda: date.today() + timedelta(days=30))
    created_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..organization')
    )
    subtotal = Decimal('1000.00')
    tax_amount = Decimal('0.00')
    shipping_amount = Decimal('0.00')
    discount_amount = Decimal('0.00')


class DraftInvoiceFactory(InvoiceFactory):
    """Factory for draft invoices."""

    status = 'DRAFT'


class ValidatedInvoiceFactory(InvoiceFactory):
    """Factory for validated invoices."""

    status = 'VALIDATED'
    validated_at = factory.Faker('date_time_this_year')
    validated_by = factory.SubFactory(UserFactory)


class MatchedInvoiceFactory(ValidatedInvoiceFactory):
    """Factory for matched invoices."""

    status = 'MATCHED'
    matched_at = factory.Faker('date_time_this_year')
    match_type = 'AUTO'


class ApprovedInvoiceFactory(MatchedInvoiceFactory):
    """Factory for approved invoices."""

    status = 'APPROVED'
    approved_at = factory.Faker('date_time_this_year')
    approved_by = factory.SubFactory(UserFactory)


class PaidInvoiceFactory(ApprovedInvoiceFactory):
    """Factory for paid invoices."""

    status = 'PAID'
    paid_at = factory.Faker('date_time_this_year')


class DisputedInvoiceFactory(MatchedInvoiceFactory):
    """Factory for disputed invoices."""

    status = 'DISPUTED'
    dispute_reason = 'Quantity discrepancy'


class InvoiceLineFactory(DjangoModelFactory):
    """Factory for InvoiceLine model."""

    class Meta:
        model = InvoiceLine

    invoice = factory.SubFactory(InvoiceFactory)
    po_line = factory.SubFactory(POLineFactory)
    line_number = factory.Sequence(lambda n: n + 1)
    quantity_invoiced = Decimal('10.00')
    unit_price = Decimal('100.00')
    match_status = 'PENDING'
    quantity_variance = Decimal('0.00')
    price_variance = Decimal('0.00')
    quantity_matched = Decimal('0.00')


class MatchedInvoiceLineFactory(InvoiceLineFactory):
    """Factory for matched invoice lines."""

    match_status = 'MATCHED'
    quantity_matched = Decimal('10.00')


class QuantityMismatchInvoiceLineFactory(InvoiceLineFactory):
    """Factory for invoice lines with quantity mismatch."""

    match_status = 'QUANTITY_MISMATCH'
    quantity_variance = Decimal('2.00')


class PriceMismatchInvoiceLineFactory(InvoiceLineFactory):
    """Factory for invoice lines with price mismatch."""

    match_status = 'PRICE_MISMATCH'
    price_variance = Decimal('10.00')

"""
Factories for receiving/goods receipt related models.
"""

from datetime import date
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.receiving.models import GoodsReceipt, GoodsReceiptLine

from .base import OrganizationFactory, UserFactory
from .purchase_orders import POLineFactory, SentPOFactory


class GoodsReceiptFactory(DjangoModelFactory):
    """Factory for GoodsReceipt model."""

    class Meta:
        model = GoodsReceipt

    organization = factory.SubFactory(OrganizationFactory)
    purchase_order = factory.SubFactory(
        SentPOFactory,
        organization=factory.SelfAttribute('..organization')
    )
    received_by = factory.SubFactory(
        UserFactory,
        organization=factory.SelfAttribute('..organization')
    )
    receipt_date = factory.LazyFunction(date.today)
    status = 'DRAFT'
    delivery_note_number = factory.Sequence(lambda n: f'DN-{n:06d}')
    carrier = factory.Faker('company')
    tracking_number = factory.Faker('uuid4')


class DraftGoodsReceiptFactory(GoodsReceiptFactory):
    """Factory for draft goods receipts."""

    status = 'DRAFT'


class PostedGoodsReceiptFactory(GoodsReceiptFactory):
    """Factory for posted goods receipts."""

    status = 'POSTED'
    posted_at = factory.Faker('date_time_this_year')


class CancelledGoodsReceiptFactory(GoodsReceiptFactory):
    """Factory for cancelled goods receipts."""

    status = 'CANCELLED'


class GoodsReceiptLineFactory(DjangoModelFactory):
    """Factory for GoodsReceiptLine model."""

    class Meta:
        model = GoodsReceiptLine

    goods_receipt = factory.SubFactory(GoodsReceiptFactory)
    po_line = factory.SubFactory(POLineFactory)
    line_number = factory.Sequence(lambda n: n + 1)
    quantity_received = Decimal('10.00')
    quantity_accepted = Decimal('10.00')
    quantity_rejected = Decimal('0.00')
    storage_location = factory.Faker('bothify', text='WH-##-??')
    batch_number = factory.Faker('bothify', text='BATCH-####')


class PartialGoodsReceiptLineFactory(GoodsReceiptLineFactory):
    """Factory for partial receipt lines."""

    quantity_received = Decimal('5.00')
    quantity_accepted = Decimal('5.00')


class RejectedGoodsReceiptLineFactory(GoodsReceiptLineFactory):
    """Factory for receipt lines with rejections."""

    quantity_received = Decimal('10.00')
    quantity_accepted = Decimal('8.00')
    quantity_rejected = Decimal('2.00')
    rejection_reason = 'Damaged during transit'

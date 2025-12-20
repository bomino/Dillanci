"""
Factories for core models including notifications.
"""

import factory
from factory.django import DjangoModelFactory

from apps.core.models import Notification

from .base import UserFactory


class NotificationFactory(DjangoModelFactory):
    """Factory for Notification model."""

    class Meta:
        model = Notification

    user = factory.SubFactory(UserFactory)
    type = 'SYSTEM_ALERT'
    title = factory.Sequence(lambda n: f'Notification {n}')
    message = factory.Faker('paragraph')
    priority = 'NORMAL'
    status = 'UNREAD'
    link = factory.Faker('uri_path')


class ApprovalNotificationFactory(NotificationFactory):
    """Factory for approval required notifications."""

    type = 'APPROVAL_REQUIRED'
    priority = 'HIGH'
    related_object_type = 'requisition'


class ReadNotificationFactory(NotificationFactory):
    """Factory for read notifications."""

    status = 'READ'
    read_at = factory.Faker('date_time_this_year')


class ArchivedNotificationFactory(NotificationFactory):
    """Factory for archived notifications."""

    status = 'ARCHIVED'
    read_at = factory.Faker('date_time_this_year')


class ContractExpiringNotificationFactory(NotificationFactory):
    """Factory for contract expiring notifications."""

    type = 'CONTRACT_EXPIRING'
    priority = 'HIGH'
    related_object_type = 'contract'


class BidReceivedNotificationFactory(NotificationFactory):
    """Factory for bid received notifications."""

    type = 'BID_RECEIVED'
    priority = 'NORMAL'
    related_object_type = 'rfq'

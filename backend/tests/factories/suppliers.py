"""
Factories for supplier-related models.
"""

import factory
from factory.django import DjangoModelFactory

from apps.suppliers.models import PortalInvitation, PortalUser, Supplier

from .base import OrganizationFactory, UserFactory


class SupplierFactory(DjangoModelFactory):
    """Factory for Supplier model."""

    class Meta:
        model = Supplier

    name = factory.Sequence(lambda n: f'Supplier {n}')
    code = factory.Sequence(lambda n: f'SUP{n:04d}')
    organization = factory.SubFactory(OrganizationFactory)
    status = 'PROSPECT'
    contact_name = factory.Faker('name')
    contact_email = factory.Faker('email')
    contact_phone = factory.Faker('phone_number')
    address_line1 = factory.Faker('street_address')
    city = factory.Faker('city')
    state = factory.Faker('state_abbr')
    postal_code = factory.Faker('postcode')
    country = 'USA'


class ApprovedSupplierFactory(SupplierFactory):
    """Factory for approved suppliers."""

    status = 'APPROVED'
    approved_at = factory.Faker('date_time_this_year')


class PortalUserFactory(DjangoModelFactory):
    """Factory for PortalUser model."""

    class Meta:
        model = PortalUser

    supplier = factory.SubFactory(ApprovedSupplierFactory)
    user = factory.SubFactory(UserFactory)
    role = 'MEMBER'
    access_status = 'ACTIVE'


class PortalInvitationFactory(DjangoModelFactory):
    """Factory for PortalInvitation model."""

    class Meta:
        model = PortalInvitation

    supplier = factory.SubFactory(ApprovedSupplierFactory)
    email = factory.Faker('email')
    status = 'PENDING'
    created_by = factory.SubFactory(UserFactory)

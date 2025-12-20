"""
Base factories for fundamental models.
"""

import factory
from factory.django import DjangoModelFactory

from apps.organizations.models import Organization
from apps.users.models import User


class OrganizationFactory(DjangoModelFactory):
    """Factory for Organization model."""

    class Meta:
        model = Organization

    name = factory.Sequence(lambda n: f'Test Organization {n}')
    code = factory.Sequence(lambda n: f'ORG{n:04d}')
    status = 'ACTIVE'
    timezone = 'UTC'
    default_currency = 'USD'
    fiscal_year_start_month = 1


class UserFactory(DjangoModelFactory):
    """Factory for User model."""

    class Meta:
        model = User

    email = factory.Sequence(lambda n: f'user{n}@example.com')
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')
    is_active = True
    status = 'ACTIVE'
    organization = factory.SubFactory(OrganizationFactory)

    @factory.post_generation
    def roles(self, create, extracted, **kwargs):
        """Handle roles relationship."""
        if not create:
            return
        if extracted:
            for role in extracted:
                self.roles.add(role)


class AdminUserFactory(UserFactory):
    """Factory for admin users."""

    is_staff = True
    is_superuser = True


class StaffUserFactory(UserFactory):
    """Factory for staff users."""

    is_staff = True
    is_superuser = False

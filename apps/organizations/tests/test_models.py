"""
Tests for Organization models.
"""

import pytest

from apps.organizations.models import Organization


@pytest.mark.django_db
class TestOrganizationModel:
    """Tests for Organization model."""

    def test_create_organization(self):
        """Can create organization with required fields."""
        org = Organization.objects.create(
            name='Acme Corporation',
            code='ACME',
        )
        assert org.name == 'Acme Corporation'
        assert org.code == 'ACME'

    def test_organization_code_unique(self):
        """Organization codes must be unique."""
        Organization.objects.create(name='First Org', code='UNIQUE1')

        with pytest.raises(Exception):  # IntegrityError
            Organization.objects.create(name='Second Org', code='UNIQUE1')

    def test_organization_default_status(self):
        """Organization defaults to ACTIVE status."""
        org = Organization.objects.create(name='Test Org', code='DEFAULT1')
        assert org.status == 'ACTIVE'

    def test_organization_default_currency(self):
        """Organization defaults to USD currency."""
        org = Organization.objects.create(name='Test Org', code='CURR01')
        assert org.default_currency == 'USD'

    def test_organization_default_timezone(self):
        """Organization defaults to UTC timezone."""
        org = Organization.objects.create(name='Test Org', code='TZ001')
        assert org.timezone == 'UTC'

    def test_organization_fiscal_year_default(self):
        """Fiscal year start month defaults to January (1)."""
        org = Organization.objects.create(name='Test Org', code='FY001')
        assert org.fiscal_year_start_month == 1

    def test_organization_string_representation(self):
        """String representation should be the org name."""
        org = Organization.objects.create(name='Test Corp', code='STR001')
        assert str(org) == 'Test Corp'

    def test_organization_has_uuid_id(self):
        """Organization should use UUID primary key."""
        org = Organization.objects.create(name='UUID Org', code='UUID01')
        assert len(str(org.id)) == 36

    def test_organization_custom_settings(self):
        """Can create organization with custom settings."""
        org = Organization.objects.create(
            name='Custom Org',
            code='CUSTOM1',
            timezone='America/New_York',
            default_currency='EUR',
            fiscal_year_start_month=7,  # July fiscal year
        )
        assert org.timezone == 'America/New_York'
        assert org.default_currency == 'EUR'
        assert org.fiscal_year_start_month == 7


@pytest.mark.django_db
class TestOrganizationSoftDelete:
    """Tests for Organization soft delete."""

    def test_soft_delete_organization(self):
        """Can soft delete an organization."""
        org = Organization.objects.create(name='Delete Me', code='DEL001')
        org.soft_delete()

        assert org.is_deleted is True
        assert org.deleted_at is not None

    def test_soft_deleted_excluded_from_default_queryset(self):
        """Soft-deleted orgs excluded from default manager."""
        org1 = Organization.objects.create(name='Active Org', code='ACT001')
        org2 = Organization.objects.create(name='Deleted Org', code='DEL002')
        org2.soft_delete()

        active_orgs = Organization.objects.all()
        assert org1 in active_orgs
        assert org2 not in active_orgs

    def test_soft_deleted_included_in_all_objects(self):
        """Soft-deleted orgs included in all_objects manager."""
        org = Organization.objects.create(name='All Objects Test', code='ALL001')
        org.soft_delete()

        all_orgs = Organization.all_objects.all()
        assert org in all_orgs

    def test_restore_organization(self):
        """Can restore a soft-deleted organization."""
        org = Organization.objects.create(name='Restore Me', code='REST01')
        org.soft_delete()
        org.restore()

        assert org.is_deleted is False
        assert org.deleted_at is None
        assert org in Organization.objects.all()


@pytest.mark.django_db
class TestOrganizationRelationships:
    """Tests for Organization relationships."""

    def test_organization_has_users(self):
        """Organization can have related users."""
        from apps.users.models import User

        org = Organization.objects.create(name='Users Org', code='USR001')
        user = User.objects.create_user(
            email='user@org.com',
            password='password123',
            first_name='Test',
            last_name='User',
            organization=org,
        )

        assert user in org.users.all()
        assert org.users.count() == 1

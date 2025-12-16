"""
Tests for core models - BaseModel and SoftDeleteModel.

Following TDD: Write tests first, then implement to pass.
"""

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.organizations.models import Organization


@pytest.mark.django_db
class TestBaseModel:
    """Tests for BaseModel functionality."""

    def test_has_uuid_primary_key(self):
        """Model should use UUID as primary key."""
        org = Organization.objects.create(name="Test Org", code="TEST001")
        assert org.id is not None
        assert len(str(org.id)) == 36  # UUID format

    def test_has_created_at_timestamp(self):
        """Model should automatically set created_at timestamp."""
        org = Organization.objects.create(name="Test Org", code="TEST002")
        assert org.created_at is not None
        assert org.created_at <= timezone.now()

    def test_has_updated_at_timestamp(self):
        """Model should automatically update updated_at timestamp."""
        org = Organization.objects.create(name="Test Org", code="TEST003")
        original_updated = org.updated_at

        org.name = "Updated Org"
        org.save()

        assert org.updated_at > original_updated

    def test_is_deleted_defaults_to_false(self):
        """Model should default is_deleted to False."""
        org = Organization.objects.create(name="Test Org", code="TEST004")
        assert org.is_deleted is False
        assert org.deleted_at is None


@pytest.mark.django_db
class TestSoftDelete:
    """Tests for soft delete functionality."""

    def test_soft_delete_sets_is_deleted_flag(self):
        """soft_delete() should set is_deleted to True."""
        org = Organization.objects.create(name="Test Org", code="TEST010")
        org.soft_delete()

        assert org.is_deleted is True

    @freeze_time("2025-01-15 12:00:00")
    def test_soft_delete_sets_deleted_at_timestamp(self):
        """soft_delete() should set deleted_at to current time."""
        org = Organization.objects.create(name="Test Org", code="TEST011")
        org.soft_delete()

        assert org.deleted_at is not None
        # Check timestamp matches frozen time
        assert org.deleted_at.hour == 12
        assert org.deleted_at.minute == 0

    def test_soft_delete_persists_to_database(self):
        """soft_delete() changes should be saved to database."""
        org = Organization.objects.create(name="Test Org", code="TEST012")
        org.soft_delete()

        # Reload from database
        org.refresh_from_db()
        assert org.is_deleted is True
        assert org.deleted_at is not None

    def test_restore_clears_deleted_flags(self):
        """restore() should clear is_deleted and deleted_at."""
        org = Organization.objects.create(name="Test Org", code="TEST013")
        org.soft_delete()
        org.restore()

        assert org.is_deleted is False
        assert org.deleted_at is None

    def test_restore_persists_to_database(self):
        """restore() changes should be saved to database."""
        org = Organization.objects.create(name="Test Org", code="TEST014")
        org.soft_delete()
        org.restore()

        # Reload from database
        org.refresh_from_db()
        assert org.is_deleted is False
        assert org.deleted_at is None


@pytest.mark.django_db
class TestActiveManager:
    """Tests for ActiveManager that filters soft-deleted records."""

    def test_objects_excludes_deleted_records(self):
        """Default manager should exclude soft-deleted records."""
        org1 = Organization.objects.create(name="Active Org", code="ACTIVE01")
        org2 = Organization.objects.create(name="Deleted Org", code="DELETE01")
        org2.soft_delete()

        active_orgs = Organization.objects.all()
        assert org1 in active_orgs
        assert org2 not in active_orgs

    def test_all_objects_includes_deleted_records(self):
        """all_objects manager should include soft-deleted records."""
        org1 = Organization.objects.create(name="Active Org", code="ACTIVE02")
        org2 = Organization.objects.create(name="Deleted Org", code="DELETE02")
        org2.soft_delete()

        all_orgs = Organization.all_objects.all()
        assert org1 in all_orgs
        assert org2 in all_orgs

    def test_objects_count_excludes_deleted(self):
        """objects.count() should not include soft-deleted records."""
        Organization.objects.create(name="Active 1", code="CNT001")
        Organization.objects.create(name="Active 2", code="CNT002")
        org3 = Organization.objects.create(name="Deleted", code="CNT003")
        org3.soft_delete()

        assert Organization.objects.count() == 2
        assert Organization.all_objects.count() == 3

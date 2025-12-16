"""
Tests for Supplier model and state machine.

This is a strict TDD module - tests written first, then implementation.
"""

import pytest
from django.db import IntegrityError

from apps.core.exceptions import InvalidStateTransitionError
from apps.organizations.models import Organization


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def supplier(db, organization):
    """Create a test supplier in PROSPECT state."""
    from apps.suppliers.models import Supplier
    return Supplier.objects.create(
        name='Test Supplier',
        code='SUP001',
        organization=organization,
    )


@pytest.mark.django_db
class TestSupplierModel:
    """Tests for basic Supplier model functionality."""

    def test_create_supplier(self, organization):
        """Can create supplier with required fields."""
        from apps.suppliers.models import Supplier
        supplier = Supplier.objects.create(
            name='Acme Supplies',
            code='ACME01',
            organization=organization,
        )
        assert supplier.name == 'Acme Supplies'
        assert supplier.code == 'ACME01'

    def test_supplier_code_unique_per_org(self, organization):
        """Supplier code must be unique within organization."""
        from apps.suppliers.models import Supplier
        Supplier.objects.create(
            name='First Supplier',
            code='UNIQUE1',
            organization=organization,
        )
        with pytest.raises(IntegrityError):
            Supplier.objects.create(
                name='Second Supplier',
                code='UNIQUE1',
                organization=organization,
            )

    def test_supplier_has_uuid_id(self, organization):
        """Supplier should use UUID primary key."""
        from apps.suppliers.models import Supplier
        supplier = Supplier.objects.create(
            name='UUID Supplier',
            code='UUID01',
            organization=organization,
        )
        assert len(str(supplier.id)) == 36

    def test_supplier_default_status_is_prospect(self, organization):
        """New suppliers should start in PROSPECT status."""
        from apps.suppliers.models import Supplier
        supplier = Supplier.objects.create(
            name='New Supplier',
            code='NEW001',
            organization=organization,
        )
        assert supplier.status == 'PROSPECT'

    def test_supplier_string_representation(self, supplier):
        """String representation should include name and code."""
        assert 'Test Supplier' in str(supplier)


@pytest.mark.django_db
class TestSupplierStateMachine:
    """Tests for supplier status state machine.

    Valid transitions:
    - PROSPECT -> PENDING_REVIEW (submit_for_review)
    - PENDING_REVIEW -> APPROVED (approve)
    - PENDING_REVIEW -> REJECTED (reject)
    - APPROVED -> BLOCKED (block)
    - BLOCKED -> APPROVED (unblock)
    - REJECTED -> PROSPECT (resubmit)
    """

    def test_prospect_can_submit_for_review(self, supplier):
        """PROSPECT -> PENDING_REVIEW is valid."""
        supplier.submit_for_review()
        assert supplier.status == 'PENDING_REVIEW'

    def test_pending_review_can_be_approved(self, supplier):
        """PENDING_REVIEW -> APPROVED is valid."""
        supplier.submit_for_review()
        supplier.approve()
        assert supplier.status == 'APPROVED'

    def test_pending_review_can_be_rejected(self, supplier):
        """PENDING_REVIEW -> REJECTED is valid."""
        supplier.submit_for_review()
        supplier.reject()
        assert supplier.status == 'REJECTED'

    def test_approved_can_be_blocked(self, supplier):
        """APPROVED -> BLOCKED is valid."""
        supplier.submit_for_review()
        supplier.approve()
        supplier.block()
        assert supplier.status == 'BLOCKED'

    def test_blocked_can_be_unblocked(self, supplier):
        """BLOCKED -> APPROVED is valid (unblock)."""
        supplier.submit_for_review()
        supplier.approve()
        supplier.block()
        supplier.unblock()
        assert supplier.status == 'APPROVED'

    def test_rejected_can_resubmit(self, supplier):
        """REJECTED -> PROSPECT is valid (resubmit)."""
        supplier.submit_for_review()
        supplier.reject()
        supplier.resubmit()
        assert supplier.status == 'PROSPECT'


@pytest.mark.django_db
class TestSupplierInvalidTransitions:
    """Tests for invalid state transitions."""

    def test_prospect_cannot_be_approved(self, supplier):
        """PROSPECT -> APPROVED is invalid (must go through review)."""
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            supplier.approve()
        assert exc_info.value.from_state == 'PROSPECT'
        assert exc_info.value.to_state == 'APPROVED'

    def test_prospect_cannot_be_blocked(self, supplier):
        """PROSPECT -> BLOCKED is invalid."""
        with pytest.raises(InvalidStateTransitionError):
            supplier.block()

    def test_approved_cannot_submit_for_review(self, supplier):
        """APPROVED -> PENDING_REVIEW is invalid."""
        supplier.submit_for_review()
        supplier.approve()
        with pytest.raises(InvalidStateTransitionError):
            supplier.submit_for_review()

    def test_pending_review_cannot_be_blocked(self, supplier):
        """PENDING_REVIEW -> BLOCKED is invalid (must approve first)."""
        supplier.submit_for_review()
        with pytest.raises(InvalidStateTransitionError):
            supplier.block()

    def test_rejected_cannot_be_approved_directly(self, supplier):
        """REJECTED -> APPROVED is invalid (must resubmit first)."""
        supplier.submit_for_review()
        supplier.reject()
        with pytest.raises(InvalidStateTransitionError):
            supplier.approve()


@pytest.mark.django_db
class TestSupplierStateHistory:
    """Tests for state change history tracking."""

    def test_state_changes_are_persisted(self, supplier):
        """State changes should be persisted to database."""
        supplier.submit_for_review()
        supplier.approve()

        supplier.refresh_from_db()
        assert supplier.status == 'APPROVED'

    def test_can_track_approval_date(self, supplier):
        """Approved suppliers should have approved_at timestamp."""
        supplier.submit_for_review()
        supplier.approve()

        assert supplier.approved_at is not None

    def test_can_track_blocked_date(self, supplier):
        """Blocked suppliers should have blocked_at timestamp."""
        supplier.submit_for_review()
        supplier.approve()
        supplier.block()

        assert supplier.blocked_at is not None

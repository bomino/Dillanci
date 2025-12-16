"""
Tests for Requisition models with approval workflow.

Strict TDD - requisition workflow is critical business logic.
"""

import pytest
from decimal import Decimal
from datetime import date

from apps.core.exceptions import InvalidStateTransitionError, InsufficientBudgetError
from apps.organizations.models import Organization
from apps.users.models import User


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def requester(db, organization):
    """Create a test user as requester."""
    return User.objects.create_user(
        email='requester@example.com',
        password='test123',
        first_name='Test',
        last_name='Requester',
        organization=organization,
    )


@pytest.fixture
def approver(db, organization):
    """Create a test user as approver."""
    return User.objects.create_user(
        email='approver@example.com',
        password='test123',
        first_name='Test',
        last_name='Approver',
        organization=organization,
    )


@pytest.fixture
def budget_line(db, organization):
    """Create a test budget line with $10,000."""
    from apps.budget.models import FiscalYear, BudgetLine
    fy = FiscalYear.objects.create(
        organization=organization,
        year=2025,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
    )
    return BudgetLine.objects.create(
        fiscal_year=fy,
        code='IT-2025-001',
        name='IT Equipment',
        allocated_amount=Decimal('10000.00'),
    )


@pytest.fixture
def requisition(db, organization, requester, budget_line):
    """Create a test requisition in DRAFT status."""
    from apps.requisitions.models import Requisition
    return Requisition.objects.create(
        organization=organization,
        requester=requester,
        budget_line=budget_line,
        title='Test Requisition',
        description='Test description',
    )


@pytest.mark.django_db
class TestRequisitionModel:
    """Tests for Requisition model."""

    def test_create_requisition(self, organization, requester, budget_line):
        """Can create requisition with required fields."""
        from apps.requisitions.models import Requisition
        req = Requisition.objects.create(
            organization=organization,
            requester=requester,
            budget_line=budget_line,
            title='Office Supplies',
            description='Q1 office supply order',
        )
        assert req.title == 'Office Supplies'
        assert req.requester == requester

    def test_requisition_has_uuid_id(self, requisition):
        """Requisition should use UUID primary key."""
        assert len(str(requisition.id)) == 36

    def test_requisition_default_status_draft(self, organization, requester, budget_line):
        """New requisitions default to DRAFT status."""
        from apps.requisitions.models import Requisition
        req = Requisition.objects.create(
            organization=organization,
            requester=requester,
            budget_line=budget_line,
            title='Test',
        )
        assert req.status == 'DRAFT'

    def test_requisition_generates_number(self, requisition):
        """Requisition should have auto-generated number."""
        assert requisition.number is not None
        assert len(requisition.number) > 0


@pytest.mark.django_db
class TestRequisitionLines:
    """Tests for requisition line items."""

    def test_add_line_to_requisition(self, requisition):
        """Can add line items to requisition."""
        from apps.requisitions.models import RequisitionLine
        line = RequisitionLine.objects.create(
            requisition=requisition,
            description='Laptop Computer',
            quantity=2,
            unit_price=Decimal('1500.00'),
            unit_of_measure='EA',
        )
        assert line.requisition == requisition
        assert line in requisition.lines.all()

    def test_line_extended_amount(self, requisition):
        """Line extended amount = quantity * unit_price."""
        from apps.requisitions.models import RequisitionLine
        line = RequisitionLine.objects.create(
            requisition=requisition,
            description='Monitor',
            quantity=3,
            unit_price=Decimal('500.00'),
            unit_of_measure='EA',
        )
        assert line.extended_amount == Decimal('1500.00')

    def test_requisition_total_amount(self, requisition):
        """Requisition total is sum of line extended amounts."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item 1',
            quantity=2,
            unit_price=Decimal('100.00'),
            unit_of_measure='EA',
        )
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item 2',
            quantity=1,
            unit_price=Decimal('500.00'),
            unit_of_measure='EA',
        )
        assert requisition.total_amount == Decimal('700.00')


@pytest.mark.django_db
class TestRequisitionWorkflow:
    """Tests for requisition approval workflow.

    Valid transitions:
    - DRAFT -> SUBMITTED (submit)
    - SUBMITTED -> APPROVED (approve)
    - SUBMITTED -> REJECTED (reject)
    - REJECTED -> DRAFT (revise)
    - APPROVED -> CANCELLED (cancel)
    - DRAFT -> CANCELLED (cancel)
    """

    def test_draft_can_be_submitted(self, requisition):
        """DRAFT -> SUBMITTED is valid."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item',
            quantity=1,
            unit_price=Decimal('100.00'),
            unit_of_measure='EA',
        )
        requisition.submit()
        assert requisition.status == 'SUBMITTED'

    def test_submitted_can_be_approved(self, requisition, approver):
        """SUBMITTED -> APPROVED is valid."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item',
            quantity=1,
            unit_price=Decimal('100.00'),
            unit_of_measure='EA',
        )
        requisition.submit()
        requisition.approve(approved_by=approver)
        assert requisition.status == 'APPROVED'
        assert requisition.approved_by == approver

    def test_submitted_can_be_rejected(self, requisition, approver):
        """SUBMITTED -> REJECTED is valid."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item',
            quantity=1,
            unit_price=Decimal('100.00'),
            unit_of_measure='EA',
        )
        requisition.submit()
        requisition.reject(rejected_by=approver, reason='Budget concerns')
        assert requisition.status == 'REJECTED'
        assert requisition.rejection_reason == 'Budget concerns'

    def test_rejected_can_be_revised(self, requisition, approver):
        """REJECTED -> DRAFT is valid (revise for resubmission)."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item',
            quantity=1,
            unit_price=Decimal('100.00'),
            unit_of_measure='EA',
        )
        requisition.submit()
        requisition.reject(rejected_by=approver, reason='Too expensive')
        requisition.revise()
        assert requisition.status == 'DRAFT'

    def test_draft_cannot_be_approved(self, requisition, approver):
        """DRAFT -> APPROVED is invalid (must submit first)."""
        with pytest.raises(InvalidStateTransitionError):
            requisition.approve(approved_by=approver)


@pytest.mark.django_db
class TestRequisitionBudgetIntegration:
    """Tests for requisition budget integration."""

    def test_submit_creates_encumbrance(self, requisition, budget_line):
        """Submitting requisition creates budget encumbrance."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Equipment',
            quantity=1,
            unit_price=Decimal('3000.00'),
            unit_of_measure='EA',
        )
        requisition.submit()

        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('3000.00')
        assert requisition.encumbrance is not None

    def test_submit_fails_on_insufficient_budget(self, requisition, budget_line):
        """Submit fails if budget is insufficient."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Expensive Item',
            quantity=1,
            unit_price=Decimal('15000.00'),  # Exceeds $10,000 budget
            unit_of_measure='EA',
        )

        with pytest.raises(InsufficientBudgetError) as exc_info:
            requisition.submit()
        assert exc_info.value.requested == Decimal('15000.00')
        assert requisition.status == 'DRAFT'  # Status unchanged

    def test_rejection_releases_encumbrance(self, requisition, approver, budget_line):
        """Rejecting requisition releases the encumbrance."""
        from apps.requisitions.models import RequisitionLine
        RequisitionLine.objects.create(
            requisition=requisition,
            description='Item',
            quantity=1,
            unit_price=Decimal('2000.00'),
            unit_of_measure='EA',
        )
        requisition.submit()

        # Verify encumbered
        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('2000.00')

        requisition.reject(rejected_by=approver, reason='Not needed')

        # Verify released
        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('10000.00')

    def test_cannot_submit_empty_requisition(self, requisition):
        """Cannot submit requisition with no lines."""
        with pytest.raises(ValueError, match='lines'):
            requisition.submit()

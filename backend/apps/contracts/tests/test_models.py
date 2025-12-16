"""
Tests for Contract models.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.contracts.models import (
    Contract,
    ContractLine,
    ContractMilestone,
    ContractSpend,
)
from apps.core.exceptions import (
    ContractValidationError,
    InvalidStateTransitionError,
)
from apps.organizations.models import Organization
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def user(db, organization):
    """Create a test user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def supplier(db, organization):
    """Create a test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP001',
        name='Test Supplier',
        status='APPROVED',
    )


@pytest.fixture
def contract(db, organization, supplier, user):
    """Create a test contract."""
    return Contract.objects.create(
        organization=organization,
        supplier=supplier,
        created_by=user,
        title='Test Contract',
        contract_type='BLANKET',
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
        total_value=Decimal('100000.00'),
    )


@pytest.fixture
def contract_with_lines(contract):
    """Create a contract with line items."""
    ContractLine.objects.create(
        contract=contract,
        description='Widget A',
        unit_price=Decimal('10.00'),
    )
    ContractLine.objects.create(
        contract=contract,
        description='Widget B',
        unit_price=Decimal('25.00'),
    )
    return contract


@pytest.mark.django_db
class TestContract:
    """Tests for Contract model."""

    def test_contract_creation(self, organization, supplier, user):
        """Can create a contract."""
        contract = Contract.objects.create(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='New Contract',
            total_value=Decimal('50000.00'),
        )

        assert contract.id is not None
        assert contract.title == 'New Contract'
        assert contract.status == 'DRAFT'
        assert contract.amendment_number == 0

    def test_contract_auto_generates_number(self, contract):
        """Contract number is auto-generated."""
        assert contract.number is not None
        assert contract.number.startswith('CONTRACT-')
        assert str(timezone.now().year) in contract.number

    def test_contract_str(self, contract):
        """Contract has meaningful string representation."""
        assert contract.number in str(contract)
        assert 'Test Contract' in str(contract)

    def test_contract_defaults(self, contract):
        """Contract has correct defaults."""
        assert contract.status == 'DRAFT'
        assert contract.contract_type == 'BLANKET'
        assert contract.currency == 'USD'
        assert contract.payment_terms == 'NET30'
        assert contract.auto_renew is False
        assert contract.renewal_notice_days == 30

    def test_total_spent_no_records(self, contract):
        """Total spent is 0 with no spend records."""
        assert contract.total_spent == Decimal('0.00')

    def test_remaining_value(self, contract):
        """Remaining value is total value minus spent."""
        assert contract.remaining_value == Decimal('100000.00')

    def test_utilization_percent_no_spend(self, contract):
        """Utilization is 0 with no spend."""
        assert contract.utilization_percent == Decimal('0.00')

    def test_is_expired_future_end_date(self, contract):
        """Contract is not expired with future end date."""
        assert contract.is_expired is False

    def test_is_expired_past_end_date(self, contract):
        """Contract is expired with past end date."""
        contract.end_date = date.today() - timedelta(days=1)
        contract.save()
        assert contract.is_expired is True

    def test_days_until_expiry(self, contract):
        """Days until expiry is calculated correctly."""
        from django.utils import timezone
        # Use timezone.now().date() to match the model's calculation
        contract.end_date = timezone.now().date() + timedelta(days=30)
        contract.save()
        assert contract.days_until_expiry == 30

    def test_needs_renewal_notice_not_active(self, contract):
        """Needs renewal notice is False for non-active contract."""
        contract.end_date = date.today() + timedelta(days=15)
        contract.renewal_notice_days = 30
        contract.save()
        assert contract.needs_renewal_notice is False  # DRAFT status

    def test_soft_delete(self, contract):
        """Contract can be soft deleted."""
        contract.soft_delete()
        contract.refresh_from_db()

        assert contract.is_deleted is True
        assert contract.deleted_at is not None

    def test_soft_delete_excluded_from_queryset(self, contract):
        """Soft deleted contracts excluded from default queryset."""
        contract_id = contract.id
        contract.soft_delete()

        assert not Contract.objects.filter(id=contract_id).exists()
        assert Contract.all_objects.filter(id=contract_id).exists()


@pytest.mark.django_db
class TestContractStateMachine:
    """Tests for Contract state machine."""

    def test_contract_creation_defaults_to_draft(self, contract):
        """New contracts start in DRAFT status."""
        assert contract.status == 'DRAFT'

    def test_draft_to_pending_approval_transition(self, contract_with_lines):
        """Can submit contract for approval (DRAFT -> PENDING_APPROVAL)."""
        contract_with_lines.submit_for_approval()
        assert contract_with_lines.status == 'PENDING_APPROVAL'

    def test_cannot_submit_without_lines(self, contract):
        """Cannot submit contract without line items."""
        with pytest.raises(ContractValidationError) as exc_info:
            contract.submit_for_approval()
        assert 'line items' in str(exc_info.value.message)

    def test_cannot_submit_without_dates(self, contract_with_lines):
        """Cannot submit contract without start/end dates."""
        contract_with_lines.start_date = None
        contract_with_lines.save()

        with pytest.raises(ContractValidationError) as exc_info:
            contract_with_lines.submit_for_approval()
        assert 'dates' in str(exc_info.value.message)

    def test_cannot_submit_with_invalid_dates(self, contract_with_lines):
        """Cannot submit contract with end date before start date."""
        contract_with_lines.end_date = contract_with_lines.start_date - timedelta(days=1)
        contract_with_lines.save()

        with pytest.raises(ContractValidationError) as exc_info:
            contract_with_lines.submit_for_approval()
        assert 'End date' in str(exc_info.value.message)

    def test_cannot_submit_without_total_value(self, contract_with_lines):
        """Cannot submit contract without positive total value."""
        contract_with_lines.total_value = Decimal('0.00')
        contract_with_lines.save()

        with pytest.raises(ContractValidationError) as exc_info:
            contract_with_lines.submit_for_approval()
        assert 'positive total value' in str(exc_info.value.message)

    def test_approve_sets_approver_and_timestamp(self, contract_with_lines, user):
        """Approval records approver and timestamp."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.approve(user)

        assert contract_with_lines.status == 'ACTIVE'
        assert contract_with_lines.approved_by == user
        assert contract_with_lines.approved_at is not None

    def test_return_to_draft_clears_approval(self, contract_with_lines, user):
        """Return to draft clears approval info."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.return_to_draft()

        assert contract_with_lines.status == 'DRAFT'
        assert contract_with_lines.approved_by is None
        assert contract_with_lines.approved_at is None

    def test_active_to_terminated_transition(self, contract_with_lines, user):
        """Can terminate active contract."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.approve(user)
        contract_with_lines.terminate('Business decision')

        assert contract_with_lines.status == 'TERMINATED'
        assert contract_with_lines.terminated_at is not None
        assert contract_with_lines.termination_reason == 'Business decision'

    def test_active_to_expired_transition(self, contract_with_lines, user):
        """Can expire active contract."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.approve(user)
        contract_with_lines.expire()

        assert contract_with_lines.status == 'EXPIRED'

    def test_expired_to_active_via_renew(self, contract_with_lines, user):
        """Can renew expired contract."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.approve(user)
        contract_with_lines.expire()

        new_end_date = date.today() + timedelta(days=365)
        contract_with_lines.renew(new_end_date)

        assert contract_with_lines.status == 'ACTIVE'
        assert contract_with_lines.end_date == new_end_date
        assert contract_with_lines.amendment_number == 1

    def test_renew_with_new_total_value(self, contract_with_lines, user):
        """Can renew with new total value."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.approve(user)
        contract_with_lines.expire()

        new_end_date = date.today() + timedelta(days=365)
        contract_with_lines.renew(new_end_date, new_total_value=Decimal('200000.00'))

        assert contract_with_lines.total_value == Decimal('200000.00')

    def test_invalid_transition_raises_error(self, contract):
        """Invalid transition raises error."""
        # Cannot go directly from DRAFT to ACTIVE
        with pytest.raises(InvalidStateTransitionError):
            contract._transition_to('ACTIVE')

    def test_cancel_from_draft(self, contract):
        """Can cancel from DRAFT status."""
        contract.cancel()
        assert contract.status == 'CANCELLED'

    def test_cancel_from_pending_approval(self, contract_with_lines):
        """Can cancel from PENDING_APPROVAL status."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.cancel()
        assert contract_with_lines.status == 'CANCELLED'

    def test_cannot_cancel_active_contract(self, contract_with_lines, user):
        """Cannot cancel ACTIVE contract (must terminate instead)."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.approve(user)

        with pytest.raises(InvalidStateTransitionError):
            contract_with_lines.cancel()


@pytest.mark.django_db
class TestContractLine:
    """Tests for ContractLine model."""

    def test_contract_line_creation(self, contract):
        """Can create contract line."""
        line = ContractLine.objects.create(
            contract=contract,
            description='Test Item',
            unit_price=Decimal('99.99'),
        )

        assert line.id is not None
        assert line.line_number == 1
        assert line.is_active is True

    def test_contract_line_auto_increment(self, contract):
        """Line number auto-increments."""
        line1 = ContractLine.objects.create(
            contract=contract,
            description='Line 1',
            unit_price=Decimal('10.00'),
        )
        line2 = ContractLine.objects.create(
            contract=contract,
            description='Line 2',
            unit_price=Decimal('20.00'),
        )

        assert line1.line_number == 1
        assert line2.line_number == 2

    def test_contract_line_str(self, contract):
        """Contract line has meaningful string representation."""
        line = ContractLine.objects.create(
            contract=contract,
            description='Widget',
            unit_price=Decimal('10.00'),
        )
        assert contract.number in str(line)
        assert 'Widget' in str(line)

    def test_is_price_valid_active_no_dates(self, contract):
        """Price is valid when active with no date restrictions."""
        line = ContractLine.objects.create(
            contract=contract,
            description='Item',
            unit_price=Decimal('10.00'),
        )
        assert line.is_price_valid is True

    def test_is_price_valid_inactive(self, contract):
        """Price is not valid when line is inactive."""
        line = ContractLine.objects.create(
            contract=contract,
            description='Item',
            unit_price=Decimal('10.00'),
            is_active=False,
        )
        assert line.is_price_valid is False

    def test_is_price_valid_future_valid_from(self, contract):
        """Price is not valid before valid_from date."""
        line = ContractLine.objects.create(
            contract=contract,
            description='Item',
            unit_price=Decimal('10.00'),
            valid_from=date.today() + timedelta(days=30),
        )
        assert line.is_price_valid is False

    def test_is_price_valid_past_valid_to(self, contract):
        """Price is not valid after valid_to date."""
        line = ContractLine.objects.create(
            contract=contract,
            description='Item',
            unit_price=Decimal('10.00'),
            valid_to=date.today() - timedelta(days=1),
        )
        assert line.is_price_valid is False


@pytest.mark.django_db
class TestContractMilestone:
    """Tests for ContractMilestone model."""

    def test_milestone_creation(self, contract):
        """Can create contract milestone."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Phase 1 Delivery',
            due_date=date.today() + timedelta(days=30),
            amount=Decimal('25000.00'),
        )

        assert milestone.id is not None
        assert milestone.status == 'PENDING'
        assert milestone.completed_date is None

    def test_milestone_str(self, contract):
        """Milestone has meaningful string representation."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Phase 1',
            due_date=date.today() + timedelta(days=30),
        )
        assert contract.number in str(milestone)
        assert 'Phase 1' in str(milestone)

    def test_milestone_is_overdue_future(self, contract):
        """Milestone is not overdue with future due date."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Future',
            due_date=date.today() + timedelta(days=30),
        )
        assert milestone.is_overdue is False

    def test_milestone_is_overdue_past(self, contract):
        """Milestone is overdue with past due date."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Past',
            due_date=date.today() - timedelta(days=1),
        )
        assert milestone.is_overdue is True

    def test_milestone_is_not_overdue_if_completed(self, contract):
        """Completed milestone is not overdue."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Done',
            due_date=date.today() - timedelta(days=1),
        )
        milestone.complete()
        assert milestone.is_overdue is False

    def test_milestone_complete(self, contract):
        """Can complete a milestone."""
        from django.utils import timezone
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Test',
            due_date=date.today() + timedelta(days=30),
        )
        milestone.complete()

        assert milestone.status == 'COMPLETED'
        assert milestone.completed_date == timezone.now().date()

    def test_milestone_complete_with_date(self, contract):
        """Can complete a milestone with specific date."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Test',
            due_date=date.today() + timedelta(days=30),
        )
        completed = date.today() - timedelta(days=5)
        milestone.complete(completed)

        assert milestone.completed_date == completed

    def test_milestone_mark_missed(self, contract):
        """Can mark milestone as missed."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Test',
            due_date=date.today() - timedelta(days=1),
        )
        milestone.mark_missed()

        assert milestone.status == 'MISSED'

    def test_milestone_waive(self, contract):
        """Can waive a milestone."""
        milestone = ContractMilestone.objects.create(
            contract=contract,
            title='Test',
            due_date=date.today() + timedelta(days=30),
        )
        milestone.waive('No longer required')

        assert milestone.status == 'WAIVED'
        assert 'No longer required' in milestone.notes


@pytest.mark.django_db
class TestContractSpend:
    """Tests for ContractSpend model."""

    def test_spend_record_creation(self, contract_with_lines, organization, user, supplier):
        """Can create spend record."""
        from apps.budget.models import BudgetLine, FiscalYear
        from apps.purchase_orders.models import PurchaseOrder

        # Create required objects
        fiscal_year = FiscalYear.objects.create(
            organization=organization,
            year=2025,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
        )
        budget_line = BudgetLine.objects.create(
            fiscal_year=fiscal_year,
            code='TEST-BUDGET',
            name='Test Budget',
            allocated_amount=Decimal('100000.00'),
        )
        po = PurchaseOrder.objects.create(
            organization=organization,
            created_by=user,
            supplier=supplier,
            budget_line=budget_line,
            title='Test PO',
        )

        spend = ContractSpend.objects.create(
            contract=contract_with_lines,
            purchase_order=po,
            amount=Decimal('5000.00'),
        )

        assert spend.id is not None
        assert spend.recorded_at is not None

    def test_spend_affects_total_spent(self, contract_with_lines, organization, user, supplier):
        """Spend record affects contract total_spent property."""
        from apps.budget.models import BudgetLine, FiscalYear
        from apps.purchase_orders.models import PurchaseOrder

        fiscal_year = FiscalYear.objects.create(
            organization=organization,
            year=2025,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
        )
        budget_line = BudgetLine.objects.create(
            fiscal_year=fiscal_year,
            code='TEST-BUDGET-2',
            name='Test Budget',
            allocated_amount=Decimal('100000.00'),
        )
        po = PurchaseOrder.objects.create(
            organization=organization,
            created_by=user,
            supplier=supplier,
            budget_line=budget_line,
            title='Test PO',
        )

        ContractSpend.objects.create(
            contract=contract_with_lines,
            purchase_order=po,
            amount=Decimal('5000.00'),
        )

        assert contract_with_lines.total_spent == Decimal('5000.00')
        assert contract_with_lines.remaining_value == Decimal('95000.00')

"""
Tests for Contract services.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.contracts.models import Contract, ContractLine, ContractMilestone
from apps.contracts.services import ContractService
from apps.core.exceptions import (
    ContractExpiredError,
    ContractNotActiveError,
    SpendLimitExceededError,
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
def budget_line(db, organization):
    """Create a test budget line."""
    from apps.budget.models import BudgetLine, FiscalYear

    fiscal_year = FiscalYear.objects.create(
        organization=organization,
        year=2025,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
    )
    return BudgetLine.objects.create(
        fiscal_year=fiscal_year,
        code='TEST-BUDGET',
        name='Test Budget',
        allocated_amount=Decimal('100000.00'),
    )


@pytest.fixture
def active_contract(db, organization, supplier, user):
    """Create an active contract."""
    contract = Contract.objects.create(
        organization=organization,
        supplier=supplier,
        created_by=user,
        title='Active Contract',
        contract_type='BLANKET',
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
        total_value=Decimal('100000.00'),
    )
    ContractLine.objects.create(
        contract=contract,
        description='Widget',
        unit_price=Decimal('10.00'),
    )
    contract.submit_for_approval()
    contract.approve(user)
    return contract


@pytest.fixture
def purchase_order(db, organization, supplier, user, budget_line):
    """Create a test purchase order."""
    from apps.purchase_orders.models import PurchaseOrder

    return PurchaseOrder.objects.create(
        organization=organization,
        created_by=user,
        supplier=supplier,
        budget_line=budget_line,
        title='Test PO',
    )


@pytest.mark.django_db
class TestContractServiceCreate:
    """Tests for ContractService.create_contract."""

    def test_create_contract_basic(self, organization, supplier, user):
        """Can create a basic contract."""
        contract = ContractService.create_contract(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Test Contract',
        )

        assert contract.id is not None
        assert contract.status == 'DRAFT'
        assert contract.organization == organization
        assert contract.supplier == supplier

    def test_create_contract_with_all_fields(self, organization, supplier, user):
        """Can create contract with all fields."""
        contract = ContractService.create_contract(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Full Contract',
            description='Detailed description',
            contract_type='FIXED_PRICE',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            total_value=Decimal('50000.00'),
            currency='EUR',
            payment_terms='NET60',
            auto_renew=True,
            renewal_notice_days=45,
            terms_and_conditions='Standard terms',
        )

        assert contract.contract_type == 'FIXED_PRICE'
        assert contract.currency == 'EUR'
        assert contract.payment_terms == 'NET60'
        assert contract.auto_renew is True


@pytest.mark.django_db
class TestContractServiceLine:
    """Tests for ContractService.add_line."""

    def test_add_line(self, organization, supplier, user):
        """Can add line to contract."""
        contract = ContractService.create_contract(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Test',
        )

        line = ContractService.add_line(
            contract=contract,
            description='Widget A',
            unit_price=Decimal('99.99'),
        )

        assert line.contract == contract
        assert line.line_number == 1
        assert line.unit_price == Decimal('99.99')

    def test_add_line_with_quantity_limits(self, organization, supplier, user):
        """Can add line with quantity limits."""
        contract = ContractService.create_contract(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Test',
        )

        line = ContractService.add_line(
            contract=contract,
            description='Widget',
            unit_price=Decimal('10.00'),
            min_quantity=Decimal('100.00'),
            max_quantity=Decimal('10000.00'),
        )

        assert line.min_quantity == Decimal('100.00')
        assert line.max_quantity == Decimal('10000.00')


@pytest.mark.django_db
class TestContractServiceMilestone:
    """Tests for ContractService.add_milestone."""

    def test_add_milestone(self, organization, supplier, user):
        """Can add milestone to contract."""
        contract = ContractService.create_contract(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Test',
        )

        milestone = ContractService.add_milestone(
            contract=contract,
            title='Phase 1',
            due_date=date.today() + timedelta(days=30),
            amount=Decimal('10000.00'),
        )

        assert milestone.contract == contract
        assert milestone.status == 'PENDING'
        assert milestone.amount == Decimal('10000.00')


@pytest.mark.django_db
class TestContractServiceSpend:
    """Tests for ContractService.record_spend."""

    def test_record_spend_valid(self, active_contract, purchase_order):
        """Can record spend on active contract."""
        spend = ContractService.record_spend(
            contract=active_contract,
            purchase_order=purchase_order,
            amount=Decimal('5000.00'),
        )

        assert spend.amount == Decimal('5000.00')
        assert active_contract.total_spent == Decimal('5000.00')

    def test_record_spend_not_active(self, organization, supplier, user, purchase_order):
        """Cannot record spend on non-active contract."""
        contract = Contract.objects.create(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Draft Contract',
            total_value=Decimal('100000.00'),
        )

        with pytest.raises(ContractNotActiveError):
            ContractService.record_spend(
                contract=contract,
                purchase_order=purchase_order,
                amount=Decimal('5000.00'),
            )

    def test_record_spend_expired(self, active_contract, purchase_order):
        """Cannot record spend on expired contract."""
        active_contract.end_date = date.today() - timedelta(days=1)
        active_contract.save()

        with pytest.raises(ContractExpiredError):
            ContractService.record_spend(
                contract=active_contract,
                purchase_order=purchase_order,
                amount=Decimal('5000.00'),
            )

    def test_record_spend_exceeds_limit(self, active_contract, purchase_order):
        """Cannot record spend exceeding remaining value."""
        with pytest.raises(SpendLimitExceededError):
            ContractService.record_spend(
                contract=active_contract,
                purchase_order=purchase_order,
                amount=Decimal('150000.00'),
            )

    def test_record_spend_skip_validation(self, organization, supplier, user, purchase_order):
        """Can record spend without validation."""
        contract = Contract.objects.create(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Draft Contract',
            total_value=Decimal('100000.00'),
        )

        spend = ContractService.record_spend(
            contract=contract,
            purchase_order=purchase_order,
            amount=Decimal('5000.00'),
            validate=False,
        )

        assert spend.amount == Decimal('5000.00')


@pytest.mark.django_db
class TestContractServiceQueries:
    """Tests for ContractService query methods."""

    def test_get_expiring_contracts(self, active_contract, organization):
        """Can get contracts expiring within N days."""
        # Set to expire in 15 days
        active_contract.end_date = date.today() + timedelta(days=15)
        active_contract.save()

        expiring = ContractService.get_expiring_contracts(
            organization=organization,
            days=30,
        )

        assert active_contract in expiring

    def test_get_expiring_contracts_excludes_distant(self, active_contract, organization):
        """Excludes contracts expiring beyond threshold."""
        # Expires in 90 days
        active_contract.end_date = date.today() + timedelta(days=90)
        active_contract.save()

        expiring = ContractService.get_expiring_contracts(
            organization=organization,
            days=30,
        )

        assert active_contract not in expiring

    def test_get_contracts_for_supplier(self, active_contract, organization, supplier):
        """Can get contracts for a supplier."""
        contracts = ContractService.get_contracts_for_supplier(
            organization=organization,
            supplier=supplier,
        )

        assert active_contract in contracts

    def test_get_contracts_for_supplier_active_only(self, organization, supplier, user):
        """Active only filter works."""
        # Create draft contract
        draft = Contract.objects.create(
            organization=organization,
            supplier=supplier,
            created_by=user,
            title='Draft',
            total_value=Decimal('10000.00'),
        )

        active_contracts = ContractService.get_contracts_for_supplier(
            organization=organization,
            supplier=supplier,
            active_only=True,
        )
        all_contracts = ContractService.get_contracts_for_supplier(
            organization=organization,
            supplier=supplier,
            active_only=False,
        )

        assert draft not in active_contracts
        assert draft in all_contracts

    def test_get_spend_summary(self, active_contract, purchase_order):
        """Can get spend summary."""
        ContractService.record_spend(
            contract=active_contract,
            purchase_order=purchase_order,
            amount=Decimal('25000.00'),
        )

        summary = ContractService.get_spend_summary(active_contract)

        assert summary['contract_number'] == active_contract.number
        assert summary['total_value'] == Decimal('100000.00')
        assert summary['total_spent'] == Decimal('25000.00')
        assert summary['remaining_value'] == Decimal('75000.00')
        assert summary['utilization_percent'] == Decimal('25.00')
        assert summary['spend_count'] == 1

    def test_get_overdue_milestones(self, active_contract, organization):
        """Can get overdue milestones."""
        ContractMilestone.objects.create(
            contract=active_contract,
            title='Overdue',
            due_date=date.today() - timedelta(days=5),
        )
        ContractMilestone.objects.create(
            contract=active_contract,
            title='Future',
            due_date=date.today() + timedelta(days=30),
        )

        overdue = ContractService.get_overdue_milestones(
            organization=organization,
        )

        assert len(overdue) == 1
        assert overdue[0].title == 'Overdue'


@pytest.mark.django_db
class TestContractServiceAmendment:
    """Tests for ContractService.create_amendment."""

    def test_create_amendment(self, active_contract, user):
        """Can create contract amendment."""
        amendment = ContractService.create_amendment(
            original_contract=active_contract,
            created_by=user,
            new_end_date=date.today() + timedelta(days=730),
        )

        assert amendment.parent_contract == active_contract
        assert amendment.amendment_number == 1
        assert 'Amendment' in amendment.title
        assert amendment.status == 'DRAFT'

    def test_create_amendment_copies_lines(self, active_contract, user):
        """Amendment copies active lines from original."""
        ContractLine.objects.create(
            contract=active_contract,
            description='Copied Item',
            unit_price=Decimal('50.00'),
        )

        amendment = ContractService.create_amendment(
            original_contract=active_contract,
            created_by=user,
            new_end_date=date.today() + timedelta(days=730),
            copy_lines=True,
        )

        # Original has 2 lines (from fixture + new one)
        assert amendment.lines.count() == active_contract.lines.filter(is_active=True).count()

    def test_create_amendment_with_new_value(self, active_contract, user):
        """Amendment can have new total value."""
        amendment = ContractService.create_amendment(
            original_contract=active_contract,
            created_by=user,
            new_end_date=date.today() + timedelta(days=730),
            new_total_value=Decimal('200000.00'),
        )

        assert amendment.total_value == Decimal('200000.00')

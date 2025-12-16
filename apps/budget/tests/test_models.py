"""
Tests for Budget models - FiscalYear, BudgetLine, Encumbrance.

This is a strict TDD module - budget calculations must be tested thoroughly.
"""

import pytest
from decimal import Decimal
from django.utils import timezone
from datetime import date

from apps.core.exceptions import InsufficientBudgetError
from apps.organizations.models import Organization


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def fiscal_year(db, organization):
    """Create a test fiscal year."""
    from apps.budget.models import FiscalYear
    return FiscalYear.objects.create(
        organization=organization,
        year=2025,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
    )


@pytest.fixture
def budget_line(db, fiscal_year):
    """Create a test budget line with $10,000 budget."""
    from apps.budget.models import BudgetLine
    return BudgetLine.objects.create(
        fiscal_year=fiscal_year,
        code='IT-2025-001',
        name='IT Equipment',
        allocated_amount=Decimal('10000.00'),
    )


@pytest.mark.django_db
class TestFiscalYearModel:
    """Tests for FiscalYear model."""

    def test_create_fiscal_year(self, organization):
        """Can create fiscal year with required fields."""
        from apps.budget.models import FiscalYear
        fy = FiscalYear.objects.create(
            organization=organization,
            year=2025,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
        )
        assert fy.year == 2025
        assert fy.start_date == date(2025, 1, 1)
        assert fy.end_date == date(2025, 12, 31)

    def test_fiscal_year_has_uuid_id(self, fiscal_year):
        """FiscalYear should use UUID primary key."""
        assert len(str(fiscal_year.id)) == 36

    def test_fiscal_year_string_representation(self, fiscal_year):
        """String representation should include year."""
        assert '2025' in str(fiscal_year)

    def test_fiscal_year_unique_per_org(self, organization):
        """Fiscal year must be unique per organization."""
        from apps.budget.models import FiscalYear
        FiscalYear.objects.create(
            organization=organization,
            year=2026,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        with pytest.raises(Exception):  # IntegrityError
            FiscalYear.objects.create(
                organization=organization,
                year=2026,  # Duplicate year
                start_date=date(2026, 7, 1),
                end_date=date(2027, 6, 30),
            )

    def test_fiscal_year_default_status_open(self, organization):
        """New fiscal years default to OPEN status."""
        from apps.budget.models import FiscalYear
        fy = FiscalYear.objects.create(
            organization=organization,
            year=2027,
            start_date=date(2027, 1, 1),
            end_date=date(2027, 12, 31),
        )
        assert fy.status == 'OPEN'


@pytest.mark.django_db
class TestBudgetLineModel:
    """Tests for BudgetLine model."""

    def test_create_budget_line(self, fiscal_year):
        """Can create budget line with required fields."""
        from apps.budget.models import BudgetLine
        line = BudgetLine.objects.create(
            fiscal_year=fiscal_year,
            code='HR-2025-001',
            name='Training Budget',
            allocated_amount=Decimal('50000.00'),
        )
        assert line.code == 'HR-2025-001'
        assert line.allocated_amount == Decimal('50000.00')

    def test_budget_line_has_uuid_id(self, budget_line):
        """BudgetLine should use UUID primary key."""
        assert len(str(budget_line.id)) == 36

    def test_budget_line_string_representation(self, budget_line):
        """String representation should include code and name."""
        assert 'IT-2025-001' in str(budget_line)

    def test_budget_line_code_unique_per_fiscal_year(self, fiscal_year):
        """Budget line code must be unique within fiscal year."""
        from apps.budget.models import BudgetLine
        BudgetLine.objects.create(
            fiscal_year=fiscal_year,
            code='UNIQUE-001',
            name='First Line',
            allocated_amount=Decimal('1000.00'),
        )
        with pytest.raises(Exception):  # IntegrityError
            BudgetLine.objects.create(
                fiscal_year=fiscal_year,
                code='UNIQUE-001',  # Duplicate code
                name='Second Line',
                allocated_amount=Decimal('2000.00'),
            )


@pytest.mark.django_db
class TestBudgetCalculations:
    """Tests for budget availability calculations."""

    def test_initial_available_equals_allocated(self, budget_line):
        """Initially, available amount equals allocated amount."""
        assert budget_line.available_amount == Decimal('10000.00')

    def test_encumbrance_reduces_available(self, budget_line):
        """Creating an encumbrance reduces available amount."""
        from apps.budget.models import Encumbrance
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('3000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('7000.00')

    def test_multiple_encumbrances_reduce_available(self, budget_line):
        """Multiple encumbrances are summed."""
        from apps.budget.models import Encumbrance
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('2000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('3000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-002',
        )
        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('5000.00')

    def test_encumbered_amount_calculation(self, budget_line):
        """encumbered_amount returns sum of active encumbrances."""
        from apps.budget.models import Encumbrance
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('1500.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('2500.00'),
            reference_type='REQUISITION',
            reference_id='REQ-002',
        )
        assert budget_line.encumbered_amount == Decimal('4000.00')


@pytest.mark.django_db
class TestEncumbranceModel:
    """Tests for Encumbrance model."""

    def test_create_encumbrance(self, budget_line):
        """Can create encumbrance with required fields."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('1000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        assert enc.amount == Decimal('1000.00')
        assert enc.status == 'ACTIVE'

    def test_encumbrance_has_uuid_id(self, budget_line):
        """Encumbrance should use UUID primary key."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('500.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        assert len(str(enc.id)) == 36

    def test_encumbrance_default_status_active(self, budget_line):
        """New encumbrances default to ACTIVE status."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('500.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        assert enc.status == 'ACTIVE'

    def test_released_encumbrance_not_counted(self, budget_line):
        """Released encumbrances don't reduce available amount."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('5000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        enc.release()

        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('10000.00')


@pytest.mark.django_db
class TestBudgetAvailabilityCheck:
    """Tests for budget availability checking."""

    def test_check_availability_sufficient(self, budget_line):
        """check_availability returns True when budget is sufficient."""
        assert budget_line.check_availability(Decimal('5000.00')) is True

    def test_check_availability_exact_amount(self, budget_line):
        """check_availability returns True for exact available amount."""
        assert budget_line.check_availability(Decimal('10000.00')) is True

    def test_check_availability_insufficient(self, budget_line):
        """check_availability returns False when budget is insufficient."""
        assert budget_line.check_availability(Decimal('15000.00')) is False

    def test_encumber_creates_encumbrance(self, budget_line):
        """encumber() creates an encumbrance and reduces available."""
        enc = budget_line.encumber(
            amount=Decimal('3000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        assert enc is not None
        assert enc.amount == Decimal('3000.00')
        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('7000.00')

    def test_encumber_raises_on_insufficient_budget(self, budget_line):
        """encumber() raises InsufficientBudgetError when budget is insufficient."""
        with pytest.raises(InsufficientBudgetError) as exc_info:
            budget_line.encumber(
                amount=Decimal('15000.00'),
                reference_type='REQUISITION',
                reference_id='REQ-001',
            )
        assert exc_info.value.requested == Decimal('15000.00')
        assert exc_info.value.available == Decimal('10000.00')
        assert exc_info.value.shortfall == Decimal('5000.00')


@pytest.mark.django_db
class TestEncumbranceLifecycle:
    """Tests for encumbrance status transitions."""

    def test_encumbrance_can_be_released(self, budget_line):
        """Active encumbrance can be released."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('2000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        enc.release()
        assert enc.status == 'RELEASED'

    def test_encumbrance_can_be_liquidated(self, budget_line):
        """Active encumbrance can be liquidated (converted to expense)."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('2000.00'),
            reference_type='PO',
            reference_id='PO-001',
        )
        enc.liquidate()
        assert enc.status == 'LIQUIDATED'

    def test_released_encumbrance_restores_availability(self, budget_line):
        """Releasing encumbrance restores available amount."""
        from apps.budget.models import Encumbrance
        enc = Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('4000.00'),
            reference_type='REQUISITION',
            reference_id='REQ-001',
        )
        # Available is now 6000
        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('6000.00')

        enc.release()
        # Available is restored to 10000
        budget_line.refresh_from_db()
        assert budget_line.available_amount == Decimal('10000.00')

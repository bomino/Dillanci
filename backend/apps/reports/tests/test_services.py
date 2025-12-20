"""
Tests for Report services.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.budget.models import BudgetLine, Encumbrance, FiscalYear
from apps.invoices.models import Invoice
from apps.organizations.models import Organization
from apps.purchase_orders.models import PurchaseOrder, POLine
from apps.reports.models import DashboardKPI
from apps.reports.services import (
    BudgetUtilizationService,
    CycleTimeService,
    KPIService,
    SpendAnalysisService,
    SupplierPerformanceService,
)
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
def fiscal_year(db, organization):
    """Create a test fiscal year."""
    today = timezone.now().date()
    return FiscalYear.objects.create(
        organization=organization,
        year=today.year,
        start_date=date(today.year, 1, 1),
        end_date=date(today.year, 12, 31),
        status='OPEN',
    )


@pytest.fixture
def budget_line(db, fiscal_year):
    """Create a test budget line."""
    return BudgetLine.objects.create(
        fiscal_year=fiscal_year,
        code='BL001',
        name='Test Budget Line',
        allocated_amount=Decimal('100000.00'),
        status='ACTIVE',
    )


@pytest.mark.django_db
class TestKPIService:
    """Tests for KPIService."""

    def test_init(self, organization):
        """Can initialize KPI service."""
        service = KPIService(organization)
        assert service.organization == organization

    def test_get_total_spend_mtd_no_invoices(self, organization):
        """Returns zero when no invoices exist."""
        service = KPIService(organization)
        spend = service.get_total_spend_mtd()
        assert spend == Decimal('0.00')

    def test_get_total_spend_ytd_no_invoices(self, organization):
        """Returns zero when no invoices exist."""
        service = KPIService(organization)
        spend = service.get_total_spend_ytd()
        assert spend == Decimal('0.00')

    def test_get_budget_utilization_no_budget(self, organization):
        """Returns zero when no budget exists."""
        service = KPIService(organization)
        util = service.get_budget_utilization()
        assert util == Decimal('0.00')

    def test_get_budget_utilization_with_encumbrances(self, organization, budget_line):
        """Calculates utilization correctly."""
        # Create active encumbrance
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('25000.00'),
            reference_type='PO',
            reference_id='PO-001',
            status='ACTIVE',
        )

        service = KPIService(organization)
        util = service.get_budget_utilization()

        # 25000 / 100000 = 25%
        assert util == Decimal('25.00')

    def test_get_open_rfx_count(self, organization):
        """Returns count of open RFQs and RFPs."""
        service = KPIService(organization)
        count = service.get_open_rfx_count()
        assert count == 0  # No RFQs/RFPs created

    def test_get_pending_approvals(self, organization):
        """Returns count of pending approvals."""
        service = KPIService(organization)
        count = service.get_pending_approvals()
        assert count == 0  # No pending items

    def test_get_avg_supplier_performance(self, organization, supplier):
        """Returns supplier performance metric based on approved count."""
        service = KPIService(organization)
        avg = service.get_avg_supplier_performance()
        # With 1 approved supplier, metric is min(1*10, 100) = 10
        assert avg == Decimal('10')

    def test_get_expiring_contracts_90d(self, organization):
        """Returns count of expiring contracts."""
        service = KPIService(organization)
        count = service.get_expiring_contracts_90d()
        assert count == 0  # No contracts created

    def test_calculate_all_kpis(self, organization):
        """Can calculate all KPIs at once."""
        service = KPIService(organization)
        kpis = service.calculate_all_kpis()

        assert 'TOTAL_SPEND_MTD' in kpis
        assert 'TOTAL_SPEND_YTD' in kpis
        assert 'BUDGET_UTILIZATION' in kpis
        assert 'CONTRACT_COMPLIANCE' in kpis
        # 12 base KPIs + 9 RFP-specific KPIs = 21 total
        assert len(kpis) == 21

    def test_save_kpi_snapshot(self, organization):
        """Can save a KPI snapshot to database."""
        service = KPIService(organization)
        kpi = service.save_kpi_snapshot('TOTAL_SPEND_MTD', Decimal('50000.00'), 'MTD')

        assert kpi.id is not None
        assert kpi.numeric_value == Decimal('50000.00')

    def test_save_all_kpi_snapshots(self, organization):
        """Can save all KPI snapshots."""
        service = KPIService(organization)
        kpis = service.save_all_kpi_snapshots()

        # 12 base KPIs + 9 RFP-specific KPIs = 21 total
        assert len(kpis) == 21
        assert DashboardKPI.objects.filter(organization=organization).count() >= 21


@pytest.mark.django_db
class TestSpendAnalysisService:
    """Tests for SpendAnalysisService."""

    def test_init(self, organization):
        """Can initialize spend analysis service."""
        service = SpendAnalysisService(organization)
        assert service.organization == organization

    def test_get_spend_summary_no_data(self, organization):
        """Returns empty summary when no data."""
        service = SpendAnalysisService(organization)
        summary = service.get_spend_summary()

        assert summary['total_spend'] == Decimal('0.00')
        assert summary['invoice_count'] == 0

    def test_get_spend_by_month_no_data(self, organization):
        """Returns empty list when no data."""
        service = SpendAnalysisService(organization)
        by_month = service.get_spend_by_month()

        assert by_month == []

    def test_execute_report(self, organization):
        """Can execute spend analysis report."""
        service = SpendAnalysisService(organization)
        results = service.execute(
            filters={'date_from': date(2025, 1, 1)},
            group_by=['month', 'supplier'],
        )

        assert 'summary' in results
        assert 'by_month' in results
        assert 'by_supplier' in results


@pytest.mark.django_db
class TestSupplierPerformanceService:
    """Tests for SupplierPerformanceService."""

    def test_init(self, organization):
        """Can initialize supplier performance service."""
        service = SupplierPerformanceService(organization)
        assert service.organization == organization

    def test_get_supplier_scorecard(self, organization, supplier):
        """Can get supplier scorecard."""
        service = SupplierPerformanceService(organization)
        scorecard = service.get_supplier_scorecard(str(supplier.id))

        assert scorecard['supplier']['name'] == 'Test Supplier'
        # Score is calculated from metrics (no POs/invoices = 100% rates)
        assert scorecard['overall_score'] == Decimal('100.00')
        assert 'metrics' in scorecard

    def test_get_supplier_scorecard_not_found(self, organization):
        """Returns error for non-existent supplier."""
        service = SupplierPerformanceService(organization)
        scorecard = service.get_supplier_scorecard('00000000-0000-0000-0000-000000000000')

        assert 'error' in scorecard

    def test_get_all_supplier_rankings(self, organization, supplier):
        """Can get supplier rankings."""
        service = SupplierPerformanceService(organization)
        rankings = service.get_all_supplier_rankings()

        assert len(rankings) == 1
        assert rankings[0]['supplier_name'] == 'Test Supplier'
        assert rankings[0]['rank'] == 1

    def test_execute_report_single_supplier(self, organization, supplier):
        """Can execute report for single supplier."""
        service = SupplierPerformanceService(organization)
        results = service.execute(filters={'supplier_id': str(supplier.id)})

        assert results['type'] == 'single_supplier'

    def test_execute_report_ranking(self, organization, supplier):
        """Can execute ranking report."""
        service = SupplierPerformanceService(organization)
        results = service.execute(filters={})

        assert results['type'] == 'ranking'


@pytest.mark.django_db
class TestBudgetUtilizationService:
    """Tests for BudgetUtilizationService."""

    def test_init(self, organization):
        """Can initialize budget utilization service."""
        service = BudgetUtilizationService(organization)
        assert service.organization == organization

    def test_get_fiscal_year_summary_no_fiscal_year(self, organization):
        """Returns error when no fiscal year."""
        service = BudgetUtilizationService(organization)
        summary = service.get_fiscal_year_summary()

        assert 'error' in summary

    def test_get_fiscal_year_summary(self, organization, fiscal_year, budget_line):
        """Can get fiscal year summary."""
        service = BudgetUtilizationService(organization)
        summary = service.get_fiscal_year_summary()

        assert summary['fiscal_year']['year'] == fiscal_year.year
        assert summary['totals']['allocated'] == Decimal('100000.00')
        assert summary['budget_line_count'] == 1

    def test_get_budget_line_details(self, organization, fiscal_year, budget_line):
        """Can get budget line details."""
        service = BudgetUtilizationService(organization)
        details = service.get_budget_line_details()

        assert len(details) == 1
        assert details[0]['code'] == 'BL001'
        assert details[0]['allocated'] == Decimal('100000.00')

    def test_get_encumbrance_aging(self, organization, fiscal_year, budget_line):
        """Can get encumbrance aging."""
        # Create encumbrance
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('10000.00'),
            reference_type='PO',
            reference_id='PO-001',
            status='ACTIVE',
        )

        service = BudgetUtilizationService(organization)
        aging = service.get_encumbrance_aging()

        assert 'aging_buckets' in aging
        assert aging['total_encumbrances'] == 1

    def test_get_over_budget_lines(self, organization, fiscal_year, budget_line):
        """Can get over-budget lines."""
        # Create encumbrance that uses 95% of budget
        Encumbrance.objects.create(
            budget_line=budget_line,
            amount=Decimal('95000.00'),
            reference_type='PO',
            reference_id='PO-001',
            status='ACTIVE',
        )

        service = BudgetUtilizationService(organization)
        over_budget = service.get_over_budget_lines(threshold_percent=Decimal('90.00'))

        assert len(over_budget) == 1
        assert over_budget[0]['code'] == 'BL001'


@pytest.mark.django_db
class TestCycleTimeService:
    """Tests for CycleTimeService."""

    def test_init(self, organization):
        """Can initialize cycle time service."""
        service = CycleTimeService(organization)
        assert service.organization == organization

    def test_get_po_approval_cycle_time_no_data(self, organization):
        """Returns zero when no POs."""
        service = CycleTimeService(organization)
        stats = service.get_po_approval_cycle_time()

        assert stats['average_days'] == Decimal('0.00')
        assert stats['count'] == 0

    def test_get_all_cycle_times(self, organization):
        """Can get all cycle time metrics."""
        service = CycleTimeService(organization)
        cycle_times = service.get_all_cycle_times()

        assert 'requisition_to_po' in cycle_times
        assert 'po_approval' in cycle_times
        assert 'po_to_receipt' in cycle_times
        assert 'invoice_to_payment' in cycle_times
        assert 'procure_to_pay' in cycle_times

    def test_get_cycle_time_trend(self, organization):
        """Can get cycle time trend."""
        service = CycleTimeService(organization)
        trend = service.get_cycle_time_trend('po_approval', months=3)

        assert len(trend) == 3
        assert 'period' in trend[0]
        assert 'average_days' in trend[0]

    def test_execute_report(self, organization):
        """Can execute cycle time report."""
        service = CycleTimeService(organization)
        results = service.execute(
            filters={'include_trend': True},
        )

        assert 'cycle_times' in results
        assert 'trends' in results

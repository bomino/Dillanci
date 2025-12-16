"""
Tests for Report models.
"""

from datetime import date, time, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.organizations.models import Organization
from apps.reports.models import (
    DashboardKPI,
    ReportDefinition,
    ReportExecution,
    SavedReport,
    ScheduledReport,
)
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
def report_definition(db):
    """Create a test report definition."""
    return ReportDefinition.objects.create(
        code='SPEND_ANALYSIS',
        name='Spend Analysis Report',
        report_type='SPEND_ANALYSIS',
        description='Analyzes spending by category and supplier',
        available_filters={'date_from': 'date', 'date_to': 'date', 'supplier': 'uuid'},
        available_columns=['supplier', 'category', 'amount', 'date'],
        default_columns=['supplier', 'amount'],
        service_class='apps.reports.services.spend_service.SpendAnalysisService',
        is_active=True,
    )


@pytest.fixture
def saved_report(db, organization, user, report_definition):
    """Create a test saved report."""
    return SavedReport.objects.create(
        organization=organization,
        report_definition=report_definition,
        created_by=user,
        name='My Spend Report',
        description='Custom spend analysis',
        filters={'date_from': '2025-01-01'},
        columns=['supplier', 'amount'],
        is_shared=False,
    )


@pytest.mark.django_db
class TestReportDefinition:
    """Tests for ReportDefinition model."""

    def test_create_report_definition(self, db):
        """Can create a report definition."""
        report = ReportDefinition.objects.create(
            code='TEST_REPORT',
            name='Test Report',
            report_type='SPEND_ANALYSIS',
            service_class='apps.reports.services.spend_service.SpendAnalysisService',
        )

        assert report.id is not None
        assert report.code == 'TEST_REPORT'
        assert report.is_active is True

    def test_report_definition_unique_code(self, report_definition):
        """Code must be unique."""
        with pytest.raises(Exception):  # IntegrityError
            ReportDefinition.objects.create(
                code='SPEND_ANALYSIS',  # Same code
                name='Another Report',
                report_type='SPEND_ANALYSIS',
                service_class='test.Service',
            )

    def test_report_definition_str(self, report_definition):
        """String representation is name and code."""
        assert str(report_definition) == 'Spend Analysis Report (SPEND_ANALYSIS)'

    def test_report_definition_soft_delete(self, report_definition):
        """Report definition can be soft deleted."""
        report_definition.soft_delete()
        report_definition.refresh_from_db()

        assert report_definition.is_deleted is True
        assert report_definition.deleted_at is not None


@pytest.mark.django_db
class TestSavedReport:
    """Tests for SavedReport model."""

    def test_create_saved_report(self, organization, user, report_definition):
        """Can create a saved report."""
        report = SavedReport.objects.create(
            organization=organization,
            report_definition=report_definition,
            created_by=user,
            name='My Report',
            filters={'date_from': '2025-01-01'},
            columns=['supplier', 'amount'],
        )

        assert report.id is not None
        assert report.name == 'My Report'
        assert report.is_shared is False

    def test_saved_report_str(self, saved_report):
        """String representation includes name and code."""
        assert str(saved_report) == 'My Spend Report (SPEND_ANALYSIS)'

    def test_saved_report_soft_delete(self, saved_report):
        """Saved report can be soft deleted."""
        saved_report.soft_delete()
        saved_report.refresh_from_db()

        assert saved_report.is_deleted is True


@pytest.mark.django_db
class TestScheduledReport:
    """Tests for ScheduledReport model."""

    def test_create_scheduled_report(self, saved_report):
        """Can create a scheduled report."""
        schedule = ScheduledReport.objects.create(
            saved_report=saved_report,
            frequency='DAILY',
            time_of_day=time(8, 0),
            export_format='EXCEL',
            recipients=['user@example.com'],
            is_active=True,
        )

        assert schedule.id is not None
        assert schedule.frequency == 'DAILY'

    def test_calculate_next_run_daily(self, saved_report):
        """Daily schedule calculates next run correctly."""
        schedule = ScheduledReport.objects.create(
            saved_report=saved_report,
            frequency='DAILY',
            time_of_day=time(8, 0),
            export_format='EXCEL',
            recipients=[],
        )

        next_run = schedule.calculate_next_run()

        assert next_run is not None
        assert next_run.hour == 8
        assert next_run.minute == 0

    def test_calculate_next_run_weekly(self, saved_report):
        """Weekly schedule calculates next run correctly."""
        schedule = ScheduledReport.objects.create(
            saved_report=saved_report,
            frequency='WEEKLY',
            day_of_week=1,  # Tuesday
            time_of_day=time(9, 30),
            export_format='CSV',
            recipients=[],
        )

        next_run = schedule.calculate_next_run()

        assert next_run is not None
        assert next_run.weekday() == 1  # Tuesday
        assert next_run.hour == 9
        assert next_run.minute == 30

    def test_calculate_next_run_monthly(self, saved_report):
        """Monthly schedule calculates next run correctly."""
        schedule = ScheduledReport.objects.create(
            saved_report=saved_report,
            frequency='MONTHLY',
            day_of_month=15,
            time_of_day=time(10, 0),
            export_format='EXCEL',
            recipients=[],
        )

        next_run = schedule.calculate_next_run()

        assert next_run is not None
        assert next_run.day <= 28  # Safe for all months
        assert next_run.hour == 10

    def test_scheduled_report_str(self, saved_report):
        """String representation includes report name and frequency."""
        schedule = ScheduledReport.objects.create(
            saved_report=saved_report,
            frequency='DAILY',
            time_of_day=time(8, 0),
            export_format='EXCEL',
            recipients=[],
        )

        assert str(schedule) == 'My Spend Report - DAILY'


@pytest.mark.django_db
class TestReportExecution:
    """Tests for ReportExecution model."""

    def test_create_report_execution(self, organization, report_definition, user):
        """Can create a report execution."""
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            filters_used={'date_from': '2025-01-01'},
            status='PENDING',
        )

        assert execution.id is not None
        assert execution.status == 'PENDING'

    def test_mark_completed(self, organization, report_definition, user):
        """Can mark execution as completed."""
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            status='RUNNING',
        )

        execution.mark_completed(row_count=100, cached_result={'data': []})
        execution.refresh_from_db()

        assert execution.status == 'COMPLETED'
        assert execution.row_count == 100
        assert execution.completed_at is not None

    def test_mark_failed(self, organization, report_definition, user):
        """Can mark execution as failed."""
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            status='RUNNING',
        )

        execution.mark_failed('Database connection error')
        execution.refresh_from_db()

        assert execution.status == 'FAILED'
        assert execution.error_message == 'Database connection error'
        assert execution.completed_at is not None

    def test_execution_str(self, organization, report_definition, user):
        """String representation includes code and timestamp."""
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            status='PENDING',
        )

        assert 'SPEND_ANALYSIS' in str(execution)


@pytest.mark.django_db
class TestDashboardKPI:
    """Tests for DashboardKPI model."""

    def test_create_numeric_kpi(self, organization):
        """Can create a numeric KPI."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='TOTAL_SPEND_YTD',
            numeric_value=Decimal('1500000.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
        )

        assert kpi.id is not None
        assert kpi.value == Decimal('1500000.00')

    def test_create_percentage_kpi(self, organization):
        """Can create a percentage KPI."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='BUDGET_UTILIZATION',
            percentage_value=Decimal('75.50'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
        )

        assert kpi.value == Decimal('75.50')

    def test_create_count_kpi(self, organization):
        """Can create a count KPI."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='OPEN_RFX_COUNT',
            count_value=15,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
        )

        assert kpi.value == 15

    def test_trend_property_up(self, organization):
        """Trend is 'up' for positive change."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='TOTAL_SPEND_YTD',
            numeric_value=Decimal('1000000.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
            change_percent=Decimal('10.50'),
        )

        assert kpi.trend == 'up'

    def test_trend_property_down(self, organization):
        """Trend is 'down' for negative change."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='TOTAL_SPEND_YTD',
            numeric_value=Decimal('900000.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
            change_percent=Decimal('-5.25'),
        )

        assert kpi.trend == 'down'

    def test_trend_property_stable(self, organization):
        """Trend is 'stable' for zero or null change."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='TOTAL_SPEND_YTD',
            numeric_value=Decimal('1000000.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
            change_percent=Decimal('0.00'),
        )

        assert kpi.trend == 'stable'

    def test_calculate_change(self, organization):
        """Can calculate change from previous value."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='TOTAL_SPEND_YTD',
            numeric_value=Decimal('1100000.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
        )

        kpi.calculate_change(Decimal('1000000.00'))

        assert kpi.previous_value == Decimal('1000000.00')
        assert kpi.change_percent == Decimal('10.00')

    def test_unique_constraint(self, organization):
        """Cannot have duplicate KPIs for same org/type/period."""
        DashboardKPI.objects.create(
            organization=organization,
            kpi_type='TOTAL_SPEND_YTD',
            numeric_value=Decimal('1000000.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
        )

        with pytest.raises(Exception):  # IntegrityError
            DashboardKPI.objects.create(
                organization=organization,
                kpi_type='TOTAL_SPEND_YTD',  # Same type
                numeric_value=Decimal('1100000.00'),
                period_start=date(2025, 1, 1),  # Same period
                period_end=date(2025, 12, 16),
            )

    def test_kpi_str(self, organization):
        """String representation includes type and org."""
        kpi = DashboardKPI.objects.create(
            organization=organization,
            kpi_type='BUDGET_UTILIZATION',
            percentage_value=Decimal('75.00'),
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 16),
        )

        assert 'Budget Utilization' in str(kpi)
        assert organization.name in str(kpi)

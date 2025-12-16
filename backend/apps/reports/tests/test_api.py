"""
Tests for Report API endpoints.
"""

from datetime import date, time, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

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
def authenticated_client(user):
    """Create an authenticated API client."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def report_definition(db):
    """Create a test report definition."""
    return ReportDefinition.objects.create(
        code='SPEND_ANALYSIS',
        name='Spend Analysis Report',
        report_type='SPEND_ANALYSIS',
        description='Analyzes spending',
        available_filters={'date_from': 'date'},
        available_columns=['supplier', 'amount'],
        default_columns=['supplier'],
        service_class='apps.reports.services.SpendAnalysisService',
        is_active=True,
    )


@pytest.fixture
def saved_report(organization, user, report_definition):
    """Create a test saved report."""
    return SavedReport.objects.create(
        organization=organization,
        report_definition=report_definition,
        created_by=user,
        name='My Report',
        filters={},
        columns=['supplier'],
    )


@pytest.mark.django_db
class TestReportDefinitionAPI:
    """Tests for ReportDefinition API endpoints."""

    def test_list_report_definitions(self, authenticated_client, report_definition):
        """Can list active report definitions."""
        url = reverse('report-definition-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_retrieve_report_definition(self, authenticated_client, report_definition):
        """Can retrieve a report definition by code."""
        url = reverse('report-definition-detail', args=[report_definition.code])
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == 'SPEND_ANALYSIS'
        assert response.data['name'] == 'Spend Analysis Report'

    def test_report_definitions_read_only(self, authenticated_client, report_definition):
        """Report definitions are read-only."""
        url = reverse('report-definition-detail', args=[report_definition.code])

        # Try to update
        response = authenticated_client.put(url, {'name': 'Modified'})
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

        # Try to delete
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_unauthenticated_access_denied(self, report_definition):
        """Unauthenticated users cannot access report definitions."""
        client = APIClient()
        url = reverse('report-definition-list')
        response = client.get(url)

        # DRF returns 403 for unauthenticated requests by default
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestSavedReportAPI:
    """Tests for SavedReport API endpoints."""

    def test_list_saved_reports(self, authenticated_client, saved_report):
        """Can list saved reports."""
        url = reverse('saved-report-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_create_saved_report(self, authenticated_client, report_definition):
        """Can create a saved report."""
        url = reverse('saved-report-list')
        data = {
            'name': 'New Report',
            'description': 'A new custom report',
            'report_definition': str(report_definition.id),
            'filters': {'date_from': '2025-01-01'},
            'columns': ['supplier', 'amount'],
            'is_shared': False,
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Report'

    def test_retrieve_saved_report(self, authenticated_client, saved_report):
        """Can retrieve a saved report."""
        url = reverse('saved-report-detail', args=[saved_report.id])
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'My Report'

    def test_update_saved_report(self, authenticated_client, saved_report):
        """Can update a saved report."""
        url = reverse('saved-report-detail', args=[saved_report.id])
        data = {'name': 'Updated Report Name'}

        response = authenticated_client.patch(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Updated Report Name'

    def test_delete_saved_report(self, authenticated_client, saved_report):
        """Can soft delete a saved report."""
        url = reverse('saved-report-detail', args=[saved_report.id])
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT

        saved_report.refresh_from_db()
        assert saved_report.is_deleted is True

    def test_execute_saved_report(self, authenticated_client, saved_report):
        """Can execute a saved report."""
        url = reverse('saved-report-execute', args=[saved_report.id])
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'id' in response.data


@pytest.mark.django_db
class TestScheduledReportAPI:
    """Tests for ScheduledReport API endpoints."""

    def test_create_scheduled_report(self, authenticated_client, saved_report):
        """Can create a scheduled report."""
        url = reverse('scheduled-report-list')
        data = {
            'saved_report': str(saved_report.id),
            'frequency': 'DAILY',
            'time_of_day': '08:00:00',
            'export_format': 'EXCEL',
            'recipients': ['user@example.com'],
            'is_active': True,
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['frequency'] == 'DAILY'
        assert response.data['next_run_at'] is not None

    def test_create_weekly_schedule_requires_day(self, authenticated_client, saved_report):
        """Weekly schedule requires day_of_week."""
        url = reverse('scheduled-report-list')
        data = {
            'saved_report': str(saved_report.id),
            'frequency': 'WEEKLY',
            'time_of_day': '08:00:00',
            'export_format': 'EXCEL',
            'recipients': [],
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'day_of_week' in response.data

    def test_create_monthly_schedule_requires_day(self, authenticated_client, saved_report):
        """Monthly schedule requires day_of_month."""
        url = reverse('scheduled-report-list')
        data = {
            'saved_report': str(saved_report.id),
            'frequency': 'MONTHLY',
            'time_of_day': '08:00:00',
            'export_format': 'EXCEL',
            'recipients': [],
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'day_of_month' in response.data

    def test_run_now_action(self, authenticated_client, saved_report):
        """Can trigger immediate execution."""
        schedule = ScheduledReport.objects.create(
            saved_report=saved_report,
            frequency='DAILY',
            time_of_day=time(8, 0),
            export_format='EXCEL',
            recipients=[],
        )

        url = reverse('scheduled-report-run-now', args=[schedule.id])
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'execution' in response.data
        assert 'schedule' in response.data


@pytest.mark.django_db
class TestReportExecutionAPI:
    """Tests for ReportExecution API endpoints."""

    def test_list_executions(self, authenticated_client, organization, report_definition, user):
        """Can list report executions."""
        ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            status='COMPLETED',
        )

        url = reverse('report-execution-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_execute_report_by_code(self, authenticated_client, report_definition):
        """Can execute a report by code."""
        url = reverse('report-execution-execute')
        data = {
            'report_code': 'SPEND_ANALYSIS',
            'filters': {'date_from': '2025-01-01'},
            'columns': ['supplier'],
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'COMPLETED'

    def test_execute_invalid_report_code(self, authenticated_client):
        """Invalid report code returns 400."""
        url = reverse('report-execution-execute')
        data = {
            'report_code': 'INVALID_CODE',
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_completed_execution(self, authenticated_client, organization, report_definition, user):
        """Can export a completed execution."""
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            status='COMPLETED',
            cached_result={'data': []},
        )

        url = reverse('report-execution-export', args=[execution.id])
        response = authenticated_client.post(url, {'format': 'CSV'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['format'] == 'CSV'

    def test_cannot_export_pending_execution(self, authenticated_client, organization, report_definition, user):
        """Cannot export a pending execution."""
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_definition,
            executed_by=user,
            status='PENDING',
        )

        url = reverse('report-execution-export', args=[execution.id])
        response = authenticated_client.post(url, {'format': 'CSV'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDashboardAPI:
    """Tests for Dashboard API endpoints."""

    def test_list_dashboard_kpis(self, authenticated_client, organization):
        """Can list dashboard KPIs."""
        url = reverse('dashboard-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'kpis' in response.data
        assert 'last_updated' in response.data

    def test_refresh_dashboard_kpis(self, authenticated_client, organization):
        """Can refresh dashboard KPIs."""
        url = reverse('dashboard-refresh')
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'kpis' in response.data

    def test_kpi_trend(self, authenticated_client, organization):
        """Can get KPI trend data."""
        url = reverse('dashboard-kpi-trend', args=['TOTAL_SPEND_YTD'])
        response = authenticated_client.get(url, {'months': 6})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['kpi_type'] == 'TOTAL_SPEND_YTD'
        assert 'trend_data' in response.data

    def test_kpi_trend_invalid_type(self, authenticated_client, organization):
        """Invalid KPI type returns 400."""
        url = reverse('dashboard-kpi-trend', args=['INVALID_KPI'])
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestOrganizationIsolation:
    """Tests for organization-level data isolation."""

    def test_saved_reports_filtered_by_organization(self, authenticated_client, user, organization, report_definition):
        """Users only see saved reports from their organization."""
        # Create report in user's org
        own_report = SavedReport.objects.create(
            organization=organization,
            report_definition=report_definition,
            created_by=user,
            name='Own Report',
        )

        # Create another org and report
        other_org = Organization.objects.create(name='Other Org', code='OTHER001')
        other_user = User.objects.create_user(
            email='other@example.com',
            password='pass',
            organization=other_org,
        )
        other_report = SavedReport.objects.create(
            organization=other_org,
            report_definition=report_definition,
            created_by=other_user,
            name='Other Report',
        )

        url = reverse('saved-report-list')
        response = authenticated_client.get(url)

        # Should only see own report
        assert response.status_code == status.HTTP_200_OK

        # Handle paginated or non-paginated responses
        if isinstance(response.data, dict) and 'results' in response.data:
            report_data = response.data['results']
        else:
            report_data = response.data

        report_names = [r['name'] for r in report_data]
        assert 'Own Report' in report_names
        assert 'Other Report' not in report_names

"""
API tests for Budget endpoints.

Tests budget availability checks and encumbrance operations.
"""

import pytest
from datetime import date
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient

from apps.budget.models import BudgetLine, Encumbrance, FiscalYear
from apps.organizations.models import Organization
from apps.users.models import User


@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


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
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def fiscal_year(db, organization):
    """Create a test fiscal year."""
    return FiscalYear.objects.create(
        organization=organization,
        year=2025,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
    )


@pytest.fixture
def budget_line(db, fiscal_year):
    """Create a test budget line with $10,000."""
    return BudgetLine.objects.create(
        fiscal_year=fiscal_year,
        code='IT-2025-001',
        name='IT Equipment',
        allocated_amount=Decimal('10000.00'),
    )


@pytest.fixture
def encumbrance(db, budget_line):
    """Create a test encumbrance."""
    return Encumbrance.objects.create(
        budget_line=budget_line,
        amount=Decimal('2000.00'),
        reference_type='REQUISITION',
        reference_id='REQ-001',
    )


@pytest.mark.django_db
class TestFiscalYearViewSet:
    """Tests for /api/v1/budget/fiscal-years/ endpoints."""

    def test_list_fiscal_years(self, authenticated_client, fiscal_year):
        """Can list fiscal years in user's organization."""
        response = authenticated_client.get('/api/v1/budget/fiscal-years/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['year'] == 2025

    def test_create_fiscal_year(self, authenticated_client, organization):
        """Can create a new fiscal year."""
        response = authenticated_client.post(
            '/api/v1/budget/fiscal-years/',
            {
                'organization': str(organization.id),
                'year': 2026,
                'start_date': '2026-01-01',
                'end_date': '2026-12-31',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert FiscalYear.objects.filter(year=2026).exists()

    def test_get_fiscal_year_budget_lines(self, authenticated_client, fiscal_year, budget_line):
        """Can get budget lines for a fiscal year."""
        response = authenticated_client.get(
            f'/api/v1/budget/fiscal-years/{fiscal_year.id}/budget_lines/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.django_db
class TestBudgetLineViewSet:
    """Tests for /api/v1/budget/budget-lines/ endpoints."""

    def test_list_budget_lines(self, authenticated_client, budget_line):
        """Can list budget lines in user's organization."""
        response = authenticated_client.get('/api/v1/budget/budget-lines/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['code'] == 'IT-2025-001'

    def test_get_budget_line_detail(self, authenticated_client, budget_line):
        """Can get budget line details with availability."""
        response = authenticated_client.get(
            f'/api/v1/budget/budget-lines/{budget_line.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['allocated_amount'] == '10000.00'
        assert response.data['available_amount'] == '10000.00'
        assert response.data['encumbered_amount'] == '0.00'


@pytest.mark.django_db
class TestBudgetAvailability:
    """Tests for budget availability checking via API."""

    def test_get_availability(self, authenticated_client, budget_line, encumbrance):
        """GET /availability/ returns current availability."""
        response = authenticated_client.get(
            f'/api/v1/budget/budget-lines/{budget_line.id}/availability/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['allocated_amount'] == Decimal('10000.00')
        assert response.data['encumbered_amount'] == Decimal('2000.00')
        assert response.data['available_amount'] == Decimal('8000.00')

    def test_check_availability_sufficient(self, authenticated_client, budget_line):
        """POST /availability/ returns True when sufficient."""
        response = authenticated_client.post(
            f'/api/v1/budget/budget-lines/{budget_line.id}/availability/',
            {'amount': '5000.00'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_available'] is True
        assert response.data['requested_amount'] == Decimal('5000.00')

    def test_check_availability_insufficient(self, authenticated_client, budget_line):
        """POST /availability/ returns False when insufficient."""
        response = authenticated_client.post(
            f'/api/v1/budget/budget-lines/{budget_line.id}/availability/',
            {'amount': '15000.00'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_available'] is False


@pytest.mark.django_db
class TestEncumbranceAPI:
    """Tests for encumbrance operations via API."""

    def test_create_encumbrance_via_budget_line(self, authenticated_client, budget_line):
        """Can create encumbrance via budget line encumber action."""
        response = authenticated_client.post(
            f'/api/v1/budget/budget-lines/{budget_line.id}/encumber/',
            {
                'amount': '3000.00',
                'reference_type': 'REQUISITION',
                'reference_id': 'REQ-002',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['amount'] == '3000.00'
        assert response.data['status'] == 'ACTIVE'

        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('3000.00')

    def test_encumber_fails_on_insufficient_budget(self, authenticated_client, budget_line):
        """Encumber fails if budget is insufficient."""
        response = authenticated_client.post(
            f'/api/v1/budget/budget-lines/{budget_line.id}/encumber/',
            {
                'amount': '15000.00',
                'reference_type': 'REQUISITION',
                'reference_id': 'REQ-003',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'requested' in response.data
        assert 'shortfall' in response.data

    def test_list_encumbrances(self, authenticated_client, encumbrance):
        """Can list encumbrances."""
        response = authenticated_client.get('/api/v1/budget/encumbrances/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_release_encumbrance(self, authenticated_client, encumbrance, budget_line):
        """Can release an active encumbrance."""
        assert encumbrance.status == 'ACTIVE'

        response = authenticated_client.post(
            f'/api/v1/budget/encumbrances/{encumbrance.id}/release/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'RELEASED'

        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('0.00')

    def test_liquidate_encumbrance(self, authenticated_client, encumbrance):
        """Can liquidate an active encumbrance."""
        response = authenticated_client.post(
            f'/api/v1/budget/encumbrances/{encumbrance.id}/liquidate/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'LIQUIDATED'

    def test_cannot_release_released_encumbrance(self, authenticated_client, encumbrance):
        """Cannot release an already released encumbrance."""
        encumbrance.release()

        response = authenticated_client.post(
            f'/api/v1/budget/encumbrances/{encumbrance.id}/release/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

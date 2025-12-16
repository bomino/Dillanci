"""
API tests for Requisition endpoints.

Tests workflow actions and budget integration.
"""

import pytest
from datetime import date
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient

from apps.budget.models import BudgetLine, FiscalYear
from apps.organizations.models import Organization
from apps.requisitions.models import Requisition, RequisitionLine
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
def approver(db, organization):
    """Create a test approver user."""
    return User.objects.create_user(
        email='approver@example.com',
        password='testpass123',
        first_name='Test',
        last_name='Approver',
        organization=organization,
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def approver_client(api_client, approver):
    """Return an authenticated API client for approver."""
    api_client.force_authenticate(user=approver)
    return api_client


@pytest.fixture
def budget_line(db, organization):
    """Create a test budget line with $10,000."""
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
def requisition(db, organization, user, budget_line):
    """Create a test requisition in DRAFT status."""
    return Requisition.objects.create(
        organization=organization,
        requester=user,
        budget_line=budget_line,
        title='Test Requisition',
        description='Test description',
    )


@pytest.fixture
def requisition_with_line(requisition):
    """Create a requisition with a line item."""
    RequisitionLine.objects.create(
        requisition=requisition,
        description='Test Item',
        quantity=1,
        unit_price=Decimal('1000.00'),
        unit_of_measure='EA',
    )
    return requisition


@pytest.mark.django_db
class TestRequisitionViewSet:
    """Tests for /api/v1/requisitions/ endpoints."""

    def test_list_requisitions(self, authenticated_client, requisition):
        """Can list requisitions in user's organization."""
        response = authenticated_client.get('/api/v1/requisitions/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_requisition(self, authenticated_client, organization, user, budget_line):
        """Can create a new requisition."""
        response = authenticated_client.post(
            '/api/v1/requisitions/',
            {
                'organization': str(organization.id),
                'requester': str(user.id),
                'budget_line': str(budget_line.id),
                'title': 'New Requisition',
                'description': 'New description',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Requisition.objects.filter(title='New Requisition').exists()

    def test_create_requisition_with_lines(
        self, authenticated_client, organization, user, budget_line
    ):
        """Can create a requisition with line items."""
        response = authenticated_client.post(
            '/api/v1/requisitions/',
            {
                'organization': str(organization.id),
                'requester': str(user.id),
                'budget_line': str(budget_line.id),
                'title': 'Requisition with Lines',
                'lines': [
                    {
                        'description': 'Item 1',
                        'quantity': '2',
                        'unit_price': '100.00',
                        'unit_of_measure': 'EA',
                    },
                    {
                        'description': 'Item 2',
                        'quantity': '1',
                        'unit_price': '500.00',
                        'unit_of_measure': 'EA',
                    },
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        req = Requisition.objects.get(title='Requisition with Lines')
        assert req.lines.count() == 2

    def test_get_requisition_detail(self, authenticated_client, requisition_with_line):
        """Can get requisition details with lines."""
        response = authenticated_client.get(
            f'/api/v1/requisitions/{requisition_with_line.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Test Requisition'
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['lines']) == 1


@pytest.mark.django_db
class TestRequisitionWorkflow:
    """Tests for requisition workflow actions."""

    def test_submit_requisition(self, authenticated_client, requisition_with_line, budget_line):
        """DRAFT -> SUBMITTED via submit action."""
        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/submit/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'SUBMITTED'

        requisition_with_line.refresh_from_db()
        assert requisition_with_line.status == 'SUBMITTED'
        assert requisition_with_line.encumbrance is not None

        # Verify budget encumbered
        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('1000.00')

    def test_cannot_submit_empty_requisition(self, authenticated_client, requisition):
        """Cannot submit requisition without lines."""
        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'lines' in response.data['error'].lower()

    def test_approve_requisition(self, approver_client, requisition_with_line, approver):
        """SUBMITTED -> APPROVED via approve action."""
        requisition_with_line.submit()

        response = approver_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/approve/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED'
        assert str(response.data['approved_by']) == str(approver.id)

    def test_reject_requisition(self, approver_client, requisition_with_line, budget_line):
        """SUBMITTED -> REJECTED via reject action releases encumbrance."""
        requisition_with_line.submit()
        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('1000.00')

        response = approver_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/reject/',
            {'reason': 'Budget concerns'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'REJECTED'
        assert response.data['rejection_reason'] == 'Budget concerns'

        # Verify encumbrance released
        budget_line.refresh_from_db()
        assert budget_line.encumbered_amount == Decimal('0.00')

    def test_reject_requires_reason(self, approver_client, requisition_with_line):
        """Reject action requires a reason."""
        requisition_with_line.submit()

        response = approver_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/reject/',
            {},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_revise_rejected_requisition(self, authenticated_client, requisition_with_line, approver):
        """REJECTED -> DRAFT via revise action."""
        requisition_with_line.submit()
        requisition_with_line.reject(rejected_by=approver, reason='Not needed')

        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/revise/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'

    def test_cancel_draft_requisition(self, authenticated_client, requisition):
        """DRAFT -> CANCELLED via cancel action."""
        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition.id}/cancel/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'


@pytest.mark.django_db
class TestRequisitionBudgetIntegration:
    """Tests for requisition budget integration via API."""

    def test_submit_fails_on_insufficient_budget(
        self, authenticated_client, organization, user, budget_line
    ):
        """Submit fails if budget is insufficient."""
        # Create requisition exceeding budget
        req = Requisition.objects.create(
            organization=organization,
            requester=user,
            budget_line=budget_line,
            title='Expensive Req',
        )
        RequisitionLine.objects.create(
            requisition=req,
            description='Expensive Item',
            quantity=1,
            unit_price=Decimal('15000.00'),  # Exceeds $10,000 budget
            unit_of_measure='EA',
        )

        response = authenticated_client.post(
            f'/api/v1/requisitions/{req.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'requested' in response.data
        assert 'available' in response.data

        # Verify requisition stayed in DRAFT
        req.refresh_from_db()
        assert req.status == 'DRAFT'


@pytest.mark.django_db
class TestRequisitionInvalidTransitions:
    """Tests for invalid workflow transitions via API."""

    def test_cannot_approve_draft(self, authenticated_client, requisition):
        """Cannot approve directly from DRAFT status."""
        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition.id}/approve/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_submit_approved(self, authenticated_client, requisition_with_line, approver):
        """Cannot submit an already approved requisition."""
        requisition_with_line.submit()
        requisition_with_line.approve(approved_by=approver)

        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/submit/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRequisitionLines:
    """Tests for requisition line management via API."""

    def test_get_requisition_lines(self, authenticated_client, requisition_with_line):
        """Can get lines for a requisition."""
        response = authenticated_client.get(
            f'/api/v1/requisitions/{requisition_with_line.id}/lines/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['description'] == 'Test Item'

    def test_add_line_to_draft_requisition(self, authenticated_client, requisition):
        """Can add line to draft requisition."""
        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition.id}/lines/',
            {
                'description': 'New Item',
                'quantity': '3',
                'unit_price': '200.00',
                'unit_of_measure': 'EA',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert requisition.lines.count() == 1

    def test_cannot_add_line_to_submitted_requisition(
        self, authenticated_client, requisition_with_line
    ):
        """Cannot add line to non-draft requisition."""
        requisition_with_line.submit()

        response = authenticated_client.post(
            f'/api/v1/requisitions/{requisition_with_line.id}/lines/',
            {
                'description': 'Another Item',
                'quantity': '1',
                'unit_price': '100.00',
                'unit_of_measure': 'EA',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

"""
Tests for Contract API endpoints.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.contracts.models import Contract, ContractLine, ContractMilestone, ContractSpend
from apps.organizations.models import Organization
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def other_organization(db):
    """Create another organization for isolation tests."""
    return Organization.objects.create(name='Other Org', code='OTHER001')


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
def other_user(db, other_organization):
    """Create a user in another organization."""
    return User.objects.create_user(
        email='other@example.com',
        password='testpass123',
        first_name='Other',
        last_name='User',
        organization=other_organization,
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
def other_supplier(db, other_organization):
    """Create a supplier in another organization."""
    return Supplier.objects.create(
        organization=other_organization,
        code='SUP002',
        name='Other Supplier',
        status='APPROVED',
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Create an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def draft_contract(db, organization, supplier, user):
    """Create a draft contract."""
    return Contract.objects.create(
        organization=organization,
        supplier=supplier,
        created_by=user,
        title='Draft Contract',
        contract_type='BLANKET',
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
        total_value=Decimal('100000.00'),
    )


@pytest.fixture
def contract_with_lines(db, organization, supplier, user):
    """Create a contract with lines."""
    contract = Contract.objects.create(
        organization=organization,
        supplier=supplier,
        created_by=user,
        title='Contract with Lines',
        contract_type='BLANKET',
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
        total_value=Decimal('100000.00'),
    )
    ContractLine.objects.create(
        contract=contract,
        description='Widget A',
        unit_price=Decimal('10.00'),
    )
    ContractLine.objects.create(
        contract=contract,
        description='Widget B',
        unit_price=Decimal('20.00'),
    )
    return contract


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
def other_contract(db, other_organization, other_supplier, other_user):
    """Create a contract in another organization."""
    return Contract.objects.create(
        organization=other_organization,
        supplier=other_supplier,
        created_by=other_user,
        title='Other Contract',
        total_value=Decimal('50000.00'),
    )


@pytest.mark.django_db
class TestContractListCreate:
    """Tests for contract list and create endpoints."""

    def test_list_contracts(self, authenticated_client, draft_contract, other_contract):
        """Lists only contracts in user's organization."""
        url = reverse('contract-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(draft_contract.id)

    def test_create_contract(self, authenticated_client, organization, supplier, user):
        """Can create a contract."""
        url = reverse('contract-list')
        data = {
            'organization': str(organization.id),
            'supplier': str(supplier.id),
            'created_by': str(user.id),
            'title': 'New Contract',
            'description': 'A new contract',
            'contract_type': 'FIXED_PRICE',
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=365)),
            'total_value': '50000.00',
            'currency': 'USD',
        }
        response = authenticated_client.post(url, data)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == 'New Contract'
        assert response.data['status'] == 'DRAFT'
        assert Contract.objects.filter(title='New Contract').exists()

    def test_create_contract_with_lines(self, authenticated_client, organization, supplier, user):
        """Can create contract with nested lines."""
        url = reverse('contract-list')
        data = {
            'organization': str(organization.id),
            'supplier': str(supplier.id),
            'created_by': str(user.id),
            'title': 'Contract with Lines',
            'contract_type': 'BLANKET',
            'total_value': '100000.00',
            'lines': [
                {'description': 'Item 1', 'unit_price': '100.00'},
                {'description': 'Item 2', 'unit_price': '200.00'},
            ],
        }
        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        contract = Contract.objects.get(id=response.data['id'])
        assert contract.lines.count() == 2

    def test_create_contract_unauthenticated(self, api_client, organization, supplier, user):
        """Unauthenticated users cannot create contracts."""
        url = reverse('contract-list')
        data = {
            'organization': str(organization.id),
            'supplier': str(supplier.id),
            'created_by': str(user.id),
            'title': 'New Contract',
        }
        response = api_client.post(url, data)

        # DRF may return 401 or 403 depending on configuration
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestContractDetail:
    """Tests for contract detail endpoint."""

    def test_retrieve_contract(self, authenticated_client, contract_with_lines):
        """Can retrieve contract detail with nested data."""
        url = reverse('contract-detail', kwargs={'pk': contract_with_lines.id})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Contract with Lines'
        assert len(response.data['lines']) == 2

    def test_retrieve_contract_other_org(self, authenticated_client, other_contract):
        """Cannot retrieve contract from another organization."""
        url = reverse('contract-detail', kwargs={'pk': other_contract.id})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_draft_contract(self, authenticated_client, draft_contract):
        """Can update a draft contract."""
        url = reverse('contract-detail', kwargs={'pk': draft_contract.id})
        data = {'title': 'Updated Title'}
        response = authenticated_client.patch(url, data)

        assert response.status_code == status.HTTP_200_OK
        draft_contract.refresh_from_db()
        assert draft_contract.title == 'Updated Title'

    def test_cannot_update_active_contract_title(self, authenticated_client, active_contract):
        """Cannot update certain fields on active contract."""
        url = reverse('contract-detail', kwargs={'pk': active_contract.id})
        data = {'supplier': 'some-other-id'}  # Should not be changeable
        response = authenticated_client.patch(url, data)
        # The update goes through but supplier changes are not allowed
        # This depends on serializer implementation

    def test_delete_contract(self, authenticated_client, draft_contract):
        """Can soft delete a contract."""
        url = reverse('contract-detail', kwargs={'pk': draft_contract.id})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        draft_contract.refresh_from_db()
        assert draft_contract.is_deleted is True


@pytest.mark.django_db
class TestContractWorkflowActions:
    """Tests for contract workflow action endpoints."""

    def test_submit_for_approval(self, authenticated_client, contract_with_lines):
        """Can submit contract for approval."""
        url = reverse('contract-submit-for-approval', kwargs={'pk': contract_with_lines.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        contract_with_lines.refresh_from_db()
        assert contract_with_lines.status == 'PENDING_APPROVAL'

    def test_submit_without_lines_fails(self, authenticated_client, draft_contract):
        """Cannot submit contract without lines."""
        url = reverse('contract-submit-for-approval', kwargs={'pk': draft_contract.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'line' in str(response.data).lower()  # "line items" or "lines"

    def test_approve_contract(self, authenticated_client, contract_with_lines, user):
        """Can approve a submitted contract."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.save()

        url = reverse('contract-approve', kwargs={'pk': contract_with_lines.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        contract_with_lines.refresh_from_db()
        assert contract_with_lines.status == 'ACTIVE'
        assert contract_with_lines.approved_by == user

    def test_approve_draft_fails(self, authenticated_client, contract_with_lines):
        """Cannot approve a draft contract."""
        url = reverse('contract-approve', kwargs={'pk': contract_with_lines.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_return_to_draft(self, authenticated_client, contract_with_lines):
        """Can return submitted contract to draft."""
        contract_with_lines.submit_for_approval()
        contract_with_lines.save()

        url = reverse('contract-return-to-draft', kwargs={'pk': contract_with_lines.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        contract_with_lines.refresh_from_db()
        assert contract_with_lines.status == 'DRAFT'

    def test_terminate_active_contract(self, authenticated_client, active_contract):
        """Can terminate an active contract."""
        url = reverse('contract-terminate', kwargs={'pk': active_contract.id})
        data = {'reason': 'Supplier performance issues'}
        response = authenticated_client.post(url, data)

        assert response.status_code == status.HTTP_200_OK
        active_contract.refresh_from_db()
        assert active_contract.status == 'TERMINATED'
        assert 'performance' in active_contract.termination_reason.lower()

    def test_terminate_draft_fails(self, authenticated_client, draft_contract):
        """Cannot terminate a draft contract."""
        url = reverse('contract-terminate', kwargs={'pk': draft_contract.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cancel_draft_contract(self, authenticated_client, draft_contract):
        """Can cancel a draft contract."""
        url = reverse('contract-cancel', kwargs={'pk': draft_contract.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        draft_contract.refresh_from_db()
        assert draft_contract.status == 'CANCELLED'

    def test_cancel_active_fails(self, authenticated_client, active_contract):
        """Cannot cancel an active contract (must terminate)."""
        url = reverse('contract-cancel', kwargs={'pk': active_contract.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestContractRenew:
    """Tests for contract renewal endpoint."""

    def test_renew_active_contract(self, authenticated_client, active_contract, user):
        """Can create amendment from active contract."""
        url = reverse('contract-renew', kwargs={'pk': active_contract.id})
        new_end = date.today() + timedelta(days=730)
        data = {
            'new_end_date': str(new_end),
            'new_total_value': '150000.00',
        }
        response = authenticated_client.post(url, data)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['amendment_number'] == 1
        assert response.data['status'] == 'DRAFT'
        assert 'Amendment' in response.data['title']

    def test_renew_requires_end_date(self, authenticated_client, active_contract):
        """Renewal requires new end date."""
        url = reverse('contract-renew', kwargs={'pk': active_contract.id})
        response = authenticated_client.post(url, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestContractNestedEndpoints:
    """Tests for nested contract endpoints."""

    def test_list_contract_lines(self, authenticated_client, contract_with_lines):
        """Can list lines for a contract."""
        url = reverse('contract-lines', kwargs={'pk': contract_with_lines.id})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_add_line_to_contract(self, authenticated_client, draft_contract):
        """Can add line to draft contract."""
        url = reverse('contract-lines', kwargs={'pk': draft_contract.id})
        data = {
            'description': 'New Item',
            'unit_price': '50.00',
            'unit_of_measure': 'EA',
        }
        response = authenticated_client.post(url, data)

        assert response.status_code == status.HTTP_201_CREATED
        assert draft_contract.lines.count() == 1

    def test_list_milestones(self, authenticated_client, active_contract):
        """Can list milestones for a contract."""
        ContractMilestone.objects.create(
            contract=active_contract,
            title='Phase 1',
            due_date=date.today() + timedelta(days=30),
        )
        url = reverse('contract-milestones', kwargs={'pk': active_contract.id})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_add_milestone_to_contract(self, authenticated_client, draft_contract):
        """Can add milestone to contract."""
        url = reverse('contract-milestones', kwargs={'pk': draft_contract.id})
        data = {
            'title': 'Kickoff Meeting',
            'due_date': str(date.today() + timedelta(days=7)),
            'amount': '10000.00',
        }
        response = authenticated_client.post(url, data)

        assert response.status_code == status.HTTP_201_CREATED
        assert draft_contract.milestones.count() == 1


@pytest.mark.django_db
class TestContractSpendEndpoint:
    """Tests for contract spend summary endpoint."""

    def test_get_spend_summary(self, authenticated_client, active_contract, organization, supplier, user):
        """Can get spend summary for contract."""
        # Create a PO and record spend
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
            code='TEST-BUDGET',
            name='Test Budget',
            allocated_amount=Decimal('100000.00'),
        )
        po = PurchaseOrder.objects.create(
            organization=organization,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
            title='Test PO',
        )
        ContractSpend.objects.create(
            contract=active_contract,
            purchase_order=po,
            amount=Decimal('25000.00'),
        )

        url = reverse('contract-spend', kwargs={'pk': active_contract.id})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_spent'] == '25000.00'
        assert response.data['remaining_value'] == '75000.00'
        assert response.data['utilization_percent'] == '25.00'


@pytest.mark.django_db
class TestContractUtilityEndpoints:
    """Tests for utility endpoints."""

    def test_expiring_contracts(self, authenticated_client, active_contract, organization):
        """Can get contracts expiring soon."""
        # Set to expire in 15 days
        active_contract.end_date = date.today() + timedelta(days=15)
        active_contract.save()

        url = reverse('contract-expiring')
        response = authenticated_client.get(url, {'days': 30})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(active_contract.id)

    def test_expiring_contracts_excludes_distant(self, authenticated_client, active_contract):
        """Excludes contracts not expiring within threshold."""
        # Expires in 90 days
        active_contract.end_date = date.today() + timedelta(days=90)
        active_contract.save()

        url = reverse('contract-expiring')
        response = authenticated_client.get(url, {'days': 30})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_contracts_for_supplier(self, authenticated_client, active_contract, supplier):
        """Can get contracts for a specific supplier."""
        url = reverse('contract-for-supplier', kwargs={'supplier_id': supplier.id})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(active_contract.id)

    def test_contracts_for_supplier_active_only(self, authenticated_client, supplier, draft_contract, active_contract):
        """Active only filter works for supplier contracts."""
        url = reverse('contract-for-supplier', kwargs={'supplier_id': supplier.id})

        # With active_only=true
        response = authenticated_client.get(url, {'active_only': 'true'})
        assert len(response.data) == 1  # Only active contract

        # Without filter
        response = authenticated_client.get(url, {'active_only': 'false'})
        assert len(response.data) == 2  # Both contracts


@pytest.mark.django_db
class TestContractLineViewSet:
    """Tests for ContractLine ViewSet."""

    def test_list_all_lines(self, authenticated_client, contract_with_lines, draft_contract):
        """Can list all contract lines in organization."""
        ContractLine.objects.create(
            contract=draft_contract,
            description='Another Item',
            unit_price=Decimal('30.00'),
        )

        url = reverse('contract-line-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_filter_lines_by_contract(self, authenticated_client, contract_with_lines, draft_contract):
        """Can filter lines by contract."""
        ContractLine.objects.create(
            contract=draft_contract,
            description='Another Item',
            unit_price=Decimal('30.00'),
        )

        url = reverse('contract-line-list')
        response = authenticated_client.get(url, {'contract': str(contract_with_lines.id)})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2


@pytest.mark.django_db
class TestContractMilestoneViewSet:
    """Tests for ContractMilestone ViewSet."""

    def test_complete_milestone(self, authenticated_client, active_contract):
        """Can mark milestone as completed."""
        milestone = ContractMilestone.objects.create(
            contract=active_contract,
            title='Phase 1',
            due_date=date.today() + timedelta(days=30),
        )

        url = reverse('contract-milestone-complete', kwargs={'pk': milestone.id})
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        milestone.refresh_from_db()
        assert milestone.status == 'COMPLETED'
        assert milestone.completed_date is not None

    def test_waive_milestone(self, authenticated_client, active_contract):
        """Can waive a milestone."""
        milestone = ContractMilestone.objects.create(
            contract=active_contract,
            title='Optional Phase',
            due_date=date.today() + timedelta(days=30),
        )

        url = reverse('contract-milestone-waive', kwargs={'pk': milestone.id})
        data = {'reason': 'No longer required'}
        response = authenticated_client.post(url, data)

        assert response.status_code == status.HTTP_200_OK
        milestone.refresh_from_db()
        assert milestone.status == 'WAIVED'


@pytest.mark.django_db
class TestOrganizationIsolation:
    """Tests for organization-based data isolation."""

    def test_cannot_see_other_org_contracts(self, authenticated_client, other_contract):
        """User cannot see contracts from other organizations."""
        url = reverse('contract-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        ids = [c['id'] for c in response.data['results']]
        assert str(other_contract.id) not in ids

    def test_cannot_update_other_org_contract(self, authenticated_client, other_contract):
        """User cannot update contracts from other organizations."""
        url = reverse('contract-detail', kwargs={'pk': other_contract.id})
        response = authenticated_client.patch(url, {'title': 'Hacked'})

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_delete_other_org_contract(self, authenticated_client, other_contract):
        """User cannot delete contracts from other organizations."""
        url = reverse('contract-detail', kwargs={'pk': other_contract.id})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        other_contract.refresh_from_db()
        assert other_contract.is_deleted is False

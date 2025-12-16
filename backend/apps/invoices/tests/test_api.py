"""
API tests for Invoice endpoints.

Tests workflow actions and invoice management.
"""

import pytest
from decimal import Decimal
from datetime import date

from rest_framework import status
from rest_framework.test import APIClient

from apps.budget.models import BudgetLine, FiscalYear
from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration
from apps.organizations.models import Organization
from apps.purchase_orders.models import PurchaseOrder, POLine
from apps.receiving.models import GoodsReceipt, GoodsReceiptLine
from apps.suppliers.models import Supplier
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
        allocated_amount=Decimal('50000.00'),
    )


@pytest.fixture
def sent_po(db, organization, user, supplier, budget_line):
    """Create a PO in SENT status ready for invoicing."""
    po = PurchaseOrder.objects.create(
        organization=organization,
        created_by=user,
        supplier=supplier,
        budget_line=budget_line,
        title='Test PO',
    )
    POLine.objects.create(
        purchase_order=po,
        description='Test Item',
        quantity=Decimal('10'),
        unit_price=Decimal('100.00'),
        unit_of_measure='EA',
    )
    po.submit()
    po.approve(approved_by=user)
    po.send()
    return po


@pytest.fixture
def posted_gr(db, organization, sent_po, user):
    """Create a posted goods receipt."""
    gr = GoodsReceipt.objects.create(
        organization=organization,
        purchase_order=sent_po,
        received_by=user,
    )
    po_line = sent_po.lines.first()
    GoodsReceiptLine.objects.create(
        goods_receipt=gr,
        po_line=po_line,
        quantity_received=Decimal('10'),
    )
    gr.post()
    return gr


@pytest.fixture
def matching_config(db, organization):
    """Create matching configuration."""
    return MatchingConfiguration.objects.create(
        organization=organization,
    )


@pytest.fixture
def invoice(db, organization, sent_po, supplier, user):
    """Create a draft invoice."""
    return Invoice.objects.create(
        organization=organization,
        purchase_order=sent_po,
        supplier=supplier,
        created_by=user,
        supplier_invoice_number='SUP-INV-001',
    )


@pytest.fixture
def invoice_with_line(invoice, sent_po):
    """Create an invoice with a line item."""
    po_line = sent_po.lines.first()
    InvoiceLine.objects.create(
        invoice=invoice,
        po_line=po_line,
        quantity_invoiced=Decimal('10'),
        unit_price=Decimal('100.00'),
    )
    invoice.calculate_subtotal()
    invoice.save()
    return invoice


@pytest.mark.django_db
class TestInvoiceViewSet:
    """Tests for /api/v1/invoices/ endpoints."""

    def test_list_invoices(self, authenticated_client, invoice):
        """Can list invoices in user's organization."""
        response = authenticated_client.get('/api/v1/invoices/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_invoice(
        self, authenticated_client, organization, sent_po, supplier, user
    ):
        """Can create a new invoice."""
        response = authenticated_client.post(
            '/api/v1/invoices/',
            {
                'supplier_invoice_number': 'VENDOR-123',
                'organization': str(organization.id),
                'purchase_order': str(sent_po.id),
                'supplier': str(supplier.id),
                'created_by': str(user.id),
                'invoice_date': '2025-12-15',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Invoice.objects.filter(supplier_invoice_number='VENDOR-123').exists()

    def test_create_invoice_with_lines(
        self, authenticated_client, organization, sent_po, supplier, user
    ):
        """Can create invoice with line items."""
        po_line = sent_po.lines.first()
        response = authenticated_client.post(
            '/api/v1/invoices/',
            {
                'supplier_invoice_number': 'VENDOR-456',
                'organization': str(organization.id),
                'purchase_order': str(sent_po.id),
                'supplier': str(supplier.id),
                'created_by': str(user.id),
                'invoice_date': '2025-12-15',
                'lines': [
                    {
                        'po_line': str(po_line.id),
                        'quantity_invoiced': '10',
                        'unit_price': '100.00',
                    },
                ],
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        inv = Invoice.objects.get(id=response.data['id'])
        assert inv.lines.count() == 1
        assert inv.subtotal == Decimal('1000.00')

    def test_get_invoice_detail(self, authenticated_client, invoice_with_line):
        """Can get invoice details with lines."""
        response = authenticated_client.get(
            f'/api/v1/invoices/{invoice_with_line.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'
        assert len(response.data['lines']) == 1


@pytest.mark.django_db
class TestInvoiceWorkflowAPI:
    """Tests for invoice workflow actions via API."""

    def test_validate_invoice(
        self, authenticated_client, invoice_with_line, user
    ):
        """DRAFT -> VALIDATED via validate action."""
        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/validate/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'VALIDATED'

    def test_validate_fails_without_lines(
        self, authenticated_client, invoice
    ):
        """Validation fails if invoice has no lines."""
        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice.id}/validate/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'errors' in response.data

    def test_match_invoice(
        self, authenticated_client, invoice_with_line, posted_gr, matching_config
    ):
        """Perform 3-way match on validated invoice."""
        invoice_with_line.validate(validated_by=invoice_with_line.created_by)

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/match/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'overall_match' in response.data
        # Should auto-match since perfect match
        assert response.data['overall_match'] is True

    def test_force_match(
        self, authenticated_client, invoice_with_line
    ):
        """Force match with manual override."""
        invoice_with_line.validate(validated_by=invoice_with_line.created_by)

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/force_match/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'MATCHED'
        assert response.data['match_type'] == 'OVERRIDE'

    def test_approve_invoice(
        self, authenticated_client, invoice_with_line, posted_gr
    ):
        """MATCHED -> APPROVED via approve action."""
        invoice_with_line.validate(validated_by=invoice_with_line.created_by)
        invoice_with_line.mark_matched()

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/approve/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED'

    def test_mark_paid(
        self, authenticated_client, invoice_with_line, posted_gr, user
    ):
        """APPROVED -> PAID via mark_paid action."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.approve(approved_by=user)

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/mark_paid/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'PAID'

    def test_reject_invoice(
        self, authenticated_client, invoice_with_line, user
    ):
        """VALIDATED -> REJECTED via reject action."""
        invoice_with_line.validate(validated_by=user)

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/reject/',
            {'reason': 'Incorrect pricing'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'REJECTED'
        assert response.data['rejection_reason'] == 'Incorrect pricing'

    def test_dispute_invoice(
        self, authenticated_client, invoice_with_line, user
    ):
        """MATCHED -> DISPUTED via dispute action."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/dispute/',
            {'reason': 'Quantity discrepancy'},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DISPUTED'

    def test_resolve_dispute(
        self, authenticated_client, invoice_with_line, user
    ):
        """DISPUTED -> MATCHED via resolve_dispute action."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.mark_matched()
        invoice_with_line.dispute(reason='Issue')

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/resolve_dispute/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'MATCHED'

    def test_revise_rejected_invoice(
        self, authenticated_client, invoice_with_line, user
    ):
        """REJECTED -> DRAFT via revise action."""
        invoice_with_line.validate(validated_by=user)
        invoice_with_line.reject()

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/revise/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'DRAFT'

    def test_cancel_invoice(
        self, authenticated_client, invoice
    ):
        """DRAFT -> CANCELLED via cancel action."""
        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice.id}/cancel/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'


@pytest.mark.django_db
class TestInvoiceInvalidTransitionsAPI:
    """Tests for invalid state transitions via API."""

    def test_cannot_approve_from_draft(
        self, authenticated_client, invoice_with_line
    ):
        """Cannot approve invoice from draft."""
        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/approve/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_match_from_draft(
        self, authenticated_client, invoice_with_line
    ):
        """Cannot match invoice from draft."""
        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/match/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestInvoiceLines:
    """Tests for invoice line management via API."""

    def test_get_invoice_lines(
        self, authenticated_client, invoice_with_line
    ):
        """Can get lines for an invoice."""
        response = authenticated_client.get(
            f'/api/v1/invoices/{invoice_with_line.id}/lines/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_add_line_to_draft_invoice(
        self, authenticated_client, invoice, sent_po
    ):
        """Can add line to draft invoice."""
        po_line = sent_po.lines.first()
        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice.id}/lines/',
            {
                'po_line': str(po_line.id),
                'quantity_invoiced': '5',
                'unit_price': '100.00',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert invoice.lines.count() == 1

    def test_cannot_add_line_to_validated_invoice(
        self, authenticated_client, invoice_with_line, sent_po, user
    ):
        """Cannot add line to validated invoice."""
        invoice_with_line.validate(validated_by=user)
        po_line = sent_po.lines.first()

        response = authenticated_client.post(
            f'/api/v1/invoices/{invoice_with_line.id}/lines/',
            {
                'po_line': str(po_line.id),
                'quantity_invoiced': '5',
                'unit_price': '100.00',
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMatchingConfigurationAPI:
    """Tests for matching configuration API."""

    def test_get_config(self, authenticated_client, matching_config):
        """Can get matching configuration."""
        response = authenticated_client.get('/api/v1/invoices/config/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_update_config_tolerances(
        self, authenticated_client, matching_config
    ):
        """Can update tolerance values."""
        response = authenticated_client.patch(
            f'/api/v1/invoices/config/{matching_config.id}/',
            {
                'price_tolerance_percent': '10.00',
                'quantity_tolerance_percent': '5.00',
            },
        )
        assert response.status_code == status.HTTP_200_OK
        matching_config.refresh_from_db()
        assert matching_config.price_tolerance_percent == Decimal('10.00')
        assert matching_config.quantity_tolerance_percent == Decimal('5.00')

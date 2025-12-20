"""
Tests for Invoice services - 3-way matching and invoice validation.
"""

from decimal import Decimal

import pytest

from apps.invoices.models import MatchingConfiguration
from apps.invoices.services import InvoiceService, ThreeWayMatchingService
from tests.factories import (
    ApprovedSupplierFactory,
    BudgetLineFactory,
    FiscalYearFactory,
    GoodsReceiptFactory,
    GoodsReceiptLineFactory,
    InvoiceFactory,
    InvoiceLineFactory,
    MatchingConfigurationFactory,
    OrganizationFactory,
    POLineFactory,
    PostedGoodsReceiptFactory,
    SentPOFactory,
    UserFactory,
)


@pytest.mark.django_db
class TestThreeWayMatchingService:
    """Tests for ThreeWayMatchingService."""

    def test_match_line_exact_match(self):
        """Test matching when invoice matches PO and GR exactly."""
        # Create organization and config
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            price_tolerance_percent=Decimal('5.00'),
            quantity_tolerance_percent=Decimal('2.00'),
        )

        # Create supplier and user
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)

        # Create budget infrastructure
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        # Create PO with line
        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
            quantity_received=Decimal('10.00'),  # Fully received
        )

        # Create invoice with matching line
        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        invoice_line = InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),  # Matches GR
            unit_price=Decimal('100.00'),  # Matches PO
        )

        # Run matching
        service = ThreeWayMatchingService(org)
        result = service.match_line(invoice_line)

        assert result['match_status'] == 'MATCHED'
        assert result['within_qty_tolerance'] is True
        assert result['within_price_tolerance'] is True

    def test_match_line_quantity_mismatch(self):
        """Test matching when invoice quantity differs from GR."""
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            quantity_tolerance_percent=Decimal('2.00'),
        )

        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
            quantity_received=Decimal('8.00'),  # Only 8 received
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        invoice_line = InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),  # Invoicing 10, but only 8 received
            unit_price=Decimal('100.00'),
        )

        service = ThreeWayMatchingService(org)
        result = service.match_line(invoice_line)

        assert result['match_status'] == 'QUANTITY_MISMATCH'
        assert result['within_qty_tolerance'] is False
        assert result['within_price_tolerance'] is True

    def test_match_line_price_mismatch(self):
        """Test matching when invoice price differs from PO price."""
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            price_tolerance_percent=Decimal('5.00'),
        )

        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
            quantity_received=Decimal('10.00'),
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        invoice_line = InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),
            unit_price=Decimal('120.00'),  # 20% higher than PO
        )

        service = ThreeWayMatchingService(org)
        result = service.match_line(invoice_line)

        assert result['match_status'] == 'PRICE_MISMATCH'
        assert result['within_qty_tolerance'] is True
        assert result['within_price_tolerance'] is False

    def test_match_line_both_mismatch(self):
        """Test matching when both quantity and price mismatch."""
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            price_tolerance_percent=Decimal('5.00'),
            quantity_tolerance_percent=Decimal('2.00'),
        )

        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
            quantity_received=Decimal('8.00'),  # Only 8 received
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        invoice_line = InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),  # Mismatch with GR
            unit_price=Decimal('120.00'),  # Mismatch with PO
        )

        service = ThreeWayMatchingService(org)
        result = service.match_line(invoice_line)

        assert result['match_status'] == 'BOTH_MISMATCH'
        assert result['within_qty_tolerance'] is False
        assert result['within_price_tolerance'] is False

    def test_match_line_within_tolerance(self):
        """Test matching when variances are within tolerance limits."""
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            price_tolerance_percent=Decimal('5.00'),
            quantity_tolerance_percent=Decimal('5.00'),
        )

        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100.00'),
            unit_price=Decimal('100.00'),
            quantity_received=Decimal('100.00'),
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        invoice_line = InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('102.00'),  # 2% variance - within 5%
            unit_price=Decimal('103.00'),  # 3% variance - within 5%
        )

        service = ThreeWayMatchingService(org)
        result = service.match_line(invoice_line)

        assert result['match_status'] == 'MATCHED'
        assert result['within_qty_tolerance'] is True
        assert result['within_price_tolerance'] is True

    def test_match_invoice_no_goods_receipt_required(self):
        """Test matching invoice when goods receipt is not required."""
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            require_goods_receipt=False,  # GR not required
        )

        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
            quantity_received=Decimal('0.00'),  # No GR yet
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),
            unit_price=Decimal('100.00'),
        )

        service = ThreeWayMatchingService(org)
        result = service.match_invoice(invoice)

        # Should not fail due to missing GR
        assert 'Goods receipt required' not in result.get('errors', [])

    def test_match_invoice_goods_receipt_required_no_gr(self):
        """Test matching fails when goods receipt is required but missing."""
        org = OrganizationFactory()
        MatchingConfigurationFactory(
            organization=org,
            require_goods_receipt=True,
        )

        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )

        service = ThreeWayMatchingService(org)
        result = service.match_invoice(invoice)

        assert result['overall_match'] is False
        assert result['can_auto_match'] is False
        assert 'Goods receipt required' in result['errors'][0]


@pytest.mark.django_db
class TestInvoiceService:
    """Tests for InvoiceService validation and utility methods."""

    def test_validate_invoice_no_lines(self):
        """Test validation fails when invoice has no lines."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        # No lines created

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert 'at least one line item' in errors[0]

    def test_validate_invoice_wrong_po_status(self):
        """Test validation fails when PO is in wrong status."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        # PO in DRAFT status - not ready for invoicing
        from tests.factories import DraftPOFactory
        po = DraftPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(purchase_order=po)

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),
            unit_price=Decimal('100.00'),
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert 'DRAFT' in errors[0]

    def test_validate_invoice_supplier_mismatch(self):
        """Test validation fails when invoice supplier differs from PO."""
        org = OrganizationFactory()
        supplier1 = ApprovedSupplierFactory(organization=org)
        supplier2 = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier1,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(purchase_order=po)

        # Invoice with different supplier
        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier2,  # Different supplier
            created_by=user,
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),
            unit_price=Decimal('100.00'),
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert 'supplier must match' in errors[0].lower()

    def test_validate_invoice_negative_amounts(self):
        """Test validation fails for negative amounts."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(purchase_order=po)

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
            subtotal=Decimal('-100.00'),  # Negative
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),
            unit_price=Decimal('100.00'),
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is False
        assert any('cannot be negative' in e.lower() for e in errors)

    def test_validate_invoice_valid(self):
        """Test validation passes for valid invoice."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
            subtotal=Decimal('1000.00'),
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),
            unit_price=Decimal('100.00'),
        )

        is_valid, errors = InvoiceService.validate_invoice(invoice)

        assert is_valid is True
        assert errors == []

    def test_update_po_quantities(self):
        """Test updating PO line quantities after invoice approval."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            unit_price=Decimal('100.00'),
            quantity_invoiced=Decimal('0.00'),
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('5.00'),
            unit_price=Decimal('100.00'),
        )

        InvoiceService.update_po_quantities(invoice)

        po_line.refresh_from_db()
        assert po_line.quantity_invoiced == Decimal('5.00')

    def test_check_full_invoicing_partial(self):
        """Test check_full_invoicing returns False for partial invoice."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            quantity_invoiced=Decimal('0.00'),
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('5.00'),  # Only invoicing 5 of 10
        )

        is_complete = InvoiceService.check_full_invoicing(invoice)

        assert is_complete is False

    def test_check_full_invoicing_complete(self):
        """Test check_full_invoicing returns True for complete invoice."""
        org = OrganizationFactory()
        supplier = ApprovedSupplierFactory(organization=org)
        user = UserFactory(organization=org)
        fy = FiscalYearFactory(organization=org)
        budget_line = BudgetLineFactory(fiscal_year=fy)

        po = SentPOFactory(
            organization=org,
            supplier=supplier,
            created_by=user,
            budget_line=budget_line,
        )
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('10.00'),
            quantity_invoiced=Decimal('0.00'),
        )

        invoice = InvoiceFactory(
            organization=org,
            purchase_order=po,
            supplier=supplier,
            created_by=user,
        )
        InvoiceLineFactory(
            invoice=invoice,
            po_line=po_line,
            quantity_invoiced=Decimal('10.00'),  # Full quantity
        )

        is_complete = InvoiceService.check_full_invoicing(invoice)

        assert is_complete is True

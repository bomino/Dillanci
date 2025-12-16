"""
Services for Invoice processing and 3-way matching.

ThreeWayMatchingService: Compares PO vs GR vs Invoice for each line
InvoiceService: Validation, matching orchestration, budget integration
"""

from decimal import Decimal
from typing import Dict, List, Tuple

from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration


class ThreeWayMatchingService:
    """
    Performs 3-way matching between PO, Goods Receipt, and Invoice.

    3-way match compares:
    1. PO quantity and price (what was ordered)
    2. GR quantity (what was received)
    3. Invoice quantity and price (what is being billed)

    Match status outcomes:
    - MATCHED: Within tolerance on both qty and price
    - QUANTITY_MISMATCH: Invoice qty differs from GR qty beyond tolerance
    - PRICE_MISMATCH: Invoice price differs from PO price beyond tolerance
    - BOTH_MISMATCH: Both qty and price outside tolerance
    """

    def __init__(self, organization):
        """Initialize with organization's matching configuration."""
        self.config = self._get_config(organization)

    def _get_config(self, organization) -> MatchingConfiguration:
        """Get or create matching configuration for organization."""
        config, _ = MatchingConfiguration.objects.get_or_create(
            organization=organization
        )
        return config

    def match_invoice(self, invoice: Invoice) -> Dict:
        """
        Perform 3-way match on all invoice lines.

        Returns:
            dict with overall match result and line-by-line details
        """
        results = {
            'invoice_id': str(invoice.id),
            'overall_match': True,
            'can_auto_match': True,
            'lines': [],
            'errors': [],
        }

        # Check if GR required
        if self.config.require_goods_receipt:
            if not self._has_goods_receipt(invoice.purchase_order):
                results['overall_match'] = False
                results['can_auto_match'] = False
                results['errors'].append(
                    'Goods receipt required before invoice matching'
                )
                return results

        # Check auto-match amount threshold
        if invoice.total_amount > self.config.auto_match_max_amount:
            results['can_auto_match'] = False

        # Match each line
        for line in invoice.lines.all():
            line_result = self.match_line(line)
            results['lines'].append(line_result)

            if line_result['match_status'] != 'MATCHED':
                results['overall_match'] = False

        return results

    def match_line(self, invoice_line: InvoiceLine) -> Dict:
        """
        Perform 3-way match on a single invoice line.

        Compares:
        - Invoice qty vs GR qty (quantity match)
        - Invoice price vs PO price (price match)

        Returns:
            dict with match status and variance details
        """
        po_line = invoice_line.po_line

        # Get quantities
        invoice_qty = invoice_line.quantity_invoiced
        gr_qty = po_line.quantity_received
        po_qty = po_line.quantity

        # Get prices
        invoice_price = invoice_line.unit_price
        po_price = po_line.unit_price

        # Calculate variances
        qty_variance = invoice_qty - gr_qty
        price_variance = invoice_price - po_price

        # Calculate variance percentages (avoid division by zero)
        qty_variance_pct = (
            abs(qty_variance / gr_qty * 100) if gr_qty else Decimal('100')
        )
        price_variance_pct = (
            abs(price_variance / po_price * 100) if po_price else Decimal('100')
        )

        # Check tolerances
        qty_ok = qty_variance_pct <= self.config.quantity_tolerance_percent
        price_ok = price_variance_pct <= self.config.price_tolerance_percent

        # Determine match status
        if qty_ok and price_ok:
            match_status = 'MATCHED'
        elif not qty_ok and not price_ok:
            match_status = 'BOTH_MISMATCH'
        elif not qty_ok:
            match_status = 'QUANTITY_MISMATCH'
        else:
            match_status = 'PRICE_MISMATCH'

        # Update line with match results
        invoice_line.match_status = match_status
        invoice_line.quantity_variance = qty_variance
        invoice_line.price_variance = price_variance
        invoice_line.quantity_matched = (
            min(invoice_qty, gr_qty) if qty_ok else Decimal('0')
        )
        invoice_line.save()

        return {
            'line_id': str(invoice_line.id),
            'line_number': invoice_line.line_number,
            'match_status': match_status,
            'invoice_qty': str(invoice_qty),
            'gr_qty': str(gr_qty),
            'po_qty': str(po_qty),
            'invoice_price': str(invoice_price),
            'po_price': str(po_price),
            'qty_variance': str(qty_variance),
            'qty_variance_pct': str(qty_variance_pct),
            'price_variance': str(price_variance),
            'price_variance_pct': str(price_variance_pct),
            'within_qty_tolerance': qty_ok,
            'within_price_tolerance': price_ok,
        }

    def _has_goods_receipt(self, purchase_order) -> bool:
        """Check if PO has any posted goods receipts."""
        return purchase_order.goods_receipts.filter(status='POSTED').exists()


class InvoiceService:
    """
    Service for invoice validation, matching, and budget integration.

    Orchestrates the invoice lifecycle:
    1. Validate invoice data and line items
    2. Perform 3-way matching
    3. Handle budget encumbrance liquidation on approval
    """

    @staticmethod
    def validate_invoice(invoice: Invoice) -> Tuple[bool, List[str]]:
        """
        Validate invoice before proceeding to validation status.

        Checks:
        - Invoice has at least one line
        - All lines reference valid PO lines
        - PO is in appropriate status (SENT or RECEIVED)
        - Invoice amounts are non-negative

        Returns:
            tuple of (is_valid, list of error messages)
        """
        errors = []

        # Must have lines
        if not invoice.lines.exists():
            errors.append('Invoice must have at least one line item')

        # Check PO status
        po = invoice.purchase_order
        if po.status not in ['SENT', 'RECEIVED', 'COMPLETED']:
            errors.append(
                f'Cannot invoice PO in {po.status} status. '
                f'PO must be SENT, RECEIVED, or COMPLETED.'
            )

        # Check PO matches supplier
        if po.supplier_id != invoice.supplier_id:
            errors.append(
                'Invoice supplier must match PO supplier'
            )

        # Check amounts are non-negative
        if invoice.subtotal < 0:
            errors.append('Subtotal cannot be negative')
        if invoice.tax_amount < 0:
            errors.append('Tax amount cannot be negative')
        if invoice.shipping_amount < 0:
            errors.append('Shipping amount cannot be negative')

        # Check each line
        for line in invoice.lines.all():
            line_errors = InvoiceService._validate_line(line, po)
            errors.extend(line_errors)

        return (len(errors) == 0, errors)

    @staticmethod
    def _validate_line(line: InvoiceLine, po) -> List[str]:
        """Validate a single invoice line."""
        errors = []

        # Check PO line belongs to the PO
        if line.po_line.purchase_order_id != po.id:
            errors.append(
                f'Line {line.line_number}: PO line does not belong to invoice PO'
            )

        # Check quantity is positive
        if line.quantity_invoiced <= 0:
            errors.append(
                f'Line {line.line_number}: Quantity must be positive'
            )

        # Check unit price is non-negative
        if line.unit_price < 0:
            errors.append(
                f'Line {line.line_number}: Unit price cannot be negative'
            )

        # Check over-invoicing (optional based on config)
        po_line = line.po_line
        total_invoiced = po_line.quantity_invoiced + line.quantity_invoiced
        if total_invoiced > po_line.quantity:
            # Get config to check if over-invoicing allowed
            try:
                config = MatchingConfiguration.objects.get(
                    organization=line.invoice.organization
                )
                if not config.allow_over_invoice:
                    errors.append(
                        f'Line {line.line_number}: Total invoiced quantity '
                        f'({total_invoiced}) would exceed PO quantity ({po_line.quantity})'
                    )
            except MatchingConfiguration.DoesNotExist:
                # Default: don't allow over-invoicing
                errors.append(
                    f'Line {line.line_number}: Total invoiced quantity '
                    f'({total_invoiced}) would exceed PO quantity ({po_line.quantity})'
                )

        return errors

    @staticmethod
    def update_po_quantities(invoice: Invoice):
        """
        Update PO line quantity_invoiced after invoice approval.

        Called when invoice is approved to track how much of each
        PO line has been invoiced.
        """
        for line in invoice.lines.all():
            po_line = line.po_line
            po_line.quantity_invoiced += line.quantity_invoiced
            po_line.save(update_fields=['quantity_invoiced', 'updated_at'])

    @staticmethod
    def link_encumbrance(invoice: Invoice):
        """
        Link invoice to PO's encumbrance for budget liquidation.

        Should be called before invoice approval to ensure budget
        integration is properly set up.
        """
        if invoice.purchase_order.encumbrance:
            invoice.encumbrance = invoice.purchase_order.encumbrance
            invoice.save(update_fields=['encumbrance', 'updated_at'])

    @staticmethod
    def check_full_invoicing(invoice: Invoice) -> bool:
        """
        Check if this invoice completes invoicing for the PO.

        Returns True if all PO lines are fully invoiced after this invoice.
        """
        po = invoice.purchase_order

        for po_line in po.lines.all():
            # Get invoice line for this PO line in current invoice
            invoice_line = invoice.lines.filter(po_line=po_line).first()
            new_invoiced = (
                invoice_line.quantity_invoiced if invoice_line else Decimal('0')
            )

            # Check if fully invoiced
            total_invoiced = po_line.quantity_invoiced + new_invoiced
            if total_invoiced < po_line.quantity:
                return False

        return True

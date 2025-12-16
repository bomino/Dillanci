"""
Supplier Performance Service for vendor analytics.

Provides supplier performance metrics and scorecards.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

from apps.invoices.models import Invoice, InvoiceLine
from apps.purchase_orders.models import PurchaseOrder
from apps.receiving.models import GoodsReceipt
from apps.suppliers.models import Supplier


class SupplierPerformanceService:
    """
    Service for analyzing supplier performance.

    Calculates supplier scorecards: on-time delivery, quality, invoice accuracy.
    """

    def __init__(self, organization):
        """
        Initialize supplier performance service.

        Args:
            organization: The Organization instance to analyze.
        """
        self.organization = organization

    def get_supplier_scorecard(
        self,
        supplier_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Get comprehensive scorecard for a supplier.

        Args:
            supplier_id: UUID of the supplier.
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with scorecard metrics.
        """
        try:
            supplier = Supplier.objects.get(
                id=supplier_id,
                organization=self.organization,
            )
        except Supplier.DoesNotExist:
            return {'error': 'Supplier not found'}

        # Calculate derived scores from actual metrics
        on_time = self._calc_on_time_delivery(supplier, date_from, date_to)
        invoice_accuracy = self._calc_invoice_accuracy(supplier, date_from, date_to)
        fulfillment = self._calc_fulfillment_rate(supplier, date_from, date_to)

        # Calculate overall score as average of metrics
        overall = (on_time + invoice_accuracy + fulfillment) / 3

        return {
            'supplier': {
                'id': str(supplier.id),
                'name': supplier.name,
                'code': supplier.code,
                'status': supplier.status,
            },
            # Note: Supplier model doesn't have score fields
            # We calculate them from actual performance
            'overall_score': round(overall, 2),
            'metrics': {
                'on_time_delivery_rate': on_time,
                'invoice_accuracy_rate': invoice_accuracy,
                'order_fulfillment_rate': fulfillment,
                'total_po_count': self._get_po_count(supplier, date_from, date_to),
                'total_spend': self._get_total_spend(supplier, date_from, date_to),
            },
            'period': {
                'from': date_from,
                'to': date_to,
            }
        }

    def _calc_on_time_delivery(
        self,
        supplier: Supplier,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Decimal:
        """Calculate on-time delivery percentage."""
        receipts = GoodsReceipt.objects.filter(
            purchase_order__supplier=supplier,
            purchase_order__organization=self.organization,
            status='POSTED',
            is_deleted=False,
        )

        if date_from:
            receipts = receipts.filter(receipt_date__gte=date_from)
        if date_to:
            receipts = receipts.filter(receipt_date__lte=date_to)

        total = receipts.count()
        if total == 0:
            return Decimal('100.00')

        # Count on-time receipts (receipts on or before expected date)
        on_time = 0
        for receipt in receipts:
            po = receipt.purchase_order
            if hasattr(po, 'expected_delivery_date') and po.expected_delivery_date:
                if receipt.receipt_date <= po.expected_delivery_date:
                    on_time += 1
            else:
                on_time += 1  # No expected date = consider on time

        return round((Decimal(on_time) / Decimal(total)) * 100, 2)

    def _calc_invoice_accuracy(
        self,
        supplier: Supplier,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Decimal:
        """Calculate invoice accuracy percentage (auto-matched vs total)."""
        invoices = Invoice.objects.filter(
            supplier=supplier,
            organization=self.organization,
            status__in=['MATCHED', 'APPROVED', 'PAID'],
            is_deleted=False,
        )

        if date_from:
            invoices = invoices.filter(invoice_date__gte=date_from)
        if date_to:
            invoices = invoices.filter(invoice_date__lte=date_to)

        total = invoices.count()
        if total == 0:
            return Decimal('100.00')

        auto_matched = invoices.filter(match_type='AUTO').count()
        return round((Decimal(auto_matched) / Decimal(total)) * 100, 2)

    def _calc_fulfillment_rate(
        self,
        supplier: Supplier,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Decimal:
        """Calculate order fulfillment rate (completed POs vs total)."""
        pos = PurchaseOrder.objects.filter(
            supplier=supplier,
            organization=self.organization,
            status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            is_deleted=False,
        )

        if date_from:
            pos = pos.filter(approved_at__date__gte=date_from)
        if date_to:
            pos = pos.filter(approved_at__date__lte=date_to)

        total = pos.count()
        if total == 0:
            return Decimal('100.00')

        completed = pos.filter(status='COMPLETED').count()
        return round((Decimal(completed) / Decimal(total)) * 100, 2)

    def _get_po_count(
        self,
        supplier: Supplier,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> int:
        """Get total PO count for supplier."""
        pos = PurchaseOrder.objects.filter(
            supplier=supplier,
            organization=self.organization,
            status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            is_deleted=False,
        )

        if date_from:
            pos = pos.filter(approved_at__date__gte=date_from)
        if date_to:
            pos = pos.filter(approved_at__date__lte=date_to)

        return pos.count()

    def _get_total_spend(
        self,
        supplier: Supplier,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Decimal:
        """Get total spend with supplier."""
        invoices = Invoice.objects.filter(
            supplier=supplier,
            organization=self.organization,
            status__in=['APPROVED', 'PAID'],
            is_deleted=False,
        )

        if date_from:
            invoices = invoices.filter(invoice_date__gte=date_from)
        if date_to:
            invoices = invoices.filter(invoice_date__lte=date_to)

        # Invoice.total_amount is a property, calculate from fields
        result = invoices.aggregate(
            subtotal=Sum('subtotal'),
            tax=Sum('tax_amount'),
            shipping=Sum('shipping_amount'),
            discount=Sum('discount_amount'),
        )

        subtotal = result['subtotal'] or Decimal('0.00')
        tax = result['tax'] or Decimal('0.00')
        shipping = result['shipping'] or Decimal('0.00')
        discount = result['discount'] or Decimal('0.00')

        return subtotal + tax + shipping - discount

    def get_all_supplier_rankings(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 20,
    ) -> list[dict]:
        """
        Get ranked list of suppliers by performance score.

        Calculates performance metrics dynamically since Supplier model
        doesn't have score fields.

        Args:
            date_from: Start date filter.
            date_to: End date filter.
            limit: Maximum number of suppliers to return.

        Returns:
            List of supplier performance summaries.
        """
        suppliers = Supplier.objects.filter(
            organization=self.organization,
            status='APPROVED',
            is_deleted=False,
        ).order_by('name')[:limit]

        # Calculate scores for each supplier and sort by overall
        supplier_scores = []
        for supplier in suppliers:
            on_time = self._calc_on_time_delivery(supplier, date_from, date_to)
            invoice_accuracy = self._calc_invoice_accuracy(supplier, date_from, date_to)
            fulfillment = self._calc_fulfillment_rate(supplier, date_from, date_to)
            overall = (on_time + invoice_accuracy + fulfillment) / 3

            supplier_scores.append({
                'supplier': supplier,
                'overall_score': round(overall, 2),
                'delivery_score': on_time,
                'quality_score': invoice_accuracy,  # Using invoice accuracy as quality proxy
                'fulfillment_score': fulfillment,
            })

        # Sort by overall score descending
        supplier_scores.sort(key=lambda x: x['overall_score'], reverse=True)

        results = []
        for rank, item in enumerate(supplier_scores, 1):
            supplier = item['supplier']
            results.append({
                'rank': rank,
                'supplier_id': str(supplier.id),
                'supplier_name': supplier.name,
                'supplier_code': supplier.code,
                'overall_score': item['overall_score'],
                'quality_score': item['quality_score'],
                'delivery_score': item['delivery_score'],
                'total_spend': self._get_total_spend(supplier, date_from, date_to),
                'po_count': self._get_po_count(supplier, date_from, date_to),
            })

        return results

    def get_supplier_comparison(
        self,
        supplier_ids: list[str],
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list[dict]:
        """
        Compare multiple suppliers side by side.

        Args:
            supplier_ids: List of supplier UUIDs to compare.
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            List of supplier scorecards.
        """
        results = []
        for supplier_id in supplier_ids:
            scorecard = self.get_supplier_scorecard(supplier_id, date_from, date_to)
            if 'error' not in scorecard:
                results.append(scorecard)

        return results

    def execute(
        self,
        filters: dict,
        columns: Optional[list] = None,
        group_by: Optional[list] = None,
    ) -> dict:
        """
        Execute supplier performance report with given parameters.

        Args:
            filters: Dict of filter parameters.
            columns: List of columns to include.
            group_by: Not used for this report type.

        Returns:
            Dict with report data.
        """
        date_from = filters.get('date_from')
        date_to = filters.get('date_to')
        supplier_id = filters.get('supplier_id')

        if supplier_id:
            return {
                'type': 'single_supplier',
                'data': self.get_supplier_scorecard(supplier_id, date_from, date_to),
            }

        return {
            'type': 'ranking',
            'data': self.get_all_supplier_rankings(date_from, date_to),
        }

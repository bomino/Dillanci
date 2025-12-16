"""
Spend Analysis Service for procurement spend reporting.

Provides aggregated spend analysis by supplier, category, time period, etc.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.db.models import Count, Sum, F, Q, Value, ExpressionWrapper, DecimalField
from django.db.models.functions import TruncMonth, TruncQuarter, TruncYear, Coalesce

from apps.invoices.models import Invoice
from apps.purchase_orders.models import PurchaseOrder, POLine


# Invoice.total_amount is a property, not a DB field.
# We need to calculate: subtotal + tax_amount + shipping_amount - discount_amount
# Using annotation to compute this
INVOICE_TOTAL_EXPR = ExpressionWrapper(
    Coalesce(F('subtotal'), Value(Decimal('0.00'))) +
    Coalesce(F('tax_amount'), Value(Decimal('0.00'))) +
    Coalesce(F('shipping_amount'), Value(Decimal('0.00'))) -
    Coalesce(F('discount_amount'), Value(Decimal('0.00'))),
    output_field=DecimalField(max_digits=15, decimal_places=2)
)


class SpendAnalysisService:
    """
    Service for analyzing procurement spend data.

    Aggregates spend by various dimensions for reporting.
    """

    def __init__(self, organization):
        """
        Initialize spend analysis service.

        Args:
            organization: The Organization instance to analyze.
        """
        self.organization = organization

    def _get_base_queryset(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ):
        """
        Get base queryset for approved/paid invoices.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Filtered Invoice queryset.
        """
        queryset = Invoice.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'PAID'],
            is_deleted=False,
        )

        if date_from:
            queryset = queryset.filter(invoice_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(invoice_date__lte=date_to)

        return queryset

    def get_spend_by_supplier(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 10,
    ) -> list[dict]:
        """
        Get spend aggregated by supplier.

        Args:
            date_from: Start date filter.
            date_to: End date filter.
            limit: Maximum number of suppliers to return.

        Returns:
            List of dicts with supplier info and spend totals.
        """
        queryset = self._get_base_queryset(date_from, date_to)

        results = queryset.annotate(
            computed_total=INVOICE_TOTAL_EXPR
        ).values(
            'supplier_id',
            'supplier__name',
            'supplier__code',
        ).annotate(
            total_spend=Sum('computed_total'),
            invoice_count=Count('id'),
        ).order_by('-total_spend')[:limit]

        return list(results)

    def get_spend_by_category(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 10,
    ) -> list[dict]:
        """
        Get spend aggregated by catalog category.

        Args:
            date_from: Start date filter.
            date_to: End date filter.
            limit: Maximum number of categories to return.

        Returns:
            List of dicts with category info and spend totals.
        """
        # Get PO lines with approved invoices
        po_lines = POLine.objects.filter(
            purchase_order__organization=self.organization,
            purchase_order__status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            purchase_order__is_deleted=False,
            catalog_item__category__isnull=False,
        )

        if date_from:
            po_lines = po_lines.filter(purchase_order__approved_at__date__gte=date_from)
        if date_to:
            po_lines = po_lines.filter(purchase_order__approved_at__date__lte=date_to)

        results = po_lines.values(
            'catalog_item__category__id',
            'catalog_item__category__name',
            'catalog_item__category__code',
        ).annotate(
            total_spend=Sum(F('quantity') * F('unit_price')),
            line_count=Count('id'),
        ).order_by('-total_spend')[:limit]

        return list(results)

    def get_spend_by_month(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list[dict]:
        """
        Get spend aggregated by month.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            List of dicts with month and spend totals.
        """
        queryset = self._get_base_queryset(date_from, date_to)

        results = queryset.annotate(
            month=TruncMonth('invoice_date'),
            computed_total=INVOICE_TOTAL_EXPR,
        ).values('month').annotate(
            total_spend=Sum('computed_total'),
            invoice_count=Count('id'),
        ).order_by('month')

        return [
            {
                'month': r['month'].strftime('%Y-%m') if r['month'] else None,
                'total_spend': r['total_spend'],
                'invoice_count': r['invoice_count'],
            }
            for r in results
        ]

    def get_spend_by_quarter(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list[dict]:
        """
        Get spend aggregated by quarter.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            List of dicts with quarter and spend totals.
        """
        queryset = self._get_base_queryset(date_from, date_to)

        results = queryset.annotate(
            quarter=TruncQuarter('invoice_date'),
            computed_total=INVOICE_TOTAL_EXPR,
        ).values('quarter').annotate(
            total_spend=Sum('computed_total'),
            invoice_count=Count('id'),
        ).order_by('quarter')

        return [
            {
                'quarter': f"Q{((r['quarter'].month - 1) // 3) + 1} {r['quarter'].year}" if r['quarter'] else None,
                'total_spend': r['total_spend'],
                'invoice_count': r['invoice_count'],
            }
            for r in results
        ]

    def get_spend_summary(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Get overall spend summary.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with total spend, invoice count, avg invoice value.
        """
        queryset = self._get_base_queryset(date_from, date_to)

        result = queryset.annotate(
            computed_total=INVOICE_TOTAL_EXPR
        ).aggregate(
            total_spend=Sum('computed_total'),
            invoice_count=Count('id'),
        )

        total = result['total_spend'] or Decimal('0.00')
        count = result['invoice_count'] or 0
        avg = total / count if count > 0 else Decimal('0.00')

        return {
            'total_spend': total,
            'invoice_count': count,
            'average_invoice_value': round(avg, 2),
            'period_start': date_from,
            'period_end': date_to,
        }

    def get_top_suppliers_by_spend(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 5,
    ) -> list[dict]:
        """
        Get top suppliers by spend with percentage of total.

        Args:
            date_from: Start date filter.
            date_to: End date filter.
            limit: Number of suppliers to return.

        Returns:
            List of supplier spend data with percentages.
        """
        suppliers = self.get_spend_by_supplier(date_from, date_to, limit=limit)
        summary = self.get_spend_summary(date_from, date_to)
        total_spend = summary['total_spend'] or Decimal('1.00')

        for supplier in suppliers:
            spend = supplier['total_spend'] or Decimal('0.00')
            supplier['spend_percentage'] = round((spend / total_spend) * 100, 2)

        return suppliers

    def execute(
        self,
        filters: dict,
        columns: Optional[list] = None,
        group_by: Optional[list] = None,
    ) -> dict:
        """
        Execute spend analysis report with given parameters.

        Args:
            filters: Dict of filter parameters (date_from, date_to, supplier_id, etc.)
            columns: List of columns to include.
            group_by: List of dimensions to group by.

        Returns:
            Dict with report data.
        """
        date_from = filters.get('date_from')
        date_to = filters.get('date_to')
        group_by = group_by or ['month']

        results = {}

        if 'supplier' in group_by:
            results['by_supplier'] = self.get_spend_by_supplier(date_from, date_to)

        if 'category' in group_by:
            results['by_category'] = self.get_spend_by_category(date_from, date_to)

        if 'month' in group_by:
            results['by_month'] = self.get_spend_by_month(date_from, date_to)

        if 'quarter' in group_by:
            results['by_quarter'] = self.get_spend_by_quarter(date_from, date_to)

        results['summary'] = self.get_spend_summary(date_from, date_to)

        return results

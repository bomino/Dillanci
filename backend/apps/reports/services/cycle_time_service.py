"""
Cycle Time Service for workflow duration analytics.

Provides analysis of workflow durations across procurement processes.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.db.models import Avg, Count, F, ExpressionWrapper, DurationField
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.invoices.models import Invoice
from apps.purchase_orders.models import PurchaseOrder
from apps.receiving.models import GoodsReceipt
from apps.requisitions.models import Requisition


class CycleTimeService:
    """
    Service for analyzing workflow cycle times.

    Calculates durations: requisition→PO, PO→receipt, invoice→payment.
    """

    def __init__(self, organization):
        """
        Initialize cycle time service.

        Args:
            organization: The Organization instance to analyze.
        """
        self.organization = organization

    def get_requisition_to_po_cycle_time(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Calculate average time from requisition approval to PO creation.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with cycle time statistics.
        """
        requisitions = Requisition.objects.filter(
            organization=self.organization,
            status='APPROVED',
            approved_at__isnull=False,
            is_deleted=False,
        )

        if date_from:
            requisitions = requisitions.filter(approved_at__date__gte=date_from)
        if date_to:
            requisitions = requisitions.filter(approved_at__date__lte=date_to)

        cycle_times = []
        for req in requisitions:
            # Find POs linked to this requisition
            pos = PurchaseOrder.objects.filter(
                requisition=req,
                created_at__isnull=False,
            )
            if pos.exists():
                first_po = pos.order_by('created_at').first()
                cycle = (first_po.created_at - req.approved_at).total_seconds() / 86400
                cycle_times.append(cycle)

        if not cycle_times:
            return {
                'average_days': Decimal('0.00'),
                'min_days': Decimal('0.00'),
                'max_days': Decimal('0.00'),
                'count': 0,
            }

        return {
            'average_days': round(Decimal(str(sum(cycle_times) / len(cycle_times))), 2),
            'min_days': round(Decimal(str(min(cycle_times))), 2),
            'max_days': round(Decimal(str(max(cycle_times))), 2),
            'count': len(cycle_times),
        }

    def get_po_approval_cycle_time(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Calculate average time from PO submission to approval.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with cycle time statistics.
        """
        pos = PurchaseOrder.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            submitted_at__isnull=False,
            approved_at__isnull=False,
            is_deleted=False,
        )

        if date_from:
            pos = pos.filter(approved_at__date__gte=date_from)
        if date_to:
            pos = pos.filter(approved_at__date__lte=date_to)

        cycle_times = []
        for po in pos:
            cycle = (po.approved_at - po.submitted_at).total_seconds() / 86400
            cycle_times.append(cycle)

        if not cycle_times:
            return {
                'average_days': Decimal('0.00'),
                'min_days': Decimal('0.00'),
                'max_days': Decimal('0.00'),
                'count': 0,
            }

        return {
            'average_days': round(Decimal(str(sum(cycle_times) / len(cycle_times))), 2),
            'min_days': round(Decimal(str(min(cycle_times))), 2),
            'max_days': round(Decimal(str(max(cycle_times))), 2),
            'count': len(cycle_times),
        }

    def get_po_to_receipt_cycle_time(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Calculate average time from PO approval to goods receipt.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with cycle time statistics.
        """
        receipts = GoodsReceipt.objects.filter(
            organization=self.organization,
            status='POSTED',
            posted_at__isnull=False,
            purchase_order__approved_at__isnull=False,
            is_deleted=False,
        )

        if date_from:
            receipts = receipts.filter(posted_at__date__gte=date_from)
        if date_to:
            receipts = receipts.filter(posted_at__date__lte=date_to)

        cycle_times = []
        for receipt in receipts:
            po = receipt.purchase_order
            if po.approved_at:
                cycle = (receipt.posted_at - po.approved_at).total_seconds() / 86400
                cycle_times.append(cycle)

        if not cycle_times:
            return {
                'average_days': Decimal('0.00'),
                'min_days': Decimal('0.00'),
                'max_days': Decimal('0.00'),
                'count': 0,
            }

        return {
            'average_days': round(Decimal(str(sum(cycle_times) / len(cycle_times))), 2),
            'min_days': round(Decimal(str(min(cycle_times))), 2),
            'max_days': round(Decimal(str(max(cycle_times))), 2),
            'count': len(cycle_times),
        }

    def get_invoice_to_payment_cycle_time(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Calculate average time from invoice receipt to payment.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with cycle time statistics.
        """
        invoices = Invoice.objects.filter(
            organization=self.organization,
            status='PAID',
            invoice_date__isnull=False,
            paid_at__isnull=False,
            is_deleted=False,
        )

        if date_from:
            invoices = invoices.filter(paid_at__date__gte=date_from)
        if date_to:
            invoices = invoices.filter(paid_at__date__lte=date_to)

        cycle_times = []
        for inv in invoices:
            # Convert invoice_date to datetime for comparison
            invoice_datetime = timezone.make_aware(
                timezone.datetime.combine(inv.invoice_date, timezone.datetime.min.time())
            )
            cycle = (inv.paid_at - invoice_datetime).total_seconds() / 86400
            cycle_times.append(cycle)

        if not cycle_times:
            return {
                'average_days': Decimal('0.00'),
                'min_days': Decimal('0.00'),
                'max_days': Decimal('0.00'),
                'count': 0,
            }

        return {
            'average_days': round(Decimal(str(sum(cycle_times) / len(cycle_times))), 2),
            'min_days': round(Decimal(str(min(cycle_times))), 2),
            'max_days': round(Decimal(str(max(cycle_times))), 2),
            'count': len(cycle_times),
        }

    def get_procure_to_pay_cycle_time(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Calculate full procure-to-pay cycle time (PO creation to payment).

        Since PurchaseOrder doesn't link directly to Requisition, we calculate
        from PO creation to invoice payment as the P2P cycle.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with cycle time statistics.
        """
        # Get paid invoices with linked POs
        invoices = Invoice.objects.filter(
            organization=self.organization,
            status='PAID',
            paid_at__isnull=False,
            purchase_order__created_at__isnull=False,
            is_deleted=False,
        )

        if date_from:
            invoices = invoices.filter(paid_at__date__gte=date_from)
        if date_to:
            invoices = invoices.filter(paid_at__date__lte=date_to)

        cycle_times = []
        for inv in invoices:
            po = inv.purchase_order
            if po and po.created_at:
                cycle = (inv.paid_at - po.created_at).total_seconds() / 86400
                cycle_times.append(cycle)

        if not cycle_times:
            return {
                'average_days': Decimal('0.00'),
                'min_days': Decimal('0.00'),
                'max_days': Decimal('0.00'),
                'count': 0,
            }

        return {
            'average_days': round(Decimal(str(sum(cycle_times) / len(cycle_times))), 2),
            'min_days': round(Decimal(str(min(cycle_times))), 2),
            'max_days': round(Decimal(str(max(cycle_times))), 2),
            'count': len(cycle_times),
        }

    def get_cycle_time_trend(
        self,
        cycle_type: str,
        months: int = 6,
    ) -> list[dict]:
        """
        Get cycle time trend over time.

        Args:
            cycle_type: Type of cycle ('po_approval', 'po_to_receipt', 'invoice_to_payment')
            months: Number of months to include.

        Returns:
            List of monthly cycle time averages.
        """
        today = timezone.now().date()
        results = []

        method_map = {
            'po_approval': self.get_po_approval_cycle_time,
            'po_to_receipt': self.get_po_to_receipt_cycle_time,
            'invoice_to_payment': self.get_invoice_to_payment_cycle_time,
            'requisition_to_po': self.get_requisition_to_po_cycle_time,
            'procure_to_pay': self.get_procure_to_pay_cycle_time,
        }

        calc_method = method_map.get(cycle_type)
        if not calc_method:
            return []

        for i in range(months - 1, -1, -1):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1

            period_start = date(year, month, 1)
            if month == 12:
                period_end = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                period_end = date(year, month + 1, 1) - timedelta(days=1)

            stats = calc_method(period_start, period_end)

            results.append({
                'period': period_start.strftime('%Y-%m'),
                'average_days': stats['average_days'],
                'count': stats['count'],
            })

        return results

    def get_all_cycle_times(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Get all cycle time metrics.

        Args:
            date_from: Start date filter.
            date_to: End date filter.

        Returns:
            Dict with all cycle time metrics.
        """
        return {
            'requisition_to_po': self.get_requisition_to_po_cycle_time(date_from, date_to),
            'po_approval': self.get_po_approval_cycle_time(date_from, date_to),
            'po_to_receipt': self.get_po_to_receipt_cycle_time(date_from, date_to),
            'invoice_to_payment': self.get_invoice_to_payment_cycle_time(date_from, date_to),
            'procure_to_pay': self.get_procure_to_pay_cycle_time(date_from, date_to),
        }

    def execute(
        self,
        filters: dict,
        columns: Optional[list] = None,
        group_by: Optional[list] = None,
    ) -> dict:
        """
        Execute cycle time report with given parameters.

        Args:
            filters: Dict of filter parameters.
            columns: List of columns to include.
            group_by: Not used for this report type.

        Returns:
            Dict with report data.
        """
        date_from = filters.get('date_from')
        date_to = filters.get('date_to')
        include_trend = filters.get('include_trend', True)

        results = {
            'cycle_times': self.get_all_cycle_times(date_from, date_to),
            'period': {
                'from': date_from,
                'to': date_to,
            }
        }

        if include_trend:
            results['trends'] = {
                'po_approval': self.get_cycle_time_trend('po_approval'),
                'po_to_receipt': self.get_cycle_time_trend('po_to_receipt'),
                'invoice_to_payment': self.get_cycle_time_trend('invoice_to_payment'),
            }

        return results

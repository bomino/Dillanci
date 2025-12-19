"""
KPI Service for calculating dashboard metrics.

Provides 12 key performance indicators for procurement analytics.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

from apps.budget.models import BudgetLine, Encumbrance
from apps.contracts.models import Contract
from apps.invoices.models import Invoice, InvoiceLine
from apps.purchase_orders.models import PurchaseOrder
from apps.receiving.models import GoodsReceipt, GoodsReceiptLine
from apps.reports.models import DashboardKPI
from apps.requisitions.models import Requisition
from apps.rfps.models import RFP, Proposal, EvaluationScore, BAFORound
from apps.rfqs.models import RFQ
from apps.suppliers.models import Supplier


class KPIService:
    """
    Service for calculating and storing dashboard KPIs.

    Calculates 12 key metrics for procurement performance monitoring.
    """

    def __init__(self, organization):
        """
        Initialize KPI service for an organization.

        Args:
            organization: The Organization instance to calculate KPIs for.
        """
        self.organization = organization

    def _get_period_dates(self, period_type: str = 'MTD') -> tuple[date, date]:
        """
        Get period start and end dates.

        Args:
            period_type: 'MTD' for month-to-date, 'YTD' for year-to-date.

        Returns:
            Tuple of (period_start, period_end) dates.
        """
        today = timezone.now().date()

        if period_type == 'MTD':
            period_start = today.replace(day=1)
            period_end = today
        elif period_type == 'YTD':
            period_start = today.replace(month=1, day=1)
            period_end = today
        else:
            raise ValueError(f"Unknown period type: {period_type}")

        return period_start, period_end

    def _get_previous_period_dates(self, period_type: str = 'MTD') -> tuple[date, date]:
        """
        Get previous period dates for comparison.

        Args:
            period_type: 'MTD' for previous month, 'YTD' for previous year.

        Returns:
            Tuple of (period_start, period_end) dates.
        """
        today = timezone.now().date()

        if period_type == 'MTD':
            # Previous month
            first_of_month = today.replace(day=1)
            prev_month_end = first_of_month - timedelta(days=1)
            prev_month_start = prev_month_end.replace(day=1)
            return prev_month_start, prev_month_end
        elif period_type == 'YTD':
            # Previous year same period
            period_start = today.replace(year=today.year - 1, month=1, day=1)
            period_end = today.replace(year=today.year - 1)
            return period_start, period_end

        raise ValueError(f"Unknown period type: {period_type}")

    # =========================================================================
    # SPEND KPIs
    # =========================================================================

    def get_total_spend_mtd(self) -> Decimal:
        """
        Calculate total spend for month-to-date.

        Based on approved/paid invoices in current month.
        Note: Invoice.total_amount is a property, so we calculate:
        subtotal + tax_amount + shipping_amount - discount_amount
        """
        period_start, period_end = self._get_period_dates('MTD')

        result = Invoice.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'PAID'],
            approved_at__date__gte=period_start,
            approved_at__date__lte=period_end,
            is_deleted=False,
        ).aggregate(
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

    def get_total_spend_ytd(self) -> Decimal:
        """
        Calculate total spend for year-to-date.

        Based on approved/paid invoices in current year.
        Note: Invoice.total_amount is a property, so we calculate:
        subtotal + tax_amount + shipping_amount - discount_amount
        """
        period_start, period_end = self._get_period_dates('YTD')

        result = Invoice.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'PAID'],
            approved_at__date__gte=period_start,
            approved_at__date__lte=period_end,
            is_deleted=False,
        ).aggregate(
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

    # =========================================================================
    # BUDGET KPIs
    # =========================================================================

    def get_budget_utilization(self) -> Decimal:
        """
        Calculate budget utilization percentage.

        (Encumbered + Spent) / Allocated * 100
        """
        # Get active budget lines for the organization
        budget_lines = BudgetLine.objects.filter(
            fiscal_year__organization=self.organization,
            fiscal_year__status='OPEN',
            status='ACTIVE',
            is_deleted=False,
        )

        total_allocated = budget_lines.aggregate(
            total=Sum('allocated_amount')
        )['total'] or Decimal('0.00')

        if total_allocated == 0:
            return Decimal('0.00')

        total_encumbered = Encumbrance.objects.filter(
            budget_line__in=budget_lines,
            status__in=['ACTIVE', 'LIQUIDATED'],
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        utilization = (total_encumbered / total_allocated) * 100
        return round(utilization, 2)

    # =========================================================================
    # CONTRACT KPIs
    # =========================================================================

    def _get_po_total(self, po_queryset) -> Decimal:
        """
        Calculate total amount for a PurchaseOrder queryset.

        Since PurchaseOrder.total_amount is a property, we sum
        POLine.quantity * POLine.unit_price for each PO.
        """
        from apps.purchase_orders.models import POLine

        po_ids = po_queryset.values_list('id', flat=True)
        result = POLine.objects.filter(
            purchase_order_id__in=po_ids,
            is_deleted=False,
        ).aggregate(total=Sum(F('quantity') * F('unit_price')))

        return result['total'] or Decimal('0.00')

    def get_contract_compliance(self) -> Decimal:
        """
        Calculate contract compliance percentage.

        Percentage of spend that is on-contract vs off-contract.
        """
        period_start, period_end = self._get_period_dates('YTD')

        # Get POs with contracts (on-contract spend)
        on_contract_pos = PurchaseOrder.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            contract__isnull=False,
            approved_at__date__gte=period_start,
            approved_at__date__lte=period_end,
            is_deleted=False,
        )
        on_contract = self._get_po_total(on_contract_pos)

        # Total PO spend
        all_pos = PurchaseOrder.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            approved_at__date__gte=period_start,
            approved_at__date__lte=period_end,
            is_deleted=False,
        )
        total_spend = self._get_po_total(all_pos)

        if total_spend == 0:
            return Decimal('100.00')  # 100% compliant if no spend

        compliance = (on_contract / total_spend) * 100
        return round(compliance, 2)

    def get_maverick_spend(self) -> Decimal:
        """
        Calculate maverick spend percentage.

        Percentage of purchases made without proper PO process.
        This is the inverse of contract compliance in simpler systems.
        """
        # For this implementation, maverick spend = 100 - contract compliance
        return Decimal('100.00') - self.get_contract_compliance()

    def get_expiring_contracts_90d(self) -> int:
        """
        Count contracts expiring within 90 days.
        """
        today = timezone.now().date()
        end_date = today + timedelta(days=90)

        count = Contract.objects.filter(
            organization=self.organization,
            status='ACTIVE',
            end_date__gte=today,
            end_date__lte=end_date,
            is_deleted=False,
        ).count()

        return count

    # =========================================================================
    # RFX KPIs
    # =========================================================================

    def get_open_rfx_count(self) -> int:
        """
        Count open RFQs and RFPs.
        """
        open_rfqs = RFQ.objects.filter(
            organization=self.organization,
            status='OPEN',
            is_deleted=False,
        ).count()

        open_rfps = RFP.objects.filter(
            organization=self.organization,
            status='PUBLISHED',
            is_deleted=False,
        ).count()

        return open_rfqs + open_rfps

    # =========================================================================
    # RFP-SPECIFIC KPIs
    # =========================================================================

    def get_rfp_open_count(self) -> int:
        """Count open RFPs (PUBLISHED or EVALUATION status)."""
        return RFP.objects.filter(
            organization=self.organization,
            status__in=['PUBLISHED', 'EVALUATION', 'BAFO'],
            is_deleted=False,
        ).count()

    def get_rfp_proposals_received(self) -> int:
        """Count proposals received in current period."""
        period_start, period_end = self._get_period_dates('MTD')

        return Proposal.objects.filter(
            rfp__organization=self.organization,
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_REQUESTED', 'BAFO_SUBMITTED', 'AWARDED'],
            submitted_at__date__gte=period_start,
            submitted_at__date__lte=period_end,
        ).count()

    def get_rfp_avg_evaluation_score(self) -> Decimal:
        """Calculate average evaluation score across all proposals."""
        period_start, period_end = self._get_period_dates('MTD')

        result = EvaluationScore.objects.filter(
            proposal__rfp__organization=self.organization,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
        ).aggregate(avg_score=Avg('score'))

        return Decimal(str(result['avg_score'] or 0)).quantize(Decimal('0.01'))

    def get_rfp_bafo_rounds_active(self) -> int:
        """Count active BAFO rounds."""
        return BAFORound.objects.filter(
            rfp__organization=self.organization,
            status='OPEN',
        ).count()

    def get_rfp_time_to_award_avg(self) -> Decimal:
        """
        Calculate average time from RFP publish to award in days.
        """
        period_start, period_end = self._get_period_dates('YTD')

        awarded_rfps = RFP.objects.filter(
            organization=self.organization,
            status='AWARDED',
            awarded_date__date__gte=period_start,
            awarded_date__date__lte=period_end,
            publish_date__isnull=False,
            is_deleted=False,
        )

        if not awarded_rfps.exists():
            return Decimal('0.00')

        total_days = Decimal('0.00')
        count = 0

        for rfp in awarded_rfps:
            if rfp.publish_date and rfp.awarded_date:
                cycle_time = (rfp.awarded_date - rfp.publish_date).total_seconds() / 86400
                total_days += Decimal(str(cycle_time))
                count += 1

        if count == 0:
            return Decimal('0.00')

        return round(total_days / count, 2)

    def get_rfp_supplier_response_rate(self) -> Decimal:
        """
        Calculate supplier response rate for RFP invitations.
        (Proposals submitted / Invitations sent) * 100
        """
        period_start, period_end = self._get_period_dates('MTD')

        from apps.rfps.models import RFPInvitation

        invitations = RFPInvitation.objects.filter(
            rfp__organization=self.organization,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
        )

        total_invitations = invitations.count()
        if total_invitations == 0:
            return Decimal('100.00')

        responded = invitations.filter(
            status__in=['PROPOSAL_SUBMITTED', 'DECLINED']
        ).count()

        return round((Decimal(responded) / Decimal(total_invitations)) * 100, 2)

    def get_rfp_evaluation_completion_rate(self) -> Decimal:
        """
        Calculate evaluation completion rate.
        (Completed evaluations / Total required evaluations) * 100
        """
        from apps.rfps.models import EvaluationTeam

        # Get RFPs in evaluation status
        evaluation_rfps = RFP.objects.filter(
            organization=self.organization,
            status__in=['EVALUATION', 'BAFO', 'CLOSED'],
            is_deleted=False,
        )

        if not evaluation_rfps.exists():
            return Decimal('100.00')

        total_required = 0
        total_completed = 0

        for rfp in evaluation_rfps:
            # Count evaluation team members
            evaluators = EvaluationTeam.objects.filter(rfp=rfp).count()
            proposals = Proposal.objects.filter(
                rfp=rfp,
                status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED', 'AWARDED']
            ).count()

            # Total evaluations required = evaluators * proposals
            required = evaluators * proposals
            total_required += required

            # Count completed evaluations (scores submitted)
            completed = EvaluationScore.objects.filter(
                proposal__rfp=rfp,
                score__isnull=False,
            ).count()
            total_completed += completed

        if total_required == 0:
            return Decimal('100.00')

        return round((Decimal(total_completed) / Decimal(total_required)) * 100, 2)

    def get_rfp_awarded_value_mtd(self) -> Decimal:
        """Calculate total value of awarded RFPs month-to-date."""
        period_start, period_end = self._get_period_dates('MTD')

        awarded_proposals = Proposal.objects.filter(
            rfp__organization=self.organization,
            status='AWARDED',
            rfp__awarded_date__date__gte=period_start,
            rfp__awarded_date__date__lte=period_end,
        )

        # total_amount is a property, so we aggregate line_items instead
        result = awarded_proposals.aggregate(total=Sum('line_items__extended_price'))
        return result['total'] or Decimal('0.00')

    def get_rfp_awarded_value_ytd(self) -> Decimal:
        """Calculate total value of awarded RFPs year-to-date."""
        period_start, period_end = self._get_period_dates('YTD')

        awarded_proposals = Proposal.objects.filter(
            rfp__organization=self.organization,
            status='AWARDED',
            rfp__awarded_date__date__gte=period_start,
            rfp__awarded_date__date__lte=period_end,
        )

        # total_amount is a property, so we aggregate line_items instead
        result = awarded_proposals.aggregate(total=Sum('line_items__extended_price'))
        return result['total'] or Decimal('0.00')

    # =========================================================================
    # APPROVAL KPIs
    # =========================================================================

    def get_pending_approvals(self) -> int:
        """
        Count items awaiting approval across all modules.
        """
        pending_requisitions = Requisition.objects.filter(
            organization=self.organization,
            status='SUBMITTED',
            is_deleted=False,
        ).count()

        pending_pos = PurchaseOrder.objects.filter(
            organization=self.organization,
            status='SUBMITTED',
            is_deleted=False,
        ).count()

        pending_invoices = Invoice.objects.filter(
            organization=self.organization,
            status='MATCHED',  # Invoices awaiting approval after matching
            is_deleted=False,
        ).count()

        return pending_requisitions + pending_pos + pending_invoices

    # =========================================================================
    # CYCLE TIME KPIs
    # =========================================================================

    def get_avg_po_cycle_time(self) -> Decimal:
        """
        Calculate average PO cycle time in days.

        Time from submission to approval.
        """
        period_start, period_end = self._get_period_dates('MTD')

        # Get approved POs with both timestamps
        approved_pos = PurchaseOrder.objects.filter(
            organization=self.organization,
            status__in=['APPROVED', 'SENT', 'RECEIVED', 'COMPLETED'],
            submitted_at__isnull=False,
            approved_at__isnull=False,
            approved_at__date__gte=period_start,
            approved_at__date__lte=period_end,
            is_deleted=False,
        )

        if not approved_pos.exists():
            return Decimal('0.00')

        # Calculate average cycle time in days
        total_days = Decimal('0.00')
        count = 0

        for po in approved_pos:
            cycle_time = (po.approved_at - po.submitted_at).total_seconds() / 86400
            total_days += Decimal(str(cycle_time))
            count += 1

        if count == 0:
            return Decimal('0.00')

        avg_days = total_days / count
        return round(avg_days, 2)

    # =========================================================================
    # SUPPLIER KPIs
    # =========================================================================

    def get_avg_supplier_performance(self) -> Decimal:
        """
        Calculate supplier performance metric.

        Note: Supplier model doesn't have score fields, so we calculate
        based on approved supplier count as a simple metric.
        """
        approved_count = Supplier.objects.filter(
            organization=self.organization,
            status='APPROVED',
            is_deleted=False,
        ).count()

        # Return as a simple "health" score - more approved suppliers = better
        # Scale: 10 points per supplier, capped at 100
        return Decimal(str(min(approved_count * 10, 100)))

    def get_on_time_delivery_rate(self) -> Decimal:
        """
        Calculate on-time delivery rate percentage.

        Based on goods receipts vs expected delivery dates.
        """
        period_start, period_end = self._get_period_dates('MTD')

        # Get goods receipts in the period
        receipts = GoodsReceipt.objects.filter(
            organization=self.organization,
            status='POSTED',
            posted_at__date__gte=period_start,
            posted_at__date__lte=period_end,
            is_deleted=False,
        )

        total_receipts = receipts.count()
        if total_receipts == 0:
            return Decimal('100.00')  # 100% if no receipts

        # Count on-time receipts (receipt date <= expected delivery)
        on_time_count = 0
        for receipt in receipts:
            po = receipt.purchase_order
            # If PO has expected delivery date and receipt was on or before it
            if hasattr(po, 'expected_delivery_date') and po.expected_delivery_date:
                if receipt.receipt_date <= po.expected_delivery_date:
                    on_time_count += 1
            else:
                # No expected date, consider it on-time
                on_time_count += 1

        rate = (Decimal(on_time_count) / Decimal(total_receipts)) * 100
        return round(rate, 2)

    # =========================================================================
    # INVOICE KPIs
    # =========================================================================

    def get_invoice_match_rate(self) -> Decimal:
        """
        Calculate invoice auto-match rate percentage.

        Percentage of invoices that matched automatically vs manually.
        """
        period_start, period_end = self._get_period_dates('MTD')

        # Get matched invoices in the period
        matched_invoices = Invoice.objects.filter(
            organization=self.organization,
            status__in=['MATCHED', 'APPROVED', 'PAID'],
            matched_at__date__gte=period_start,
            matched_at__date__lte=period_end,
            is_deleted=False,
        )

        total_matched = matched_invoices.count()
        if total_matched == 0:
            return Decimal('100.00')

        auto_matched = matched_invoices.filter(match_type='AUTO').count()

        rate = (Decimal(auto_matched) / Decimal(total_matched)) * 100
        return round(rate, 2)

    # =========================================================================
    # AGGREGATE METHODS
    # =========================================================================

    def calculate_all_kpis(self) -> dict:
        """
        Calculate all KPIs and return as dict.

        Returns:
            Dict with KPI type as key and calculated value.
        """
        return {
            # Core KPIs
            'TOTAL_SPEND_MTD': self.get_total_spend_mtd(),
            'TOTAL_SPEND_YTD': self.get_total_spend_ytd(),
            'BUDGET_UTILIZATION': self.get_budget_utilization(),
            'CONTRACT_COMPLIANCE': self.get_contract_compliance(),
            'MAVERICK_SPEND': self.get_maverick_spend(),
            'OPEN_RFX_COUNT': self.get_open_rfx_count(),
            'PENDING_APPROVALS': self.get_pending_approvals(),
            'AVG_PO_CYCLE_TIME': self.get_avg_po_cycle_time(),
            'SUPPLIER_PERFORMANCE_AVG': self.get_avg_supplier_performance(),
            'EXPIRING_CONTRACTS_90D': self.get_expiring_contracts_90d(),
            'INVOICE_MATCH_RATE': self.get_invoice_match_rate(),
            'ON_TIME_DELIVERY_RATE': self.get_on_time_delivery_rate(),
            # RFP-specific KPIs
            'RFP_OPEN_COUNT': self.get_rfp_open_count(),
            'RFP_PROPOSALS_RECEIVED': self.get_rfp_proposals_received(),
            'RFP_AVG_EVALUATION_SCORE': self.get_rfp_avg_evaluation_score(),
            'RFP_BAFO_ROUNDS_ACTIVE': self.get_rfp_bafo_rounds_active(),
            'RFP_TIME_TO_AWARD_AVG': self.get_rfp_time_to_award_avg(),
            'RFP_SUPPLIER_RESPONSE_RATE': self.get_rfp_supplier_response_rate(),
            'RFP_EVALUATION_COMPLETION_RATE': self.get_rfp_evaluation_completion_rate(),
            'RFP_AWARDED_VALUE_MTD': self.get_rfp_awarded_value_mtd(),
            'RFP_AWARDED_VALUE_YTD': self.get_rfp_awarded_value_ytd(),
        }

    def save_kpi_snapshot(self, kpi_type: str, value, period_type: str = 'MTD') -> DashboardKPI:
        """
        Save a KPI value to the database.

        Args:
            kpi_type: The KPI type constant.
            value: The calculated value.
            period_type: 'MTD' or 'YTD'.

        Returns:
            The created or updated DashboardKPI instance.
        """
        period_start, period_end = self._get_period_dates(period_type)

        # Determine value field based on KPI type
        numeric_kpis = [
            'TOTAL_SPEND_MTD', 'TOTAL_SPEND_YTD', 'AVG_PO_CYCLE_TIME', 'SUPPLIER_PERFORMANCE_AVG',
            'RFP_AVG_EVALUATION_SCORE', 'RFP_TIME_TO_AWARD_AVG',
            'RFP_AWARDED_VALUE_MTD', 'RFP_AWARDED_VALUE_YTD',
        ]
        percentage_kpis = [
            'BUDGET_UTILIZATION', 'CONTRACT_COMPLIANCE', 'MAVERICK_SPEND',
            'INVOICE_MATCH_RATE', 'ON_TIME_DELIVERY_RATE',
            'RFP_SUPPLIER_RESPONSE_RATE', 'RFP_EVALUATION_COMPLETION_RATE',
        ]
        count_kpis = [
            'OPEN_RFX_COUNT', 'PENDING_APPROVALS', 'EXPIRING_CONTRACTS_90D',
            'RFP_OPEN_COUNT', 'RFP_PROPOSALS_RECEIVED', 'RFP_BAFO_ROUNDS_ACTIVE',
        ]

        # Get or create the KPI record
        kpi, created = DashboardKPI.objects.update_or_create(
            organization=self.organization,
            kpi_type=kpi_type,
            period_start=period_start,
            period_end=period_end,
            defaults={
                'numeric_value': value if kpi_type in numeric_kpis else None,
                'percentage_value': value if kpi_type in percentage_kpis else None,
                'count_value': value if kpi_type in count_kpis else None,
            }
        )

        # Calculate change from previous period
        prev_start, prev_end = self._get_previous_period_dates(period_type)
        prev_kpi = DashboardKPI.objects.filter(
            organization=self.organization,
            kpi_type=kpi_type,
            period_start=prev_start,
            period_end=prev_end,
        ).first()

        if prev_kpi:
            kpi.calculate_change(prev_kpi.value)
            kpi.save()

        return kpi

    def save_all_kpi_snapshots(self) -> list[DashboardKPI]:
        """
        Calculate and save all KPIs to the database.

        Returns:
            List of created/updated DashboardKPI instances.
        """
        kpis = self.calculate_all_kpis()
        results = []

        # MTD KPIs
        mtd_kpis = [
            'TOTAL_SPEND_MTD', 'AVG_PO_CYCLE_TIME', 'INVOICE_MATCH_RATE',
            'ON_TIME_DELIVERY_RATE', 'OPEN_RFX_COUNT', 'PENDING_APPROVALS',
            # RFP MTD KPIs
            'RFP_OPEN_COUNT', 'RFP_PROPOSALS_RECEIVED', 'RFP_AVG_EVALUATION_SCORE',
            'RFP_BAFO_ROUNDS_ACTIVE', 'RFP_SUPPLIER_RESPONSE_RATE',
            'RFP_EVALUATION_COMPLETION_RATE', 'RFP_AWARDED_VALUE_MTD',
        ]

        # YTD KPIs
        ytd_kpis = [
            'TOTAL_SPEND_YTD', 'BUDGET_UTILIZATION', 'CONTRACT_COMPLIANCE',
            'MAVERICK_SPEND', 'SUPPLIER_PERFORMANCE_AVG', 'EXPIRING_CONTRACTS_90D',
            # RFP YTD KPIs
            'RFP_TIME_TO_AWARD_AVG', 'RFP_AWARDED_VALUE_YTD',
        ]

        for kpi_type, value in kpis.items():
            period_type = 'MTD' if kpi_type in mtd_kpis else 'YTD'
            kpi = self.save_kpi_snapshot(kpi_type, value, period_type)
            results.append(kpi)

        return results

    def get_kpi_trend(self, kpi_type: str, months: int = 12) -> list[dict]:
        """
        Get KPI trend data over time.

        Args:
            kpi_type: The KPI type to get trend for.
            months: Number of months of history to retrieve.

        Returns:
            List of dicts with period and value.
        """
        today = timezone.now().date()
        results = []

        for i in range(months - 1, -1, -1):
            # Calculate period dates for each month
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1

            period_start = date(year, month, 1)

            # Calculate end of month
            if month == 12:
                period_end = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                period_end = date(year, month + 1, 1) - timedelta(days=1)

            kpi = DashboardKPI.objects.filter(
                organization=self.organization,
                kpi_type=kpi_type,
                period_start=period_start,
                period_end__lte=period_end,
            ).order_by('-calculated_at').first()

            results.append({
                'period': period_start.strftime('%Y-%m'),
                'value': kpi.value if kpi else None,
                'change_percent': kpi.change_percent if kpi else None,
            })

        return results

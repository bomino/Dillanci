"""
Budget Utilization Service for budget analytics.

Provides budget utilization metrics and encumbrance tracking.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from django.db.models import F, Sum

from apps.budget.models import BudgetLine, Encumbrance, FiscalYear


class BudgetUtilizationService:
    """
    Service for analyzing budget utilization.

    Reports on budget line utilization and encumbrance aging.
    """

    def __init__(self, organization):
        """
        Initialize budget utilization service.

        Args:
            organization: The Organization instance to analyze.
        """
        self.organization = organization

    def get_fiscal_year_summary(
        self,
        fiscal_year_id: Optional[str] = None,
    ) -> dict:
        """
        Get budget summary for a fiscal year.

        Args:
            fiscal_year_id: Optional fiscal year UUID. If not provided, uses current open fiscal year.

        Returns:
            Dict with fiscal year budget summary.
        """
        if fiscal_year_id:
            fiscal_year = FiscalYear.objects.get(
                id=fiscal_year_id,
                organization=self.organization,
            )
        else:
            fiscal_year = FiscalYear.objects.filter(
                organization=self.organization,
                status='OPEN',
                is_deleted=False,
            ).first()

        if not fiscal_year:
            return {'error': 'No open fiscal year found'}

        budget_lines = BudgetLine.objects.filter(
            fiscal_year=fiscal_year,
            is_deleted=False,
        )

        totals = budget_lines.aggregate(
            total_allocated=Sum('allocated_amount'),
        )

        total_allocated = totals['total_allocated'] or Decimal('0.00')

        # Calculate encumbered amount
        total_encumbered = Encumbrance.objects.filter(
            budget_line__fiscal_year=fiscal_year,
            status='ACTIVE',
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Calculate liquidated/spent amount
        total_spent = Encumbrance.objects.filter(
            budget_line__fiscal_year=fiscal_year,
            status='LIQUIDATED',
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_committed = total_encumbered + total_spent
        available = total_allocated - total_committed
        utilization_pct = (
            (total_committed / total_allocated) * 100
            if total_allocated > 0
            else Decimal('0.00')
        )

        return {
            'fiscal_year': {
                'id': str(fiscal_year.id),
                'year': fiscal_year.year,
                'status': fiscal_year.status,
                'start_date': fiscal_year.start_date,
                'end_date': fiscal_year.end_date,
            },
            'totals': {
                'allocated': total_allocated,
                'encumbered': total_encumbered,
                'spent': total_spent,
                'committed': total_committed,
                'available': available,
                'utilization_percent': round(utilization_pct, 2),
            },
            'budget_line_count': budget_lines.count(),
        }

    def get_budget_line_details(
        self,
        fiscal_year_id: Optional[str] = None,
        include_inactive: bool = False,
    ) -> list[dict]:
        """
        Get detailed breakdown by budget line.

        Args:
            fiscal_year_id: Optional fiscal year UUID.
            include_inactive: Include frozen/closed budget lines.

        Returns:
            List of budget line details.
        """
        if fiscal_year_id:
            fiscal_year = FiscalYear.objects.get(
                id=fiscal_year_id,
                organization=self.organization,
            )
        else:
            fiscal_year = FiscalYear.objects.filter(
                organization=self.organization,
                status='OPEN',
                is_deleted=False,
            ).first()

        if not fiscal_year:
            return []

        budget_lines = BudgetLine.objects.filter(
            fiscal_year=fiscal_year,
            is_deleted=False,
        )

        if not include_inactive:
            budget_lines = budget_lines.filter(status='ACTIVE')

        results = []
        for bl in budget_lines:
            encumbered = bl.encumbered_amount
            available = bl.available_amount
            utilization = (
                ((bl.allocated_amount - available) / bl.allocated_amount) * 100
                if bl.allocated_amount > 0
                else Decimal('0.00')
            )

            results.append({
                'id': str(bl.id),
                'code': bl.code,
                'name': bl.name,
                'status': bl.status,
                'allocated': bl.allocated_amount,
                'encumbered': encumbered,
                'available': available,
                'utilization_percent': round(utilization, 2),
            })

        # Sort by utilization descending
        results.sort(key=lambda x: x['utilization_percent'], reverse=True)

        return results

    def get_encumbrance_aging(
        self,
        fiscal_year_id: Optional[str] = None,
    ) -> dict:
        """
        Get encumbrance aging analysis.

        Groups active encumbrances by age buckets.

        Args:
            fiscal_year_id: Optional fiscal year UUID.

        Returns:
            Dict with aging buckets.
        """
        from django.utils import timezone
        today = timezone.now().date()

        if fiscal_year_id:
            fiscal_year = FiscalYear.objects.get(
                id=fiscal_year_id,
                organization=self.organization,
            )
        else:
            fiscal_year = FiscalYear.objects.filter(
                organization=self.organization,
                status='OPEN',
                is_deleted=False,
            ).first()

        if not fiscal_year:
            return {'error': 'No open fiscal year found'}

        encumbrances = Encumbrance.objects.filter(
            budget_line__fiscal_year=fiscal_year,
            status='ACTIVE',
        )

        # Age buckets: 0-30, 31-60, 61-90, 90+ days
        buckets = {
            '0-30': {'count': 0, 'amount': Decimal('0.00')},
            '31-60': {'count': 0, 'amount': Decimal('0.00')},
            '61-90': {'count': 0, 'amount': Decimal('0.00')},
            '90+': {'count': 0, 'amount': Decimal('0.00')},
        }

        for enc in encumbrances:
            age = (today - enc.created_at.date()).days

            if age <= 30:
                bucket = '0-30'
            elif age <= 60:
                bucket = '31-60'
            elif age <= 90:
                bucket = '61-90'
            else:
                bucket = '90+'

            buckets[bucket]['count'] += 1
            buckets[bucket]['amount'] += enc.amount

        return {
            'fiscal_year_id': str(fiscal_year.id) if fiscal_year else None,
            'as_of_date': today,
            'aging_buckets': buckets,
            'total_encumbrances': encumbrances.count(),
            'total_encumbered': encumbrances.aggregate(total=Sum('amount'))['total'] or Decimal('0.00'),
        }

    def get_over_budget_lines(
        self,
        fiscal_year_id: Optional[str] = None,
        threshold_percent: Decimal = Decimal('90.00'),
    ) -> list[dict]:
        """
        Get budget lines at or above threshold utilization.

        Args:
            fiscal_year_id: Optional fiscal year UUID.
            threshold_percent: Utilization threshold (default 90%).

        Returns:
            List of budget lines over threshold.
        """
        all_lines = self.get_budget_line_details(fiscal_year_id)

        return [
            line for line in all_lines
            if line['utilization_percent'] >= threshold_percent
        ]

    def execute(
        self,
        filters: dict,
        columns: Optional[list] = None,
        group_by: Optional[list] = None,
    ) -> dict:
        """
        Execute budget utilization report with given parameters.

        Args:
            filters: Dict of filter parameters.
            columns: List of columns to include.
            group_by: Not used for this report type.

        Returns:
            Dict with report data.
        """
        fiscal_year_id = filters.get('fiscal_year_id')
        include_aging = filters.get('include_aging', True)

        results = {
            'summary': self.get_fiscal_year_summary(fiscal_year_id),
            'budget_lines': self.get_budget_line_details(fiscal_year_id),
        }

        if include_aging:
            results['aging'] = self.get_encumbrance_aging(fiscal_year_id)

        results['over_budget'] = self.get_over_budget_lines(fiscal_year_id)

        return results

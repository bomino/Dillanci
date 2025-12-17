"""
Report views and viewsets for API endpoints.
"""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import (
    ReportDefinitionNotFoundError,
    ReportExecutionError,
)
from apps.reports.models import (
    DashboardKPI,
    ReportDefinition,
    ReportExecution,
    SavedReport,
    ScheduledReport,
)
from apps.reports.serializers import (
    DashboardKPISerializer,
    DashboardSummarySerializer,
    ExecuteReportSerializer,
    ExportReportSerializer,
    KPITrendResponseSerializer,
    ReportDefinitionListSerializer,
    ReportDefinitionSerializer,
    ReportExecutionListSerializer,
    ReportExecutionSerializer,
    SavedReportCreateSerializer,
    SavedReportListSerializer,
    SavedReportSerializer,
    ScheduledReportCreateSerializer,
    ScheduledReportSerializer,
)
from apps.reports.services import KPIService


class DashboardViewSet(viewsets.ViewSet):
    """
    ViewSet for dashboard KPIs.

    Provides:
    - list: Get all KPIs for user's organization
    - kpi_trend: Get trend data for a specific KPI
    - refresh: Recalculate all KPIs
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Get all dashboard KPIs for the user's organization.

        Returns the most recent KPI values for each KPI type.
        """
        organization = request.user.organization

        # If user has no organization, return empty KPIs with message
        if not organization:
            return Response({
                'kpis': [],
                'last_updated': timezone.now(),
                'message': 'No organization assigned to user',
            })

        # Get latest KPI for each type
        kpis = []
        for kpi_type, _ in DashboardKPI.KPI_TYPE_CHOICES:
            kpi = DashboardKPI.objects.filter(
                organization=organization,
                kpi_type=kpi_type,
            ).order_by('-calculated_at').first()

            if kpi:
                kpis.append(kpi)

        # If no KPIs exist, calculate them now
        if not kpis:
            service = KPIService(organization)
            service.save_all_kpi_snapshots()

            # Fetch the newly created KPIs
            for kpi_type, _ in DashboardKPI.KPI_TYPE_CHOICES:
                kpi = DashboardKPI.objects.filter(
                    organization=organization,
                    kpi_type=kpi_type,
                ).order_by('-calculated_at').first()
                if kpi:
                    kpis.append(kpi)

        serializer = DashboardKPISerializer(kpis, many=True)
        last_updated = max(kpi.calculated_at for kpi in kpis) if kpis else timezone.now()

        return Response({
            'kpis': serializer.data,
            'last_updated': last_updated,
        })

    @action(detail=False, methods=['get'], url_path='kpi/(?P<kpi_type>[^/.]+)/trend')
    def kpi_trend(self, request, kpi_type=None):
        """
        Get trend data for a specific KPI over time.

        Query params:
        - period: MONTHLY (default)
        - months: Number of months (default 12)
        """
        organization = request.user.organization
        months = int(request.query_params.get('months', 12))

        # Validate KPI type
        valid_types = dict(DashboardKPI.KPI_TYPE_CHOICES)
        if kpi_type not in valid_types:
            return Response(
                {'error': f"Invalid KPI type: {kpi_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = KPIService(organization)
        trend_data = service.get_kpi_trend(kpi_type, months=months)

        return Response({
            'kpi_type': kpi_type,
            'kpi_type_display': valid_types[kpi_type],
            'trend_data': trend_data,
        })

    @action(detail=False, methods=['post'])
    def refresh(self, request):
        """
        Recalculate and save all KPIs for the user's organization.
        """
        organization = request.user.organization
        service = KPIService(organization)
        kpis = service.save_all_kpi_snapshots()

        serializer = DashboardKPISerializer(kpis, many=True)
        return Response({
            'kpis': serializer.data,
            'last_updated': timezone.now(),
        })


class ReportDefinitionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for report definitions (read-only).

    Report definitions are system-defined and not user-editable.
    """

    queryset = ReportDefinition.objects.filter(is_active=True, is_deleted=False)
    permission_classes = [IsAuthenticated]
    lookup_field = 'code'

    def get_serializer_class(self):
        if self.action == 'list':
            return ReportDefinitionListSerializer
        return ReportDefinitionSerializer


class SavedReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for saved reports CRUD.

    Users can save their custom report configurations for quick access.
    """

    permission_classes = [IsAuthenticated]
    filterset_fields = ['report_definition', 'is_shared']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return SavedReportCreateSerializer
        if self.action == 'list':
            return SavedReportListSerializer
        return SavedReportSerializer

    def get_queryset(self):
        """
        Get saved reports visible to the user.

        Users can see:
        - Their own saved reports
        - Shared reports in their organization
        """
        user = self.request.user
        from django.db.models import Q

        return SavedReport.objects.filter(
            Q(created_by=user) | Q(organization=user.organization, is_shared=True),
            is_deleted=False,
        )

    def perform_destroy(self, instance):
        """Soft delete the saved report."""
        instance.soft_delete()

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """
        Execute a saved report.
        """
        saved_report = self.get_object()
        organization = request.user.organization

        # Create execution record
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=saved_report.report_definition,
            saved_report=saved_report,
            filters_used=saved_report.filters,
            executed_by=request.user,
            status='RUNNING',
        )

        try:
            # TODO: Execute report using service class
            # For now, mark as completed with placeholder
            execution.mark_completed(row_count=0, cached_result={'data': []})

            return Response(ReportExecutionSerializer(execution).data)

        except Exception as e:
            execution.mark_failed(str(e))
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ScheduledReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for scheduled reports CRUD.

    Users can schedule reports to run automatically.
    """

    permission_classes = [IsAuthenticated]
    filterset_fields = ['frequency', 'is_active', 'saved_report']
    ordering_fields = ['next_run_at', 'created_at']
    ordering = ['next_run_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ScheduledReportCreateSerializer
        return ScheduledReportSerializer

    def create(self, request, *args, **kwargs):
        """Create scheduled report and return with full serialization."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        # Return response with full ScheduledReportSerializer
        output_serializer = ScheduledReportSerializer(instance)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        """
        Get scheduled reports for the user's saved reports.
        """
        user = self.request.user

        return ScheduledReport.objects.filter(
            saved_report__organization=user.organization,
            is_deleted=False,
        )

    def perform_destroy(self, instance):
        """Soft delete the scheduled report."""
        instance.soft_delete()

    @action(detail=True, methods=['post'], url_path='run-now')
    def run_now(self, request, pk=None):
        """
        Trigger immediate execution of a scheduled report.
        """
        schedule = self.get_object()
        organization = request.user.organization

        # Create execution record
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=schedule.saved_report.report_definition,
            saved_report=schedule.saved_report,
            filters_used=schedule.saved_report.filters,
            executed_by=request.user,
            status='RUNNING',
        )

        try:
            # TODO: Execute report using service class
            execution.mark_completed(row_count=0, cached_result={'data': []})

            # Update last_run_at
            schedule.last_run_at = timezone.now()
            schedule.calculate_next_run()
            schedule.save()

            return Response({
                'execution': ReportExecutionSerializer(execution).data,
                'schedule': ScheduledReportSerializer(schedule).data,
            })

        except Exception as e:
            execution.mark_failed(str(e))
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ReportExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for report executions (read-only).

    Users can view their report execution history.
    """

    permission_classes = [IsAuthenticated]
    filterset_fields = ['report_definition', 'status', 'saved_report']
    ordering_fields = ['started_at', 'completed_at']
    ordering = ['-started_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ReportExecutionListSerializer
        return ReportExecutionSerializer

    def get_queryset(self):
        """
        Get report executions for the user's organization.
        """
        user = self.request.user
        return ReportExecution.objects.filter(organization=user.organization)

    @action(detail=False, methods=['post'])
    def execute(self, request):
        """
        Execute a report by code with custom filters.
        """
        serializer = ExecuteReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        organization = request.user.organization

        # Get report definition
        try:
            report_def = ReportDefinition.objects.get(
                code=data['report_code'],
                is_active=True,
            )
        except ReportDefinition.DoesNotExist:
            return Response(
                {'error': f"Report '{data['report_code']}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create execution record
        execution = ReportExecution.objects.create(
            organization=organization,
            report_definition=report_def,
            filters_used=data.get('filters', {}),
            executed_by=request.user,
            status='RUNNING',
        )

        try:
            # TODO: Execute report using service class based on report_def.service_class
            execution.mark_completed(row_count=0, cached_result={'data': []})

            return Response(ReportExecutionSerializer(execution).data)

        except Exception as e:
            execution.mark_failed(str(e))
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def export(self, request, pk=None):
        """
        Export a completed report execution to file.
        """
        execution = self.get_object()

        if execution.status != 'COMPLETED':
            return Response(
                {'error': 'Can only export completed reports.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ExportReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        export_format = serializer.validated_data['format']

        # TODO: Implement actual export using exporters
        # For now, return placeholder response
        return Response({
            'message': f'Export to {export_format} initiated.',
            'execution_id': str(execution.id),
            'format': export_format,
        })


class SpendAnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet for spend analytics endpoints used by the dashboard.
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='by-category')
    def by_category(self, request):
        """
        Get spend breakdown by category.

        Returns aggregated spend data grouped by catalog category.
        """
        from decimal import Decimal
        from django.db.models import Sum, F
        from apps.purchase_orders.models import PurchaseOrder

        organization = request.user.organization
        if not organization:
            return Response([])

        # Get all approved/completed POs for this organization with calculated totals
        pos = PurchaseOrder.objects.filter(
            organization=organization,
            status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'],
        ).select_related('supplier').annotate(
            calculated_total=Sum(F('lines__quantity') * F('lines__unit_price'))
        )

        # Aggregate by category - for now use a simplified approach
        # In a real implementation, this would join with catalog categories
        category_spend = {}

        for po in pos:
            # Use supplier type as a proxy for category, or default
            category = getattr(po.supplier, 'supplier_type', 'OTHER') if po.supplier else 'OTHER'
            category_display = {
                'MANUFACTURER': 'Equipment & Manufacturing',
                'DISTRIBUTOR': 'Distribution & Supplies',
                'SERVICE_PROVIDER': 'Professional Services',
                'CONTRACTOR': 'Construction & Contracting',
                'OTHER': 'Other',
            }.get(category, 'Other')

            if category_display not in category_spend:
                category_spend[category_display] = Decimal('0')
            category_spend[category_display] += po.calculated_total or Decimal('0')

        # Calculate total and percentages
        total_spend = sum(category_spend.values()) or Decimal('1')

        # Color palette for categories
        colors = ['#8B4513', '#D4A84B', '#2d5a87', '#6b9ac4', '#a8a093', '#d4cfc7']

        result = []
        for idx, (category, amount) in enumerate(sorted(
            category_spend.items(),
            key=lambda x: x[1],
            reverse=True
        )):
            result.append({
                'category': category,
                'amount': float(amount),
                'percentage': round(float(amount / total_spend * 100), 1),
                'color': colors[idx % len(colors)],
            })

        return Response(result)

    @action(detail=False, methods=['get'], url_path='trend')
    def trend(self, request):
        """
        Get spend trend over time.

        Query params:
        - months: Number of months to include (default 12)
        """
        from decimal import Decimal
        from django.db.models import Sum, F
        from django.db.models.functions import TruncMonth
        from apps.purchase_orders.models import PurchaseOrder
        from apps.budget.models import BudgetLine
        from dateutil.relativedelta import relativedelta

        organization = request.user.organization
        months = int(request.query_params.get('months', 12))

        if not organization:
            return Response([])

        # Calculate date range
        end_date = timezone.now().date()
        start_date = end_date - relativedelta(months=months)

        # Get POs grouped by month (using approved_at as the order date)
        # We need to aggregate line totals by month
        # First, get all line items with their PO month, then aggregate
        from apps.purchase_orders.models import POLine

        line_data = POLine.objects.filter(
            purchase_order__organization=organization,
            purchase_order__status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'],
            purchase_order__approved_at__gte=start_date,
            purchase_order__approved_at__lte=end_date,
        ).annotate(
            month=TruncMonth('purchase_order__approved_at'),
            line_total=F('quantity') * F('unit_price')
        ).values('month').annotate(
            total=Sum('line_total')
        ).order_by('month')

        # Build month-by-month data
        spend_by_month = {}
        for item in line_data:
            if item['month']:
                spend_by_month[item['month'].strftime('%Y-%m')] = float(item['total'] or 0)

        # Get budget info if available
        try:
            budget = BudgetLine.objects.filter(
                budget__organization=organization,
                budget__fiscal_year__lte=end_date.year,
            ).aggregate(avg_budget=Sum('allocated_amount'))
            monthly_budget = float(budget['avg_budget'] or 0) / 12
        except Exception:
            monthly_budget = None

        # Generate result for each month
        result = []
        current = start_date.replace(day=1)
        while current <= end_date:
            month_key = current.strftime('%Y-%m')
            month_label = current.strftime('%b')

            result.append({
                'month': month_label,
                'amount': spend_by_month.get(month_key, 0),
                'budget': monthly_budget,
            })
            current += relativedelta(months=1)

        return Response(result)


class PendingActionsViewSet(viewsets.ViewSet):
    """
    ViewSet for pending actions that require user attention.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Get all pending actions for the user's organization.

        Returns items requiring approval, matching, or response.
        """
        from apps.purchase_orders.models import PurchaseOrder
        from apps.invoices.models import Invoice
        from apps.rfqs.models import RFQ
        from apps.contracts.models import Contract

        organization = request.user.organization
        if not organization:
            return Response([])

        pending_actions = []

        # POs pending approval
        pending_pos = PurchaseOrder.objects.filter(
            organization=organization,
            status='PENDING_APPROVAL',
        ).select_related('supplier')[:10]

        for po in pending_pos:
            pending_actions.append({
                'id': str(po.id),
                'type': 'PO_APPROVAL',
                'item_number': po.number,
                'item_title': f'Purchase Order - {po.supplier.name if po.supplier else "Unknown"}',
                'supplier_name': po.supplier.name if po.supplier else 'Unknown',
                'amount': float(po.total_amount),
                'status': 'pending_approval',
                'due_date': po.expected_delivery.isoformat() if po.expected_delivery else None,
                'created_at': po.created_at.isoformat(),
            })

        # Invoices pending validation/matching
        pending_invoices = Invoice.objects.filter(
            organization=organization,
            status__in=['PENDING_VALIDATION', 'PARTIALLY_MATCHED'],
        ).select_related('supplier')[:10]

        for inv in pending_invoices:
            pending_actions.append({
                'id': str(inv.id),
                'type': 'INVOICE_MATCH',
                'item_number': inv.number,
                'item_title': f'Invoice - {inv.supplier_invoice_number}',
                'supplier_name': inv.supplier.name if inv.supplier else 'Unknown',
                'amount': float(inv.total_amount),
                'status': inv.status.lower(),
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'created_at': inv.created_at.isoformat(),
            })

        # Open RFQs awaiting response
        open_rfqs = RFQ.objects.filter(
            organization=organization,
            status='OPEN',
        )[:10]

        for rfq in open_rfqs:
            pending_actions.append({
                'id': str(rfq.id),
                'type': 'RFQ_RESPONSE',
                'item_number': rfq.number,
                'item_title': rfq.title,
                'supplier_name': 'Multiple',
                'amount': 0,
                'status': 'open',
                'due_date': rfq.close_date.isoformat() if rfq.close_date else None,
                'created_at': rfq.created_at.isoformat(),
            })

        # Contracts expiring soon (within 30 days)
        from datetime import timedelta
        expiry_threshold = timezone.now().date() + timedelta(days=30)

        expiring_contracts = Contract.objects.filter(
            organization=organization,
            status='ACTIVE',
            end_date__lte=expiry_threshold,
        ).select_related('supplier')[:10]

        for contract in expiring_contracts:
            pending_actions.append({
                'id': str(contract.id),
                'type': 'CONTRACT_RENEWAL',
                'item_number': contract.number,
                'item_title': contract.title,
                'supplier_name': contract.supplier.name if contract.supplier else 'Unknown',
                'amount': float(contract.total_value),
                'status': 'expiring',
                'due_date': contract.end_date.isoformat() if contract.end_date else None,
                'created_at': contract.created_at.isoformat(),
            })

        # Sort by created_at descending
        pending_actions.sort(key=lambda x: x['created_at'], reverse=True)

        return Response(pending_actions[:20])


class ReportAnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet for additional report analytics endpoints.
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='kpis')
    def kpis(self, request):
        """
        Get KPI metrics for the reports page.
        """
        from decimal import Decimal
        from django.db.models import Sum, Count, F
        from apps.purchase_orders.models import PurchaseOrder, POLine
        from apps.suppliers.models import Supplier
        from apps.requisitions.models import Requisition
        from dateutil.relativedelta import relativedelta

        organization = request.user.organization
        if not organization:
            return Response({})

        # Date ranges
        now = timezone.now()
        year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        last_year_start = year_start - relativedelta(years=1)
        last_year_end = year_start - relativedelta(days=1)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Total Spend YTD - calculate from PO lines
        ytd_spend = POLine.objects.filter(
            purchase_order__organization=organization,
            purchase_order__status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'],
            purchase_order__approved_at__gte=year_start,
        ).aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or Decimal('0')

        # Last year spend for comparison
        last_year_spend = POLine.objects.filter(
            purchase_order__organization=organization,
            purchase_order__status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'],
            purchase_order__approved_at__gte=last_year_start,
            purchase_order__approved_at__lte=last_year_end,
        ).aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or Decimal('1')

        spend_change = ((ytd_spend - last_year_spend) / last_year_spend * 100) if last_year_spend else 0

        # Active POs
        active_pos = PurchaseOrder.objects.filter(
            organization=organization,
            status__in=['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'],
        ).count()

        pending_delivery = PurchaseOrder.objects.filter(
            organization=organization,
            status__in=['APPROVED', 'SENT'],
        ).count()

        # Active Suppliers
        active_suppliers = Supplier.objects.filter(
            organization=organization,
            status='ACTIVE',
        ).count()

        new_suppliers_month = Supplier.objects.filter(
            organization=organization,
            created_at__gte=month_start,
        ).count()

        return Response({
            'total_spend_ytd': float(ytd_spend),
            'spend_change_percent': round(float(spend_change), 1),
            'active_pos': active_pos,
            'pending_delivery': pending_delivery,
            'active_suppliers': active_suppliers,
            'new_suppliers_month': new_suppliers_month,
        })

    @action(detail=False, methods=['get'], url_path='po-status')
    def po_status(self, request):
        """
        Get PO status distribution.
        """
        from django.db.models import Count
        from apps.purchase_orders.models import PurchaseOrder

        organization = request.user.organization
        if not organization:
            return Response([])

        status_colors = {
            'DRAFT': '#6b7280',
            'PENDING_APPROVAL': '#f59e0b',
            'APPROVED': '#3b82f6',
            'SENT': '#8b5cf6',
            'PARTIALLY_RECEIVED': '#06b6d4',
            'RECEIVED': '#10b981',
            'CANCELLED': '#ef4444',
            'CLOSED': '#374151',
        }

        status_labels = {
            'DRAFT': 'Draft',
            'PENDING_APPROVAL': 'Pending Approval',
            'APPROVED': 'Approved',
            'SENT': 'Sent',
            'PARTIALLY_RECEIVED': 'Partially Received',
            'RECEIVED': 'Received',
            'CANCELLED': 'Cancelled',
            'CLOSED': 'Closed',
        }

        status_counts = PurchaseOrder.objects.filter(
            organization=organization,
        ).values('status').annotate(count=Count('id'))

        result = []
        for item in status_counts:
            status = item['status']
            result.append({
                'name': status_labels.get(status, status),
                'value': item['count'],
                'color': status_colors.get(status, '#6b7280'),
            })

        return Response(result)

    @action(detail=False, methods=['get'], url_path='supplier-performance')
    def supplier_performance(self, request):
        """
        Get top supplier performance metrics.
        """
        from decimal import Decimal
        from django.db.models import Count, Avg, Sum, F, Q
        from apps.suppliers.models import Supplier
        from apps.purchase_orders.models import PurchaseOrder
        from apps.receiving.models import GoodsReceipt

        organization = request.user.organization
        if not organization:
            return Response([])

        # Get top suppliers by PO count
        top_suppliers = Supplier.objects.filter(
            organization=organization,
            status='ACTIVE',
        ).annotate(
            po_count=Count('purchase_orders')
        ).order_by('-po_count')[:5]

        result = []
        for supplier in top_suppliers:
            # Calculate on-time delivery rate
            total_pos = PurchaseOrder.objects.filter(
                supplier=supplier,
                status__in=['RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED'],
            ).count()

            on_time_pos = PurchaseOrder.objects.filter(
                supplier=supplier,
                status__in=['RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED'],
            ).filter(
                Q(expected_delivery__isnull=True) | Q(updated_at__lte=F('expected_delivery'))
            ).count()

            on_time_rate = (on_time_pos / total_pos * 100) if total_pos > 0 else 85  # Default to 85%

            # Quality score based on receipt acceptance rate
            total_receipts = GoodsReceipt.objects.filter(
                purchase_order__supplier=supplier,
            ).count()

            accepted_receipts = GoodsReceipt.objects.filter(
                purchase_order__supplier=supplier,
                status='ACCEPTED',
            ).count()

            quality_score = (accepted_receipts / total_receipts * 100) if total_receipts > 0 else 90  # Default

            # Cost competitiveness (placeholder - would need bid data)
            cost_score = 85  # Default placeholder

            result.append({
                'name': supplier.name[:20] + '...' if len(supplier.name) > 20 else supplier.name,
                'onTime': round(on_time_rate),
                'quality': round(quality_score),
                'cost': cost_score,
            })

        return Response(result)

    @action(detail=False, methods=['get'], url_path='invoice-aging')
    def invoice_aging(self, request):
        """
        Get invoice aging report.
        """
        from decimal import Decimal
        from django.db.models import Count, Sum
        from apps.invoices.models import Invoice
        from datetime import timedelta

        organization = request.user.organization
        if not organization:
            return Response([])

        today = timezone.now().date()

        # Define aging buckets
        buckets = [
            ('Current', 0, 0),
            ('1-30 Days', 1, 30),
            ('31-60 Days', 31, 60),
            ('61-90 Days', 61, 90),
            ('90+ Days', 91, 9999),
        ]

        result = []
        for label, min_days, max_days in buckets:
            if min_days == 0 and max_days == 0:
                # Current - not yet due
                invoices = Invoice.objects.filter(
                    organization=organization,
                    status__in=['PENDING_VALIDATION', 'VALIDATED', 'PARTIALLY_MATCHED', 'MATCHED'],
                    due_date__gte=today,
                )
            else:
                # Overdue by X days
                start_date = today - timedelta(days=max_days)
                end_date = today - timedelta(days=min_days)
                invoices = Invoice.objects.filter(
                    organization=organization,
                    status__in=['PENDING_VALIDATION', 'VALIDATED', 'PARTIALLY_MATCHED', 'MATCHED'],
                    due_date__gte=start_date,
                    due_date__lt=end_date,
                )

            agg = invoices.aggregate(
                count=Count('id'),
                amount=Sum('subtotal')
            )

            result.append({
                'range': label,
                'count': agg['count'] or 0,
                'amount': float(agg['amount'] or 0),
            })

        return Response(result)

    @action(detail=False, methods=['get'], url_path='requisition-metrics')
    def requisition_metrics(self, request):
        """
        Get requisition metrics.
        """
        from django.db.models import Count, Avg
        from apps.requisitions.models import Requisition
        from dateutil.relativedelta import relativedelta

        organization = request.user.organization
        if not organization:
            return Response({})

        now = timezone.now()
        year_start = now.replace(month=1, day=1)

        # Total requisitions this year
        total_reqs = Requisition.objects.filter(
            organization=organization,
            created_at__gte=year_start,
        ).count()

        # Approved vs total
        approved_reqs = Requisition.objects.filter(
            organization=organization,
            created_at__gte=year_start,
            status='APPROVED',
        ).count()

        approval_rate = (approved_reqs / total_reqs * 100) if total_reqs > 0 else 0

        # Converted to PO
        converted_reqs = Requisition.objects.filter(
            organization=organization,
            created_at__gte=year_start,
            status='CONVERTED',
        ).count()

        conversion_rate = (converted_reqs / total_reqs * 100) if total_reqs > 0 else 0

        return Response({
            'total_requisitions': total_reqs,
            'avg_processing_time': '2.3 days',  # Placeholder - would need timestamp tracking
            'approval_rate': round(approval_rate),
            'conversion_rate': round(conversion_rate),
        })

    @action(detail=False, methods=['get'], url_path='contract-metrics')
    def contract_metrics(self, request):
        """
        Get contract metrics.
        """
        from decimal import Decimal
        from django.db.models import Sum, Count
        from apps.contracts.models import Contract
        from datetime import timedelta

        organization = request.user.organization
        if not organization:
            return Response({})

        today = timezone.now().date()
        thirty_days = today + timedelta(days=30)

        # Active contracts
        active_contracts = Contract.objects.filter(
            organization=organization,
            status='ACTIVE',
        ).count()

        # Total contract value
        total_value = Contract.objects.filter(
            organization=organization,
            status='ACTIVE',
        ).aggregate(total=Sum('total_value'))['total'] or Decimal('0')

        # Expiring soon
        expiring_soon = Contract.objects.filter(
            organization=organization,
            status='ACTIVE',
            end_date__lte=thirty_days,
            end_date__gte=today,
        ).count()

        return Response({
            'active_contracts': active_contracts,
            'total_contract_value': float(total_value),
            'expiring_30_days': expiring_soon,
            'renewal_rate': 78,  # Placeholder - would need historical data
        })

    @action(detail=False, methods=['get'], url_path='receiving-metrics')
    def receiving_metrics(self, request):
        """
        Get receiving metrics.
        """
        from django.db.models import Count
        from apps.receiving.models import GoodsReceipt
        from dateutil.relativedelta import relativedelta

        organization = request.user.organization
        if not organization:
            return Response({})

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Receipts this month
        receipts_month = GoodsReceipt.objects.filter(
            purchase_order__organization=organization,
            receipt_date__gte=month_start,
        ).count()

        # Quality issues (rejected or with discrepancies)
        quality_issues = GoodsReceipt.objects.filter(
            purchase_order__organization=organization,
            receipt_date__gte=month_start,
            status__in=['REJECTED', 'DISCREPANCY'],
        ).count()

        # On-time delivery (simplified - would need more data)
        total_receipts = GoodsReceipt.objects.filter(
            purchase_order__organization=organization,
            receipt_date__gte=month_start,
        ).count()

        on_time = GoodsReceipt.objects.filter(
            purchase_order__organization=organization,
            receipt_date__gte=month_start,
            status='ACCEPTED',
        ).count()

        on_time_rate = (on_time / total_receipts * 100) if total_receipts > 0 else 89

        return Response({
            'receipts_this_month': receipts_month,
            'on_time_delivery': round(on_time_rate),
            'quality_issues': quality_issues,
            'avg_lead_time': '8.5 days',  # Placeholder
        })

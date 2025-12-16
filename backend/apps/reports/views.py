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

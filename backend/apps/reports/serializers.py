"""
Report serializers for API endpoints.
"""

from rest_framework import serializers

from apps.reports.models import (
    DashboardKPI,
    ReportDefinition,
    ReportExecution,
    SavedReport,
    ScheduledReport,
)


# ============================================================================
# Report Definition Serializers
# ============================================================================

class ReportDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for report definitions."""

    report_type_display = serializers.CharField(
        source='get_report_type_display', read_only=True
    )

    class Meta:
        model = ReportDefinition
        fields = [
            'id',
            'code',
            'name',
            'report_type',
            'report_type_display',
            'description',
            'available_filters',
            'available_columns',
            'default_columns',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class ReportDefinitionListSerializer(serializers.ModelSerializer):
    """Compact serializer for listing report definitions."""

    report_type_display = serializers.CharField(
        source='get_report_type_display', read_only=True
    )

    class Meta:
        model = ReportDefinition
        fields = [
            'id',
            'code',
            'name',
            'report_type',
            'report_type_display',
            'description',
            'is_active',
        ]


# ============================================================================
# Saved Report Serializers
# ============================================================================

class SavedReportSerializer(serializers.ModelSerializer):
    """Serializer for saved reports."""

    report_definition_name = serializers.CharField(
        source='report_definition.name', read_only=True
    )
    report_definition_code = serializers.CharField(
        source='report_definition.code', read_only=True
    )
    created_by_email = serializers.EmailField(
        source='created_by.email', read_only=True
    )

    class Meta:
        model = SavedReport
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'report_definition',
            'report_definition_name',
            'report_definition_code',
            'created_by',
            'created_by_email',
            'filters',
            'columns',
            'is_shared',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'created_by', 'created_at', 'updated_at']


class SavedReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating saved reports."""

    class Meta:
        model = SavedReport
        fields = [
            'name',
            'description',
            'report_definition',
            'filters',
            'columns',
            'is_shared',
        ]

    def create(self, validated_data):
        """Create saved report with organization and user from context."""
        request = self.context.get('request')
        validated_data['organization'] = request.user.organization
        validated_data['created_by'] = request.user
        return super().create(validated_data)


class SavedReportListSerializer(serializers.ModelSerializer):
    """Compact serializer for listing saved reports."""

    report_definition_name = serializers.CharField(
        source='report_definition.name', read_only=True
    )

    class Meta:
        model = SavedReport
        fields = [
            'id',
            'name',
            'report_definition_name',
            'is_shared',
            'created_at',
        ]


# ============================================================================
# Scheduled Report Serializers
# ============================================================================

class ScheduledReportSerializer(serializers.ModelSerializer):
    """Serializer for scheduled reports."""

    saved_report_name = serializers.CharField(
        source='saved_report.name', read_only=True
    )
    frequency_display = serializers.CharField(
        source='get_frequency_display', read_only=True
    )
    export_format_display = serializers.CharField(
        source='get_export_format_display', read_only=True
    )

    class Meta:
        model = ScheduledReport
        fields = [
            'id',
            'saved_report',
            'saved_report_name',
            'frequency',
            'frequency_display',
            'day_of_week',
            'day_of_month',
            'time_of_day',
            'export_format',
            'export_format_display',
            'recipients',
            'is_active',
            'last_run_at',
            'next_run_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_run_at', 'next_run_at', 'created_at', 'updated_at']


class ScheduledReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating scheduled reports."""

    class Meta:
        model = ScheduledReport
        fields = [
            'saved_report',
            'frequency',
            'day_of_week',
            'day_of_month',
            'time_of_day',
            'export_format',
            'recipients',
            'is_active',
        ]

    def validate(self, data):
        """Validate schedule configuration."""
        frequency = data.get('frequency')
        day_of_week = data.get('day_of_week')
        day_of_month = data.get('day_of_month')

        if frequency == 'WEEKLY' and day_of_week is None:
            raise serializers.ValidationError({
                'day_of_week': 'Required for weekly schedules.'
            })

        if frequency == 'MONTHLY' and day_of_month is None:
            raise serializers.ValidationError({
                'day_of_month': 'Required for monthly schedules.'
            })

        if day_of_week is not None and (day_of_week < 0 or day_of_week > 6):
            raise serializers.ValidationError({
                'day_of_week': 'Must be between 0 (Monday) and 6 (Sunday).'
            })

        if day_of_month is not None and (day_of_month < 1 or day_of_month > 31):
            raise serializers.ValidationError({
                'day_of_month': 'Must be between 1 and 31.'
            })

        return data

    def create(self, validated_data):
        """Create scheduled report and calculate next run time."""
        schedule = super().create(validated_data)
        schedule.calculate_next_run()
        schedule.save()
        return schedule


# ============================================================================
# Report Execution Serializers
# ============================================================================

class ReportExecutionSerializer(serializers.ModelSerializer):
    """Serializer for report executions."""

    report_definition_name = serializers.CharField(
        source='report_definition.name', read_only=True
    )
    report_definition_code = serializers.CharField(
        source='report_definition.code', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    executed_by_email = serializers.EmailField(
        source='executed_by.email', read_only=True
    )

    class Meta:
        model = ReportExecution
        fields = [
            'id',
            'organization',
            'report_definition',
            'report_definition_name',
            'report_definition_code',
            'saved_report',
            'filters_used',
            'executed_by',
            'executed_by_email',
            'started_at',
            'completed_at',
            'status',
            'status_display',
            'row_count',
            'error_message',
            'result_file',
        ]
        read_only_fields = fields


class ReportExecutionListSerializer(serializers.ModelSerializer):
    """Compact serializer for listing report executions."""

    report_definition_name = serializers.CharField(
        source='report_definition.name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = ReportExecution
        fields = [
            'id',
            'report_definition_name',
            'status',
            'status_display',
            'row_count',
            'started_at',
            'completed_at',
        ]


class ExecuteReportSerializer(serializers.Serializer):
    """Serializer for report execution request."""

    report_code = serializers.CharField()
    filters = serializers.JSONField(required=False, default=dict)
    columns = serializers.JSONField(required=False, default=list)
    group_by = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    order_by = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )

    def validate_report_code(self, value):
        """Validate that report definition exists."""
        if not ReportDefinition.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError(
                f"Report definition '{value}' not found or inactive."
            )
        return value


class ExportReportSerializer(serializers.Serializer):
    """Serializer for report export request."""

    format = serializers.ChoiceField(choices=['EXCEL', 'CSV'])


# ============================================================================
# Dashboard KPI Serializers
# ============================================================================

class DashboardKPISerializer(serializers.ModelSerializer):
    """Serializer for dashboard KPIs."""

    kpi_type_display = serializers.CharField(
        source='get_kpi_type_display', read_only=True
    )
    value = serializers.SerializerMethodField()
    trend = serializers.SerializerMethodField()

    class Meta:
        model = DashboardKPI
        fields = [
            'id',
            'kpi_type',
            'kpi_type_display',
            'value',
            'numeric_value',
            'percentage_value',
            'count_value',
            'period_start',
            'period_end',
            'calculated_at',
            'previous_value',
            'change_percent',
            'trend',
        ]
        read_only_fields = fields

    def get_value(self, obj):
        """Get the appropriate value based on KPI type."""
        return obj.value

    def get_trend(self, obj):
        """Get trend direction."""
        return obj.trend


class DashboardSummarySerializer(serializers.Serializer):
    """Serializer for dashboard summary response."""

    kpis = DashboardKPISerializer(many=True)
    last_updated = serializers.DateTimeField()


class KPITrendSerializer(serializers.Serializer):
    """Serializer for KPI trend data."""

    period = serializers.CharField()
    value = serializers.DecimalField(max_digits=15, decimal_places=4, allow_null=True)
    change_percent = serializers.DecimalField(
        max_digits=7, decimal_places=2, allow_null=True
    )


class KPITrendResponseSerializer(serializers.Serializer):
    """Serializer for KPI trend response."""

    kpi_type = serializers.CharField()
    kpi_type_display = serializers.CharField()
    trend_data = KPITrendSerializer(many=True)

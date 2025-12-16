"""
Admin configuration for Report models.
"""

from django.contrib import admin

from apps.reports.models import (
    DashboardKPI,
    ReportDefinition,
    ReportExecution,
    SavedReport,
    ScheduledReport,
)


class ScheduledReportInline(admin.TabularInline):
    """Inline admin for ScheduledReport."""

    model = ScheduledReport
    extra = 0
    readonly_fields = ['last_run_at', 'next_run_at', 'created_at']
    fields = [
        'frequency',
        'day_of_week',
        'day_of_month',
        'time_of_day',
        'export_format',
        'recipients',
        'is_active',
        'last_run_at',
        'next_run_at',
    ]


@admin.register(ReportDefinition)
class ReportDefinitionAdmin(admin.ModelAdmin):
    """Admin configuration for ReportDefinition."""

    list_display = [
        'code',
        'name',
        'report_type',
        'is_active',
        'created_at',
    ]
    list_filter = ['report_type', 'is_active']
    search_fields = ['code', 'name', 'description']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        (None, {
            'fields': ('code', 'name', 'report_type', 'description', 'is_active')
        }),
        ('Configuration', {
            'fields': (
                'available_filters',
                'available_columns',
                'default_columns',
                'service_class',
            ),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(SavedReport)
class SavedReportAdmin(admin.ModelAdmin):
    """Admin configuration for SavedReport."""

    list_display = [
        'name',
        'report_definition',
        'organization',
        'created_by',
        'is_shared',
        'created_at',
    ]
    list_filter = ['is_shared', 'report_definition', 'organization']
    search_fields = ['name', 'description', 'report_definition__name']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ScheduledReportInline]

    fieldsets = (
        (None, {
            'fields': (
                'name',
                'description',
                'organization',
                'report_definition',
                'created_by',
                'is_shared',
            )
        }),
        ('Configuration', {
            'fields': ('filters', 'columns'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(ScheduledReport)
class ScheduledReportAdmin(admin.ModelAdmin):
    """Admin configuration for ScheduledReport."""

    list_display = [
        'saved_report',
        'frequency',
        'day_of_week',
        'day_of_month',
        'time_of_day',
        'export_format',
        'is_active',
        'last_run_at',
        'next_run_at',
    ]
    list_filter = ['frequency', 'export_format', 'is_active', 'saved_report__organization']
    search_fields = ['saved_report__name']
    readonly_fields = ['last_run_at', 'next_run_at', 'created_at', 'updated_at']

    fieldsets = (
        (None, {
            'fields': ('saved_report', 'is_active')
        }),
        ('Schedule', {
            'fields': (
                'frequency',
                'day_of_week',
                'day_of_month',
                'time_of_day',
            ),
        }),
        ('Delivery', {
            'fields': ('export_format', 'recipients'),
        }),
        ('Execution Status', {
            'fields': ('last_run_at', 'next_run_at'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(ReportExecution)
class ReportExecutionAdmin(admin.ModelAdmin):
    """Admin configuration for ReportExecution."""

    list_display = [
        'report_definition',
        'organization',
        'executed_by',
        'status',
        'row_count',
        'started_at',
        'completed_at',
    ]
    list_filter = ['status', 'report_definition', 'organization']
    search_fields = [
        'report_definition__name',
        'report_definition__code',
        'executed_by__email',
    ]
    readonly_fields = [
        'started_at',
        'completed_at',
        'status',
        'row_count',
        'error_message',
        'cache_key',
        'expires_at',
    ]

    fieldsets = (
        (None, {
            'fields': (
                'organization',
                'report_definition',
                'saved_report',
                'executed_by',
            )
        }),
        ('Execution Details', {
            'fields': (
                'status',
                'started_at',
                'completed_at',
                'row_count',
            ),
        }),
        ('Filters Used', {
            'fields': ('filters_used',),
        }),
        ('Results', {
            'fields': (
                'cached_result',
                'result_file',
                'error_message',
            ),
            'classes': ('collapse',),
        }),
        ('Cache', {
            'fields': ('cache_key', 'expires_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(DashboardKPI)
class DashboardKPIAdmin(admin.ModelAdmin):
    """Admin configuration for DashboardKPI."""

    list_display = [
        'kpi_type',
        'organization',
        'display_value',
        'period_start',
        'period_end',
        'change_percent',
        'calculated_at',
    ]
    list_filter = ['kpi_type', 'organization']
    search_fields = ['organization__name']
    readonly_fields = ['calculated_at']

    fieldsets = (
        (None, {
            'fields': ('organization', 'kpi_type')
        }),
        ('Period', {
            'fields': ('period_start', 'period_end'),
        }),
        ('Values', {
            'fields': (
                'numeric_value',
                'percentage_value',
                'count_value',
            ),
        }),
        ('Comparison', {
            'fields': (
                'previous_value',
                'change_percent',
            ),
        }),
        ('Metadata', {
            'fields': ('calculated_at',),
        }),
    )

    def display_value(self, obj):
        """Display the appropriate value based on KPI type."""
        value = obj.value
        if obj.percentage_value is not None:
            return f"{value}%"
        if obj.count_value is not None:
            return str(value)
        if obj.numeric_value is not None:
            return f"${value:,.2f}"
        return "-"
    display_value.short_description = 'Value'

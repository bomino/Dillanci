"""
Report models for storing report definitions, saved reports, and KPI snapshots.
"""

import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.core.models import SoftDeleteModel


class ReportDefinition(SoftDeleteModel):
    """
    System-defined report templates.

    Each definition describes a type of report with its available
    filters, columns, and the service class used to execute it.
    """

    REPORT_TYPE_CHOICES = [
        ('SPEND_ANALYSIS', 'Spend Analysis'),
        ('SUPPLIER_PERFORMANCE', 'Supplier Performance'),
        ('BUDGET_UTILIZATION', 'Budget Utilization'),
        ('PO_CYCLE_TIME', 'PO Cycle Time'),
        ('CONTRACT_EXPIRATION', 'Contract Expiration'),
        ('RFX_ANALYTICS', 'RFx Analytics'),
        ('INVOICE_MATCHING', 'Invoice Matching'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    report_type = models.CharField(max_length=30, choices=REPORT_TYPE_CHOICES)
    description = models.TextField(blank=True)

    # Configuration for available filters and columns
    available_filters = models.JSONField(
        default=dict,
        help_text='JSON dict of available filter configurations',
    )
    available_columns = models.JSONField(
        default=list,
        help_text='JSON list of available column definitions',
    )
    default_columns = models.JSONField(
        default=list,
        help_text='JSON list of default column selections',
    )

    # Service class to execute this report
    service_class = models.CharField(
        max_length=200,
        help_text='Python path to service class (e.g., apps.reports.services.spend_service.SpendAnalysisService)',
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Report Definition'
        verbose_name_plural = 'Report Definitions'

    def __str__(self):
        return f'{self.name} ({self.code})'


class SavedReport(SoftDeleteModel):
    """
    User-saved report configurations.

    Allows users to save their custom filter and column selections
    for quick access to frequently-used reports.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='saved_reports',
    )
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.PROTECT,
        related_name='saved_reports',
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='saved_reports',
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # User-configured filters and columns
    filters = models.JSONField(
        default=dict,
        help_text='JSON dict of user-selected filter values',
    )
    columns = models.JSONField(
        default=list,
        help_text='JSON list of user-selected columns',
    )

    # Sharing
    is_shared = models.BooleanField(
        default=False,
        help_text='If true, visible to all users in the organization',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Saved Report'
        verbose_name_plural = 'Saved Reports'

    def __str__(self):
        return f'{self.name} ({self.report_definition.code})'


class ScheduledReport(SoftDeleteModel):
    """
    Automated report generation and distribution schedule.

    Allows users to schedule reports to run automatically
    and be delivered to specified recipients.
    """

    FREQUENCY_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
    ]

    EXPORT_FORMAT_CHOICES = [
        ('EXCEL', 'Excel'),
        ('CSV', 'CSV'),
        ('PDF', 'PDF'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    saved_report = models.ForeignKey(
        SavedReport,
        on_delete=models.CASCADE,
        related_name='schedules',
    )

    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    day_of_week = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='0-6 (Monday-Sunday), for weekly schedules',
    )
    day_of_month = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='1-31, for monthly schedules',
    )
    time_of_day = models.TimeField()

    export_format = models.CharField(max_length=10, choices=EXPORT_FORMAT_CHOICES)
    recipients = models.JSONField(
        default=list,
        help_text='JSON list of email addresses',
    )

    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Scheduled Report'
        verbose_name_plural = 'Scheduled Reports'

    def __str__(self):
        return f'{self.saved_report.name} - {self.frequency}'

    def calculate_next_run(self):
        """Calculate the next run time based on frequency and schedule."""
        now = timezone.now()

        if self.frequency == 'DAILY':
            # Next occurrence of time_of_day
            next_run = now.replace(
                hour=self.time_of_day.hour,
                minute=self.time_of_day.minute,
                second=0,
                microsecond=0,
            )
            if next_run <= now:
                next_run += timezone.timedelta(days=1)

        elif self.frequency == 'WEEKLY':
            # Next occurrence of day_of_week at time_of_day
            days_ahead = self.day_of_week - now.weekday()
            if days_ahead < 0:
                days_ahead += 7
            next_run = now + timezone.timedelta(days=days_ahead)
            next_run = next_run.replace(
                hour=self.time_of_day.hour,
                minute=self.time_of_day.minute,
                second=0,
                microsecond=0,
            )
            if next_run <= now:
                next_run += timezone.timedelta(weeks=1)

        elif self.frequency == 'MONTHLY':
            # Next occurrence of day_of_month at time_of_day
            next_run = now.replace(
                day=min(self.day_of_month, 28),  # Safe for all months
                hour=self.time_of_day.hour,
                minute=self.time_of_day.minute,
                second=0,
                microsecond=0,
            )
            if next_run <= now:
                # Move to next month
                if now.month == 12:
                    next_run = next_run.replace(year=now.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=now.month + 1)

        self.next_run_at = next_run
        return next_run


class ReportExecution(models.Model):
    """
    Report execution history and cached results.

    Tracks each report run with its parameters, status,
    and optionally cached results for quick retrieval.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='report_executions',
    )
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.CASCADE,
        related_name='executions',
    )
    saved_report = models.ForeignKey(
        SavedReport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='executions',
    )

    # Execution details
    filters_used = models.JSONField(default=dict)
    executed_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='report_executions',
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Results
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    row_count = models.PositiveIntegerField(null=True, blank=True)
    cached_result = models.JSONField(
        null=True,
        blank=True,
        help_text='Cached report data for smaller reports',
    )
    result_file = models.FileField(
        upload_to='reports/exports/',
        null=True,
        blank=True,
        help_text='File path for exported reports',
    )
    error_message = models.TextField(blank=True)

    # Caching
    cache_key = models.CharField(max_length=255, db_index=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Report Execution'
        verbose_name_plural = 'Report Executions'
        indexes = [
            models.Index(fields=['organization', 'cache_key']),
            models.Index(fields=['status', 'started_at']),
        ]

    def __str__(self):
        return f'{self.report_definition.code} - {self.started_at}'

    def mark_completed(self, row_count=None, cached_result=None):
        """Mark execution as completed with optional results."""
        self.status = 'COMPLETED'
        self.completed_at = timezone.now()
        if row_count is not None:
            self.row_count = row_count
        if cached_result is not None:
            self.cached_result = cached_result
        self.save()

    def mark_failed(self, error_message):
        """Mark execution as failed with error message."""
        self.status = 'FAILED'
        self.completed_at = timezone.now()
        self.error_message = error_message
        self.save()


class DashboardKPI(models.Model):
    """
    Pre-aggregated KPI snapshots for fast dashboard loading.

    KPIs are calculated periodically (e.g., hourly) and stored
    for instant retrieval on dashboard load.
    """

    KPI_TYPE_CHOICES = [
        ('TOTAL_SPEND_MTD', 'Total Spend MTD'),
        ('TOTAL_SPEND_YTD', 'Total Spend YTD'),
        ('BUDGET_UTILIZATION', 'Budget Utilization %'),
        ('CONTRACT_COMPLIANCE', 'Contract Compliance %'),
        ('MAVERICK_SPEND', 'Maverick Spend %'),
        ('OPEN_RFX_COUNT', 'Open RFx Count'),
        ('PENDING_APPROVALS', 'Pending Approvals'),
        ('AVG_PO_CYCLE_TIME', 'Avg PO Cycle Time Days'),
        ('SUPPLIER_PERFORMANCE_AVG', 'Avg Supplier Performance'),
        ('EXPIRING_CONTRACTS_90D', 'Expiring Contracts 90 Days'),
        ('INVOICE_MATCH_RATE', 'Invoice Match Rate %'),
        ('ON_TIME_DELIVERY_RATE', 'On-Time Delivery Rate %'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='dashboard_kpis',
    )
    kpi_type = models.CharField(max_length=50, choices=KPI_TYPE_CHOICES)

    # Values - only one should be populated based on KPI type
    numeric_value = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text='For monetary amounts',
    )
    percentage_value = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        null=True,
        blank=True,
        help_text='For percentages (0-100)',
    )
    count_value = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='For counts',
    )

    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    calculated_at = models.DateTimeField(auto_now=True)

    # Comparison with previous period
    previous_value = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text='Previous period value for trend comparison',
    )
    change_percent = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage change from previous period',
    )

    class Meta:
        verbose_name = 'Dashboard KPI'
        verbose_name_plural = 'Dashboard KPIs'
        unique_together = ['organization', 'kpi_type', 'period_start', 'period_end']
        indexes = [
            models.Index(fields=['organization', 'kpi_type', '-calculated_at']),
        ]

    def __str__(self):
        return f'{self.get_kpi_type_display()} - {self.organization.name}'

    @property
    def value(self):
        """Return the appropriate value based on KPI type."""
        if self.numeric_value is not None:
            return self.numeric_value
        if self.percentage_value is not None:
            return self.percentage_value
        if self.count_value is not None:
            return self.count_value
        return None

    @property
    def trend(self):
        """Return trend direction based on change_percent."""
        if self.change_percent is None:
            return 'stable'
        if self.change_percent > Decimal('0'):
            return 'up'
        if self.change_percent < Decimal('0'):
            return 'down'
        return 'stable'

    def calculate_change(self, previous_value):
        """Calculate change percentage from previous value."""
        if previous_value is None or previous_value == 0:
            self.previous_value = previous_value
            self.change_percent = None
            return

        current = self.value
        if current is None:
            self.change_percent = None
            return

        self.previous_value = previous_value
        self.change_percent = ((Decimal(str(current)) - Decimal(str(previous_value)))
                               / Decimal(str(previous_value)) * 100)

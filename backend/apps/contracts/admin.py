"""
Admin configuration for Contract models.
"""

from django.contrib import admin

from apps.contracts.models import Contract, ContractLine, ContractMilestone, ContractSpend


class ContractLineInline(admin.TabularInline):
    """Inline admin for ContractLine."""

    model = ContractLine
    extra = 0
    readonly_fields = ['line_number', 'is_price_valid', 'created_at']
    fields = [
        'line_number',
        'description',
        'catalog_item',
        'unit_of_measure',
        'unit_price',
        'min_quantity',
        'max_quantity',
        'valid_from',
        'valid_to',
        'is_active',
        'is_price_valid',
    ]


class ContractMilestoneInline(admin.TabularInline):
    """Inline admin for ContractMilestone."""

    model = ContractMilestone
    extra = 0
    readonly_fields = ['is_overdue', 'created_at']
    fields = [
        'title',
        'due_date',
        'completed_date',
        'status',
        'is_overdue',
        'amount',
        'notes',
    ]


class ContractSpendInline(admin.TabularInline):
    """Inline admin for ContractSpend."""

    model = ContractSpend
    extra = 0
    readonly_fields = ['recorded_at']
    fields = [
        'purchase_order',
        'amount',
        'recorded_at',
        'notes',
    ]


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    """Admin configuration for Contract."""

    list_display = [
        'number',
        'title',
        'supplier',
        'status',
        'contract_type',
        'start_date',
        'end_date',
        'total_value',
        'utilization_percent',
        'organization',
    ]
    list_filter = ['status', 'contract_type', 'organization', 'auto_renew']
    search_fields = [
        'number',
        'title',
        'supplier__name',
        'supplier__code',
    ]
    readonly_fields = [
        'number',
        'status',
        'total_spent',
        'remaining_value',
        'utilization_percent',
        'is_expired',
        'days_until_expiry',
        'needs_renewal_notice',
        'approved_at',
        'terminated_at',
        'created_at',
        'updated_at',
    ]
    inlines = [ContractLineInline, ContractMilestoneInline, ContractSpendInline]

    fieldsets = (
        (None, {
            'fields': (
                'number',
                'organization',
                'supplier',
                'title',
                'description',
                'status',
            )
        }),
        ('Contract Details', {
            'fields': (
                'contract_type',
                'start_date',
                'end_date',
                'total_value',
                'currency',
                'payment_terms',
            )
        }),
        ('Renewal Settings', {
            'fields': (
                'auto_renew',
                'renewal_notice_days',
            ),
            'classes': ('collapse',),
        }),
        ('Financial Summary', {
            'fields': (
                'total_spent',
                'remaining_value',
                'utilization_percent',
            ),
        }),
        ('Status Information', {
            'fields': (
                'is_expired',
                'days_until_expiry',
                'needs_renewal_notice',
            ),
        }),
        ('Approval', {
            'fields': (
                'created_by',
                'approved_by',
                'approved_at',
            ),
            'classes': ('collapse',),
        }),
        ('Termination', {
            'fields': (
                'terminated_at',
                'termination_reason',
            ),
            'classes': ('collapse',),
        }),
        ('Related Records', {
            'fields': (
                'rfq',
                'parent_contract',
                'amendment_number',
            ),
            'classes': ('collapse',),
        }),
        ('Terms & Conditions', {
            'fields': ('terms_and_conditions',),
            'classes': ('collapse',),
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def utilization_percent(self, obj):
        """Display utilization percentage."""
        return f"{obj.utilization_percent}%"
    utilization_percent.short_description = 'Utilization'


@admin.register(ContractLine)
class ContractLineAdmin(admin.ModelAdmin):
    """Admin configuration for ContractLine."""

    list_display = [
        'contract',
        'line_number',
        'description',
        'unit_price',
        'unit_of_measure',
        'is_active',
        'is_price_valid',
    ]
    list_filter = ['is_active', 'unit_of_measure', 'contract__organization']
    search_fields = [
        'contract__number',
        'description',
        'catalog_item__name',
    ]
    readonly_fields = [
        'line_number',
        'is_price_valid',
        'created_at',
        'updated_at',
    ]


@admin.register(ContractMilestone)
class ContractMilestoneAdmin(admin.ModelAdmin):
    """Admin configuration for ContractMilestone."""

    list_display = [
        'contract',
        'title',
        'due_date',
        'status',
        'is_overdue',
        'amount',
    ]
    list_filter = ['status', 'contract__organization']
    search_fields = [
        'contract__number',
        'title',
    ]
    readonly_fields = [
        'is_overdue',
        'created_at',
        'updated_at',
    ]


@admin.register(ContractSpend)
class ContractSpendAdmin(admin.ModelAdmin):
    """Admin configuration for ContractSpend."""

    list_display = [
        'contract',
        'purchase_order',
        'amount',
        'recorded_at',
    ]
    list_filter = ['contract__organization', 'recorded_at']
    search_fields = [
        'contract__number',
        'purchase_order__number',
    ]
    readonly_fields = [
        'recorded_at',
    ]

"""
Admin configuration for Invoice models.
"""

from django.contrib import admin

from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration


class InvoiceLineInline(admin.TabularInline):
    """Inline admin for InvoiceLine."""

    model = InvoiceLine
    extra = 0
    readonly_fields = ['line_number', 'extended_amount', 'match_status', 'created_at']
    fields = [
        'line_number',
        'po_line',
        'quantity_invoiced',
        'unit_price',
        'extended_amount',
        'match_status',
        'quantity_variance',
        'price_variance',
    ]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """Admin configuration for Invoice."""

    list_display = [
        'number',
        'supplier_invoice_number',
        'supplier',
        'purchase_order',
        'status',
        'total_amount',
        'invoice_date',
        'organization',
    ]
    list_filter = ['status', 'match_type', 'organization', 'invoice_date']
    search_fields = [
        'number',
        'supplier_invoice_number',
        'supplier__name',
        'purchase_order__number',
    ]
    readonly_fields = [
        'number',
        'status',
        'total_amount',
        'validated_at',
        'matched_at',
        'approved_at',
        'paid_at',
        'created_at',
        'updated_at',
    ]
    inlines = [InvoiceLineInline]

    fieldsets = (
        (None, {
            'fields': (
                'number',
                'organization',
                'purchase_order',
                'supplier',
                'status',
            )
        }),
        ('Invoice Details', {
            'fields': (
                'supplier_invoice_number',
                'invoice_date',
                'due_date',
                'created_by',
            )
        }),
        ('Amounts', {
            'fields': (
                'subtotal',
                'tax_amount',
                'shipping_amount',
                'discount_amount',
                'total_amount',
            )
        }),
        ('Matching', {
            'fields': (
                'match_type',
                'encumbrance',
            ),
            'classes': ('collapse',),
        }),
        ('Workflow', {
            'fields': (
                'validated_by',
                'validated_at',
                'matched_at',
                'approved_by',
                'approved_at',
                'paid_at',
            ),
            'classes': ('collapse',),
        }),
        ('Issues', {
            'fields': (
                'rejection_reason',
                'dispute_reason',
            ),
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


@admin.register(InvoiceLine)
class InvoiceLineAdmin(admin.ModelAdmin):
    """Admin configuration for InvoiceLine."""

    list_display = [
        'invoice',
        'line_number',
        'po_line',
        'quantity_invoiced',
        'unit_price',
        'extended_amount',
        'match_status',
    ]
    list_filter = ['match_status', 'invoice__status']
    search_fields = ['invoice__number', 'po_line__description']
    readonly_fields = [
        'line_number',
        'extended_amount',
        'match_status',
        'quantity_variance',
        'price_variance',
        'quantity_matched',
        'created_at',
        'updated_at',
    ]


@admin.register(MatchingConfiguration)
class MatchingConfigurationAdmin(admin.ModelAdmin):
    """Admin configuration for MatchingConfiguration."""

    list_display = [
        'organization',
        'price_tolerance_percent',
        'quantity_tolerance_percent',
        'auto_match_max_amount',
        'require_goods_receipt',
    ]
    list_filter = ['require_goods_receipt', 'allow_over_receipt', 'allow_over_invoice']
    search_fields = ['organization__name']
    readonly_fields = ['created_at', 'updated_at']

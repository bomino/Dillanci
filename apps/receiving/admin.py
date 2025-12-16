"""
Admin configuration for Goods Receipt models.
"""

from django.contrib import admin

from apps.receiving.models import GoodsReceipt, GoodsReceiptLine


class GoodsReceiptLineInline(admin.TabularInline):
    """Inline admin for GoodsReceiptLine."""

    model = GoodsReceiptLine
    extra = 0
    readonly_fields = ['line_number', 'created_at']
    fields = [
        'line_number',
        'po_line',
        'quantity_received',
        'quantity_accepted',
        'quantity_rejected',
        'rejection_reason',
        'storage_location',
        'batch_number',
    ]


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    """Admin configuration for GoodsReceipt."""

    list_display = [
        'number',
        'purchase_order',
        'status',
        'received_by',
        'receipt_date',
        'organization',
        'created_at',
    ]
    list_filter = ['status', 'organization', 'receipt_date']
    search_fields = ['number', 'purchase_order__number', 'delivery_note_number']
    readonly_fields = [
        'number',
        'posted_at',
        'inspected_at',
        'created_at',
        'updated_at',
    ]
    inlines = [GoodsReceiptLineInline]

    fieldsets = (
        (None, {
            'fields': ('number', 'organization', 'purchase_order', 'status')
        }),
        ('Receipt Info', {
            'fields': (
                'received_by',
                'receipt_date',
                'delivery_note_number',
                'carrier',
                'tracking_number',
            )
        }),
        ('Inspection', {
            'fields': (
                'inspection_required',
                'inspection_status',
                'inspection_notes',
                'inspected_by',
                'inspected_at',
            ),
            'classes': ('collapse',),
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('posted_at', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(GoodsReceiptLine)
class GoodsReceiptLineAdmin(admin.ModelAdmin):
    """Admin configuration for GoodsReceiptLine."""

    list_display = [
        'goods_receipt',
        'line_number',
        'po_line',
        'quantity_received',
        'quantity_accepted',
        'quantity_rejected',
    ]
    list_filter = ['goods_receipt__status']
    search_fields = ['goods_receipt__number', 'po_line__description']
    readonly_fields = ['line_number', 'created_at', 'updated_at']

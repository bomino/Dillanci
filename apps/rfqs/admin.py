"""RFQ admin configuration."""

from django.contrib import admin

from apps.rfqs.models import RFQ, RFQLine, SupplierInvitation, Bid, BidLine


class RFQLineInline(admin.TabularInline):
    """Inline admin for RFQ lines."""

    model = RFQLine
    extra = 0
    fields = ['line_number', 'description', 'quantity', 'unit_of_measure', 'target_unit_price', 'catalog_item']
    readonly_fields = ['line_number']


class SupplierInvitationInline(admin.TabularInline):
    """Inline admin for supplier invitations."""

    model = SupplierInvitation
    extra = 0
    fields = ['supplier', 'invited_by', 'status', 'invited_at', 'viewed_at', 'responded_at']
    readonly_fields = ['invited_at', 'viewed_at', 'responded_at']


@admin.register(RFQ)
class RFQAdmin(admin.ModelAdmin):
    """Admin for RFQ model."""

    list_display = ['number', 'title', 'organization', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'organization', 'created_at']
    search_fields = ['number', 'title', 'description']
    readonly_fields = ['number', 'open_date', 'close_date', 'awarded_date', 'created_at', 'updated_at']
    ordering = ['-created_at']
    inlines = [RFQLineInline, SupplierInvitationInline]

    fieldsets = (
        (None, {
            'fields': ('number', 'title', 'description', 'organization', 'created_by')
        }),
        ('Status', {
            'fields': ('status', 'open_date', 'close_date', 'awarded_date')
        }),
        ('Award Information', {
            'fields': ('awarded_supplier', 'awarded_bid'),
            'classes': ('collapse',)
        }),
        ('Related', {
            'fields': ('requisition',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RFQLine)
class RFQLineAdmin(admin.ModelAdmin):
    """Admin for RFQ Line model."""

    list_display = ['rfq', 'line_number', 'description', 'quantity', 'unit_of_measure', 'target_unit_price']
    list_filter = ['rfq__status', 'unit_of_measure']
    search_fields = ['description', 'rfq__number']
    readonly_fields = ['line_number', 'created_at', 'updated_at']
    ordering = ['rfq', 'line_number']


@admin.register(SupplierInvitation)
class SupplierInvitationAdmin(admin.ModelAdmin):
    """Admin for Supplier Invitation model."""

    list_display = ['rfq', 'supplier', 'status', 'invited_by', 'invited_at']
    list_filter = ['status', 'invited_at']
    search_fields = ['rfq__number', 'supplier__name']
    readonly_fields = ['invited_at', 'viewed_at', 'responded_at', 'created_at', 'updated_at']
    ordering = ['-invited_at']


class BidLineInline(admin.TabularInline):
    """Inline admin for bid lines."""

    model = BidLine
    extra = 0
    fields = ['rfq_line', 'unit_price', 'lead_time_days', 'notes']


@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    """Admin for Bid model."""

    list_display = ['rfq', 'supplier', 'status', 'submitted_by', 'submitted_at', 'total_amount']
    list_filter = ['status', 'submitted_at']
    search_fields = ['rfq__number', 'supplier__name']
    readonly_fields = ['submitted_at', 'created_at', 'updated_at']
    ordering = ['-created_at']
    inlines = [BidLineInline]

    def total_amount(self, obj):
        return obj.total_amount
    total_amount.short_description = 'Total Amount'


@admin.register(BidLine)
class BidLineAdmin(admin.ModelAdmin):
    """Admin for Bid Line model."""

    list_display = ['bid', 'rfq_line', 'unit_price', 'lead_time_days']
    list_filter = ['bid__status']
    search_fields = ['bid__rfq__number', 'rfq_line__description']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['bid', 'rfq_line__line_number']

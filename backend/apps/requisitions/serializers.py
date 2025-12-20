"""
Requisition serializers for API endpoints.
"""

from rest_framework import serializers

from apps.core.utils.sanitization import sanitize_html
from apps.requisitions.models import (
    Requisition,
    RequisitionLine,
    RequisitionTemplate,
    RequisitionTemplateLine,
)


# =============================================================================
# Related PO Serializers (for Requisition -> PO relationship display)
# =============================================================================


class RelatedPOLineSerializer(serializers.Serializer):
    """Minimal PO line info for display in Requisition line detail."""

    id = serializers.UUIDField()
    purchase_order_number = serializers.CharField(source='purchase_order.number')
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)


class RelatedPurchaseOrderSerializer(serializers.Serializer):
    """Minimal PO info for display in Requisition detail."""

    id = serializers.UUIDField()
    number = serializers.CharField()
    status = serializers.CharField()
    supplier_name = serializers.CharField(source='supplier.name')
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    created_at = serializers.DateTimeField()


class RequisitionLineSerializer(serializers.ModelSerializer):
    """Serializer for requisition line items."""

    extended_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    catalog_item_name = serializers.CharField(
        source='catalog_item.name', read_only=True
    )
    catalog_item_sku = serializers.CharField(
        source='catalog_item.sku', read_only=True
    )
    # Line fulfillment tracking
    is_converted = serializers.SerializerMethodField()
    po_lines = serializers.SerializerMethodField()

    class Meta:
        model = RequisitionLine
        fields = [
            'id',
            'requisition',
            'line_number',
            'description',
            'quantity',
            'unit_of_measure',
            'unit_price',
            'extended_amount',
            'catalog_item',
            'catalog_item_name',
            'catalog_item_sku',
            'is_converted',
            'po_lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'extended_amount', 'is_converted', 'po_lines', 'created_at', 'updated_at']

    def get_is_converted(self, obj):
        """Check if this line has been converted to any PO line."""
        return obj.po_lines.exists()

    def get_po_lines(self, obj):
        """Get list of PO lines created from this requisition line."""
        return RelatedPOLineSerializer(obj.po_lines.select_related('purchase_order'), many=True).data


class RequisitionLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating requisition lines."""

    class Meta:
        model = RequisitionLine
        fields = [
            'line_number',
            'description',
            'quantity',
            'unit_of_measure',
            'unit_price',
            'catalog_item',
        ]


class RequisitionSerializer(serializers.ModelSerializer):
    """Serializer for requisition detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    requester_name = serializers.CharField(
        source='requester.full_name', read_only=True
    )
    requester_email = serializers.CharField(
        source='requester.email', read_only=True
    )
    budget_line_code = serializers.CharField(
        source='budget_line.code', read_only=True
    )
    budget_line_name = serializers.CharField(
        source='budget_line.name', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.full_name', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    lines = RequisitionLineSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    # Related purchase orders created from this requisition
    purchase_orders = serializers.SerializerMethodField()

    class Meta:
        model = Requisition
        fields = [
            'id',
            'organization',
            'organization_name',
            'number',
            'title',
            'description',
            'requester',
            'requester_name',
            'requester_email',
            'budget_line',
            'budget_line_code',
            'budget_line_name',
            'status',
            'status_display',
            'total_amount',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'rejection_reason',
            'rejected_at',
            'encumbrance',
            'lines',
            'purchase_orders',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number',
            'status',
            'total_amount',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'rejected_at',
            'encumbrance',
            'purchase_orders',
            'created_at',
            'updated_at',
        ]

    def get_purchase_orders(self, obj):
        """Get list of POs created from this requisition."""
        return RelatedPurchaseOrderSerializer(
            obj.purchase_orders.select_related('supplier').order_by('-created_at'),
            many=True
        ).data


class RequisitionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating requisitions."""

    lines = RequisitionLineCreateSerializer(many=True, required=False)

    class Meta:
        model = Requisition
        fields = [
            'organization',
            'title',
            'description',
            'requester',
            'budget_line',
            'lines',
        ]

    def validate_description(self, value):
        """Sanitize description to prevent XSS attacks."""
        return sanitize_html(value) if value else value

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        requisition = Requisition.objects.create(**validated_data)

        for i, line_data in enumerate(lines_data, start=1):
            line_data['line_number'] = line_data.get('line_number', i)
            RequisitionLine.objects.create(requisition=requisition, **line_data)

        return requisition


class RequisitionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for requisition list views."""

    requester_name = serializers.CharField(
        source='requester.full_name', read_only=True
    )
    budget_line_code = serializers.CharField(
        source='budget_line.code', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Requisition
        fields = [
            'id',
            'number',
            'title',
            'requester',
            'requester_name',
            'budget_line',
            'budget_line_code',
            'status',
            'total_amount',
            'created_at',
        ]


class RejectSerializer(serializers.Serializer):
    """Serializer for requisition rejection."""

    reason = serializers.CharField(max_length=1000)


# =============================================================================
# Requisition Template Serializers
# =============================================================================


class RequisitionTemplateLineSerializer(serializers.ModelSerializer):
    """Serializer for template line items."""

    class Meta:
        model = RequisitionTemplateLine
        fields = [
            'id',
            'description',
            'quantity',
            'unit_of_measure',
            'estimated_unit_price',
            'notes',
        ]
        read_only_fields = ['id']


class RequisitionTemplateSerializer(serializers.ModelSerializer):
    """Serializer for requisition templates."""

    lines = RequisitionTemplateLineSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )

    class Meta:
        model = RequisitionTemplate
        fields = [
            'id',
            'organization',
            'organization_name',
            'name',
            'description',
            'department',
            'priority',
            'currency',
            'is_public',
            'created_by',
            'created_by_name',
            'use_count',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'use_count', 'created_at', 'updated_at']


class RequisitionTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating requisition templates with lines."""

    lines = RequisitionTemplateLineSerializer(many=True)

    class Meta:
        model = RequisitionTemplate
        fields = [
            'name',
            'description',
            'department',
            'priority',
            'currency',
            'is_public',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        request = self.context.get('request')

        # Set organization and created_by from request user
        validated_data['organization'] = request.user.organization
        validated_data['created_by'] = request.user

        template = RequisitionTemplate.objects.create(**validated_data)

        for line_data in lines_data:
            RequisitionTemplateLine.objects.create(template=template, **line_data)

        return template


class RequisitionTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for template list views."""

    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    line_count = serializers.IntegerField(source='lines.count', read_only=True)

    class Meta:
        model = RequisitionTemplate
        fields = [
            'id',
            'name',
            'description',
            'department',
            'priority',
            'currency',
            'is_public',
            'created_by',
            'created_by_name',
            'use_count',
            'line_count',
            'created_at',
            'updated_at',
        ]

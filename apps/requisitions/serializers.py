"""
Requisition serializers for API endpoints.
"""

from rest_framework import serializers

from apps.requisitions.models import Requisition, RequisitionLine


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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'extended_amount', 'created_at', 'updated_at']


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
            'created_at',
            'updated_at',
        ]


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

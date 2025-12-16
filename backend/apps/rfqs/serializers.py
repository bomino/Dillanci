"""
RFQ serializers for API endpoints.
"""

from rest_framework import serializers

from apps.rfqs.models import RFQ, RFQLine, SupplierInvitation, Bid, BidLine


# RFQ Line Serializers
class RFQLineSerializer(serializers.ModelSerializer):
    """Serializer for RFQ line items."""

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
        model = RFQLine
        fields = [
            'id',
            'rfq',
            'line_number',
            'description',
            'quantity',
            'unit_of_measure',
            'target_unit_price',
            'extended_amount',
            'catalog_item',
            'catalog_item_name',
            'catalog_item_sku',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'line_number', 'extended_amount', 'created_at', 'updated_at']


class RFQLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFQ lines."""

    class Meta:
        model = RFQLine
        fields = [
            'description',
            'quantity',
            'unit_of_measure',
            'target_unit_price',
            'catalog_item',
        ]


# Supplier Invitation Serializers
class SupplierInvitationSerializer(serializers.ModelSerializer):
    """Serializer for supplier invitations."""

    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
    )
    invited_by_name = serializers.CharField(
        source='invited_by.full_name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = SupplierInvitation
        fields = [
            'id',
            'rfq',
            'supplier',
            'supplier_name',
            'invited_by',
            'invited_by_name',
            'invited_at',
            'status',
            'status_display',
            'viewed_at',
            'responded_at',
            'decline_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'invited_at',
            'status',
            'viewed_at',
            'responded_at',
            'created_at',
            'updated_at',
        ]


class SupplierInvitationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating supplier invitations."""

    class Meta:
        model = SupplierInvitation
        fields = ['supplier']


# Bid Line Serializers
class BidLineSerializer(serializers.ModelSerializer):
    """Serializer for bid line items."""

    extended_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    rfq_line_description = serializers.CharField(
        source='rfq_line.description', read_only=True
    )
    rfq_line_quantity = serializers.DecimalField(
        source='rfq_line.quantity',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    rfq_line_number = serializers.IntegerField(
        source='rfq_line.line_number', read_only=True
    )

    class Meta:
        model = BidLine
        fields = [
            'id',
            'bid',
            'rfq_line',
            'rfq_line_number',
            'rfq_line_description',
            'rfq_line_quantity',
            'unit_price',
            'extended_amount',
            'lead_time_days',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'extended_amount', 'created_at', 'updated_at']


class BidLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating bid lines."""

    class Meta:
        model = BidLine
        fields = [
            'rfq_line',
            'unit_price',
            'lead_time_days',
            'notes',
        ]


# Bid Serializers
class BidSerializer(serializers.ModelSerializer):
    """Serializer for bid detail views."""

    rfq_number = serializers.CharField(
        source='rfq.number', read_only=True
    )
    rfq_title = serializers.CharField(
        source='rfq.title', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
    )
    submitted_by_name = serializers.CharField(
        source='submitted_by.full_name', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    lines = BidLineSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Bid
        fields = [
            'id',
            'rfq',
            'rfq_number',
            'rfq_title',
            'supplier',
            'supplier_name',
            'submitted_by',
            'submitted_by_name',
            'status',
            'status_display',
            'submitted_at',
            'total_amount',
            'notes',
            'valid_until',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'submitted_at',
            'total_amount',
            'created_at',
            'updated_at',
        ]


class BidCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating bids."""

    lines = BidLineCreateSerializer(many=True, required=False)

    class Meta:
        model = Bid
        fields = [
            'rfq',
            'supplier',
            'submitted_by',
            'notes',
            'valid_until',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        bid = Bid.objects.create(**validated_data)

        for line_data in lines_data:
            BidLine.objects.create(bid=bid, **line_data)

        return bid


class BidListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for bid list views."""

    rfq_number = serializers.CharField(
        source='rfq.number', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Bid
        fields = [
            'id',
            'rfq',
            'rfq_number',
            'supplier',
            'supplier_name',
            'status',
            'total_amount',
            'submitted_at',
            'created_at',
        ]


# RFQ Serializers
class RFQSerializer(serializers.ModelSerializer):
    """Serializer for RFQ detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    created_by_email = serializers.CharField(
        source='created_by.email', read_only=True
    )
    awarded_supplier_name = serializers.CharField(
        source='awarded_supplier.name', read_only=True
    )
    requisition_number = serializers.CharField(
        source='requisition.number', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    lines = RFQLineSerializer(many=True, read_only=True)
    invitations = SupplierInvitationSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = RFQ
        fields = [
            'id',
            'organization',
            'organization_name',
            'number',
            'title',
            'description',
            'created_by',
            'created_by_name',
            'created_by_email',
            'status',
            'status_display',
            'total_amount',
            'open_date',
            'close_date',
            'awarded_date',
            'awarded_supplier',
            'awarded_supplier_name',
            'awarded_bid',
            'requisition',
            'requisition_number',
            'lines',
            'invitations',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number',
            'status',
            'total_amount',
            'open_date',
            'close_date',
            'awarded_date',
            'awarded_supplier',
            'awarded_bid',
            'created_at',
            'updated_at',
        ]


class RFQCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFQs."""

    lines = RFQLineCreateSerializer(many=True, required=False)

    class Meta:
        model = RFQ
        fields = [
            'organization',
            'title',
            'description',
            'created_by',
            'requisition',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        rfq = RFQ.objects.create(**validated_data)

        for line_data in lines_data:
            RFQLine.objects.create(rfq=rfq, **line_data)

        return rfq


class RFQListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for RFQ list views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = RFQ
        fields = [
            'id',
            'number',
            'title',
            'organization',
            'organization_name',
            'created_by',
            'created_by_name',
            'status',
            'total_amount',
            'open_date',
            'close_date',
            'created_at',
        ]


# Action Serializers
class AwardSerializer(serializers.Serializer):
    """Serializer for RFQ award action."""

    bid_id = serializers.UUIDField()


class DeclineInvitationSerializer(serializers.Serializer):
    """Serializer for declining an invitation."""

    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)


class BidComparisonSerializer(serializers.Serializer):
    """Serializer for bid comparison response."""

    rfq_line_id = serializers.UUIDField()
    rfq_line_number = serializers.IntegerField()
    description = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    target_unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, allow_null=True
    )
    bids = serializers.ListField(child=serializers.DictField())


class BidComparisonResponseSerializer(serializers.Serializer):
    """Serializer for full bid comparison response."""

    rfq_id = serializers.UUIDField()
    rfq_number = serializers.CharField()
    lines = BidComparisonSerializer(many=True)
    summary = serializers.DictField()

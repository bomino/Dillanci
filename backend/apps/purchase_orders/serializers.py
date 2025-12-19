"""
Purchase Order serializers for API endpoints.
"""

from rest_framework import serializers

from apps.purchase_orders.models import PurchaseOrder, POLine


class POLineSerializer(serializers.ModelSerializer):
    """Serializer for PO line items."""

    extended_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    catalog_item_name = serializers.CharField(
        source='catalog_item.name', read_only=True
    )
    catalog_item_sku = serializers.CharField(
        source='catalog_item.sku', read_only=True
    )
    remaining_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    requisition_line_id = serializers.UUIDField(
        source='requisition_line.id', read_only=True
    )

    class Meta:
        model = POLine
        fields = [
            'id',
            'purchase_order',
            'line_number',
            'description',
            'quantity',
            'unit_price',
            'unit_of_measure',
            'extended_amount',
            'catalog_item',
            'catalog_item_name',
            'catalog_item_sku',
            'rfq_line',
            'bid_line',
            'proposal_line',
            'requisition_line',
            'requisition_line_id',
            'quantity_received',
            'remaining_quantity',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'line_number', 'extended_amount', 'remaining_quantity',
            'requisition_line_id', 'created_at', 'updated_at'
        ]


class POLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating PO lines."""

    class Meta:
        model = POLine
        fields = [
            'description',
            'quantity',
            'unit_price',
            'unit_of_measure',
            'catalog_item',
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Serializer for PO detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
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
    rejected_by_name = serializers.CharField(
        source='rejected_by.full_name', read_only=True
    )
    rfq_number = serializers.CharField(
        source='rfq.number', read_only=True
    )
    rfp_number = serializers.CharField(
        source='rfp.number', read_only=True
    )
    proposal_number = serializers.CharField(
        source='proposal.proposal_number', read_only=True
    )
    requisition_id = serializers.UUIDField(
        source='requisition.id', read_only=True
    )
    requisition_number = serializers.CharField(
        source='requisition.number', read_only=True
    )
    requisition_title = serializers.CharField(
        source='requisition.title', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    lines = POLineSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'organization',
            'organization_name',
            'number',
            'title',
            'description',
            'created_by',
            'created_by_name',
            'supplier',
            'supplier_name',
            'budget_line',
            'budget_line_code',
            'budget_line_name',
            'status',
            'status_display',
            'total_amount',
            'submitted_at',
            'approved_at',
            'approved_by',
            'approved_by_name',
            'rejected_by',
            'rejected_by_name',
            'rejection_reason',
            'sent_at',
            'received_at',
            'completed_at',
            'rfq',
            'rfq_number',
            'bid',
            'rfp',
            'rfp_number',
            'proposal',
            'proposal_number',
            'requisition',
            'requisition_id',
            'requisition_number',
            'requisition_title',
            'ship_to_address',
            'shipping_terms',
            'payment_terms',
            'expected_delivery',
            'notes',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number',
            'status',
            'total_amount',
            'submitted_at',
            'approved_at',
            'approved_by',
            'rejected_by',
            'rejection_reason',
            'sent_at',
            'received_at',
            'completed_at',
            'requisition_id',
            'requisition_number',
            'requisition_title',
            'created_at',
            'updated_at',
        ]


class PurchaseOrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating POs."""

    lines = POLineCreateSerializer(many=True, required=False)

    class Meta:
        model = PurchaseOrder
        fields = [
            'organization',
            'title',
            'description',
            'created_by',
            'supplier',
            'budget_line',
            'ship_to_address',
            'shipping_terms',
            'payment_terms',
            'expected_delivery',
            'notes',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        po = PurchaseOrder.objects.create(**validated_data)

        for line_data in lines_data:
            POLine.objects.create(purchase_order=po, **line_data)

        return po


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for PO list views."""

    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
    )
    budget_line_code = serializers.CharField(
        source='budget_line.code', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    requisition_number = serializers.CharField(
        source='requisition.number', read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'number',
            'title',
            'supplier',
            'supplier_name',
            'budget_line',
            'budget_line_code',
            'status',
            'total_amount',
            'requisition',
            'requisition_number',
            'submitted_at',
            'approved_at',
            'created_at',
        ]


class RejectSerializer(serializers.Serializer):
    """Serializer for PO rejection."""

    reason = serializers.CharField(max_length=1000)


class CreateFromBidSerializer(serializers.Serializer):
    """Serializer for creating PO from awarded bid."""

    bid_id = serializers.UUIDField()
    budget_line_id = serializers.UUIDField()


class CreateFromRequisitionSerializer(serializers.Serializer):
    """Serializer for creating PO from approved requisition."""

    requisition_id = serializers.UUIDField()
    supplier_id = serializers.UUIDField()


class CreateFromProposalSerializer(serializers.Serializer):
    """Serializer for creating PO from awarded RFP proposal."""

    proposal_id = serializers.UUIDField()
    budget_line_id = serializers.UUIDField()
    contract_id = serializers.UUIDField(required=False, allow_null=True)

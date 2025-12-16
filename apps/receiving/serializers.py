"""
Serializers for Goods Receipt models.
"""

from rest_framework import serializers

from apps.receiving.models import GoodsReceipt, GoodsReceiptLine


class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    """Serializer for GoodsReceiptLine model."""

    class Meta:
        model = GoodsReceiptLine
        fields = [
            'id',
            'goods_receipt',
            'po_line',
            'line_number',
            'quantity_received',
            'quantity_accepted',
            'quantity_rejected',
            'rejection_reason',
            'storage_location',
            'batch_number',
            'serial_numbers',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'line_number', 'created_at', 'updated_at']


class GoodsReceiptLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating GoodsReceiptLine."""

    class Meta:
        model = GoodsReceiptLine
        fields = [
            'po_line',
            'quantity_received',
            'quantity_accepted',
            'quantity_rejected',
            'rejection_reason',
            'storage_location',
            'batch_number',
            'serial_numbers',
            'notes',
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    """Serializer for GoodsReceipt model with lines."""

    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    total_quantity_received = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = GoodsReceipt
        fields = [
            'id',
            'number',
            'organization',
            'purchase_order',
            'status',
            'received_by',
            'receipt_date',
            'posted_at',
            'delivery_note_number',
            'carrier',
            'tracking_number',
            'inspection_required',
            'inspection_status',
            'inspection_notes',
            'inspected_by',
            'inspected_at',
            'notes',
            'lines',
            'total_quantity_received',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number',
            'status',
            'posted_at',
            'inspected_at',
            'created_at',
            'updated_at',
        ]


class GoodsReceiptCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating GoodsReceipt with lines."""

    lines = GoodsReceiptLineCreateSerializer(many=True, required=False)

    class Meta:
        model = GoodsReceipt
        fields = [
            'organization',
            'purchase_order',
            'received_by',
            'receipt_date',
            'delivery_note_number',
            'carrier',
            'tracking_number',
            'inspection_required',
            'notes',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        goods_receipt = GoodsReceipt.objects.create(**validated_data)

        for line_data in lines_data:
            GoodsReceiptLine.objects.create(
                goods_receipt=goods_receipt,
                **line_data
            )

        return goods_receipt


class GoodsReceiptListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing GoodsReceipts."""

    class Meta:
        model = GoodsReceipt
        fields = [
            'id',
            'number',
            'purchase_order',
            'status',
            'received_by',
            'receipt_date',
            'posted_at',
            'created_at',
        ]

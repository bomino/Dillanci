"""
Serializers for Invoice models.
"""

from rest_framework import serializers

from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration


class MatchingConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for MatchingConfiguration model."""

    class Meta:
        model = MatchingConfiguration
        fields = [
            'id',
            'organization',
            'price_tolerance_percent',
            'quantity_tolerance_percent',
            'auto_match_max_amount',
            'require_goods_receipt',
            'allow_over_receipt',
            'allow_over_invoice',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class InvoiceLineSerializer(serializers.ModelSerializer):
    """Serializer for InvoiceLine model."""

    extended_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    po_unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    gr_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = InvoiceLine
        fields = [
            'id',
            'invoice',
            'po_line',
            'line_number',
            'quantity_invoiced',
            'unit_price',
            'extended_amount',
            'match_status',
            'quantity_variance',
            'price_variance',
            'quantity_matched',
            'po_unit_price',
            'gr_quantity',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'line_number',
            'match_status',
            'quantity_variance',
            'price_variance',
            'quantity_matched',
            'created_at',
            'updated_at',
        ]


class InvoiceLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating InvoiceLine."""

    class Meta:
        model = InvoiceLine
        fields = [
            'po_line',
            'quantity_invoiced',
            'unit_price',
            'notes',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for Invoice model with lines."""

    lines = InvoiceLineSerializer(many=True, read_only=True)
    total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Invoice
        fields = [
            'id',
            'number',
            'supplier_invoice_number',
            'organization',
            'purchase_order',
            'supplier',
            'status',
            'match_type',
            'invoice_date',
            'due_date',
            'validated_at',
            'matched_at',
            'approved_at',
            'paid_at',
            'created_by',
            'validated_by',
            'approved_by',
            'subtotal',
            'tax_amount',
            'shipping_amount',
            'discount_amount',
            'total_amount',
            'encumbrance',
            'notes',
            'rejection_reason',
            'dispute_reason',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number',
            'status',
            'match_type',
            'validated_at',
            'matched_at',
            'approved_at',
            'paid_at',
            'validated_by',
            'approved_by',
            'rejection_reason',
            'dispute_reason',
            'created_at',
            'updated_at',
        ]


class InvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Invoice with lines."""

    lines = InvoiceLineCreateSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            'supplier_invoice_number',
            'organization',
            'purchase_order',
            'supplier',
            'created_by',
            'invoice_date',
            'due_date',
            'subtotal',
            'tax_amount',
            'shipping_amount',
            'discount_amount',
            'notes',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        invoice = Invoice.objects.create(**validated_data)

        for line_data in lines_data:
            InvoiceLine.objects.create(
                invoice=invoice,
                **line_data
            )

        # Calculate subtotal from lines if not provided
        if not invoice.subtotal and invoice.lines.exists():
            invoice.calculate_subtotal()
            invoice.save(update_fields=['subtotal'])

        return invoice


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing Invoices."""

    total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Invoice
        fields = [
            'id',
            'number',
            'supplier_invoice_number',
            'purchase_order',
            'supplier',
            'status',
            'invoice_date',
            'due_date',
            'total_amount',
            'created_at',
        ]


class RejectSerializer(serializers.Serializer):
    """Serializer for reject action."""

    reason = serializers.CharField(required=False, allow_blank=True)


class DisputeSerializer(serializers.Serializer):
    """Serializer for dispute action."""

    reason = serializers.CharField(required=True)


class MatchResultSerializer(serializers.Serializer):
    """Serializer for 3-way match results."""

    invoice_id = serializers.UUIDField()
    overall_match = serializers.BooleanField()
    can_auto_match = serializers.BooleanField()
    lines = serializers.ListField()
    errors = serializers.ListField(child=serializers.CharField())

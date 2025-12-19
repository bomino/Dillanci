"""
Contract serializers for API endpoints.
"""

from rest_framework import serializers

from .models import Contract, ContractLine, ContractMilestone, ContractSpend


# Contract Line Serializers
class ContractLineSerializer(serializers.ModelSerializer):
    """Serializer for contract line items."""

    catalog_item_name = serializers.CharField(
        source='catalog_item.name', read_only=True
    )
    catalog_item_sku = serializers.CharField(
        source='catalog_item.sku', read_only=True
    )
    is_price_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = ContractLine
        fields = [
            'id',
            'contract',
            'line_number',
            'description',
            'catalog_item',
            'catalog_item_name',
            'catalog_item_sku',
            'unit_of_measure',
            'unit_price',
            'min_quantity',
            'max_quantity',
            'valid_from',
            'valid_to',
            'is_active',
            'is_price_valid',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'line_number', 'created_at', 'updated_at']


class ContractLineCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating contract lines."""

    class Meta:
        model = ContractLine
        fields = [
            'description',
            'catalog_item',
            'unit_of_measure',
            'unit_price',
            'min_quantity',
            'max_quantity',
            'valid_from',
            'valid_to',
            'notes',
        ]


# Contract Milestone Serializers
class ContractMilestoneSerializer(serializers.ModelSerializer):
    """Serializer for contract milestones."""

    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = ContractMilestone
        fields = [
            'id',
            'contract',
            'title',
            'description',
            'due_date',
            'completed_date',
            'status',
            'status_display',
            'is_overdue',
            'amount',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'completed_date', 'status', 'created_at', 'updated_at']


class ContractMilestoneCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating contract milestones."""

    class Meta:
        model = ContractMilestone
        fields = [
            'title',
            'description',
            'due_date',
            'amount',
            'notes',
        ]


# Contract Spend Serializers
class ContractSpendSerializer(serializers.ModelSerializer):
    """Serializer for contract spend records."""

    purchase_order_number = serializers.CharField(
        source='purchase_order.number', read_only=True
    )
    contract_number = serializers.CharField(
        source='contract.number', read_only=True
    )

    class Meta:
        model = ContractSpend
        fields = [
            'id',
            'contract',
            'contract_number',
            'purchase_order',
            'purchase_order_number',
            'amount',
            'recorded_at',
            'notes',
        ]
        read_only_fields = ['id', 'recorded_at']


# Contract Serializers
class ContractSerializer(serializers.ModelSerializer):
    """Serializer for contract detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
    )
    supplier_code = serializers.CharField(
        source='supplier.code', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.full_name', read_only=True
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
    parent_contract_number = serializers.CharField(
        source='parent_contract.number', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    contract_type_display = serializers.CharField(
        source='get_contract_type_display', read_only=True
    )
    payment_terms_display = serializers.CharField(
        source='get_payment_terms_display', read_only=True
    )

    # Computed properties
    total_spent = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    remaining_value = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    utilization_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)
    needs_renewal_notice = serializers.BooleanField(read_only=True)

    # Nested items
    lines = ContractLineSerializer(many=True, read_only=True)
    milestones = ContractMilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id',
            'number',
            'organization',
            'organization_name',
            'supplier',
            'supplier_name',
            'supplier_code',
            'title',
            'description',
            'status',
            'status_display',
            'contract_type',
            'contract_type_display',
            'start_date',
            'end_date',
            'total_value',
            'currency',
            'auto_renew',
            'renewal_notice_days',
            'payment_terms',
            'payment_terms_display',
            'terms_and_conditions',
            'notes',
            'created_by',
            'created_by_name',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'terminated_at',
            'termination_reason',
            'rfq',
            'rfq_number',
            'rfp',
            'rfp_number',
            'proposal',
            'proposal_number',
            'parent_contract',
            'parent_contract_number',
            'amendment_number',
            # Computed
            'total_spent',
            'remaining_value',
            'utilization_percent',
            'is_expired',
            'days_until_expiry',
            'needs_renewal_notice',
            # Nested
            'lines',
            'milestones',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'number',
            'status',
            'approved_by',
            'approved_at',
            'terminated_at',
            'termination_reason',
            'amendment_number',
            'created_at',
            'updated_at',
        ]


class ContractCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating contracts."""

    lines = ContractLineCreateSerializer(many=True, required=False)

    class Meta:
        model = Contract
        fields = [
            'organization',
            'supplier',
            'created_by',
            'title',
            'description',
            'contract_type',
            'start_date',
            'end_date',
            'total_value',
            'currency',
            'auto_renew',
            'renewal_notice_days',
            'payment_terms',
            'terms_and_conditions',
            'notes',
            'rfq',
            'rfp',
            'proposal',
            'lines',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        contract = Contract.objects.create(**validated_data)

        for line_data in lines_data:
            ContractLine.objects.create(contract=contract, **line_data)

        return contract


class ContractListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for contract list views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    contract_type_display = serializers.CharField(
        source='get_contract_type_display', read_only=True
    )
    total_spent = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    remaining_value = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    utilization_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    days_until_expiry = serializers.IntegerField(read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id',
            'number',
            'title',
            'organization',
            'organization_name',
            'supplier',
            'supplier_name',
            'status',
            'status_display',
            'contract_type',
            'contract_type_display',
            'start_date',
            'end_date',
            'total_value',
            'total_spent',
            'remaining_value',
            'utilization_percent',
            'days_until_expiry',
            'created_at',
        ]


# Action Serializers
class ApproveContractSerializer(serializers.Serializer):
    """Serializer for contract approval action."""
    pass  # No additional data needed, approver comes from request.user


class TerminateContractSerializer(serializers.Serializer):
    """Serializer for contract termination action."""

    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class RenewContractSerializer(serializers.Serializer):
    """Serializer for contract renewal action."""

    new_end_date = serializers.DateField()
    new_total_value = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )


class CompleteMilestoneSerializer(serializers.Serializer):
    """Serializer for completing a milestone."""

    completed_date = serializers.DateField(required=False)


class WaiveMilestoneSerializer(serializers.Serializer):
    """Serializer for waiving a milestone."""

    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)


class SpendSummarySerializer(serializers.Serializer):
    """Serializer for spend summary response."""

    contract_number = serializers.CharField()
    total_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    remaining_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    utilization_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    spend_count = serializers.IntegerField()

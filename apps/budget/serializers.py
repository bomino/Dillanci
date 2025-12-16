"""
Budget serializers for API endpoints.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.budget.models import BudgetLine, Encumbrance, FiscalYear


class FiscalYearSerializer(serializers.ModelSerializer):
    """Serializer for fiscal year list and detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    budget_lines_count = serializers.SerializerMethodField()
    total_allocated = serializers.SerializerMethodField()

    class Meta:
        model = FiscalYear
        fields = [
            'id',
            'organization',
            'organization_name',
            'year',
            'start_date',
            'end_date',
            'status',
            'budget_lines_count',
            'total_allocated',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_budget_lines_count(self, obj):
        return obj.budget_lines.count()

    def get_total_allocated(self, obj):
        from django.db.models import Sum
        result = obj.budget_lines.aggregate(total=Sum('allocated_amount'))
        return result['total'] or Decimal('0.00')


class BudgetLineSerializer(serializers.ModelSerializer):
    """Serializer for budget line list and detail views."""

    fiscal_year_display = serializers.CharField(
        source='fiscal_year.__str__', read_only=True
    )
    organization = serializers.UUIDField(
        source='fiscal_year.organization.id', read_only=True
    )
    organization_name = serializers.CharField(
        source='fiscal_year.organization.name', read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name', read_only=True
    )
    encumbered_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    available_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = BudgetLine
        fields = [
            'id',
            'fiscal_year',
            'fiscal_year_display',
            'organization',
            'organization_name',
            'code',
            'name',
            'description',
            'allocated_amount',
            'encumbered_amount',
            'available_amount',
            'status',
            'parent',
            'parent_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'encumbered_amount',
            'available_amount',
            'created_at',
            'updated_at',
        ]


class BudgetLineListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for budget line list views."""

    fiscal_year_display = serializers.CharField(
        source='fiscal_year.__str__', read_only=True
    )
    available_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = BudgetLine
        fields = [
            'id',
            'fiscal_year',
            'fiscal_year_display',
            'code',
            'name',
            'allocated_amount',
            'available_amount',
            'status',
        ]


class AvailabilityCheckSerializer(serializers.Serializer):
    """Serializer for budget availability check request."""

    amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class EncumbranceSerializer(serializers.ModelSerializer):
    """Serializer for encumbrance list and detail views."""

    budget_line_code = serializers.CharField(
        source='budget_line.code', read_only=True
    )
    budget_line_name = serializers.CharField(
        source='budget_line.name', read_only=True
    )

    class Meta:
        model = Encumbrance
        fields = [
            'id',
            'budget_line',
            'budget_line_code',
            'budget_line_name',
            'amount',
            'reference_type',
            'reference_id',
            'status',
            'released_at',
            'liquidated_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'released_at',
            'liquidated_at',
            'created_at',
            'updated_at',
        ]


class EncumbranceCreateSerializer(serializers.Serializer):
    """Serializer for creating encumbrances via budget line."""

    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    reference_type = serializers.ChoiceField(
        choices=Encumbrance.REFERENCE_TYPES
    )
    reference_id = serializers.CharField(max_length=100)

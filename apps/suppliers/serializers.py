"""
Supplier serializers for API endpoints.
"""

from rest_framework import serializers

from apps.suppliers.models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for supplier list and detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'code',
            'organization',
            'organization_name',
            'status',
            'status_display',
            'approved_at',
            'blocked_at',
            'rejected_at',
            'contact_name',
            'contact_email',
            'contact_phone',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'postal_code',
            'country',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'approved_at',
            'blocked_at',
            'rejected_at',
            'created_at',
            'updated_at',
        ]


class SupplierCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating suppliers."""

    class Meta:
        model = Supplier
        fields = [
            'name',
            'code',
            'organization',
            'contact_name',
            'contact_email',
            'contact_phone',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'postal_code',
            'country',
        ]


class SupplierListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for supplier list views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'code',
            'organization',
            'organization_name',
            'status',
            'contact_email',
            'city',
            'country',
        ]

"""
Organization serializers for API endpoints.
"""

from rest_framework import serializers

from apps.organizations.models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for organization list and detail views."""

    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id',
            'name',
            'code',
            'status',
            'timezone',
            'default_currency',
            'fiscal_year_start_month',
            'user_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_user_count(self, obj):
        return obj.users.count()


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating organizations."""

    class Meta:
        model = Organization
        fields = [
            'name',
            'code',
            'timezone',
            'default_currency',
            'fiscal_year_start_month',
        ]

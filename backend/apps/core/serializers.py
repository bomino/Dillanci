"""
Core serializers for admin configuration models.
"""

from rest_framework import serializers

from apps.core.models import APIKey, ApprovalThreshold, Notification, SystemPreference


class ApprovalThresholdSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalThreshold model."""

    organization_name = serializers.CharField(source='organization.name', read_only=True)
    required_role_name = serializers.CharField(source='required_role.name', read_only=True)
    escalation_role_name = serializers.CharField(source='escalation_role.name', read_only=True)

    class Meta:
        model = ApprovalThreshold
        fields = [
            'id',
            'organization',
            'organization_name',
            'document_type',
            'min_amount',
            'max_amount',
            'currency',
            'required_role',
            'required_role_name',
            'auto_approve',
            'require_budget_check',
            'escalation_hours',
            'escalation_role',
            'escalation_role_name',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        min_amount = attrs.get('min_amount', 0)
        max_amount = attrs.get('max_amount')

        if max_amount is not None and max_amount <= min_amount:
            raise serializers.ValidationError({
                'max_amount': 'Max amount must be greater than min amount.'
            })

        return attrs


class SystemPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for SystemPreference model."""

    typed_value = serializers.SerializerMethodField()

    class Meta:
        model = SystemPreference
        fields = [
            'id',
            'organization',
            'key',
            'value',
            'typed_value',
            'value_type',
            'category',
            'label',
            'description',
            'is_secret',
            'is_editable',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_typed_value(self, obj):
        if obj.is_secret:
            return '********'
        return obj.get_typed_value()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_secret:
            data['value'] = '********'
        return data


class SystemPreferenceBulkUpdateSerializer(serializers.Serializer):
    """Serializer for bulk updating system preferences."""

    preferences = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_preferences(self, value):
        for pref in value:
            if 'key' not in pref:
                raise serializers.ValidationError('Each preference must have a key.')
            if 'value' not in pref:
                raise serializers.ValidationError('Each preference must have a value.')
        return value


class APIKeySerializer(serializers.ModelSerializer):
    """Serializer for APIKey model."""

    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = APIKey
        fields = [
            'id',
            'organization',
            'name',
            'key_prefix',
            'scopes',
            'rate_limit',
            'expires_at',
            'last_used_at',
            'is_active',
            'is_expired',
            'is_valid',
            'created_by',
            'created_by_email',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'key_prefix', 'is_expired', 'is_valid',
            'last_used_at', 'created_at', 'updated_at'
        ]


class APIKeyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating API keys."""

    class Meta:
        model = APIKey
        fields = [
            'name',
            'scopes',
            'rate_limit',
            'expires_at',
        ]


class APIKeyResponseSerializer(serializers.Serializer):
    """Serializer for API key creation response (includes the full key once)."""

    api_key = APIKeySerializer()
    key = serializers.CharField(help_text='The full API key. This is only shown once.')


# =============================================================================
# Notification Serializers
# =============================================================================

class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""

    class Meta:
        model = Notification
        fields = [
            'id',
            'type',
            'title',
            'message',
            'status',
            'priority',
            'related_object_type',
            'related_object_id',
            'link',
            'read_at',
            'created_at',
        ]
        read_only_fields = ['id', 'type', 'title', 'message', 'priority',
                           'related_object_type', 'related_object_id', 'link',
                           'read_at', 'created_at']


class NotificationSummarySerializer(serializers.Serializer):
    """Serializer for notification summary/counts."""

    total = serializers.IntegerField()
    unread = serializers.IntegerField()
    urgent = serializers.IntegerField()


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications (admin/system use)."""

    class Meta:
        model = Notification
        fields = [
            'user',
            'type',
            'title',
            'message',
            'priority',
            'related_object_type',
            'related_object_id',
            'link',
            'metadata',
        ]

"""
Serializers for Audit module.
"""

from rest_framework import serializers

from apps.audit.models import AuditConfiguration, AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog read operations."""

    content_type_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'timestamp',
            'user',
            'user_email',
            'ip_address',
            'user_agent',
            'organization',
            'content_type',
            'content_type_name',
            'object_id',
            'object_repr',
            'action',
            'action_display',
            'from_state',
            'to_state',
            'changes',
            'extra_data',
        ]
        read_only_fields = fields

    def get_content_type_name(self, obj):
        """Return human-readable content type name."""
        return f"{obj.content_type.app_label}.{obj.content_type.model}"


class AuditLogListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    content_type_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'timestamp',
            'user_email',
            'content_type_name',
            'object_id',
            'object_repr',
            'action',
            'action_display',
            'from_state',
            'to_state',
        ]
        read_only_fields = fields

    def get_content_type_name(self, obj):
        """Return human-readable content type name."""
        return f"{obj.content_type.app_label}.{obj.content_type.model}"


class AuditConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for AuditConfiguration."""

    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True,
    )

    class Meta:
        model = AuditConfiguration
        fields = [
            'organization',
            'organization_name',
            'enabled',
            'retention_days',
            'track_field_changes',
            'excluded_fields',
        ]
        read_only_fields = ['organization', 'organization_name']


class ObjectHistoryRequestSerializer(serializers.Serializer):
    """Serializer for for_object endpoint request parameters."""

    content_type = serializers.CharField(
        help_text="Content type in format 'app_label.model_name'"
    )
    object_id = serializers.UUIDField(
        help_text="UUID of the object"
    )

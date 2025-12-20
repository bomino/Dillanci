"""
Admin configuration for Audit models.
"""

from django.contrib import admin

from apps.audit.models import AuditConfiguration, AuditLog
from apps.audit.security_models import SecurityEvent


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin configuration for AuditLog."""

    list_display = [
        'timestamp',
        'action',
        'object_repr',
        'user_email',
        'organization',
        'from_state',
        'to_state',
    ]
    list_filter = [
        'action',
        'organization',
        'content_type',
        'timestamp',
    ]
    search_fields = [
        'object_repr',
        'user_email',
        'object_id',
    ]
    readonly_fields = [
        'id',
        'timestamp',
        'user',
        'user_email',
        'ip_address',
        'user_agent',
        'organization',
        'content_type',
        'object_id',
        'object_repr',
        'action',
        'from_state',
        'to_state',
        'changes',
        'extra_data',
    ]
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

    fieldsets = (
        (None, {
            'fields': (
                'id',
                'timestamp',
                'action',
                'organization',
            )
        }),
        ('User Info', {
            'fields': (
                'user',
                'user_email',
                'ip_address',
                'user_agent',
            )
        }),
        ('Object Info', {
            'fields': (
                'content_type',
                'object_id',
                'object_repr',
            )
        }),
        ('State Transition', {
            'fields': (
                'from_state',
                'to_state',
            ),
            'classes': ('collapse',),
        }),
        ('Changes', {
            'fields': (
                'changes',
                'extra_data',
            ),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        """Audit logs should only be created programmatically."""
        return False

    def has_change_permission(self, request, obj=None):
        """Audit logs are immutable."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete audit logs."""
        return request.user.is_superuser


@admin.register(AuditConfiguration)
class AuditConfigurationAdmin(admin.ModelAdmin):
    """Admin configuration for AuditConfiguration."""

    list_display = [
        'organization',
        'enabled',
        'retention_days',
        'track_field_changes',
    ]
    list_filter = [
        'enabled',
        'track_field_changes',
    ]
    search_fields = [
        'organization__name',
    ]

    fieldsets = (
        (None, {
            'fields': (
                'organization',
                'enabled',
            )
        }),
        ('Settings', {
            'fields': (
                'retention_days',
                'track_field_changes',
                'excluded_fields',
            )
        }),
    )


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    """Admin configuration for SecurityEvent."""

    list_display = [
        'timestamp',
        'event_type',
        'severity',
        'user_email',
        'ip_address',
        'success',
        'organization',
    ]
    list_filter = [
        'event_type',
        'severity',
        'success',
        'organization',
        'timestamp',
    ]
    search_fields = [
        'user_email',
        'target_email',
        'ip_address',
        'description',
        'correlation_id',
    ]
    readonly_fields = [
        'id',
        'timestamp',
        'event_type',
        'severity',
        'user',
        'user_email',
        'organization',
        'ip_address',
        'user_agent',
        'description',
        'details',
        'target_user',
        'target_email',
        'correlation_id',
        'success',
        'failure_reason',
    ]
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

    fieldsets = (
        (None, {
            'fields': (
                'id',
                'timestamp',
                'event_type',
                'severity',
                'success',
                'failure_reason',
            )
        }),
        ('User Info', {
            'fields': (
                'user',
                'user_email',
                'organization',
            )
        }),
        ('Target', {
            'fields': (
                'target_user',
                'target_email',
            ),
            'classes': ('collapse',),
        }),
        ('Request Info', {
            'fields': (
                'ip_address',
                'user_agent',
                'correlation_id',
            )
        }),
        ('Details', {
            'fields': (
                'description',
                'details',
            ),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        """Security events should only be created programmatically."""
        return False

    def has_change_permission(self, request, obj=None):
        """Security events are immutable."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete security events."""
        return request.user.is_superuser

"""
Admin configuration for Organization models.
"""

from django.contrib import admin, messages
from django.db.models import Count
from django.utils.html import format_html

from apps.organizations.models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    """Admin configuration for Organization model."""

    list_display = [
        'name',
        'code',
        'status',
        'user_count',
        'role_count',
        'default_currency',
        'timezone',
        'created_at',
    ]
    list_filter = ['status', 'default_currency', 'timezone']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at', 'user_count', 'role_count']
    ordering = ['name']

    fieldsets = (
        (None, {
            'fields': ('name', 'code', 'status')
        }),
        ('Settings', {
            'fields': ('timezone', 'default_currency', 'fiscal_year_start_month')
        }),
        ('Statistics', {
            'fields': ('user_count', 'role_count'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _user_count=Count('users', distinct=True),
            _role_count=Count('roles', distinct=True),
        )

    def user_count(self, obj):
        count = getattr(obj, '_user_count', obj.users.count())
        return format_html(
            '<a href="/admin/users/user/?organization__id__exact={}">{} users</a>',
            obj.id,
            count
        )
    user_count.short_description = 'Users'
    user_count.admin_order_field = '_user_count'

    def role_count(self, obj):
        count = getattr(obj, '_role_count', obj.roles.count())
        return format_html(
            '<a href="/admin/users/role/?organization__id__exact={}">{} roles</a>',
            obj.id,
            count
        )
    role_count.short_description = 'Roles'
    role_count.admin_order_field = '_role_count'

    actions = ['activate_organizations', 'deactivate_organizations', 'create_default_roles']

    @admin.action(description='Activate selected organizations')
    def activate_organizations(self, request, queryset):
        count = queryset.update(status='ACTIVE')
        self.message_user(request, f'{count} organizations activated.', messages.SUCCESS)

    @admin.action(description='Deactivate selected organizations')
    def deactivate_organizations(self, request, queryset):
        count = queryset.update(status='INACTIVE')
        self.message_user(request, f'{count} organizations deactivated.', messages.SUCCESS)

    @admin.action(description='Create default roles for selected organizations')
    def create_default_roles(self, request, queryset):
        from apps.users.models import Role, RolePresets

        created_count = 0
        for org in queryset:
            for preset in RolePresets.all_presets():
                role, created = Role.create_from_preset(preset, organization=org)
                if created:
                    created_count += 1

        self.message_user(
            request,
            f'{created_count} roles created for {queryset.count()} organizations.',
            messages.SUCCESS
        )

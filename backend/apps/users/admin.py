"""
Admin configuration for User and RBAC models.
Provides full role-based access control management in Django Admin.
"""

from django import forms
from django.contrib import admin, messages
from django.contrib.admin import SimpleListFilter
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.db.models import Count
from django.utils import timezone
from django.utils.html import format_html

from apps.users.models import (
    User, Role, UserRole, RoleChangeLog,
    Permissions, RolePresets
)


# =============================================================================
# Custom Forms
# =============================================================================

class UserCreationForm(forms.ModelForm):
    """Form for creating new users in admin."""

    password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirm Password', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ('email', 'first_name', 'last_name', 'organization')

    def clean_password2(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords don't match")
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """Form for updating users in admin."""

    password = ReadOnlyPasswordHashField(
        label='Password',
        help_text='Raw passwords are not stored, so there is no way to see '
                  'this user\'s password, but you can change the password '
                  'using <a href="../password/">this form</a>.'
    )

    class Meta:
        model = User
        fields = '__all__'


class RoleForm(forms.ModelForm):
    """Form for Role with permission selection."""

    # Multi-select for permissions
    permission_choices = forms.MultipleChoiceField(
        choices=Permissions.get_choices(),
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label='Permissions'
    )

    class Meta:
        model = Role
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['permission_choices'].initial = self.instance.permissions or []

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.permissions = list(self.cleaned_data.get('permission_choices', []))
        if commit:
            instance.save()
        return instance


# =============================================================================
# Filters
# =============================================================================

class OrganizationFilter(SimpleListFilter):
    """Filter by organization."""
    title = 'Organization'
    parameter_name = 'organization'

    def lookups(self, request, model_admin):
        from apps.organizations.models import Organization
        return [(org.id, org.name) for org in Organization.objects.all()]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(organization_id=self.value())
        return queryset


class RoleTypeFilter(SimpleListFilter):
    """Filter by role type."""
    title = 'Role Type'
    parameter_name = 'role_type'

    def lookups(self, request, model_admin):
        return Role.ROLE_TYPES

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(role_type=self.value())
        return queryset


class RoleValidityFilter(SimpleListFilter):
    """Filter user roles by validity."""
    title = 'Validity'
    parameter_name = 'validity'

    def lookups(self, request, model_admin):
        return [
            ('active', 'Currently Active'),
            ('expired', 'Expired'),
            ('future', 'Future (Not Yet Active)'),
            ('permanent', 'Permanent'),
            ('temporary', 'Temporary'),
        ]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == 'active':
            return queryset.filter(
                is_active=True,
                valid_from__lte=now
            ).filter(
                models.Q(valid_to__isnull=True) | models.Q(valid_to__gte=now)
            )
        elif self.value() == 'expired':
            return queryset.filter(valid_to__lt=now)
        elif self.value() == 'future':
            return queryset.filter(valid_from__gt=now)
        elif self.value() == 'permanent':
            return queryset.filter(valid_to__isnull=True)
        elif self.value() == 'temporary':
            return queryset.filter(valid_to__isnull=False)
        return queryset


# =============================================================================
# Inline Admins
# =============================================================================

class UserRoleInline(admin.TabularInline):
    """Inline for managing user roles from User admin."""

    model = UserRole
    extra = 1
    fk_name = 'user'
    autocomplete_fields = ['role']
    readonly_fields = ['created_at', 'is_valid_display', 'is_delegated_display']
    fields = [
        'role',
        'is_active',
        'valid_from',
        'valid_to',
        'custom_approval_limit',
        'is_valid_display',
        'is_delegated_display',
        'notes',
    ]

    def is_valid_display(self, obj):
        if obj.pk:
            return format_html(
                '<span style="color: {};">{}</span>',
                'green' if obj.is_valid else 'red',
                '✓ Valid' if obj.is_valid else '✗ Invalid'
            )
        return '-'
    is_valid_display.short_description = 'Status'

    def is_delegated_display(self, obj):
        if obj.pk and obj.is_delegated:
            return format_html(
                '<span title="Delegated by {}">👤 Delegated</span>',
                obj.delegated_by.email if obj.delegated_by else 'Unknown'
            )
        return '-'
    is_delegated_display.short_description = 'Delegation'


class RoleUserInline(admin.TabularInline):
    """Inline for viewing users assigned to a role."""

    model = UserRole
    extra = 0
    fk_name = 'role'
    readonly_fields = ['user', 'valid_from', 'valid_to', 'is_active', 'assigned_by', 'created_at']
    fields = ['user', 'is_active', 'valid_from', 'valid_to', 'assigned_by', 'created_at']
    can_delete = False
    max_num = 0

    def has_add_permission(self, request, obj=None):
        return False


# =============================================================================
# Model Admins
# =============================================================================

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model."""

    form = UserChangeForm
    add_form = UserCreationForm

    list_display = [
        'email',
        'full_name',
        'organization',
        'status',
        'roles_display',
        'is_staff',
        'is_superuser',
        'is_active',
        'created_at',
    ]
    list_filter = [
        'status',
        'is_staff',
        'is_superuser',
        'is_active',
        OrganizationFilter,
        'created_at',
    ]
    search_fields = ['email', 'first_name', 'last_name', 'employee_id']
    ordering = ['email']
    readonly_fields = ['created_at', 'updated_at', 'last_login', 'permissions_display']

    fieldsets = (
        (None, {
            'fields': ('email', 'password')
        }),
        ('Personal Info', {
            'fields': ('first_name', 'last_name', 'employee_id')
        }),
        ('Organization', {
            'fields': ('organization',)
        }),
        ('Status', {
            'fields': ('status', 'is_active')
        }),
        ('Admin Permissions', {
            'fields': ('is_staff', 'is_superuser'),
            'classes': ('collapse',),
            'description': 'Staff users can access admin. Superusers have all permissions.'
        }),
        ('Django Permissions', {
            'fields': ('groups', 'user_permissions'),
            'classes': ('collapse',),
            'description': 'Legacy Django permission system. Use Roles instead.'
        }),
        ('Effective Permissions', {
            'fields': ('permissions_display',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('last_login', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email',
                'first_name',
                'last_name',
                'organization',
                'password1',
                'password2',
            ),
        }),
    )

    inlines = [UserRoleInline]

    def roles_display(self, obj):
        """Display user's roles as badges."""
        roles = obj.user_roles.filter(is_active=True).select_related('role')[:3]
        if not roles:
            return format_html('<span style="color: gray;">No roles</span>')

        badges = []
        for ur in roles:
            color = '#28a745' if ur.is_valid else '#dc3545'
            badges.append(format_html(
                '<span style="background-color: {}; color: white; padding: 2px 6px; '
                'border-radius: 3px; margin-right: 4px; font-size: 11px;">{}</span>',
                color, ur.role.name
            ))

        total = obj.user_roles.filter(is_active=True).count()
        if total > 3:
            badges.append(format_html(
                '<span style="color: gray; font-size: 11px;">+{} more</span>',
                total - 3
            ))

        return format_html(''.join(str(b) for b in badges))
    roles_display.short_description = 'Roles'

    def permissions_display(self, obj):
        """Display effective permissions."""
        if obj.is_superuser:
            return format_html(
                '<span style="color: green; font-weight: bold;">SUPERUSER - All Permissions</span>'
            )

        permissions = obj.get_permissions()
        if not permissions:
            return format_html('<span style="color: gray;">No permissions</span>')

        # Group by module
        modules = {}
        for perm in sorted(permissions):
            module, action = perm.split('.', 1)
            if module not in modules:
                modules[module] = []
            modules[module].append(action)

        html = ['<div style="column-count: 2; column-gap: 20px;">']
        for module, actions in sorted(modules.items()):
            html.append(f'<div style="break-inside: avoid; margin-bottom: 10px;">')
            html.append(f'<strong>{module.title()}</strong><br>')
            for action in sorted(actions):
                html.append(f'<span style="margin-left: 10px;">• {action}</span><br>')
            html.append('</div>')
        html.append('</div>')

        return format_html(''.join(html))
    permissions_display.short_description = 'Effective Permissions'

    actions = ['activate_users', 'deactivate_users', 'suspend_users', 'assign_role']

    @admin.action(description='Activate selected users')
    def activate_users(self, request, queryset):
        count = queryset.update(status='ACTIVE', is_active=True)
        self.message_user(request, f'{count} users activated.', messages.SUCCESS)

    @admin.action(description='Deactivate selected users')
    def deactivate_users(self, request, queryset):
        count = queryset.update(status='INACTIVE', is_active=False)
        self.message_user(request, f'{count} users deactivated.', messages.SUCCESS)

    @admin.action(description='Suspend selected users')
    def suspend_users(self, request, queryset):
        count = queryset.update(status='SUSPENDED', is_active=False)
        self.message_user(request, f'{count} users suspended.', messages.WARNING)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Admin configuration for Role model."""

    form = RoleForm
    list_display = [
        'name',
        'code',
        'role_type',
        'organization',
        'user_count',
        'permission_count',
        'approval_limit_display',
        'is_active',
        'is_system_role',
    ]
    list_filter = [
        'role_type',
        'is_active',
        'is_system_role',
        OrganizationFilter,
    ]
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['created_at', 'updated_at', 'user_count', 'permissions_preview']
    raw_id_fields = ['organization', 'parent_role']

    fieldsets = (
        (None, {
            'fields': ('name', 'code', 'description')
        }),
        ('Scope', {
            'fields': ('role_type', 'organization', 'parent_role'),
            'description': 'System roles apply globally. Organization roles are scoped to one org.'
        }),
        ('Approval Authority', {
            'fields': ('approval_limit', 'currency'),
            'description': 'Maximum amount users with this role can approve.'
        }),
        ('Permissions', {
            'fields': ('permission_choices', 'permissions_preview'),
            'description': 'Select the permissions granted by this role.'
        }),
        ('Status', {
            'fields': ('is_active', 'is_system_role'),
        }),
        ('Statistics', {
            'fields': ('user_count',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    inlines = [RoleUserInline]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _user_count=Count('user_assignments', filter=models.Q(user_assignments__is_active=True))
        )

    def user_count(self, obj):
        count = getattr(obj, '_user_count', obj.user_assignments.filter(is_active=True).count())
        return format_html(
            '<a href="{}?role__id__exact={}">{} users</a>',
            '/admin/users/userrole/',
            obj.id,
            count
        )
    user_count.short_description = 'Users'
    user_count.admin_order_field = '_user_count'

    def permission_count(self, obj):
        count = len(obj.permissions or [])
        inherited = len(obj.get_permissions_list()) - count
        if inherited > 0:
            return f'{count} (+{inherited} inherited)'
        return str(count)
    permission_count.short_description = 'Permissions'

    def approval_limit_display(self, obj):
        if obj.approval_limit:
            return f'{obj.currency} {obj.approval_limit:,.2f}'
        return '-'
    approval_limit_display.short_description = 'Approval Limit'

    def permissions_preview(self, obj):
        """Display permissions in a readable format."""
        permissions = obj.get_permissions_list()
        if not permissions:
            return format_html('<span style="color: gray;">No permissions</span>')

        # Group by module
        modules = {}
        own_perms = set(obj.permissions or [])
        for perm in sorted(permissions):
            module, action = perm.split('.', 1)
            if module not in modules:
                modules[module] = []
            is_inherited = perm not in own_perms
            modules[module].append((action, is_inherited))

        html = ['<div style="column-count: 3; column-gap: 20px;">']
        for module, actions in sorted(modules.items()):
            html.append(f'<div style="break-inside: avoid; margin-bottom: 10px;">')
            html.append(f'<strong>{module.title()}</strong><br>')
            for action, inherited in sorted(actions):
                style = 'color: #666; font-style: italic;' if inherited else ''
                suffix = ' (inherited)' if inherited else ''
                html.append(f'<span style="margin-left: 10px; {style}">• {action}{suffix}</span><br>')
            html.append('</div>')
        html.append('</div>')

        return format_html(''.join(html))
    permissions_preview.short_description = 'Permissions Preview'

    actions = ['create_preset_roles', 'duplicate_role', 'activate_roles', 'deactivate_roles']

    @admin.action(description='Create preset roles for selected organizations')
    def create_preset_roles(self, request, queryset):
        # This action is mainly for creating system roles
        created_count = 0
        for preset in RolePresets.all_presets():
            role, created = Role.create_from_preset(preset, organization=None)
            if created:
                role.is_system_role = True
                role.role_type = 'SYSTEM'
                role.save()
                created_count += 1

        self.message_user(
            request,
            f'{created_count} system roles created from presets.',
            messages.SUCCESS
        )

    @admin.action(description='Duplicate selected roles')
    def duplicate_role(self, request, queryset):
        for role in queryset:
            role.pk = None
            role.code = f'{role.code}_copy'
            role.name = f'{role.name} (Copy)'
            role.is_system_role = False
            role.save()
        self.message_user(request, f'{queryset.count()} roles duplicated.', messages.SUCCESS)

    @admin.action(description='Activate selected roles')
    def activate_roles(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} roles activated.', messages.SUCCESS)

    @admin.action(description='Deactivate selected roles')
    def deactivate_roles(self, request, queryset):
        count = queryset.filter(is_system_role=False).update(is_active=False)
        self.message_user(request, f'{count} roles deactivated.', messages.SUCCESS)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    """Admin configuration for UserRole model."""

    list_display = [
        'user',
        'role',
        'is_active',
        'validity_display',
        'approval_limit_display',
        'delegation_display',
        'assigned_by',
        'created_at',
    ]
    list_filter = [
        'is_active',
        RoleValidityFilter,
        'role__role_type',
        'role',
    ]
    search_fields = [
        'user__email',
        'user__first_name',
        'user__last_name',
        'role__name',
    ]
    readonly_fields = ['created_at', 'updated_at', 'is_valid', 'effective_permissions']
    autocomplete_fields = ['user', 'role', 'delegated_by', 'assigned_by']
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': ('user', 'role', 'is_active')
        }),
        ('Validity Period', {
            'fields': ('valid_from', 'valid_to', 'is_valid'),
            'description': 'Leave "Valid To" empty for permanent assignment.'
        }),
        ('Approval Override', {
            'fields': ('custom_approval_limit',),
            'classes': ('collapse',),
            'description': 'Override the role\'s approval limit for this user.'
        }),
        ('Delegation', {
            'fields': ('delegated_by', 'delegation_reason'),
            'classes': ('collapse',),
            'description': 'If this role was delegated from another user.'
        }),
        ('Assignment Info', {
            'fields': ('assigned_by', 'notes'),
        }),
        ('Effective Permissions', {
            'fields': ('effective_permissions',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def validity_display(self, obj):
        now = timezone.now()
        if obj.valid_to and obj.valid_to < now:
            return format_html(
                '<span style="color: red;">Expired {}</span>',
                obj.valid_to.strftime('%Y-%m-%d')
            )
        elif obj.valid_from > now:
            return format_html(
                '<span style="color: orange;">Starts {}</span>',
                obj.valid_from.strftime('%Y-%m-%d')
            )
        elif obj.valid_to:
            return format_html(
                '<span style="color: blue;">Until {}</span>',
                obj.valid_to.strftime('%Y-%m-%d')
            )
        return format_html('<span style="color: green;">Permanent</span>')
    validity_display.short_description = 'Validity'

    def approval_limit_display(self, obj):
        limit = obj.approval_limit
        if limit:
            currency = obj.role.currency if obj.role else 'USD'
            is_custom = obj.custom_approval_limit is not None
            suffix = ' (custom)' if is_custom else ''
            return f'{currency} {limit:,.2f}{suffix}'
        return '-'
    approval_limit_display.short_description = 'Approval Limit'

    def delegation_display(self, obj):
        if obj.is_delegated:
            return format_html(
                '<span title="{}">👤 {}</span>',
                obj.delegation_reason or 'No reason provided',
                obj.delegated_by.email if obj.delegated_by else 'Unknown'
            )
        return '-'
    delegation_display.short_description = 'Delegated By'

    def effective_permissions(self, obj):
        """Display permissions from the assigned role."""
        if not obj.role:
            return '-'

        permissions = obj.role.get_permissions_list()
        if not permissions:
            return format_html('<span style="color: gray;">No permissions</span>')

        return format_html(
            '<div style="max-height: 200px; overflow-y: auto;">{}</div>',
            ', '.join(sorted(permissions))
        )
    effective_permissions.short_description = 'Permissions from Role'

    actions = ['activate_assignments', 'deactivate_assignments', 'extend_validity']

    @admin.action(description='Activate selected role assignments')
    def activate_assignments(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} role assignments activated.', messages.SUCCESS)

    @admin.action(description='Deactivate selected role assignments')
    def deactivate_assignments(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} role assignments deactivated.', messages.SUCCESS)

    @admin.action(description='Extend validity by 30 days')
    def extend_validity(self, request, queryset):
        from datetime import timedelta
        now = timezone.now()
        count = 0
        for assignment in queryset:
            if assignment.valid_to:
                assignment.valid_to = max(assignment.valid_to, now) + timedelta(days=30)
            else:
                assignment.valid_to = now + timedelta(days=30)
            assignment.save()
            count += 1
        self.message_user(request, f'{count} role assignments extended by 30 days.', messages.SUCCESS)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.assigned_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(RoleChangeLog)
class RoleChangeLogAdmin(admin.ModelAdmin):
    """Admin configuration for RoleChangeLog model (read-only audit log)."""

    list_display = [
        'created_at',
        'user',
        'action',
        'role_name',
        'performed_by',
        'ip_address',
    ]
    list_filter = [
        'action',
        'created_at',
    ]
    search_fields = [
        'user__email',
        'role_name',
        'performed_by__email',
        'reason',
    ]
    readonly_fields = [
        'user',
        'role',
        'role_name',
        'action',
        'performed_by',
        'old_values',
        'new_values',
        'reason',
        'ip_address',
        'user_agent',
        'created_at',
    ]
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': ('user', 'role', 'role_name', 'action')
        }),
        ('Change Details', {
            'fields': ('old_values', 'new_values', 'reason')
        }),
        ('Performed By', {
            'fields': ('performed_by', 'ip_address', 'user_agent')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# =============================================================================
# Import models for autocomplete
# =============================================================================

# Need to import for autocomplete to work
from django.db import models

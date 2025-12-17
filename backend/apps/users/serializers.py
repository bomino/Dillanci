"""
User serializers for API endpoints.
"""

from django.contrib.auth import authenticate
from rest_framework import serializers

from apps.users.models import Permissions, Role, RoleChangeLog, RolePresets, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user list and detail views."""

    full_name = serializers.CharField(read_only=True)
    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'employee_id',
            'organization',
            'organization_name',
            'status',
            'is_active',
            'is_staff',
            'is_superuser',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_staff', 'is_superuser', 'created_at', 'updated_at']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            'email',
            'password',
            'first_name',
            'last_name',
            'employee_id',
            'organization',
        ]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        user = authenticate(
            request=self.context.get('request'),
            email=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError('Invalid email or password.')

        if not user.is_active:
            raise serializers.ValidationError('User account is disabled.')

        if user.status == 'SUSPENDED':
            raise serializers.ValidationError('User account is suspended.')

        attrs['user'] = user
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


# =============================================================================
# Role Serializers
# =============================================================================

class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""

    organization_name = serializers.CharField(source='organization.name', read_only=True)
    user_count = serializers.SerializerMethodField()
    permission_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            'id',
            'name',
            'code',
            'description',
            'role_type',
            'organization',
            'organization_name',
            'permissions',
            'parent_role',
            'approval_limit',
            'currency',
            'is_active',
            'is_system_role',
            'user_count',
            'permission_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_system_role']

    def get_user_count(self, obj):
        return obj.user_assignments.filter(is_active=True).count()

    def get_permission_count(self, obj):
        return len(obj.get_permissions_list())


class RoleCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating roles."""

    class Meta:
        model = Role
        fields = [
            'name',
            'code',
            'description',
            'role_type',
            'organization',
            'permissions',
            'parent_role',
            'approval_limit',
            'currency',
        ]

    def validate_code(self, value):
        if Role.objects.filter(code=value).exists():
            raise serializers.ValidationError('A role with this code already exists.')
        return value

    def validate_permissions(self, value):
        valid_permissions = set(p[0] for p in Permissions.all_permissions())
        invalid = set(value) - valid_permissions
        if invalid:
            raise serializers.ValidationError(f'Invalid permissions: {", ".join(invalid)}')
        return value


class RolePresetSerializer(serializers.Serializer):
    """Serializer for role presets."""

    name = serializers.CharField()
    description = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField())


# =============================================================================
# UserRole Serializers
# =============================================================================

class UserRoleSerializer(serializers.ModelSerializer):
    """Serializer for UserRole model."""

    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)
    effective_approval_limit = serializers.DecimalField(
        source='approval_limit',
        max_digits=15,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = UserRole
        fields = [
            'id',
            'user',
            'user_email',
            'user_name',
            'role',
            'role_name',
            'role_code',
            'valid_from',
            'valid_to',
            'delegated_by',
            'delegation_reason',
            'custom_approval_limit',
            'effective_approval_limit',
            'assigned_by',
            'is_active',
            'is_valid',
            'is_delegated',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_valid', 'is_delegated']


class AssignRoleSerializer(serializers.Serializer):
    """Serializer for assigning a role to a user."""

    role_id = serializers.UUIDField()
    valid_from = serializers.DateTimeField(required=False)
    valid_to = serializers.DateTimeField(required=False, allow_null=True)
    custom_approval_limit = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_role_id(self, value):
        try:
            Role.objects.get(id=value, is_active=True)
        except Role.DoesNotExist:
            raise serializers.ValidationError('Role not found or inactive.')
        return value


class RemoveRoleSerializer(serializers.Serializer):
    """Serializer for removing a role from a user."""

    role_id = serializers.UUIDField()
    reason = serializers.CharField(required=False, allow_blank=True)


# =============================================================================
# User Extended Serializers (with roles)
# =============================================================================

class UserWithRolesSerializer(UserSerializer):
    """Extended user serializer including role information."""

    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ['roles', 'permissions']

    def get_roles(self, obj):
        user_roles = obj.user_roles.filter(is_active=True).select_related('role')
        return [
            {
                'id': str(ur.id),
                'role_id': str(ur.role.id),
                'role_name': ur.role.name,
                'role_code': ur.role.code,
                'valid_from': ur.valid_from,
                'valid_to': ur.valid_to,
                'is_delegated': ur.is_delegated,
                'approval_limit': ur.approval_limit,
            }
            for ur in user_roles
        ]

    def get_permissions(self, obj):
        return list(obj.get_permissions())


class InviteUserSerializer(serializers.Serializer):
    """Serializer for inviting a new user."""

    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    role_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate_role_ids(self, value):
        if value:
            roles = Role.objects.filter(id__in=value, is_active=True)
            if len(roles) != len(value):
                raise serializers.ValidationError('One or more roles not found.')
        return value


# =============================================================================
# Role Change Log Serializer
# =============================================================================

class RoleChangeLogSerializer(serializers.ModelSerializer):
    """Serializer for role change audit logs."""

    user_email = serializers.CharField(source='user.email', read_only=True)
    performed_by_email = serializers.CharField(source='performed_by.email', read_only=True)

    class Meta:
        model = RoleChangeLog
        fields = [
            'id',
            'user',
            'user_email',
            'role',
            'role_name',
            'action',
            'performed_by',
            'performed_by_email',
            'old_values',
            'new_values',
            'reason',
            'ip_address',
            'created_at',
        ]
        read_only_fields = fields


# =============================================================================
# Permission Serializers
# =============================================================================

class PermissionSerializer(serializers.Serializer):
    """Serializer for permission list."""

    code = serializers.CharField()
    label = serializers.CharField()
    module = serializers.SerializerMethodField()

    def get_module(self, obj):
        return obj['code'].split('.')[0] if '.' in obj['code'] else 'general'


class PermissionGroupSerializer(serializers.Serializer):
    """Serializer for permissions grouped by module."""

    module = serializers.CharField()
    label = serializers.CharField()
    permissions = serializers.ListField(child=PermissionSerializer())

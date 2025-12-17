"""
User views and viewsets for API endpoints.
"""

import secrets

from django.contrib.auth import login, logout
from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import Permissions, Role, RoleChangeLog, RolePresets, User, UserRole
from apps.users.serializers import (
    AssignRoleSerializer,
    InviteUserSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PermissionSerializer,
    RemoveRoleSerializer,
    RoleChangeLogSerializer,
    RoleCreateSerializer,
    RolePresetSerializer,
    RoleSerializer,
    UserCreateSerializer,
    UserRoleSerializer,
    UserSerializer,
    UserWithRolesSerializer,
)


class LoginView(APIView):
    """Handle user login."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        return Response({
            'message': 'Login successful',
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    """Handle user logout."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'message': 'Logout successful'})


class MeView(APIView):
    """Get current user information."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordChangeView(APIView):
    """Handle password change for authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully'})


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user management.

    Admin users can list, create, and manage users.
    """

    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by organization if provided
        organization = self.request.query_params.get('organization')
        if organization:
            queryset = queryset.filter(organization_id=organization)
        # Filter by status if provided
        user_status = self.request.query_params.get('status')
        if user_status:
            queryset = queryset.filter(status=user_status)
        return queryset

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user account."""
        user = self.get_object()
        user.status = 'ACTIVE'
        user.is_active = True
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user account."""
        user = self.get_object()
        user.status = 'INACTIVE'
        user.is_active = False
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a user account."""
        user = self.get_object()
        user.status = 'SUSPENDED'
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['get'])
    def roles(self, request, pk=None):
        """Get user's role assignments."""
        user = self.get_object()
        user_roles = UserRole.objects.filter(user=user).select_related('role', 'assigned_by', 'delegated_by')
        serializer = UserRoleSerializer(user_roles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def permissions(self, request, pk=None):
        """Get user's effective permissions."""
        user = self.get_object()
        permissions = list(user.get_permissions())
        return Response({'permissions': permissions})

    @action(detail=True, methods=['post'], url_path='assign-role')
    def assign_role(self, request, pk=None):
        """Assign a role to a user."""
        user = self.get_object()
        serializer = AssignRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = Role.objects.get(id=serializer.validated_data['role_id'])

        # Check if already assigned
        existing = UserRole.objects.filter(user=user, role=role).first()
        if existing and existing.is_active:
            return Response(
                {'error': 'User already has this role.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create or reactivate assignment
        if existing:
            existing.is_active = True
            existing.valid_from = serializer.validated_data.get('valid_from', timezone.now())
            existing.valid_to = serializer.validated_data.get('valid_to')
            existing.custom_approval_limit = serializer.validated_data.get('custom_approval_limit')
            existing.notes = serializer.validated_data.get('notes', '')
            existing.assigned_by = request.user
            existing.save()
            user_role = existing
        else:
            user_role = UserRole.objects.create(
                user=user,
                role=role,
                valid_from=serializer.validated_data.get('valid_from', timezone.now()),
                valid_to=serializer.validated_data.get('valid_to'),
                custom_approval_limit=serializer.validated_data.get('custom_approval_limit'),
                notes=serializer.validated_data.get('notes', ''),
                assigned_by=request.user,
            )

        # Log the change
        RoleChangeLog.objects.create(
            user=user,
            role=role,
            role_name=role.name,
            action='ASSIGNED',
            performed_by=request.user,
            new_values={
                'valid_from': str(user_role.valid_from),
                'valid_to': str(user_role.valid_to) if user_role.valid_to else None,
                'custom_approval_limit': str(user_role.custom_approval_limit) if user_role.custom_approval_limit else None,
            },
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response(UserRoleSerializer(user_role).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='remove-role')
    def remove_role(self, request, pk=None):
        """Remove a role from a user."""
        user = self.get_object()
        serializer = RemoveRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user_role = UserRole.objects.get(
                user=user,
                role_id=serializer.validated_data['role_id'],
                is_active=True
            )
        except UserRole.DoesNotExist:
            return Response(
                {'error': 'Role assignment not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        user_role.is_active = False
        user_role.save()

        # Log the change
        RoleChangeLog.objects.create(
            user=user,
            role=user_role.role,
            role_name=user_role.role.name,
            action='REMOVED',
            performed_by=request.user,
            reason=serializer.validated_data.get('reason', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response({'message': 'Role removed successfully.'})

    @action(detail=False, methods=['post'])
    def invite(self, request):
        """Invite a new user to the organization."""
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Generate a temporary password
        temp_password = secrets.token_urlsafe(12)

        # Create the user
        user = User.objects.create_user(
            email=serializer.validated_data['email'],
            password=temp_password,
            first_name=serializer.validated_data['first_name'],
            last_name=serializer.validated_data['last_name'],
            organization=request.user.organization,
            status='ACTIVE',
        )

        # Assign roles if specified
        for role_id in serializer.validated_data.get('role_ids', []):
            role = Role.objects.get(id=role_id)
            UserRole.objects.create(
                user=user,
                role=role,
                assigned_by=request.user,
            )
            RoleChangeLog.objects.create(
                user=user,
                role=role,
                role_name=role.name,
                action='ASSIGNED',
                performed_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
            )

        # In production, send invitation email with temp_password
        # For now, return the user data
        return Response({
            'user': UserWithRolesSerializer(user).data,
            'message': 'User invited successfully.',
            # In development only - remove in production
            'temp_password': temp_password,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get user statistics for admin dashboard."""
        organization = request.user.organization

        queryset = User.objects.all()
        if organization:
            queryset = queryset.filter(organization=organization)

        total = queryset.count()
        active = queryset.filter(status='ACTIVE', is_active=True).count()
        inactive = queryset.filter(status='INACTIVE').count()
        suspended = queryset.filter(status='SUSPENDED').count()

        return Response({
            'total': total,
            'active': active,
            'inactive': inactive,
            'suspended': suspended,
        })


# =============================================================================
# Role ViewSet
# =============================================================================

class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for role management.
    """

    queryset = Role.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return RoleCreateSerializer
        return RoleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization or system roles
        organization = self.request.user.organization
        if organization:
            queryset = queryset.filter(
                models.Q(organization=organization) |
                models.Q(organization__isnull=True, role_type='SYSTEM')
            )

        # Filter by role type
        role_type = self.request.query_params.get('role_type')
        if role_type:
            queryset = queryset.filter(role_type=role_type)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.annotate(
            assigned_users=Count('user_assignments', filter=models.Q(user_assignments__is_active=True))
        )

    def perform_create(self, serializer):
        # Set organization from request user if not provided
        organization = serializer.validated_data.get('organization')
        if not organization and not serializer.validated_data.get('role_type') == 'SYSTEM':
            serializer.save(organization=self.request.user.organization)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.is_system_role:
            raise serializers.ValidationError('System roles cannot be modified.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_system_role:
            raise serializers.ValidationError('System roles cannot be deleted.')
        # Check if role has active assignments
        if instance.user_assignments.filter(is_active=True).exists():
            raise serializers.ValidationError('Cannot delete role with active user assignments.')
        instance.delete()

    @action(detail=False, methods=['get'])
    def presets(self, request):
        """List available role presets."""
        presets = RolePresets.all_presets()
        serializer = RolePresetSerializer(presets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='from-preset')
    def create_from_preset(self, request):
        """Create a role from a preset."""
        preset_name = request.data.get('preset_name')
        custom_name = request.data.get('name')
        organization = request.user.organization

        # Find the preset
        preset = None
        for p in RolePresets.all_presets():
            if p['name'].lower() == preset_name.lower():
                preset = p
                break

        if not preset:
            return Response(
                {'error': f'Preset "{preset_name}" not found.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the role
        role_data = preset.copy()
        if custom_name:
            role_data['name'] = custom_name

        role, created = Role.create_from_preset(role_data, organization)

        if not created:
            return Response(
                {'error': 'Role with this code already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """List users assigned to this role."""
        role = self.get_object()
        assignments = UserRole.objects.filter(role=role, is_active=True).select_related('user')
        serializer = UserRoleSerializer(assignments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def permissions(self, request):
        """List all available permissions grouped by module."""
        all_perms = Permissions.all_permissions()

        # Group by module
        modules = {}
        for code, label in all_perms:
            module = code.split('.')[0]
            if module not in modules:
                modules[module] = {
                    'module': module,
                    'label': module.replace('_', ' ').title(),
                    'permissions': []
                }
            modules[module]['permissions'].append({
                'code': code,
                'label': label.replace('_', ' ').title()
            })

        return Response(list(modules.values()))

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get role statistics."""
        organization = request.user.organization

        queryset = Role.objects.all()
        if organization:
            queryset = queryset.filter(
                models.Q(organization=organization) |
                models.Q(organization__isnull=True, role_type='SYSTEM')
            )

        system_roles = queryset.filter(role_type='SYSTEM').count()
        org_roles = queryset.filter(role_type='ORGANIZATION').count()
        custom_roles = queryset.filter(role_type='CUSTOM').count()
        total_assignments = UserRole.objects.filter(
            role__in=queryset,
            is_active=True
        ).count()

        return Response({
            'system_roles': system_roles,
            'organization_roles': org_roles,
            'custom_roles': custom_roles,
            'total_assignments': total_assignments,
        })


# =============================================================================
# Role Change Log ViewSet
# =============================================================================

class RoleChangeLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing role change audit logs.
    """

    queryset = RoleChangeLog.objects.all()
    serializer_class = RoleChangeLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization
        organization = self.request.user.organization
        if organization:
            queryset = queryset.filter(user__organization=organization)

        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by role
        role_id = self.request.query_params.get('role')
        if role_id:
            queryset = queryset.filter(role_id=role_id)

        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)

        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(created_at__gte=from_date)
        if to_date:
            queryset = queryset.filter(created_at__lte=to_date)

        return queryset.select_related('user', 'role', 'performed_by')


# Need to import models for Q objects
from django.db import models
from rest_framework import serializers

"""
Organization views and viewsets for API endpoints.
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from apps.organizations.models import Organization
from apps.organizations.serializers import (
    OrganizationCreateSerializer,
    OrganizationSerializer,
)


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for organization management.

    Admin users can manage all organizations.
    Regular users can view their own organization.
    """

    queryset = Organization.objects.all()
    filterset_fields = ['status']
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'activate', 'deactivate', 'suspend']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        return OrganizationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Admin sees all organizations
        if user.is_staff:
            return queryset

        # Regular users only see their organization
        if user.organization:
            return queryset.filter(id=user.organization_id)

        return queryset.none()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def activate(self, request, pk=None):
        """Activate an organization."""
        org = self.get_object()
        org.status = 'ACTIVE'
        org.save()
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def deactivate(self, request, pk=None):
        """Deactivate an organization."""
        org = self.get_object()
        org.status = 'INACTIVE'
        org.save()
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def suspend(self, request, pk=None):
        """Suspend an organization."""
        org = self.get_object()
        org.status = 'SUSPENDED'
        org.save()
        return Response(OrganizationSerializer(org).data)

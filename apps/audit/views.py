"""
ViewSets for Audit module.
"""

from django.contrib.contenttypes.models import ContentType
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditConfiguration, AuditLog
from apps.audit.serializers import (
    AuditConfigurationSerializer,
    AuditLogListSerializer,
    AuditLogSerializer,
    ObjectHistoryRequestSerializer,
)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing audit logs.

    Provides read-only access to audit logs for the user's organization.

    list:
        Get paginated list of audit logs.
        Supports filtering by action, content_type, user, date range.

    retrieve:
        Get detailed audit log entry.

    for_object:
        Get audit history for a specific object.
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return AuditLogListSerializer
        return AuditLogSerializer

    def get_queryset(self):
        """Filter audit logs to user's organization."""
        user = self.request.user
        if not hasattr(user, 'organization') or not user.organization:
            return AuditLog.objects.none()

        queryset = AuditLog.objects.filter(
            organization=user.organization
        ).select_related('user', 'content_type')

        # Filter by action
        action_filter = self.request.query_params.get('action')
        if action_filter:
            queryset = queryset.filter(action=action_filter)

        # Filter by content type
        content_type = self.request.query_params.get('content_type')
        if content_type:
            try:
                app_label, model = content_type.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                queryset = queryset.filter(content_type=ct)
            except (ValueError, ContentType.DoesNotExist):
                pass

        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(timestamp__date__gte=from_date)

        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(timestamp__date__lte=to_date)

        return queryset

    @action(detail=False, methods=['get'])
    def for_object(self, request):
        """
        Get audit history for a specific object.

        Query params:
            content_type: Content type in format 'app_label.model_name'
            object_id: UUID of the object
        """
        serializer = ObjectHistoryRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        content_type_str = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']

        try:
            app_label, model = content_type_str.split('.')
            content_type = ContentType.objects.get(app_label=app_label, model=model)
        except (ValueError, ContentType.DoesNotExist):
            return Response(
                {'error': f"Invalid content type: {content_type_str}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset().filter(
            content_type=content_type,
            object_id=object_id,
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(queryset, many=True)
        return Response(serializer.data)


class AuditConfigurationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing audit configuration.

    Provides CRUD for organization audit settings.
    Only allows access to the user's own organization config.
    """

    serializer_class = AuditConfigurationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter to user's organization config only."""
        user = self.request.user
        if not hasattr(user, 'organization') or not user.organization:
            return AuditConfiguration.objects.none()

        return AuditConfiguration.objects.filter(
            organization=user.organization
        )

    def list(self, request, *args, **kwargs):
        """Get or create config for user's organization."""
        user = request.user
        if not hasattr(user, 'organization') or not user.organization:
            return Response({'results': []})

        config = AuditConfiguration.get_for_organization(user.organization)
        serializer = self.get_serializer(config)
        return Response({'results': [serializer.data]})

    def create(self, request, *args, **kwargs):
        """Create is not allowed - config is auto-created."""
        return Response(
            {'error': 'Configuration is created automatically. Use PUT to update.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

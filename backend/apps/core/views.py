"""
Core views for admin configuration endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from rest_framework.parsers import FormParser, MultiPartParser

from apps.core.models import APIKey, ApprovalThreshold, Attachment, Comment, Notification, SystemPreference
from apps.core.serializers import (
    APIKeyCreateSerializer,
    APIKeyResponseSerializer,
    APIKeySerializer,
    ApprovalThresholdSerializer,
    AttachmentSerializer,
    AttachmentUploadSerializer,
    CommentCreateSerializer,
    CommentSerializer,
    CommentUpdateSerializer,
    NotificationCreateSerializer,
    NotificationSerializer,
    NotificationSummarySerializer,
    SystemPreferenceBulkUpdateSerializer,
    SystemPreferenceSerializer,
)


class ApprovalThresholdViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing approval thresholds.
    """

    queryset = ApprovalThreshold.objects.all()
    serializer_class = ApprovalThresholdSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization
        organization = self.request.user.organization
        if organization:
            queryset = queryset.filter(organization=organization)

        # Filter by document type
        document_type = self.request.query_params.get('document_type')
        if document_type:
            queryset = queryset.filter(document_type=document_type)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.select_related('required_role', 'escalation_role')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    @action(detail=False, methods=['get'], url_path='for-amount')
    def for_amount(self, request):
        """Get the applicable threshold for a specific amount and document type."""
        document_type = request.query_params.get('document_type')
        amount = request.query_params.get('amount')

        if not document_type or not amount:
            return Response(
                {'error': 'document_type and amount are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = float(amount)
        except ValueError:
            return Response(
                {'error': 'amount must be a valid number.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        organization = request.user.organization
        threshold = ApprovalThreshold.objects.filter(
            organization=organization,
            document_type=document_type,
            min_amount__lte=amount,
            is_active=True
        ).filter(
            models.Q(max_amount__gte=amount) | models.Q(max_amount__isnull=True)
        ).first()

        if threshold:
            return Response(ApprovalThresholdSerializer(threshold).data)
        return Response({'threshold': None})


class SystemPreferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing system preferences.
    """

    queryset = SystemPreference.objects.all()
    serializer_class = SystemPreferenceSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization
        organization = self.request.user.organization
        if organization:
            queryset = queryset.filter(organization=organization)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Filter by key prefix
        key_prefix = self.request.query_params.get('key_prefix')
        if key_prefix:
            queryset = queryset.filter(key__startswith=key_prefix)

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        instance = self.get_object()
        if not instance.is_editable:
            raise serializers.ValidationError('This preference cannot be edited.')
        serializer.save()

    @action(detail=False, methods=['get'], url_path='by-key/(?P<key>[^/.]+)')
    def by_key(self, request, key=None):
        """Get a preference by its key."""
        organization = request.user.organization
        try:
            preference = SystemPreference.objects.get(
                organization=organization,
                key=key
            )
            return Response(SystemPreferenceSerializer(preference).data)
        except SystemPreference.DoesNotExist:
            return Response(
                {'error': f'Preference "{key}" not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        """Bulk update multiple preferences at once."""
        serializer = SystemPreferenceBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        organization = request.user.organization
        updated = []
        errors = []

        for pref_data in serializer.validated_data['preferences']:
            key = pref_data['key']
            value = pref_data['value']

            try:
                pref = SystemPreference.objects.get(
                    organization=organization,
                    key=key
                )
                if not pref.is_editable:
                    errors.append({'key': key, 'error': 'Not editable'})
                    continue

                pref.set_typed_value(value)
                pref.save()
                updated.append(key)
            except SystemPreference.DoesNotExist:
                errors.append({'key': key, 'error': 'Not found'})

        return Response({
            'updated': updated,
            'errors': errors,
        })

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """List all available preference categories."""
        return Response([
            {'value': choice[0], 'label': choice[1]}
            for choice in SystemPreference.CATEGORIES
        ])

    @action(detail=False, methods=['post'], url_path='initialize-defaults')
    def initialize_defaults(self, request):
        """Initialize default preferences for the organization."""
        organization = request.user.organization

        defaults = [
            # General settings
            {'key': 'company_name', 'value': organization.name, 'value_type': 'STRING', 'category': 'GENERAL', 'label': 'Company Name'},
            {'key': 'timezone', 'value': 'UTC', 'value_type': 'STRING', 'category': 'GENERAL', 'label': 'Timezone'},
            {'key': 'default_currency', 'value': 'USD', 'value_type': 'STRING', 'category': 'GENERAL', 'label': 'Default Currency'},
            {'key': 'fiscal_year_start', 'value': '1', 'value_type': 'INTEGER', 'category': 'GENERAL', 'label': 'Fiscal Year Start Month'},
            {'key': 'date_format', 'value': 'YYYY-MM-DD', 'value_type': 'STRING', 'category': 'GENERAL', 'label': 'Date Format'},

            # Notification settings
            {'key': 'notify_requisition_approved', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'NOTIFICATIONS', 'label': 'Notify on Requisition Approval'},
            {'key': 'notify_requisition_rejected', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'NOTIFICATIONS', 'label': 'Notify on Requisition Rejection'},
            {'key': 'notify_po_created', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'NOTIFICATIONS', 'label': 'Notify on PO Creation'},
            {'key': 'notify_invoice_received', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'NOTIFICATIONS', 'label': 'Notify on Invoice Received'},
            {'key': 'notify_contract_expiring', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'NOTIFICATIONS', 'label': 'Notify on Contract Expiring'},
            {'key': 'notification_digest_frequency', 'value': 'DAILY', 'value_type': 'STRING', 'category': 'NOTIFICATIONS', 'label': 'Notification Digest Frequency'},

            # Security settings
            {'key': 'password_min_length', 'value': '8', 'value_type': 'INTEGER', 'category': 'SECURITY', 'label': 'Minimum Password Length'},
            {'key': 'password_require_special', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'SECURITY', 'label': 'Require Special Characters'},
            {'key': 'password_expiry_days', 'value': '90', 'value_type': 'INTEGER', 'category': 'SECURITY', 'label': 'Password Expiry (Days)'},
            {'key': 'session_timeout_minutes', 'value': '30', 'value_type': 'INTEGER', 'category': 'SECURITY', 'label': 'Session Timeout (Minutes)'},
            {'key': 'require_2fa', 'value': 'false', 'value_type': 'BOOLEAN', 'category': 'SECURITY', 'label': 'Require Two-Factor Authentication'},

            # Workflow settings
            {'key': 'auto_approve_from_requisition', 'value': 'false', 'value_type': 'BOOLEAN', 'category': 'WORKFLOW', 'label': 'Auto-approve PO from Approved Requisition'},
            {'key': 'require_budget_check', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'WORKFLOW', 'label': 'Require Budget Check'},
            {'key': 'notify_supplier_on_po', 'value': 'true', 'value_type': 'BOOLEAN', 'category': 'WORKFLOW', 'label': 'Notify Supplier on PO Approval'},
            {'key': 'approval_escalation_hours', 'value': '24', 'value_type': 'INTEGER', 'category': 'WORKFLOW', 'label': 'Approval Escalation (Hours)'},
        ]

        created = []
        for pref in defaults:
            obj, was_created = SystemPreference.objects.get_or_create(
                organization=organization,
                key=pref['key'],
                defaults=pref
            )
            if was_created:
                created.append(pref['key'])

        return Response({
            'message': f'Initialized {len(created)} default preferences.',
            'created': created,
        })


class APIKeyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing API keys.
    """

    queryset = APIKey.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return APIKeyCreateSerializer
        return APIKeySerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization
        organization = self.request.user.organization
        if organization:
            queryset = queryset.filter(organization=organization)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.select_related('created_by')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Generate the key
        raw_key = APIKey.generate_key()
        key_hash = APIKey.hash_key(raw_key)
        key_prefix = raw_key[:8]

        # Create the API key record
        api_key = APIKey.objects.create(
            organization=request.user.organization,
            name=serializer.validated_data['name'],
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=serializer.validated_data.get('scopes', []),
            rate_limit=serializer.validated_data.get('rate_limit', 1000),
            expires_at=serializer.validated_data.get('expires_at'),
            created_by=request.user,
        )

        # Return the full key only once
        response_serializer = APIKeyResponseSerializer({
            'api_key': api_key,
            'key': raw_key,
        })

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an API key."""
        api_key = self.get_object()
        api_key.is_active = False
        api_key.save()
        return Response({'message': 'API key revoked successfully.'})

    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regenerate an API key (creates new key, invalidates old)."""
        old_key = self.get_object()

        # Revoke the old key
        old_key.is_active = False
        old_key.save()

        # Generate new key
        raw_key = APIKey.generate_key()
        key_hash = APIKey.hash_key(raw_key)
        key_prefix = raw_key[:8]

        # Create new API key record
        new_key = APIKey.objects.create(
            organization=old_key.organization,
            name=old_key.name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=old_key.scopes,
            rate_limit=old_key.rate_limit,
            expires_at=old_key.expires_at,
            created_by=request.user,
        )

        response_serializer = APIKeyResponseSerializer({
            'api_key': new_key,
            'key': raw_key,
        })

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# Import needed for Q objects
from django.db import models
from rest_framework import serializers


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user notifications.

    Endpoints:
    - GET /notifications/ - List user's notifications
    - GET /notifications/summary/ - Get unread/urgent counts
    - POST /notifications/{id}/mark-read/ - Mark single notification as read
    - POST /notifications/mark-all-read/ - Mark all notifications as read
    - DELETE /notifications/{id}/ - Delete a notification
    """

    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter to only show current user's notifications."""
        queryset = Notification.objects.filter(user=self.request.user)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        # Filter by type
        type_filter = self.request.query_params.get('type')
        if type_filter:
            queryset = queryset.filter(type=type_filter.upper())

        # Filter by priority
        priority_filter = self.request.query_params.get('priority')
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter.upper())

        # Exclude archived by default
        include_archived = self.request.query_params.get('include_archived', 'false')
        if include_archived.lower() != 'true':
            queryset = queryset.exclude(status='ARCHIVED')

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get notification counts for the current user."""
        user_notifications = Notification.objects.filter(user=request.user)

        total = user_notifications.exclude(status='ARCHIVED').count()
        unread = user_notifications.filter(status='UNREAD').count()
        urgent = user_notifications.filter(
            status='UNREAD',
            priority='URGENT'
        ).count()

        serializer = NotificationSummarySerializer({
            'total': total,
            'unread': unread,
            'urgent': urgent,
        })
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notification = self.get_object()
        notification.mark_as_read()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """Mark all unread notifications as read for the current user."""
        from django.utils import timezone

        updated = Notification.objects.filter(
            user=request.user,
            status='UNREAD'
        ).update(
            status='READ',
            read_at=timezone.now()
        )

        return Response({
            'message': f'Marked {updated} notifications as read.',
            'updated_count': updated,
        })

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a notification."""
        notification = self.get_object()
        notification.archive()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'], url_path='archive-all-read')
    def archive_all_read(self, request):
        """Archive all read notifications."""
        updated = Notification.objects.filter(
            user=request.user,
            status='READ'
        ).update(status='ARCHIVED')

        return Response({
            'message': f'Archived {updated} notifications.',
            'updated_count': updated,
        })

    def destroy(self, request, *args, **kwargs):
        """Delete a notification (soft delete by archiving)."""
        instance = self.get_object()
        instance.archive()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Comment ViewSet
# =============================================================================

class CommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing comments.

    Endpoints:
    - GET /comments/?object_type=xxx&object_id=yyy - List comments for an object
    - POST /comments/ - Create a new comment
    - PATCH /comments/{id}/ - Update a comment
    - DELETE /comments/{id}/ - Delete a comment
    """

    queryset = Comment.objects.filter(is_deleted=False)
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return CommentCreateSerializer
        if self.action in ['update', 'partial_update']:
            return CommentUpdateSerializer
        return CommentSerializer

    def get_queryset(self):
        """Filter comments by object_type and object_id."""
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by organization
        if hasattr(user, 'organization') and user.organization:
            queryset = queryset.filter(organization=user.organization)

        # Filter by object_type and object_id
        object_type = self.request.query_params.get('object_type')
        object_id = self.request.query_params.get('object_id')

        if object_type:
            queryset = queryset.filter(object_type=object_type)
        if object_id:
            queryset = queryset.filter(object_id=object_id)

        return queryset.select_related('author', 'parent')

    def create(self, request, *args, **kwargs):
        """Create a new comment."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get parent if specified
        parent = None
        parent_id = serializer.validated_data.pop('parent_id', None)
        if parent_id:
            try:
                parent = Comment.objects.get(id=parent_id, is_deleted=False)
            except Comment.DoesNotExist:
                return Response(
                    {'error': 'Parent comment not found'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        comment = Comment.objects.create(
            organization=request.user.organization,
            author=request.user,
            parent=parent,
            **serializer.validated_data
        )

        output_serializer = CommentSerializer(comment)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update a comment (only author can update)."""
        instance = self.get_object()
        if instance.author != request.user:
            return Response(
                {'error': 'You can only edit your own comments'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Delete a comment (soft delete, only author can delete)."""
        instance = self.get_object()
        if instance.author != request.user:
            return Response(
                {'error': 'You can only delete your own comments'},
                status=status.HTTP_403_FORBIDDEN
            )
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Attachment ViewSet
# =============================================================================

class AttachmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing attachments.

    Endpoints:
    - GET /attachments/?object_type=xxx&object_id=yyy - List attachments for an object
    - POST /attachments/ - Upload a new attachment
    - DELETE /attachments/{id}/ - Delete an attachment
    """

    queryset = Attachment.objects.filter(is_deleted=False)
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'create':
            return AttachmentUploadSerializer
        return AttachmentSerializer

    def get_queryset(self):
        """Filter attachments by object_type and object_id."""
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by organization
        if hasattr(user, 'organization') and user.organization:
            queryset = queryset.filter(organization=user.organization)

        # Filter by object_type and object_id
        object_type = self.request.query_params.get('object_type')
        object_id = self.request.query_params.get('object_id')

        if object_type:
            queryset = queryset.filter(object_type=object_type)
        if object_id:
            queryset = queryset.filter(object_id=object_id)

        return queryset.select_related('uploaded_by')

    def create(self, request, *args, **kwargs):
        """Upload a new attachment."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']

        attachment = Attachment.objects.create(
            organization=request.user.organization,
            uploaded_by=request.user,
            object_type=serializer.validated_data['object_type'],
            object_id=serializer.validated_data['object_id'],
            file=file,
            filename=file.name,
            file_type=file.content_type or '',
            file_size=file.size,
        )

        output_serializer = AttachmentSerializer(attachment, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """Delete an attachment (soft delete, only uploader can delete)."""
        instance = self.get_object()
        if instance.uploaded_by != request.user:
            return Response(
                {'error': 'You can only delete your own attachments'},
                status=status.HTTP_403_FORBIDDEN
            )
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

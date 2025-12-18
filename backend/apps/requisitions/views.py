"""
Requisition views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.bulk_action_mixin import BulkActionMixin
from apps.core.exceptions import InsufficientBudgetError, InvalidStateTransitionError
from apps.core.export_mixin import ExportMixin
from django.db.models import Q

from apps.requisitions.models import (
    Requisition,
    RequisitionLine,
    RequisitionTemplate,
    RequisitionTemplateLine,
)
from apps.requisitions.serializers import (
    RejectSerializer,
    RequisitionCreateSerializer,
    RequisitionLineCreateSerializer,
    RequisitionLineSerializer,
    RequisitionListSerializer,
    RequisitionSerializer,
    RequisitionTemplateCreateSerializer,
    RequisitionTemplateLineSerializer,
    RequisitionTemplateListSerializer,
    RequisitionTemplateSerializer,
)


class RequisitionViewSet(BulkActionMixin, ExportMixin, viewsets.ModelViewSet):
    """
    ViewSet for requisition management with workflow actions.

    Workflow actions:
    - submit: DRAFT -> SUBMITTED (creates budget encumbrance)
    - approve: SUBMITTED -> APPROVED
    - reject: SUBMITTED -> REJECTED (releases encumbrance)
    - revise: REJECTED -> DRAFT
    - cancel: DRAFT/APPROVED -> CANCELLED (releases encumbrance if active)

    Bulk actions:
    - bulk-approve: Approve multiple SUBMITTED requisitions
    - bulk-reject: Reject multiple SUBMITTED requisitions
    - bulk-delete: Delete multiple DRAFT requisitions
    """

    queryset = Requisition.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'requester', 'budget_line']
    search_fields = ['number', 'title', 'description']
    ordering_fields = ['number', 'title', 'created_at', 'status']
    ordering = ['-created_at']

    # Export configuration
    export_filename = 'requisitions'
    export_fields = [
        ('number', 'Requisition #'),
        ('title', 'Title'),
        ('status', 'Status'),
        ('requester__first_name', 'Requester First Name'),
        ('requester__last_name', 'Requester Last Name'),
        ('total_amount', 'Total Amount'),
        ('created_at', 'Created Date'),
        ('submitted_at', 'Submitted Date'),
        ('approved_at', 'Approved Date'),
    ]

    # Bulk action configuration
    bulk_approve_method = 'approve'
    bulk_reject_method = 'reject'
    bulk_approvable_statuses = ['SUBMITTED']
    bulk_rejectable_statuses = ['SUBMITTED']
    bulk_deletable_statuses = ['DRAFT']

    def get_serializer_class(self):
        if self.action == 'create':
            return RequisitionCreateSerializer
        if self.action == 'list':
            return RequisitionListSerializer
        return RequisitionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    def _handle_workflow_action(self, requisition, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            requisition.refresh_from_db()
            return Response(RequisitionSerializer(requisition).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InsufficientBudgetError as e:
            return Response(
                {
                    'error': str(e),
                    'requested': str(e.requested),
                    'available': str(e.available),
                    'shortfall': str(e.shortfall),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit requisition for approval (DRAFT -> SUBMITTED)."""
        requisition = self.get_object()
        return self._handle_workflow_action(requisition, requisition.submit)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the requisition (SUBMITTED -> APPROVED)."""
        requisition = self.get_object()
        return self._handle_workflow_action(
            requisition,
            requisition.approve,
            request.user,
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject the requisition (SUBMITTED -> REJECTED)."""
        requisition = self.get_object()
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return self._handle_workflow_action(
            requisition,
            requisition.reject,
            request.user,
            serializer.validated_data['reason'],
        )

    @action(detail=True, methods=['post'])
    def revise(self, request, pk=None):
        """Return rejected requisition to draft (REJECTED -> DRAFT)."""
        requisition = self.get_object()
        return self._handle_workflow_action(requisition, requisition.revise)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the requisition (DRAFT/APPROVED -> CANCELLED)."""
        requisition = self.get_object()
        return self._handle_workflow_action(requisition, requisition.cancel)

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """
        Manage requisition lines.

        GET: List all lines
        POST: Add a new line
        """
        requisition = self.get_object()

        if request.method == 'GET':
            serializer = RequisitionLineSerializer(requisition.lines.all(), many=True)
            return Response(serializer.data)

        # POST - add new line
        if requisition.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add lines to non-draft requisition'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RequisitionLineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Auto-assign line number if not provided
        line_data = serializer.validated_data
        if 'line_number' not in line_data or not line_data['line_number']:
            max_line = requisition.lines.order_by('-line_number').first()
            line_data['line_number'] = (max_line.line_number + 1) if max_line else 1

        line = RequisitionLine.objects.create(requisition=requisition, **line_data)
        return Response(
            RequisitionLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )


class RequisitionLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for requisition line management.

    Lines can only be modified when requisition is in DRAFT status.
    """

    queryset = RequisitionLine.objects.all()
    serializer_class = RequisitionLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['requisition', 'catalog_item']
    search_fields = ['description']
    ordering_fields = ['line_number', 'extended_amount']
    ordering = ['line_number']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(requisition__organization=user.organization)

        return queryset

    def _check_draft_status(self, line):
        """Ensure requisition is in DRAFT status for modifications."""
        if line.requisition.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify lines of non-draft requisition'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        line = self.get_object()
        error_response = self._check_draft_status(line)
        if error_response:
            return error_response
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        line = self.get_object()
        error_response = self._check_draft_status(line)
        if error_response:
            return error_response
        return super().destroy(request, *args, **kwargs)


class RequisitionTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for requisition template management.

    Users can view public templates or their own private templates.
    Templates track usage count when applied to new requisitions.
    """

    queryset = RequisitionTemplate.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['department', 'priority', 'is_public', 'created_by']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'use_count', 'created_at', 'updated_at']
    ordering = ['-use_count', '-updated_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return RequisitionTemplateCreateSerializer
        if self.action == 'list':
            return RequisitionTemplateListSerializer
        return RequisitionTemplateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_staff and user.organization:
            # Show public templates or user's own templates within organization
            queryset = queryset.filter(
                organization=user.organization
            ).filter(
                Q(is_public=True) | Q(created_by=user)
            )

        return queryset.prefetch_related('lines')

    @action(detail=True, methods=['post'])
    def increment_use_count(self, request, pk=None):
        """Increment the use count when a template is used."""
        template = self.get_object()
        template.increment_use_count()
        return Response({'use_count': template.use_count})

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """
        Manage template lines.

        GET: List all lines
        POST: Add a new line
        """
        template = self.get_object()

        if request.method == 'GET':
            serializer = RequisitionTemplateLineSerializer(
                template.lines.all(), many=True
            )
            return Response(serializer.data)

        # POST - add new line
        serializer = RequisitionTemplateLineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line = RequisitionTemplateLine.objects.create(
            template=template, **serializer.validated_data
        )
        return Response(
            RequisitionTemplateLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )

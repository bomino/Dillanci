"""
Requisition views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import InsufficientBudgetError, InvalidStateTransitionError
from apps.requisitions.models import Requisition, RequisitionLine
from apps.requisitions.serializers import (
    RejectSerializer,
    RequisitionCreateSerializer,
    RequisitionLineCreateSerializer,
    RequisitionLineSerializer,
    RequisitionListSerializer,
    RequisitionSerializer,
)


class RequisitionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for requisition management with workflow actions.

    Workflow actions:
    - submit: DRAFT -> SUBMITTED (creates budget encumbrance)
    - approve: SUBMITTED -> APPROVED
    - reject: SUBMITTED -> REJECTED (releases encumbrance)
    - revise: REJECTED -> DRAFT
    - cancel: DRAFT/APPROVED -> CANCELLED (releases encumbrance if active)
    """

    queryset = Requisition.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'requester', 'budget_line']
    search_fields = ['number', 'title', 'description']
    ordering_fields = ['number', 'title', 'created_at', 'status']
    ordering = ['-created_at']

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

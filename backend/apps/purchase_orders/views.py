"""
Purchase Order views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.budget.models import BudgetLine
from apps.core.bulk_action_mixin import BulkActionMixin
from apps.core.exceptions import InvalidStateTransitionError
from apps.core.export_mixin import ExportMixin
from apps.purchase_orders.models import PurchaseOrder, POLine
from apps.purchase_orders.serializers import (
    CreateFromBidSerializer,
    CreateFromRequisitionSerializer,
    POLineCreateSerializer,
    POLineSerializer,
    PurchaseOrderCreateSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderSerializer,
    RejectSerializer,
)
from apps.requisitions.models import Requisition
from apps.rfqs.models import Bid
from apps.suppliers.models import Supplier


class PurchaseOrderViewSet(BulkActionMixin, ExportMixin, viewsets.ModelViewSet):
    """
    ViewSet for PO management with workflow actions.

    Workflow actions:
    - submit: DRAFT -> SUBMITTED
    - approve: SUBMITTED -> APPROVED
    - reject: SUBMITTED -> REJECTED
    - revise: REJECTED -> DRAFT
    - send: APPROVED -> SENT
    - receive: SENT -> RECEIVED
    - complete: RECEIVED -> COMPLETED
    - cancel: Any (except COMPLETED/CANCELLED) -> CANCELLED

    Bulk actions:
    - bulk-approve: Approve multiple SUBMITTED POs
    - bulk-reject: Reject multiple SUBMITTED POs
    - bulk-delete: Delete multiple DRAFT POs
    """

    queryset = PurchaseOrder.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'supplier', 'created_by', 'budget_line']
    search_fields = ['number', 'title', 'description']
    ordering_fields = ['number', 'title', 'created_at', 'status', 'total_amount']
    ordering = ['-created_at']

    # Export configuration
    export_filename = 'purchase_orders'
    export_fields = [
        ('number', 'PO #'),
        ('title', 'Title'),
        ('status', 'Status'),
        ('supplier__name', 'Supplier'),
        ('total_amount', 'Total Amount'),
        ('created_at', 'Created Date'),
        ('approved_at', 'Approved Date'),
        ('expected_delivery', 'Expected Delivery'),
    ]

    # Bulk action configuration
    bulk_approve_method = 'approve'
    bulk_reject_method = 'reject'
    bulk_approvable_statuses = ['SUBMITTED']
    bulk_rejectable_statuses = ['SUBMITTED']
    bulk_deletable_statuses = ['DRAFT']

    def get_serializer_class(self):
        if self.action == 'create':
            return PurchaseOrderCreateSerializer
        if self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    def _handle_workflow_action(self, po, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            po.refresh_from_db()
            return Response(PurchaseOrderSerializer(po).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit PO for approval (DRAFT -> SUBMITTED)."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.submit)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the PO (SUBMITTED -> APPROVED)."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.approve, request.user)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject the PO (SUBMITTED -> REJECTED)."""
        po = self.get_object()
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return self._handle_workflow_action(
            po,
            po.reject,
            request.user,
            serializer.validated_data['reason'],
        )

    @action(detail=True, methods=['post'])
    def revise(self, request, pk=None):
        """Return rejected PO to draft (REJECTED -> DRAFT)."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.revise)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send PO to supplier (APPROVED -> SENT)."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.send)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Mark PO as received (SENT -> RECEIVED)."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.receive)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete the PO (RECEIVED -> COMPLETED)."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.complete)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the PO."""
        po = self.get_object()
        return self._handle_workflow_action(po, po.cancel)

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """
        Manage PO lines.

        GET: List all lines
        POST: Add a new line (DRAFT only)
        """
        po = self.get_object()

        if request.method == 'GET':
            serializer = POLineSerializer(po.lines.all(), many=True)
            return Response(serializer.data)

        # POST - add new line
        if po.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add lines to non-draft PO'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = POLineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        line = POLine.objects.create(purchase_order=po, **serializer.validated_data)
        return Response(
            POLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'])
    def create_from_bid(self, request):
        """Create a PO from an awarded bid."""
        serializer = CreateFromBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bid_id = serializer.validated_data['bid_id']
        budget_line_id = serializer.validated_data['budget_line_id']

        try:
            bid = Bid.objects.get(id=bid_id)
        except Bid.DoesNotExist:
            return Response(
                {'error': f'Bid with id {bid_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            budget_line = BudgetLine.objects.get(id=budget_line_id)
        except BudgetLine.DoesNotExist:
            return Response(
                {'error': f'Budget line with id {budget_line_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            po = PurchaseOrder.create_from_bid(
                bid=bid,
                budget_line=budget_line,
                created_by=request.user,
            )
            return Response(
                PurchaseOrderSerializer(po).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['post'])
    def create_from_requisition(self, request):
        """Create a PO from an approved requisition."""
        serializer = CreateFromRequisitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requisition_id = serializer.validated_data['requisition_id']
        supplier_id = serializer.validated_data['supplier_id']

        try:
            requisition = Requisition.objects.get(id=requisition_id)
        except Requisition.DoesNotExist:
            return Response(
                {'error': f'Requisition with id {requisition_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            supplier = Supplier.objects.get(id=supplier_id)
        except Supplier.DoesNotExist:
            return Response(
                {'error': f'Supplier with id {supplier_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            po = PurchaseOrder.create_from_requisition(
                requisition=requisition,
                supplier=supplier,
                created_by=request.user,
            )
            return Response(
                PurchaseOrderSerializer(po).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class POLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PO line management.

    Lines can only be modified when PO is in DRAFT status.
    """

    queryset = POLine.objects.all()
    serializer_class = POLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['purchase_order', 'catalog_item']
    search_fields = ['description']
    ordering_fields = ['line_number', 'unit_price', 'quantity']
    ordering = ['line_number']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(purchase_order__organization=user.organization)

        return queryset

    def _check_draft_status(self, line):
        """Ensure PO is in DRAFT status for modifications."""
        if line.purchase_order.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify lines of non-draft PO'},
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

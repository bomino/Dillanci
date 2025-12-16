"""
ViewSets for Goods Receipt management.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import InvalidStateTransitionError
from apps.receiving.models import GoodsReceipt, GoodsReceiptLine
from apps.receiving.serializers import (
    GoodsReceiptCreateSerializer,
    GoodsReceiptLineCreateSerializer,
    GoodsReceiptLineSerializer,
    GoodsReceiptListSerializer,
    GoodsReceiptSerializer,
)


class GoodsReceiptViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Goods Receipt management.

    Workflow actions:
    - post: DRAFT -> POSTED (updates PO line quantities)
    - cancel: DRAFT -> CANCELLED
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter goods receipts by user's organization."""
        return GoodsReceipt.objects.filter(
            organization=self.request.user.organization
        ).select_related('purchase_order', 'received_by', 'organization')

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return GoodsReceiptCreateSerializer
        if self.action == 'list':
            return GoodsReceiptListSerializer
        return GoodsReceiptSerializer

    def create(self, request, *args, **kwargs):
        """Create a GoodsReceipt and return full serializer with id."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        # Return full serializer with id and lines
        response_serializer = GoodsReceiptSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def _handle_workflow_action(self, gr, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            gr.refresh_from_db()
            return Response(GoodsReceiptSerializer(gr).data)
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
    def post(self, request, pk=None):
        """Post the goods receipt (DRAFT -> POSTED)."""
        gr = self.get_object()
        return self._handle_workflow_action(gr, gr.post)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the goods receipt (DRAFT -> CANCELLED)."""
        gr = self.get_object()
        return self._handle_workflow_action(gr, gr.cancel)

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """Manage goods receipt lines."""
        gr = self.get_object()

        if request.method == 'GET':
            serializer = GoodsReceiptLineSerializer(gr.lines.all(), many=True)
            return Response(serializer.data)

        if request.method == 'POST':
            # Can only add lines to draft receipts
            if gr.status != 'DRAFT':
                return Response(
                    {'error': 'Can only add lines to draft receipts'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = GoodsReceiptLineCreateSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(goods_receipt=gr)
                return Response(
                    GoodsReceiptLineSerializer(
                        GoodsReceiptLine.objects.get(id=serializer.instance.id)
                    ).data,
                    status=status.HTTP_201_CREATED,
                )
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )


class GoodsReceiptLineViewSet(viewsets.ModelViewSet):
    """ViewSet for managing individual goods receipt lines."""

    permission_classes = [IsAuthenticated]
    serializer_class = GoodsReceiptLineSerializer

    def get_queryset(self):
        """Filter lines by user's organization."""
        return GoodsReceiptLine.objects.filter(
            goods_receipt__organization=self.request.user.organization
        ).select_related('goods_receipt', 'po_line')

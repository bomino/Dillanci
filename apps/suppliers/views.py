"""
Supplier views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import InvalidStateTransitionError
from apps.suppliers.models import Supplier
from apps.suppliers.serializers import (
    SupplierCreateSerializer,
    SupplierListSerializer,
    SupplierSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet for supplier management with state transition actions.

    State transitions available:
    - submit_for_review: PROSPECT -> PENDING_REVIEW
    - approve: PENDING_REVIEW -> APPROVED
    - reject: PENDING_REVIEW -> REJECTED
    - block: APPROVED -> BLOCKED
    - unblock: BLOCKED -> APPROVED
    - resubmit: REJECTED -> PROSPECT
    """

    queryset = Supplier.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'city', 'country']
    search_fields = ['name', 'code', 'contact_name', 'contact_email']
    ordering_fields = ['name', 'created_at', 'status']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'create':
            return SupplierCreateSerializer
        if self.action == 'list':
            return SupplierListSerializer
        return SupplierSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    def _handle_state_transition(self, supplier, transition_method):
        """Helper to handle state transition actions."""
        try:
            transition_method()
            supplier.refresh_from_db()
            return Response(SupplierSerializer(supplier).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def submit_for_review(self, request, pk=None):
        """Submit supplier for approval review (PROSPECT -> PENDING_REVIEW)."""
        supplier = self.get_object()
        return self._handle_state_transition(supplier, supplier.submit_for_review)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the supplier (PENDING_REVIEW -> APPROVED)."""
        supplier = self.get_object()
        return self._handle_state_transition(supplier, supplier.approve)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject the supplier (PENDING_REVIEW -> REJECTED)."""
        supplier = self.get_object()
        return self._handle_state_transition(supplier, supplier.reject)

    @action(detail=True, methods=['post'])
    def block(self, request, pk=None):
        """Block an approved supplier (APPROVED -> BLOCKED)."""
        supplier = self.get_object()
        return self._handle_state_transition(supplier, supplier.block)

    @action(detail=True, methods=['post'])
    def unblock(self, request, pk=None):
        """Unblock a blocked supplier (BLOCKED -> APPROVED)."""
        supplier = self.get_object()
        return self._handle_state_transition(supplier, supplier.unblock)

    @action(detail=True, methods=['post'])
    def resubmit(self, request, pk=None):
        """Resubmit a rejected supplier (REJECTED -> PROSPECT)."""
        supplier = self.get_object()
        return self._handle_state_transition(supplier, supplier.resubmit)

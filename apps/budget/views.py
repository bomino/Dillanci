"""
Budget views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.budget.models import BudgetLine, Encumbrance, FiscalYear
from apps.budget.serializers import (
    AvailabilityCheckSerializer,
    BudgetLineListSerializer,
    BudgetLineSerializer,
    EncumbranceCreateSerializer,
    EncumbranceSerializer,
    FiscalYearSerializer,
)
from apps.core.exceptions import InsufficientBudgetError


class FiscalYearViewSet(viewsets.ModelViewSet):
    """
    ViewSet for fiscal year management.
    """

    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'year']
    search_fields = ['year']
    ordering_fields = ['year', 'start_date', 'created_at']
    ordering = ['-year']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    @action(detail=True, methods=['get'])
    def budget_lines(self, request, pk=None):
        """Get all budget lines for this fiscal year."""
        fiscal_year = self.get_object()
        budget_lines = fiscal_year.budget_lines.all()
        serializer = BudgetLineListSerializer(budget_lines, many=True)
        return Response(serializer.data)


class BudgetLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for budget line management with availability checking.
    """

    queryset = BudgetLine.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'fiscal_year', 'parent']
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['code', 'name', 'allocated_amount', 'created_at']
    ordering = ['code']

    def get_serializer_class(self):
        if self.action == 'list':
            return BudgetLineListSerializer
        return BudgetLineSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(fiscal_year__organization=user.organization)

        return queryset

    @action(detail=True, methods=['get', 'post'])
    def availability(self, request, pk=None):
        """
        Check budget availability.

        GET: Returns current available amount
        POST: Check if specific amount is available
        """
        budget_line = self.get_object()

        if request.method == 'GET':
            return Response({
                'allocated_amount': budget_line.allocated_amount,
                'encumbered_amount': budget_line.encumbered_amount,
                'available_amount': budget_line.available_amount,
            })

        # POST - check specific amount
        serializer = AvailabilityCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data['amount']

        return Response({
            'requested_amount': amount,
            'available_amount': budget_line.available_amount,
            'is_available': budget_line.check_availability(amount),
        })

    @action(detail=True, methods=['post'])
    def encumber(self, request, pk=None):
        """Create an encumbrance against this budget line."""
        budget_line = self.get_object()
        serializer = EncumbranceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            encumbrance = budget_line.encumber(
                amount=serializer.validated_data['amount'],
                reference_type=serializer.validated_data['reference_type'],
                reference_id=serializer.validated_data['reference_id'],
            )
            return Response(
                EncumbranceSerializer(encumbrance).data,
                status=status.HTTP_201_CREATED,
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

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get child budget lines."""
        budget_line = self.get_object()
        children = budget_line.children.all()
        serializer = BudgetLineListSerializer(children, many=True)
        return Response(serializer.data)


class EncumbranceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for encumbrance viewing with release/liquidate actions.

    Encumbrances are typically created via BudgetLine.encumber() or
    Requisition.submit(), not directly.
    """

    queryset = Encumbrance.objects.all()
    serializer_class = EncumbranceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'budget_line', 'reference_type']
    search_fields = ['reference_id']
    ordering_fields = ['amount', 'created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(
                budget_line__fiscal_year__organization=user.organization
            )

        return queryset

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        """Release an active encumbrance (returns funds to available)."""
        encumbrance = self.get_object()

        if encumbrance.status != 'ACTIVE':
            return Response(
                {'error': f'Cannot release encumbrance with status {encumbrance.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        encumbrance.release()
        return Response(EncumbranceSerializer(encumbrance).data)

    @action(detail=True, methods=['post'])
    def liquidate(self, request, pk=None):
        """Liquidate an active encumbrance (convert to actual expense)."""
        encumbrance = self.get_object()

        if encumbrance.status != 'ACTIVE':
            return Response(
                {'error': f'Cannot liquidate encumbrance with status {encumbrance.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        encumbrance.liquidate()
        return Response(EncumbranceSerializer(encumbrance).data)

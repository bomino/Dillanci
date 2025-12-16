"""
Contract views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import (
    ContractValidationError,
    InvalidStateTransitionError,
)

from .models import Contract, ContractLine, ContractMilestone, ContractSpend
from .serializers import (
    ApproveContractSerializer,
    CompleteMilestoneSerializer,
    ContractCreateSerializer,
    ContractLineCreateSerializer,
    ContractLineSerializer,
    ContractListSerializer,
    ContractMilestoneCreateSerializer,
    ContractMilestoneSerializer,
    ContractSerializer,
    ContractSpendSerializer,
    RenewContractSerializer,
    SpendSummarySerializer,
    TerminateContractSerializer,
    WaiveMilestoneSerializer,
)
from .services import ContractService


class ContractViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Contract management with workflow actions.

    Workflow actions:
    - submit_for_approval: DRAFT -> PENDING_APPROVAL
    - approve: PENDING_APPROVAL -> ACTIVE
    - return_to_draft: PENDING_APPROVAL -> DRAFT
    - terminate: ACTIVE -> TERMINATED
    - renew: EXPIRED -> ACTIVE (with new dates)
    - cancel: DRAFT/PENDING_APPROVAL -> CANCELLED
    """

    queryset = Contract.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'contract_type', 'supplier', 'organization']
    search_fields = ['number', 'title', 'description', 'supplier__name']
    ordering_fields = ['number', 'title', 'created_at', 'status', 'start_date', 'end_date', 'total_value']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ContractCreateSerializer
        if self.action == 'list':
            return ContractListSerializer
        return ContractSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    def create(self, request, *args, **kwargs):
        """Create a Contract and return full serializer with all fields."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        response_serializer = ContractSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        """Soft delete the contract."""
        instance.soft_delete()

    def _handle_workflow_action(self, contract, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            contract.refresh_from_db()
            return Response(ContractSerializer(contract).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ContractValidationError as e:
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
    def submit_for_approval(self, request, pk=None):
        """Submit contract for approval (DRAFT -> PENDING_APPROVAL)."""
        contract = self.get_object()
        return self._handle_workflow_action(contract, contract.submit_for_approval)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the contract (PENDING_APPROVAL -> ACTIVE)."""
        contract = self.get_object()
        return self._handle_workflow_action(contract, contract.approve, request.user)

    @action(detail=True, methods=['post'])
    def return_to_draft(self, request, pk=None):
        """Return contract to draft for revisions (PENDING_APPROVAL -> DRAFT)."""
        contract = self.get_object()
        return self._handle_workflow_action(contract, contract.return_to_draft)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """Terminate the contract (ACTIVE -> TERMINATED)."""
        contract = self.get_object()
        serializer = TerminateContractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        return self._handle_workflow_action(contract, contract.terminate, reason)

    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        """Create an amendment/renewal of the contract."""
        contract = self.get_object()
        serializer = RenewContractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_end_date = serializer.validated_data['new_end_date']
        new_total_value = serializer.validated_data.get('new_total_value')

        try:
            amendment = ContractService.create_amendment(
                original_contract=contract,
                created_by=request.user,
                new_end_date=new_end_date,
                new_total_value=new_total_value,
            )
            return Response(
                ContractSerializer(amendment).data,
                status=status.HTTP_201_CREATED,
            )
        except (InvalidStateTransitionError, ContractValidationError, ValueError) as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the contract (DRAFT/PENDING_APPROVAL -> CANCELLED)."""
        contract = self.get_object()
        return self._handle_workflow_action(contract, contract.cancel)

    # Nested resources
    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """
        Manage contract lines.

        GET: List all lines
        POST: Add a new line (DRAFT only)
        """
        contract = self.get_object()

        if request.method == 'GET':
            serializer = ContractLineSerializer(contract.lines.all(), many=True)
            return Response(serializer.data)

        # POST - add new line
        if contract.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add lines to non-draft contract'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ContractLineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        line = ContractLine.objects.create(contract=contract, **serializer.validated_data)
        return Response(
            ContractLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'])
    def milestones(self, request, pk=None):
        """
        Manage contract milestones.

        GET: List all milestones
        POST: Add a new milestone
        """
        contract = self.get_object()

        if request.method == 'GET':
            serializer = ContractMilestoneSerializer(contract.milestones.all(), many=True)
            return Response(serializer.data)

        # POST - add new milestone
        serializer = ContractMilestoneCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        milestone = ContractMilestone.objects.create(
            contract=contract, **serializer.validated_data
        )
        return Response(
            ContractMilestoneSerializer(milestone).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def spend(self, request, pk=None):
        """Get spend summary for this contract."""
        contract = self.get_object()
        summary = ContractService.get_spend_summary(contract)
        serializer = SpendSummarySerializer(summary)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def spend_records(self, request, pk=None):
        """Get all spend records for this contract."""
        contract = self.get_object()
        serializer = ContractSpendSerializer(contract.spend_records.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def purchase_orders(self, request, pk=None):
        """Get all purchase orders linked to this contract."""
        contract = self.get_object()
        # Import here to avoid circular imports
        from apps.purchase_orders.serializers import PurchaseOrderListSerializer

        pos = contract.spend_records.select_related('purchase_order').values_list(
            'purchase_order', flat=True
        )
        from apps.purchase_orders.models import PurchaseOrder
        queryset = PurchaseOrder.objects.filter(id__in=pos)
        serializer = PurchaseOrderListSerializer(queryset, many=True)
        return Response(serializer.data)

    # Utility endpoints
    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get contracts expiring within N days (default: 30)."""
        days = int(request.query_params.get('days', 30))
        user = request.user

        if user.organization:
            contracts = ContractService.get_expiring_contracts(
                organization=user.organization,
                days=days,
            )
        else:
            contracts = Contract.objects.none()

        serializer = ContractListSerializer(contracts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='for_supplier/(?P<supplier_id>[^/.]+)')
    def for_supplier(self, request, supplier_id=None):
        """Get contracts for a specific supplier."""
        user = request.user
        active_only = request.query_params.get('active_only', 'true').lower() == 'true'

        if user.organization:
            from apps.suppliers.models import Supplier
            try:
                supplier = Supplier.objects.get(
                    id=supplier_id,
                    organization=user.organization,
                )
            except Supplier.DoesNotExist:
                return Response(
                    {'error': 'Supplier not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            contracts = ContractService.get_contracts_for_supplier(
                organization=user.organization,
                supplier=supplier,
                active_only=active_only,
            )
        else:
            contracts = Contract.objects.none()

        serializer = ContractListSerializer(contracts, many=True)
        return Response(serializer.data)


class ContractLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for contract line management.

    Lines can only be modified when contract is in DRAFT status.
    """

    queryset = ContractLine.objects.all()
    serializer_class = ContractLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['contract', 'catalog_item', 'is_active']
    search_fields = ['description']
    ordering_fields = ['line_number', 'unit_price']
    ordering = ['line_number']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(contract__organization=user.organization)

        return queryset

    def _check_draft_status(self, line):
        """Ensure contract is in DRAFT status for modifications."""
        if line.contract.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify lines of non-draft contract'},
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


class ContractMilestoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for contract milestone management.
    """

    queryset = ContractMilestone.objects.all()
    serializer_class = ContractMilestoneSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['contract', 'status']
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'status', 'amount']
    ordering = ['due_date']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(contract__organization=user.organization)

        return queryset

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark milestone as completed."""
        milestone = self.get_object()
        serializer = CompleteMilestoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        completed_date = serializer.validated_data.get('completed_date')
        milestone.complete(completed_date)
        return Response(ContractMilestoneSerializer(milestone).data)

    @action(detail=True, methods=['post'])
    def mark_missed(self, request, pk=None):
        """Mark milestone as missed."""
        milestone = self.get_object()
        milestone.mark_missed()
        return Response(ContractMilestoneSerializer(milestone).data)

    @action(detail=True, methods=['post'])
    def waive(self, request, pk=None):
        """Waive the milestone."""
        milestone = self.get_object()
        serializer = WaiveMilestoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        milestone.waive(reason)
        return Response(ContractMilestoneSerializer(milestone).data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all overdue milestones."""
        user = request.user

        if user.organization:
            milestones = ContractService.get_overdue_milestones(
                organization=user.organization,
            )
        else:
            milestones = ContractMilestone.objects.none()

        serializer = ContractMilestoneSerializer(milestones, many=True)
        return Response(serializer.data)

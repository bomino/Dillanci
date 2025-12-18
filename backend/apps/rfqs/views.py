"""
RFQ views and viewsets for API endpoints.
"""

from django.db.models import F

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import (
    DuplicateInvitationError,
    InvalidStateTransitionError,
    RFQNotOpenError,
)
from apps.rfqs.models import RFQ, RFQLine, SupplierInvitation, Bid, BidLine
from apps.rfqs.serializers import (
    AwardSerializer,
    BidCreateSerializer,
    BidLineCreateSerializer,
    BidLineSerializer,
    BidListSerializer,
    BidSerializer,
    DeclineInvitationSerializer,
    RFQCreateSerializer,
    RFQLineCreateSerializer,
    RFQLineSerializer,
    RFQListSerializer,
    RFQSerializer,
    SupplierInvitationCreateSerializer,
    SupplierInvitationSerializer,
)


class RFQViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RFQ management with workflow actions.

    Workflow actions:
    - open_for_bids: DRAFT -> OPEN (requires lines and invitations)
    - close_bids: OPEN -> CLOSED
    - award: CLOSED -> AWARDED (requires bid_id)
    - cancel: Any (except AWARDED) -> CANCELLED
    """

    queryset = RFQ.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'created_by', 'awarded_supplier']
    search_fields = ['number', 'title', 'description']
    ordering_fields = ['number', 'title', 'created_at', 'status', 'open_date', 'close_date']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return RFQCreateSerializer
        if self.action == 'list':
            return RFQListSerializer
        return RFQSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    def _handle_workflow_action(self, rfq, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            rfq.refresh_from_db()
            return Response(RFQSerializer(rfq).data)
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
    def open_for_bids(self, request, pk=None):
        """Open RFQ for bid submissions (DRAFT -> OPEN)."""
        rfq = self.get_object()
        return self._handle_workflow_action(rfq, rfq.open_for_bids)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """
        Alias for open_for_bids - Publish RFQ to suppliers (DRAFT -> OPEN).

        This is a convenience alias for frontend compatibility.
        """
        return self.open_for_bids(request, pk)

    @action(detail=True, methods=['post'])
    def close_bids(self, request, pk=None):
        """Close RFQ for bid submissions (OPEN -> CLOSED)."""
        rfq = self.get_object()
        return self._handle_workflow_action(rfq, rfq.close_bids)

    @action(detail=True, methods=['post'])
    def award(self, request, pk=None):
        """Award RFQ to a supplier (CLOSED -> AWARDED)."""
        rfq = self.get_object()
        serializer = AwardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bid_id = serializer.validated_data['bid_id']
        try:
            bid = Bid.objects.get(id=bid_id)
        except Bid.DoesNotExist:
            return Response(
                {'error': f'Bid with id {bid_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return self._handle_workflow_action(rfq, rfq.award, bid)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the RFQ (Any -> CANCELLED, except from AWARDED)."""
        rfq = self.get_object()
        return self._handle_workflow_action(rfq, rfq.cancel)

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """
        Manage RFQ lines.

        GET: List all lines
        POST: Add a new line (DRAFT only)
        """
        rfq = self.get_object()

        if request.method == 'GET':
            serializer = RFQLineSerializer(rfq.lines.all(), many=True)
            return Response(serializer.data)

        # POST - add new line
        if rfq.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add lines to non-draft RFQ'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RFQLineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        line = RFQLine.objects.create(rfq=rfq, **serializer.validated_data)
        return Response(
            RFQLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'])
    def invitations(self, request, pk=None):
        """
        Manage supplier invitations.

        GET: List all invitations
        POST: Invite a supplier (DRAFT only)
        """
        rfq = self.get_object()

        if request.method == 'GET':
            serializer = SupplierInvitationSerializer(rfq.invitations.all(), many=True)
            return Response(serializer.data)

        # POST - invite supplier
        if rfq.status != 'DRAFT':
            return Response(
                {'error': 'Cannot invite suppliers to non-draft RFQ'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SupplierInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            invitation = SupplierInvitation.objects.create(
                rfq=rfq,
                supplier=serializer.validated_data['supplier'],
                invited_by=request.user,
            )
            return Response(
                SupplierInvitationSerializer(invitation).data,
                status=status.HTTP_201_CREATED,
            )
        except DuplicateInvitationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get'])
    def bids(self, request, pk=None):
        """List all bids for this RFQ."""
        rfq = self.get_object()
        serializer = BidListSerializer(rfq.bids.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def compare(self, request, pk=None):
        """
        Get bid comparison matrix for this RFQ.

        Returns a comparison of all submitted bids by line item.
        """
        rfq = self.get_object()

        # Get all submitted bids
        submitted_bids = rfq.bids.filter(status='SUBMITTED')

        # Build comparison matrix
        comparison = []
        for rfq_line in rfq.lines.all():
            line_data = {
                'rfq_line_id': str(rfq_line.id),
                'rfq_line_number': rfq_line.line_number,
                'description': rfq_line.description,
                'quantity': str(rfq_line.quantity),
                'target_unit_price': str(rfq_line.target_unit_price) if rfq_line.target_unit_price else None,
                'bids': [],
            }

            for bid in submitted_bids:
                try:
                    bid_line = BidLine.objects.get(bid=bid, rfq_line=rfq_line)
                    line_data['bids'].append({
                        'bid_id': str(bid.id),
                        'supplier_id': str(bid.supplier.id),
                        'supplier_name': bid.supplier.name,
                        'unit_price': str(bid_line.unit_price),
                        'extended_amount': str(bid_line.extended_amount),
                        'lead_time_days': bid_line.lead_time_days,
                        'notes': bid_line.notes,
                    })
                except BidLine.DoesNotExist:
                    line_data['bids'].append({
                        'bid_id': str(bid.id),
                        'supplier_id': str(bid.supplier.id),
                        'supplier_name': bid.supplier.name,
                        'unit_price': None,
                        'extended_amount': None,
                        'lead_time_days': None,
                        'notes': 'No bid for this line',
                    })

            comparison.append(line_data)

        # Calculate summary
        summary = {
            'total_lines': rfq.lines.count(),
            'total_bids': submitted_bids.count(),
            'bid_totals': [],
        }

        for bid in submitted_bids:
            summary['bid_totals'].append({
                'bid_id': str(bid.id),
                'supplier_name': bid.supplier.name,
                'total_amount': str(bid.total_amount),
            })

        return Response({
            'rfq_id': str(rfq.id),
            'rfq_number': rfq.number,
            'lines': comparison,
            'summary': summary,
        })


class RFQLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RFQ line management.

    Lines can only be modified when RFQ is in DRAFT status.
    """

    queryset = RFQLine.objects.all()
    serializer_class = RFQLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfq', 'catalog_item']
    search_fields = ['description']
    ordering_fields = ['line_number', 'quantity']
    ordering = ['line_number']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(rfq__organization=user.organization)

        return queryset

    def _check_draft_status(self, line):
        """Ensure RFQ is in DRAFT status for modifications."""
        if line.rfq.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify lines of non-draft RFQ'},
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


class SupplierInvitationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for supplier invitation management.
    """

    queryset = SupplierInvitation.objects.all()
    serializer_class = SupplierInvitationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfq', 'supplier', 'status']
    search_fields = ['supplier__name']
    ordering_fields = ['invited_at', 'status']
    ordering = ['-invited_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(rfq__organization=user.organization)

        return queryset

    @action(detail=True, methods=['post'])
    def mark_viewed(self, request, pk=None):
        """Mark invitation as viewed."""
        invitation = self.get_object()
        invitation.mark_viewed()
        return Response(SupplierInvitationSerializer(invitation).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline the invitation."""
        invitation = self.get_object()
        serializer = DeclineInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        invitation.decline(reason)
        return Response(SupplierInvitationSerializer(invitation).data)


class BidViewSet(viewsets.ModelViewSet):
    """
    ViewSet for bid management.

    Bids can only be modified when in DRAFT status and RFQ is OPEN.
    """

    queryset = Bid.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfq', 'supplier', 'status']
    search_fields = ['rfq__number', 'supplier__name', 'notes']
    ordering_fields = ['created_at', 'submitted_at', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return BidCreateSerializer
        if self.action == 'list':
            return BidListSerializer
        return BidSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            # Show bids for RFQs in user's organization OR bids submitted by user
            queryset = queryset.filter(
                rfq__organization=user.organization
            ) | queryset.filter(
                submitted_by=user
            )

        return queryset.distinct()

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit the bid (DRAFT -> SUBMITTED)."""
        bid = self.get_object()
        try:
            bid.submit()
            bid.refresh_from_db()
            return Response(BidSerializer(bid).data)
        except RFQNotOpenError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """
        Manage bid lines.

        GET: List all lines
        POST: Add/update a line (DRAFT only)
        """
        bid = self.get_object()

        if request.method == 'GET':
            serializer = BidLineSerializer(bid.lines.all(), many=True)
            return Response(serializer.data)

        # POST - add/update line
        if bid.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify lines of submitted bid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BidLineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rfq_line = serializer.validated_data['rfq_line']

        # Check if bid line already exists for this RFQ line
        try:
            bid_line = BidLine.objects.get(bid=bid, rfq_line=rfq_line)
            # Update existing
            bid_line.unit_price = serializer.validated_data['unit_price']
            bid_line.lead_time_days = serializer.validated_data.get('lead_time_days')
            bid_line.notes = serializer.validated_data.get('notes', '')
            bid_line.save()
        except BidLine.DoesNotExist:
            # Create new
            try:
                bid_line = BidLine.objects.create(bid=bid, **serializer.validated_data)
            except ValueError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return Response(
            BidLineSerializer(bid_line).data,
            status=status.HTTP_201_CREATED,
        )


class BidLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for bid line management.

    Lines can only be modified when bid is in DRAFT status.
    """

    queryset = BidLine.objects.all()
    serializer_class = BidLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['bid', 'rfq_line']
    search_fields = ['notes']
    ordering_fields = ['unit_price', 'lead_time_days']
    ordering = ['rfq_line__line_number']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(
                bid__rfq__organization=user.organization
            ) | queryset.filter(
                bid__submitted_by=user
            )

        return queryset.distinct()

    def _check_draft_status(self, line):
        """Ensure bid is in DRAFT status for modifications."""
        if line.bid.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify lines of submitted bid'},
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

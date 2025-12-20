"""
Views for the Supplier Portal API.

Provides endpoints for supplier portal users to:
- Authenticate (login/logout/register)
- View and update their profile
- View and respond to RFQs (submit bids)
- View and acknowledge Purchase Orders
"""

from django.contrib.auth import login, logout
from django.db.models import Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status, generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.suppliers.models import PortalUser, PortalInvitation
from apps.rfqs.models import RFQ, SupplierInvitation
from apps.purchase_orders.models import PurchaseOrder, POAcknowledgment
from apps.suppliers.portal_serializers import (
    PortalLoginSerializer,
    PortalRegisterSerializer,
    PortalUserSerializer,
    PortalSupplierSerializer,
    PortalRFQListSerializer,
    PortalRFQDetailSerializer,
    PortalBidSerializer,
    PortalPOListSerializer,
    PortalPODetailSerializer,
    POAcknowledgeSerializer,
    PortalInvitationSerializer,
)


class IsPortalUser(IsAuthenticated):
    """Permission class that checks if user is a portal user."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Must be a portal user type
        if request.user.user_type != 'PORTAL':
            return False

        # Must have active portal profile
        portal_profile = getattr(request.user, 'portal_profile', None)
        if not portal_profile or portal_profile.access_status != 'ACTIVE':
            return False

        return True


def get_portal_context(request):
    """Get the portal user and supplier from request."""
    portal_profile = request.user.portal_profile
    return {
        'portal_user': portal_profile,
        'supplier': portal_profile.supplier,
    }


# =============================================================================
# Authentication Views
# =============================================================================

class PortalLoginView(APIView):
    """
    Login endpoint for supplier portal users.

    POST /api/v1/portal/auth/login/
    """

    permission_classes = [AllowAny]

    @method_decorator(ratelimit(key='ip', rate='5/m', method='POST', block=True))
    @method_decorator(ratelimit(key='post:email', rate='10/h', method='POST', block=True))
    def post(self, request):
        serializer = PortalLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        portal_profile = serializer.validated_data['portal_profile']

        # Log in the user
        login(request, user)

        # Update last login
        portal_profile.update_last_login()

        return Response({
            'message': 'Login successful',
            'user': PortalUserSerializer(portal_profile).data,
            'supplier': PortalSupplierSerializer(portal_profile.supplier).data,
        })


class PortalLogoutView(APIView):
    """
    Logout endpoint for supplier portal users.

    POST /api/v1/portal/auth/logout/
    """

    permission_classes = [IsPortalUser]

    def post(self, request):
        logout(request)
        return Response({'message': 'Logout successful'})


class PortalRegisterView(APIView):
    """
    Registration endpoint for new portal users via invitation.

    POST /api/v1/portal/auth/register/
    """

    permission_classes = [AllowAny]

    @method_decorator(ratelimit(key='ip', rate='3/m', method='POST', block=True))
    def post(self, request):
        serializer = PortalRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        portal_user = serializer.save()

        return Response({
            'message': 'Registration successful',
            'user': PortalUserSerializer(portal_user).data,
            'supplier': PortalSupplierSerializer(portal_user.supplier).data,
        }, status=status.HTTP_201_CREATED)


class PortalInvitationValidateView(APIView):
    """
    Validate an invitation token before registration.

    GET /api/v1/portal/auth/validate-invitation/?token=<uuid>
    """

    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response(
                {'error': 'Token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invitation = PortalInvitation.objects.get(token=token)
        except PortalInvitation.DoesNotExist:
            return Response(
                {'error': 'Invalid invitation token'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not invitation.is_valid:
            return Response({
                'valid': False,
                'error': 'expired' if invitation.is_expired else 'invalid',
                'message': 'This invitation has expired' if invitation.is_expired else 'This invitation is no longer valid',
            })

        return Response({
            'valid': True,
            'email': invitation.email,
            'supplier_name': invitation.supplier.name,
            'organization_name': invitation.supplier.organization.name,
            'expires_at': invitation.expires_at,
        })


# =============================================================================
# Profile Views
# =============================================================================

class PortalProfileView(generics.RetrieveUpdateAPIView):
    """
    View and update portal user profile.

    GET /api/v1/portal/profile/
    PATCH /api/v1/portal/profile/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalUserSerializer

    def get_object(self):
        return self.request.user.portal_profile


class PortalSupplierView(generics.RetrieveUpdateAPIView):
    """
    View and update supplier profile.

    GET /api/v1/portal/supplier/
    PATCH /api/v1/portal/supplier/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalSupplierSerializer

    def get_object(self):
        return self.request.user.portal_profile.supplier


# =============================================================================
# RFQ Views
# =============================================================================

class PortalRFQListView(generics.ListAPIView):
    """
    List RFQs where this supplier has been invited.

    GET /api/v1/portal/rfqs/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalRFQListSerializer
    pagination_class = None  # Portal lists don't need pagination

    def get_queryset(self):
        ctx = get_portal_context(self.request)
        supplier = ctx['supplier']

        # Get RFQs where supplier is invited
        return RFQ.objects.filter(
            Q(invitations__supplier=supplier) |
            Q(bids__supplier=supplier)
        ).filter(
            status__in=['OPEN', 'CLOSED', 'AWARDED']
        ).distinct().order_by('-created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx.update(get_portal_context(self.request))
        return ctx


class PortalRFQDetailView(generics.RetrieveAPIView):
    """
    View RFQ details and your bid.

    GET /api/v1/portal/rfqs/<uuid>/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalRFQDetailSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        ctx = get_portal_context(self.request)
        supplier = ctx['supplier']

        # Only allow access to RFQs where supplier is invited
        return RFQ.objects.filter(
            Q(invitations__supplier=supplier) |
            Q(bids__supplier=supplier)
        ).distinct()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx.update(get_portal_context(self.request))
        return ctx


class PortalBidCreateView(generics.CreateAPIView):
    """
    Submit a bid for an RFQ.

    POST /api/v1/portal/rfqs/<uuid>/bids/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalBidSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx.update(get_portal_context(self.request))
        return ctx

    def create(self, request, *args, **kwargs):
        ctx = get_portal_context(request)
        supplier = ctx['supplier']

        # Get the RFQ
        rfq_id = kwargs.get('rfq_id')
        try:
            rfq = RFQ.objects.get(pk=rfq_id)
        except RFQ.DoesNotExist:
            return Response(
                {'error': 'RFQ not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if supplier is invited
        is_invited = rfq.invitations.filter(supplier=supplier).exists()
        if not is_invited:
            return Response(
                {'error': 'You are not invited to this RFQ'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if RFQ is still open
        if rfq.status != 'OPEN':
            return Response(
                {'error': 'This RFQ is no longer accepting bids'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check due date
        if rfq.due_date and rfq.due_date < timezone.now():
            return Response(
                {'error': 'The bidding deadline has passed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for existing bid
        existing_bid = rfq.bids.filter(supplier=supplier).first()
        if existing_bid:
            return Response(
                {'error': 'You have already submitted a bid for this RFQ'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Add RFQ to data
        data = request.data.copy()
        data['rfq'] = str(rfq_id)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PortalBidDetailView(generics.RetrieveUpdateAPIView):
    """
    View and update your bid.

    GET /api/v1/portal/rfqs/<uuid>/bids/<uuid>/
    PATCH /api/v1/portal/rfqs/<uuid>/bids/<uuid>/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalBidSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        ctx = get_portal_context(self.request)
        supplier = ctx['supplier']
        return supplier.bids.all()


# =============================================================================
# Purchase Order Views
# =============================================================================

class PortalPOListView(generics.ListAPIView):
    """
    List POs sent to this supplier.

    GET /api/v1/portal/purchase-orders/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalPOListSerializer
    pagination_class = None  # Portal lists don't need pagination

    def get_queryset(self):
        ctx = get_portal_context(self.request)
        supplier = ctx['supplier']

        # Get POs that have been sent to this supplier
        return PurchaseOrder.objects.filter(
            supplier=supplier,
            status__in=['SENT', 'RECEIVED', 'COMPLETED']
        ).select_related('acknowledgment').order_by('-sent_at')


class PortalPODetailView(generics.RetrieveAPIView):
    """
    View PO details.

    GET /api/v1/portal/purchase-orders/<uuid>/
    """

    permission_classes = [IsPortalUser]
    serializer_class = PortalPODetailSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        ctx = get_portal_context(self.request)
        supplier = ctx['supplier']

        return PurchaseOrder.objects.filter(
            supplier=supplier,
            status__in=['SENT', 'RECEIVED', 'COMPLETED']
        ).prefetch_related('lines')


class PortalPOAcknowledgeView(APIView):
    """
    Acknowledge or reject a PO.

    POST /api/v1/portal/purchase-orders/<uuid>/acknowledge/
    """

    permission_classes = [IsPortalUser]

    def post(self, request, pk):
        ctx = get_portal_context(request)
        supplier = ctx['supplier']

        # Get the PO
        try:
            po = PurchaseOrder.objects.get(
                pk=pk,
                supplier=supplier,
                status='SENT'
            )
        except PurchaseOrder.DoesNotExist:
            return Response(
                {'error': 'Purchase order not found or not awaiting acknowledgment'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get or create acknowledgment
        acknowledgment = POAcknowledgment.create_for_po(po)

        if acknowledgment.status != 'PENDING':
            return Response(
                {'error': 'This PO has already been acknowledged'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = POAcknowledgeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data['action'] == 'acknowledge':
            acknowledgment.acknowledge(
                user=request.user,
                comments=data.get('comments', ''),
                revised_delivery_date=data.get('revised_delivery_date'),
                delivery_date_reason=data.get('delivery_date_reason', ''),
            )
            message = 'Purchase order acknowledged successfully'
        else:
            acknowledgment.reject(
                user=request.user,
                rejection_reason=data['rejection_reason'],
            )
            message = 'Purchase order rejected'

        return Response({
            'message': message,
            'acknowledgment': {
                'status': acknowledgment.status,
                'acknowledged_at': acknowledgment.acknowledged_at,
            }
        })


# =============================================================================
# Portal Dashboard View
# =============================================================================

class PortalDashboardView(APIView):
    """
    Get dashboard data for the supplier portal.

    GET /api/v1/portal/dashboard/
    """

    permission_classes = [IsPortalUser]

    def get(self, request):
        ctx = get_portal_context(request)
        supplier = ctx['supplier']

        # Count open RFQs
        open_rfqs = RFQ.objects.filter(
            Q(invitations__supplier=supplier),
            status='OPEN'
        ).distinct().count()

        # Count pending PO acknowledgments
        pending_acknowledgments = POAcknowledgment.objects.filter(
            purchase_order__supplier=supplier,
            status='PENDING'
        ).count()

        # Count active POs
        active_pos = PurchaseOrder.objects.filter(
            supplier=supplier,
            status__in=['SENT', 'RECEIVED']
        ).count()

        # Recent activity
        recent_rfqs = RFQ.objects.filter(
            Q(invitations__supplier=supplier) |
            Q(bids__supplier=supplier)
        ).filter(
            status__in=['OPEN', 'CLOSED', 'AWARDED']
        ).distinct().order_by('-created_at')[:5]

        recent_pos = PurchaseOrder.objects.filter(
            supplier=supplier,
            status__in=['SENT', 'RECEIVED', 'COMPLETED']
        ).order_by('-sent_at')[:5]

        return Response({
            'summary': {
                'open_rfqs': open_rfqs,
                'pending_acknowledgments': pending_acknowledgments,
                'active_pos': active_pos,
            },
            'recent_rfqs': PortalRFQListSerializer(
                recent_rfqs,
                many=True,
                context={'supplier': supplier}
            ).data,
            'recent_pos': PortalPOListSerializer(recent_pos, many=True).data,
        })

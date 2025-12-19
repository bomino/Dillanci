"""
Supplier views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import InvalidStateTransitionError
from apps.core.export_mixin import ExportMixin
from apps.suppliers.models import Supplier, PortalInvitation, PortalUser
from apps.suppliers.serializers import (
    SupplierCreateSerializer,
    SupplierListSerializer,
    SupplierSerializer,
    PortalInvitationCreateSerializer,
    PortalInvitationSerializer,
    PortalUserListSerializer,
)


class SupplierViewSet(ExportMixin, viewsets.ModelViewSet):
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

    # Export configuration
    export_filename = 'suppliers'
    export_fields = [
        ('code', 'Supplier Code'),
        ('name', 'Supplier Name'),
        ('status', 'Status'),
        ('contact_name', 'Contact Name'),
        ('contact_email', 'Contact Email'),
        ('contact_phone', 'Contact Phone'),
        ('city', 'City'),
        ('country', 'Country'),
        ('created_at', 'Created Date'),
    ]

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

    @action(detail=True, methods=['post'], url_path='invite-to-portal')
    def invite_to_portal(self, request, pk=None):
        """
        Send a portal invitation to a supplier contact.

        POST /api/v1/suppliers/{id}/invite-to-portal/
        Body: { "email": "contact@supplier.com", "personal_message": "optional" }
        """
        supplier = self.get_object()

        serializer = PortalInvitationCreateSerializer(
            data=request.data,
            context={'supplier': supplier, 'request': request}
        )
        serializer.is_valid(raise_exception=True)

        # Create the invitation
        invitation = PortalInvitation.objects.create(
            supplier=supplier,
            email=serializer.validated_data['email'],
            personal_message=serializer.validated_data.get('personal_message', ''),
            created_by=request.user,
        )

        # Return the invitation with registration URL
        response_serializer = PortalInvitationSerializer(
            invitation,
            context={'request': request}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='portal-invitations')
    def portal_invitations(self, request, pk=None):
        """
        List all portal invitations for a supplier.

        GET /api/v1/suppliers/{id}/portal-invitations/
        """
        supplier = self.get_object()
        invitations = PortalInvitation.objects.filter(
            supplier=supplier,
            is_deleted=False
        ).order_by('-created_at')

        serializer = PortalInvitationSerializer(
            invitations,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='portal-users')
    def portal_users(self, request, pk=None):
        """
        List all portal users for a supplier.

        GET /api/v1/suppliers/{id}/portal-users/
        """
        supplier = self.get_object()
        portal_users = PortalUser.objects.filter(
            supplier=supplier,
            is_deleted=False
        ).select_related('user').order_by('-created_at')

        serializer = PortalUserListSerializer(portal_users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='portal-users/(?P<user_id>[^/.]+)/suspend')
    def suspend_portal_user(self, request, pk=None, user_id=None):
        """
        Suspend a portal user's access.

        POST /api/v1/suppliers/{id}/portal-users/{user_id}/suspend/
        """
        supplier = self.get_object()
        try:
            portal_user = PortalUser.objects.get(
                id=user_id,
                supplier=supplier,
                is_deleted=False
            )
        except PortalUser.DoesNotExist:
            return Response(
                {'error': 'Portal user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if portal_user.access_status == 'SUSPENDED':
            return Response(
                {'error': 'User is already suspended'},
                status=status.HTTP_400_BAD_REQUEST
            )

        portal_user.suspend()
        return Response(PortalUserListSerializer(portal_user).data)

    @action(detail=True, methods=['post'], url_path='portal-users/(?P<user_id>[^/.]+)/reactivate')
    def reactivate_portal_user(self, request, pk=None, user_id=None):
        """
        Reactivate a suspended portal user.

        POST /api/v1/suppliers/{id}/portal-users/{user_id}/reactivate/
        """
        supplier = self.get_object()
        try:
            portal_user = PortalUser.objects.get(
                id=user_id,
                supplier=supplier,
                is_deleted=False
            )
        except PortalUser.DoesNotExist:
            return Response(
                {'error': 'Portal user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if portal_user.access_status != 'SUSPENDED':
            return Response(
                {'error': 'User is not suspended'},
                status=status.HTTP_400_BAD_REQUEST
            )

        portal_user.reactivate()
        return Response(PortalUserListSerializer(portal_user).data)

    @action(detail=True, methods=['post'], url_path='portal-users/(?P<user_id>[^/.]+)/change-role')
    def change_portal_user_role(self, request, pk=None, user_id=None):
        """
        Change a portal user's role.

        POST /api/v1/suppliers/{id}/portal-users/{user_id}/change-role/
        Body: { "role": "ADMIN" }
        """
        supplier = self.get_object()
        try:
            portal_user = PortalUser.objects.get(
                id=user_id,
                supplier=supplier,
                is_deleted=False
            )
        except PortalUser.DoesNotExist:
            return Response(
                {'error': 'Portal user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        new_role = request.data.get('role')
        valid_roles = [r[0] for r in PortalUser.ROLES]
        if new_role not in valid_roles:
            return Response(
                {'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        portal_user.role = new_role
        portal_user.save(update_fields=['role', 'updated_at'])
        return Response(PortalUserListSerializer(portal_user).data)

    @action(detail=True, methods=['delete'], url_path='portal-users/(?P<user_id>[^/.]+)')
    def remove_portal_user(self, request, pk=None, user_id=None):
        """
        Remove a portal user (soft delete).

        DELETE /api/v1/suppliers/{id}/portal-users/{user_id}/
        """
        supplier = self.get_object()
        try:
            portal_user = PortalUser.objects.get(
                id=user_id,
                supplier=supplier,
                is_deleted=False
            )
        except PortalUser.DoesNotExist:
            return Response(
                {'error': 'Portal user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        portal_user.revoke()
        portal_user.is_deleted = True
        portal_user.save(update_fields=['is_deleted', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='portal-invitations/(?P<invitation_id>[^/.]+)/resend')
    def resend_invitation(self, request, pk=None, invitation_id=None):
        """
        Resend a portal invitation (creates new token, resets expiry).

        POST /api/v1/suppliers/{id}/portal-invitations/{invitation_id}/resend/
        """
        import uuid
        from datetime import timedelta
        from django.conf import settings
        from django.utils import timezone

        supplier = self.get_object()
        try:
            invitation = PortalInvitation.objects.get(
                id=invitation_id,
                supplier=supplier,
                is_deleted=False
            )
        except PortalInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if invitation.status == 'ACCEPTED':
            return Response(
                {'error': 'Cannot resend an already accepted invitation'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate new token and reset expiry
        invitation.token = uuid.uuid4()
        invitation.status = 'PENDING'
        expiry_days = getattr(settings, 'PORTAL_INVITATION_EXPIRY_DAYS', 7)
        invitation.expires_at = timezone.now() + timedelta(days=expiry_days)
        invitation.save(update_fields=['token', 'status', 'expires_at', 'updated_at'])

        serializer = PortalInvitationSerializer(invitation, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='portal-invitations/(?P<invitation_id>[^/.]+)/revoke')
    def revoke_invitation(self, request, pk=None, invitation_id=None):
        """
        Revoke a pending portal invitation.

        POST /api/v1/suppliers/{id}/portal-invitations/{invitation_id}/revoke/
        """
        supplier = self.get_object()
        try:
            invitation = PortalInvitation.objects.get(
                id=invitation_id,
                supplier=supplier,
                is_deleted=False
            )
        except PortalInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if invitation.status != 'PENDING':
            return Response(
                {'error': 'Can only revoke pending invitations'},
                status=status.HTTP_400_BAD_REQUEST
            )

        invitation.revoke()
        serializer = PortalInvitationSerializer(invitation, context={'request': request})
        return Response(serializer.data)

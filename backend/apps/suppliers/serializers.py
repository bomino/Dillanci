"""
Supplier serializers for API endpoints.
"""

from rest_framework import serializers

from apps.suppliers.models import Supplier, PortalInvitation, PortalUser


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for supplier list and detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'code',
            'organization',
            'organization_name',
            'status',
            'status_display',
            'approved_at',
            'blocked_at',
            'rejected_at',
            'contact_name',
            'contact_email',
            'contact_phone',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'postal_code',
            'country',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'approved_at',
            'blocked_at',
            'rejected_at',
            'created_at',
            'updated_at',
        ]


class SupplierCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating suppliers."""

    class Meta:
        model = Supplier
        fields = [
            'name',
            'code',
            'organization',
            'contact_name',
            'contact_email',
            'contact_phone',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'postal_code',
            'country',
        ]


class SupplierListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for supplier list views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'code',
            'organization',
            'organization_name',
            'status',
            'contact_email',
            'city',
            'country',
        ]


class PortalInvitationCreateSerializer(serializers.Serializer):
    """Serializer for creating portal invitations."""

    email = serializers.EmailField(
        help_text='Email address to send invitation to'
    )
    personal_message = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='Optional personal message to include in invitation'
    )

    def validate_email(self, value):
        """Check that email isn't already used by a portal user for this supplier."""
        supplier = self.context.get('supplier')
        if supplier:
            # Check if email already has a portal account for this supplier
            if PortalUser.objects.filter(
                supplier=supplier,
                user__email=value,
                is_deleted=False
            ).exists():
                raise serializers.ValidationError(
                    'This email already has portal access for this supplier.'
                )
            # Check for pending invitation
            if PortalInvitation.objects.filter(
                supplier=supplier,
                email=value,
                status='PENDING',
                is_deleted=False
            ).exists():
                raise serializers.ValidationError(
                    'A pending invitation already exists for this email.'
                )
        return value


class PortalInvitationSerializer(serializers.ModelSerializer):
    """Serializer for portal invitation responses."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    registration_url = serializers.SerializerMethodField()

    class Meta:
        model = PortalInvitation
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'email',
            'token',
            'status',
            'expires_at',
            'accepted_at',
            'created_by',
            'created_by_name',
            'personal_message',
            'registration_url',
            'created_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.email
        return None

    def get_registration_url(self, obj):
        """Generate the registration URL for the invitation."""
        from django.conf import settings

        if obj.status == 'PENDING':
            # Use configured frontend URL (not backend host)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            return f'{frontend_url}/portal/register?token={obj.token}'
        return None


class PortalUserListSerializer(serializers.ModelSerializer):
    """Serializer for listing portal users of a supplier."""

    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = PortalUser
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'access_status',
            'last_login_at',
            'created_at',
        ]

    def get_full_name(self, obj):
        return obj.user.full_name or obj.user.email

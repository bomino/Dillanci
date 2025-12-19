"""
Serializers for the Supplier Portal API.

These serializers handle data for supplier portal users to:
- Authenticate and manage their profile
- View and respond to RFQs/RFPs
- View and acknowledge POs
"""

from rest_framework import serializers
from django.contrib.auth import authenticate, password_validation

from apps.suppliers.models import Supplier, PortalUser, PortalInvitation
from apps.rfqs.models import RFQ, RFQLine, Bid, BidLine
from apps.purchase_orders.models import PurchaseOrder, POLine, POAcknowledgment
from apps.users.models import User


# =============================================================================
# Authentication Serializers
# =============================================================================

class PortalLoginSerializer(serializers.Serializer):
    """Serializer for portal login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        user = authenticate(email=email, password=password)

        if not user:
            raise serializers.ValidationError('Invalid email or password')

        if user.user_type != 'PORTAL':
            raise serializers.ValidationError('This account does not have portal access')

        if not user.is_active:
            raise serializers.ValidationError('This account has been deactivated')

        # Check portal user status
        portal_profile = getattr(user, 'portal_profile', None)
        if not portal_profile:
            raise serializers.ValidationError('Portal access not configured')

        if portal_profile.access_status != 'ACTIVE':
            raise serializers.ValidationError(
                f'Portal access is {portal_profile.access_status.lower()}'
            )

        data['user'] = user
        data['portal_profile'] = portal_profile
        return data


class PortalRegisterSerializer(serializers.Serializer):
    """Serializer for portal registration via invitation."""

    token = serializers.UUIDField()
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    def validate_token(self, value):
        try:
            invitation = PortalInvitation.objects.get(token=value)
        except PortalInvitation.DoesNotExist:
            raise serializers.ValidationError('Invalid invitation token')

        if not invitation.is_valid:
            if invitation.is_expired:
                raise serializers.ValidationError('This invitation has expired')
            raise serializers.ValidationError('This invitation is no longer valid')

        self.invitation = invitation
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match'
            })

        # Validate password strength
        password_validation.validate_password(data['password'])

        return data

    def create(self, validated_data):
        invitation = self.invitation

        # Create the user
        user = User.objects.create_user(
            email=invitation.email,
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            user_type='PORTAL',
        )

        # Determine role - first user becomes owner
        is_first_portal_user = not invitation.supplier.portal_users.exists()
        role = 'OWNER' if is_first_portal_user else 'MEMBER'

        # Create portal user profile
        portal_user = PortalUser.objects.create(
            supplier=invitation.supplier,
            user=user,
            role=role,
            invited_by=invitation.created_by,
        )

        # Mark invitation as accepted
        invitation.accept(user)

        return portal_user


class PortalUserSerializer(serializers.ModelSerializer):
    """Serializer for portal user profile."""

    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_id = serializers.UUIDField(source='supplier.id', read_only=True)

    class Meta:
        model = PortalUser
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'supplier_id', 'supplier_name', 'role', 'access_status',
            'last_login_at', 'created_at',
        ]
        read_only_fields = ['id', 'role', 'access_status', 'last_login_at', 'created_at']

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if user_data:
            for attr, value in user_data.items():
                setattr(instance.user, attr, value)
            instance.user.save()
        return instance


class PortalSupplierSerializer(serializers.ModelSerializer):
    """Serializer for supplier details in portal context."""

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'code', 'status',
            'contact_name', 'contact_email', 'contact_phone',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country',
        ]
        read_only_fields = ['id', 'code', 'status']


# =============================================================================
# RFQ/Bid Serializers
# =============================================================================

class PortalRFQLineSerializer(serializers.ModelSerializer):
    """Serializer for RFQ lines in portal context."""

    class Meta:
        model = RFQLine
        fields = [
            'id', 'line_number', 'description', 'quantity',
            'unit_of_measure', 'specifications', 'target_price',
        ]


class PortalRFQListSerializer(serializers.ModelSerializer):
    """Serializer for RFQ list in portal context."""

    organization_name = serializers.CharField(source='organization.name', read_only=True)
    line_count = serializers.IntegerField(source='lines.count', read_only=True)
    has_submitted_bid = serializers.SerializerMethodField()

    class Meta:
        model = RFQ
        fields = [
            'id', 'number', 'title', 'status', 'organization_name',
            'due_date', 'line_count', 'has_submitted_bid', 'created_at',
        ]

    def get_has_submitted_bid(self, obj):
        supplier = self.context.get('supplier')
        if not supplier:
            return False
        return obj.bids.filter(supplier=supplier).exists()


class PortalRFQDetailSerializer(serializers.ModelSerializer):
    """Serializer for RFQ detail in portal context."""

    organization_name = serializers.CharField(source='organization.name', read_only=True)
    lines = PortalRFQLineSerializer(many=True, read_only=True)
    my_bid = serializers.SerializerMethodField()

    class Meta:
        model = RFQ
        fields = [
            'id', 'number', 'title', 'description', 'status',
            'organization_name', 'due_date', 'terms_and_conditions',
            'lines', 'my_bid', 'created_at',
        ]

    def get_my_bid(self, obj):
        supplier = self.context.get('supplier')
        if not supplier:
            return None
        bid = obj.bids.filter(supplier=supplier).first()
        if bid:
            return PortalBidSerializer(bid).data
        return None


class PortalBidLineSerializer(serializers.ModelSerializer):
    """Serializer for bid lines in portal context."""

    rfq_line_number = serializers.IntegerField(source='rfq_line.line_number', read_only=True)
    rfq_line_description = serializers.CharField(source='rfq_line.description', read_only=True)

    class Meta:
        model = BidLine
        fields = [
            'id', 'rfq_line', 'rfq_line_number', 'rfq_line_description',
            'unit_price', 'lead_time_days', 'notes',
        ]


class PortalBidSerializer(serializers.ModelSerializer):
    """Serializer for bids in portal context."""

    lines = PortalBidLineSerializer(many=True)
    rfq_number = serializers.CharField(source='rfq.number', read_only=True)

    class Meta:
        model = Bid
        fields = [
            'id', 'rfq', 'rfq_number', 'status', 'total_amount',
            'validity_days', 'delivery_terms', 'payment_terms',
            'notes', 'lines', 'submitted_at', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'total_amount', 'submitted_at', 'created_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        supplier = self.context.get('supplier')
        validated_data['supplier'] = supplier

        bid = Bid.objects.create(**validated_data)

        for line_data in lines_data:
            BidLine.objects.create(bid=bid, **line_data)

        return bid


# =============================================================================
# Purchase Order Serializers
# =============================================================================

class PortalPOLineSerializer(serializers.ModelSerializer):
    """Serializer for PO lines in portal context."""

    class Meta:
        model = POLine
        fields = [
            'id', 'line_number', 'description', 'quantity',
            'unit_price', 'unit_of_measure', 'extended_amount',
        ]


class PortalPOListSerializer(serializers.ModelSerializer):
    """Serializer for PO list in portal context."""

    organization_name = serializers.CharField(source='organization.name', read_only=True)
    acknowledgment_status = serializers.CharField(
        source='acknowledgment.status',
        read_only=True,
        default='PENDING'
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'number', 'title', 'status', 'total_amount',
            'organization_name', 'expected_delivery', 'sent_at',
            'acknowledgment_status', 'created_at',
        ]


class PortalPODetailSerializer(serializers.ModelSerializer):
    """Serializer for PO detail in portal context."""

    organization_name = serializers.CharField(source='organization.name', read_only=True)
    lines = PortalPOLineSerializer(many=True, read_only=True)
    acknowledgment = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'number', 'title', 'description', 'status',
            'total_amount', 'organization_name',
            'ship_to_address', 'shipping_terms', 'payment_terms',
            'expected_delivery', 'notes', 'lines', 'acknowledgment',
            'sent_at', 'created_at',
        ]

    def get_acknowledgment(self, obj):
        try:
            return POAcknowledgmentSerializer(obj.acknowledgment).data
        except POAcknowledgment.DoesNotExist:
            return None


class POAcknowledgmentSerializer(serializers.ModelSerializer):
    """Serializer for PO acknowledgment."""

    acknowledged_by_name = serializers.CharField(
        source='acknowledged_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = POAcknowledgment
        fields = [
            'id', 'status', 'acknowledged_at', 'acknowledged_by_name',
            'revised_delivery_date', 'delivery_date_reason',
            'comments', 'rejection_reason', 'created_at',
        ]
        read_only_fields = [
            'id', 'status', 'acknowledged_at', 'acknowledged_by_name', 'created_at'
        ]


class POAcknowledgeSerializer(serializers.Serializer):
    """Serializer for acknowledging a PO."""

    action = serializers.ChoiceField(choices=['acknowledge', 'reject'])
    comments = serializers.CharField(required=False, allow_blank=True, default='')
    revised_delivery_date = serializers.DateField(required=False, allow_null=True)
    delivery_date_reason = serializers.CharField(required=False, allow_blank=True, default='')
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if data['action'] == 'reject' and not data.get('rejection_reason'):
            raise serializers.ValidationError({
                'rejection_reason': 'Rejection reason is required when rejecting a PO'
            })

        if data.get('revised_delivery_date') and not data.get('delivery_date_reason'):
            raise serializers.ValidationError({
                'delivery_date_reason': 'Please provide a reason for the revised delivery date'
            })

        return data


# =============================================================================
# Invitation Serializers (for internal users to send invitations)
# =============================================================================

class PortalInvitationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating portal invitations (internal use)."""

    class Meta:
        model = PortalInvitation
        fields = ['supplier', 'email', 'personal_message']

    def create(self, validated_data):
        created_by = self.context['request'].user
        return PortalInvitation.create_invitation(
            supplier=validated_data['supplier'],
            email=validated_data['email'],
            created_by=created_by,
            personal_message=validated_data.get('personal_message', ''),
        )


class PortalInvitationSerializer(serializers.ModelSerializer):
    """Serializer for viewing portal invitations."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = PortalInvitation
        fields = [
            'id', 'supplier', 'supplier_name', 'email', 'status',
            'expires_at', 'is_expired', 'is_valid',
            'created_by_name', 'accepted_at', 'created_at',
        ]

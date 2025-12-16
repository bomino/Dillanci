"""
User views and viewsets for API endpoints.
"""

from django.contrib.auth import login, logout
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.users.serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    UserCreateSerializer,
    UserSerializer,
)


class LoginView(APIView):
    """Handle user login."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        return Response({
            'message': 'Login successful',
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    """Handle user logout."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'message': 'Logout successful'})


class MeView(APIView):
    """Get current user information."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordChangeView(APIView):
    """Handle password change for authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully'})


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user management.

    Admin users can list, create, and manage users.
    """

    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by organization if provided
        organization = self.request.query_params.get('organization')
        if organization:
            queryset = queryset.filter(organization_id=organization)
        # Filter by status if provided
        user_status = self.request.query_params.get('status')
        if user_status:
            queryset = queryset.filter(status=user_status)
        return queryset

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user account."""
        user = self.get_object()
        user.status = 'ACTIVE'
        user.is_active = True
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user account."""
        user = self.get_object()
        user.status = 'INACTIVE'
        user.is_active = False
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a user account."""
        user = self.get_object()
        user.status = 'SUSPENDED'
        user.save()
        return Response(UserSerializer(user).data)

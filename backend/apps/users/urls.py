"""
URL configuration for users app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.users.views import (
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    RoleChangeLogViewSet,
    RoleViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'role-changes', RoleChangeLogViewSet, basename='role-change')

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/password/', PasswordChangeView.as_view(), name='password-change'),

    # User and role management (admin)
    path('', include(router.urls)),
]

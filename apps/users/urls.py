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
    UserViewSet,
)

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/password/', PasswordChangeView.as_view(), name='password-change'),

    # User management (admin)
    path('', include(router.urls)),
]

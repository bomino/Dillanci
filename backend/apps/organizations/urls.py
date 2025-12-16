"""
URL configuration for organizations app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.organizations.views import OrganizationViewSet

router = DefaultRouter()
router.register(r'', OrganizationViewSet, basename='organization')

urlpatterns = [
    path('', include(router.urls)),
]

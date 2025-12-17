"""
URL configuration for core admin endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.core.views import (
    APIKeyViewSet,
    ApprovalThresholdViewSet,
    SystemPreferenceViewSet,
)

router = DefaultRouter()
router.register(r'thresholds', ApprovalThresholdViewSet, basename='approval-threshold')
router.register(r'preferences', SystemPreferenceViewSet, basename='system-preference')
router.register(r'api-keys', APIKeyViewSet, basename='api-key')

urlpatterns = [
    path('', include(router.urls)),
]

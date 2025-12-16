"""
URL configuration for Audit app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit.views import AuditConfigurationViewSet, AuditLogViewSet

router = DefaultRouter()
router.register(r'logs', AuditLogViewSet, basename='audit-log')
router.register(r'config', AuditConfigurationViewSet, basename='audit-config')

urlpatterns = [
    path('', include(router.urls)),
]

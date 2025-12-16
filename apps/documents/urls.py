"""
URL configuration for Documents app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.documents.views import DocumentConfigurationViewSet, DocumentViewSet

router = DefaultRouter()
router.register(r'config', DocumentConfigurationViewSet, basename='document-config')
router.register(r'', DocumentViewSet, basename='document')

urlpatterns = [
    path('', include(router.urls)),
]

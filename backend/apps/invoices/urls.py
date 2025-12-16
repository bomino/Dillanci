"""
URL configuration for Invoices app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.invoices.views import (
    InvoiceLineViewSet,
    InvoiceViewSet,
    MatchingConfigurationViewSet,
)

router = DefaultRouter()
# Register more specific patterns first
router.register(r'lines', InvoiceLineViewSet, basename='invoice-line')
router.register(r'config', MatchingConfigurationViewSet, basename='matching-config')
# Root pattern last
router.register(r'', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('', include(router.urls)),
]

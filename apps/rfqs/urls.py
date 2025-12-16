"""
URL configuration for RFQs app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.rfqs.views import (
    BidLineViewSet,
    BidViewSet,
    RFQLineViewSet,
    RFQViewSet,
    SupplierInvitationViewSet,
)

router = DefaultRouter()
# Register specific paths FIRST (before the empty prefix)
router.register(r'lines', RFQLineViewSet, basename='rfq-line')
router.register(r'invitations', SupplierInvitationViewSet, basename='supplier-invitation')
router.register(r'bids', BidViewSet, basename='bid')
router.register(r'bid-lines', BidLineViewSet, basename='bid-line')
# Register empty prefix LAST to avoid catching all URLs
router.register(r'', RFQViewSet, basename='rfq')

urlpatterns = [
    path('', include(router.urls)),
]

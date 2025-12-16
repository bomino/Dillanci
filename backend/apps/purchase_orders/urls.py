"""
URL configuration for Purchase Orders app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.purchase_orders.views import POLineViewSet, PurchaseOrderViewSet

router = DefaultRouter()
# Register specific paths FIRST
router.register(r'lines', POLineViewSet, basename='po-line')
# Register empty prefix LAST
router.register(r'', PurchaseOrderViewSet, basename='purchase-order')

urlpatterns = [
    path('', include(router.urls)),
]

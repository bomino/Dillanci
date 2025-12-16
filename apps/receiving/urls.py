"""
URL configuration for Receiving app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.receiving.views import GoodsReceiptLineViewSet, GoodsReceiptViewSet

router = DefaultRouter()
# Register specific paths FIRST
router.register(r'lines', GoodsReceiptLineViewSet, basename='gr-line')
# Register empty prefix LAST
router.register(r'', GoodsReceiptViewSet, basename='goods-receipt')

urlpatterns = [
    path('', include(router.urls)),
]

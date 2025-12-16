"""
URL configuration for suppliers app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.suppliers.views import SupplierViewSet

router = DefaultRouter()
router.register(r'', SupplierViewSet, basename='supplier')

urlpatterns = [
    path('', include(router.urls)),
]

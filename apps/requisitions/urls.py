"""
URL configuration for requisitions app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.requisitions.views import RequisitionLineViewSet, RequisitionViewSet

router = DefaultRouter()
router.register(r'', RequisitionViewSet, basename='requisition')
router.register(r'lines', RequisitionLineViewSet, basename='requisition-line')

urlpatterns = [
    path('', include(router.urls)),
]

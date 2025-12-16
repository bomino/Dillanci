"""
URL configuration for Contract endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ContractLineViewSet,
    ContractMilestoneViewSet,
    ContractViewSet,
)

router = DefaultRouter()
# Register more specific patterns first
router.register(r'lines', ContractLineViewSet, basename='contract-line')
router.register(r'milestones', ContractMilestoneViewSet, basename='contract-milestone')
# Root pattern last
router.register(r'', ContractViewSet, basename='contract')

urlpatterns = [
    path('', include(router.urls)),
]

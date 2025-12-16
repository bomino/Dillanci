"""
URL configuration for Reports endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DashboardViewSet,
    ReportDefinitionViewSet,
    ReportExecutionViewSet,
    SavedReportViewSet,
    ScheduledReportViewSet,
)

router = DefaultRouter()
router.register(r'definitions', ReportDefinitionViewSet, basename='report-definition')
router.register(r'saved', SavedReportViewSet, basename='saved-report')
router.register(r'scheduled', ScheduledReportViewSet, basename='scheduled-report')
router.register(r'executions', ReportExecutionViewSet, basename='report-execution')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('', include(router.urls)),
]

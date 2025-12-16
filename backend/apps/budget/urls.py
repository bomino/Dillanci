"""
URL configuration for budget app.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.budget.views import BudgetLineViewSet, EncumbranceViewSet, FiscalYearViewSet

router = DefaultRouter()
router.register(r'fiscal-years', FiscalYearViewSet, basename='fiscal-year')
router.register(r'budget-lines', BudgetLineViewSet, basename='budget-line')
router.register(r'encumbrances', EncumbranceViewSet, basename='encumbrance')

urlpatterns = [
    path('', include(router.urls)),
]

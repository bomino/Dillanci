"""
URL configuration for the Supplier Portal API.

All endpoints are prefixed with /api/v1/portal/
"""

from django.urls import path

from apps.suppliers.portal_views import (
    # Auth
    PortalLoginView,
    PortalLogoutView,
    PortalRegisterView,
    PortalInvitationValidateView,
    # Profile
    PortalProfileView,
    PortalSupplierView,
    # Dashboard
    PortalDashboardView,
    # RFQs
    PortalRFQListView,
    PortalRFQDetailView,
    PortalBidCreateView,
    PortalBidDetailView,
    # POs
    PortalPOListView,
    PortalPODetailView,
    PortalPOAcknowledgeView,
)

app_name = 'portal'

urlpatterns = [
    # Authentication
    path('auth/login/', PortalLoginView.as_view(), name='login'),
    path('auth/logout/', PortalLogoutView.as_view(), name='logout'),
    path('auth/register/', PortalRegisterView.as_view(), name='register'),
    path('auth/validate-invitation/', PortalInvitationValidateView.as_view(), name='validate-invitation'),

    # Profile
    path('profile/', PortalProfileView.as_view(), name='profile'),
    path('supplier/', PortalSupplierView.as_view(), name='supplier'),

    # Dashboard
    path('dashboard/', PortalDashboardView.as_view(), name='dashboard'),

    # RFQs
    path('rfqs/', PortalRFQListView.as_view(), name='rfq-list'),
    path('rfqs/<uuid:pk>/', PortalRFQDetailView.as_view(), name='rfq-detail'),
    path('rfqs/<uuid:rfq_id>/bids/', PortalBidCreateView.as_view(), name='bid-create'),
    path('rfqs/<uuid:rfq_id>/bids/<uuid:pk>/', PortalBidDetailView.as_view(), name='bid-detail'),

    # Purchase Orders
    path('purchase-orders/', PortalPOListView.as_view(), name='po-list'),
    path('purchase-orders/<uuid:pk>/', PortalPODetailView.as_view(), name='po-detail'),
    path('purchase-orders/<uuid:pk>/acknowledge/', PortalPOAcknowledgeView.as_view(), name='po-acknowledge'),
]

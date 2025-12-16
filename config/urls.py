"""
URL configuration for Procurement Platform.
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API v1
    path('api/v1/', include([
        path('users/', include('apps.users.urls')),
        path('organizations/', include('apps.organizations.urls')),
        path('suppliers/', include('apps.suppliers.urls')),
        path('catalog/', include('apps.catalog.urls')),
        path('budget/', include('apps.budget.urls')),
        path('requisitions/', include('apps.requisitions.urls')),
        path('rfqs/', include('apps.rfqs.urls')),
        path('purchase-orders/', include('apps.purchase_orders.urls')),
        path('receiving/', include('apps.receiving.urls')),
        path('invoices/', include('apps.invoices.urls')),
        path('audit/', include('apps.audit.urls')),
        path('documents/', include('apps.documents.urls')),
        path('contracts/', include('apps.contracts.urls')),
        path('rfps/', include('apps.rfps.urls')),
        path('reports/', include('apps.reports.urls')),
    ])),
]

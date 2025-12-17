"""
URL configuration for Procurement Platform.
"""

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter

from apps.core.views import NotificationViewSet

# Create router for notifications (available to all authenticated users)
notifications_router = DefaultRouter()
notifications_router.register(r'notifications', NotificationViewSet, basename='notification')

# Configure Django Admin site branding
admin.site.site_header = 'Dillanci Administration'
admin.site.site_title = 'Dillanci Admin'
admin.site.index_title = 'Enterprise Procurement Platform'


def health_check(request):
    """Simple health check endpoint for Docker."""
    return JsonResponse({'status': 'healthy'})


urlpatterns = [
    # Health Check
    path('api/v1/health/', health_check, name='health-check'),

    # Admin
    path('admin/', admin.site.urls),

    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API v1
    path('api/v1/', include([
        path('', include('apps.users.urls')),
        path('', include(notifications_router.urls)),  # Notifications at /api/v1/notifications/
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
        path('admin/', include('apps.core.urls')),
    ])),
]

# Debug toolbar URLs (development only)
if settings.DEBUG:
    try:
        import debug_toolbar
        urlpatterns = [
            path('__debug__/', include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass

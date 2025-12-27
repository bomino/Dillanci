"""
URL configuration for Procurement Platform.
"""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter

from apps.core.health import (
    HealthCheckView,
    LivenessCheckView,
    ReadinessCheckView,
    health_check_simple,
)
from apps.core.views import AttachmentViewSet, CommentViewSet, NotificationViewSet
from apps.requisitions.views import RequisitionTemplateViewSet

# Create router for notifications (available to all authenticated users)
notifications_router = DefaultRouter()
notifications_router.register(r'notifications', NotificationViewSet, basename='notification')

# Create router for requisition templates
templates_router = DefaultRouter()
templates_router.register(r'requisition-templates', RequisitionTemplateViewSet, basename='requisition-template')

# Create router for comments and attachments (generic, available to all authenticated users)
core_router = DefaultRouter()
core_router.register(r'comments', CommentViewSet, basename='comment')
core_router.register(r'attachments', AttachmentViewSet, basename='attachment')

# Configure Django Admin site branding
admin.site.site_header = 'Dillanci Administration'
admin.site.site_title = 'Dillanci Admin'
admin.site.index_title = 'Enterprise Procurement Platform'
admin.site.site_url = settings.FRONTEND_URL  # "View Site" link points to React app


urlpatterns = [
    # Health Check Endpoints
    path('api/v1/health/', health_check_simple, name='health-check'),
    path('api/v1/health/detailed/', HealthCheckView.as_view(), name='health-check-detailed'),
    path('api/v1/health/ready/', ReadinessCheckView.as_view(), name='health-check-ready'),
    path('api/v1/health/live/', LivenessCheckView.as_view(), name='health-check-live'),

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
        path('', include(templates_router.urls)),  # Templates at /api/v1/requisition-templates/
        path('', include(core_router.urls)),  # Comments and Attachments at /api/v1/comments/ and /api/v1/attachments/
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
        # Supplier Portal API
        path('portal/', include('apps.suppliers.portal_urls')),
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

"""Purchase Orders app configuration."""

from django.apps import AppConfig


class PurchaseOrdersConfig(AppConfig):
    """Configuration for the Purchase Orders app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.purchase_orders'
    verbose_name = 'Purchase Orders'

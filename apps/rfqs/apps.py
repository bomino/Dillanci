"""RFQ app configuration."""

from django.apps import AppConfig


class RfqsConfig(AppConfig):
    """Configuration for the RFQs app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rfqs'
    verbose_name = 'RFQs'

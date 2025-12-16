"""Receiving app configuration."""

from django.apps import AppConfig


class ReceivingConfig(AppConfig):
    """Configuration for the Receiving app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.receiving'
    verbose_name = 'Goods Receiving'

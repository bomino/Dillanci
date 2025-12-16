"""Invoices app configuration."""

from django.apps import AppConfig


class InvoicesConfig(AppConfig):
    """Configuration for the Invoices app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.invoices'
    verbose_name = 'Invoices'

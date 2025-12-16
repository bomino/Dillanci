"""
Django app configuration for Contracts.
"""

from django.apps import AppConfig


class ContractsConfig(AppConfig):
    """Configuration for the Contracts app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.contracts'
    verbose_name = 'Contracts'

    def ready(self):
        """Import signals when app is ready."""
        import apps.contracts.signals  # noqa: F401

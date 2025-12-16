"""
App configuration for Audit module.
"""

from django.apps import AppConfig


class AuditConfig(AppConfig):
    """Configuration for the Audit app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.audit'
    verbose_name = 'Audit Trail'

    def ready(self):
        """Import signals when app is ready."""
        import apps.audit.signals  # noqa: F401

"""
App configuration for Documents module.
"""

from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    """Configuration for the Documents app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.documents'
    verbose_name = 'Document Management'

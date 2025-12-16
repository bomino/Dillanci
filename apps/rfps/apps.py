"""
RFP app configuration.
"""

from django.apps import AppConfig


class RfpsConfig(AppConfig):
    """Configuration for the RFPs application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rfps'
    verbose_name = 'Requests for Proposal'

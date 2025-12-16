"""
Organization models - Multi-tenant structure.
"""

from django.db import models

from apps.core.models import SoftDeleteModel


class Organization(SoftDeleteModel):
    """
    Top-level tenant organization.
    """

    STATUSES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('SUSPENDED', 'Suspended'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='ACTIVE')
    timezone = models.CharField(max_length=50, default='UTC')
    default_currency = models.CharField(max_length=3, default='USD')
    fiscal_year_start_month = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = 'organization'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'

    def __str__(self):
        return self.name

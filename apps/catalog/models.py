"""
Catalog models - Categories and Items for procurement.
"""

from decimal import Decimal

from django.db import models

from apps.core.models import SoftDeleteModel


class Category(SoftDeleteModel):
    """
    Product category with hierarchical structure.

    Supports nested categories (parent-child relationships)
    for organizing items in a taxonomy.
    """

    STATUSES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='categories',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='ACTIVE',
    )

    class Meta:
        db_table = 'category'
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        unique_together = ['organization', 'code']

    def __str__(self):
        return f'{self.name} ({self.code})'

    def get_ancestors(self):
        """
        Return list of all ancestor categories (parent, grandparent, etc.).

        Returns:
            list: Ancestor categories from immediate parent to root.
        """
        ancestors = []
        current = self.parent
        while current is not None:
            ancestors.append(current)
            current = current.parent
        return ancestors

    def get_full_path(self):
        """
        Return full path from root to this category.

        Returns:
            str: Category path like "Office > Writing > Pens"
        """
        ancestors = self.get_ancestors()
        path_parts = [a.name for a in reversed(ancestors)] + [self.name]
        return ' > '.join(path_parts)


class Item(SoftDeleteModel):
    """
    Catalog item representing a purchasable product or service.
    """

    STATUSES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('DISCONTINUED', 'Discontinued'),
    ]

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, help_text='Stock Keeping Unit')
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='items',
    )
    unit_of_measure = models.CharField(
        max_length=20,
        help_text='e.g., EA, BOX, CASE, HR',
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default='ACTIVE',
    )

    # Optional fields
    manufacturer = models.CharField(max_length=255, blank=True)
    manufacturer_part_number = models.CharField(max_length=100, blank=True)
    lead_time_days = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'catalog_item'
        verbose_name = 'Catalog Item'
        verbose_name_plural = 'Catalog Items'
        # SKU unique per organization (via category's organization)
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'sku'],
                name='unique_sku_per_category',
            ),
        ]

    def __str__(self):
        return f'{self.name} ({self.sku})'

    @property
    def organization(self):
        """Get organization from category."""
        return self.category.organization

"""
Tests for Catalog models - Categories and Items.

Following TDD: Tests written first.
"""

import pytest
from decimal import Decimal

from apps.organizations.models import Organization


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def category(db, organization):
    """Create a test category."""
    from apps.catalog.models import Category
    return Category.objects.create(
        name='Office Supplies',
        code='OFF',
        organization=organization,
    )


@pytest.fixture
def item(db, category):
    """Create a test catalog item."""
    from apps.catalog.models import Item
    return Item.objects.create(
        name='Ballpoint Pen',
        sku='PEN-001',
        category=category,
        unit_of_measure='EA',
        unit_price=Decimal('1.99'),
    )


@pytest.mark.django_db
class TestCategoryModel:
    """Tests for Category model."""

    def test_create_category(self, organization):
        """Can create category with required fields."""
        from apps.catalog.models import Category
        category = Category.objects.create(
            name='Electronics',
            code='ELEC',
            organization=organization,
        )
        assert category.name == 'Electronics'
        assert category.code == 'ELEC'

    def test_category_has_uuid_id(self, organization):
        """Category should use UUID primary key."""
        from apps.catalog.models import Category
        category = Category.objects.create(
            name='Furniture',
            code='FURN',
            organization=organization,
        )
        assert len(str(category.id)) == 36

    def test_category_string_representation(self, category):
        """String representation should include name."""
        assert 'Office Supplies' in str(category)

    def test_category_code_unique_per_org(self, organization):
        """Category code must be unique within organization."""
        from apps.catalog.models import Category
        Category.objects.create(name='First', code='UNIQUE1', organization=organization)

        with pytest.raises(Exception):  # IntegrityError
            Category.objects.create(name='Second', code='UNIQUE1', organization=organization)

    def test_category_default_status_active(self, organization):
        """New categories default to ACTIVE status."""
        from apps.catalog.models import Category
        category = Category.objects.create(
            name='Test Category',
            code='TEST01',
            organization=organization,
        )
        assert category.status == 'ACTIVE'


@pytest.mark.django_db
class TestCategoryHierarchy:
    """Tests for category parent-child relationships."""

    def test_category_can_have_parent(self, organization):
        """Category can be nested under a parent category."""
        from apps.catalog.models import Category
        parent = Category.objects.create(
            name='Office Supplies',
            code='OFF',
            organization=organization,
        )
        child = Category.objects.create(
            name='Writing Instruments',
            code='OFF-WRT',
            organization=organization,
            parent=parent,
        )
        assert child.parent == parent
        assert child in parent.children.all()

    def test_root_categories_have_no_parent(self, organization):
        """Root categories have null parent."""
        from apps.catalog.models import Category
        root = Category.objects.create(
            name='Root Category',
            code='ROOT',
            organization=organization,
        )
        assert root.parent is None

    def test_get_ancestors(self, organization):
        """Can get all ancestor categories."""
        from apps.catalog.models import Category
        grandparent = Category.objects.create(
            name='Office', code='OFF', organization=organization
        )
        parent = Category.objects.create(
            name='Writing', code='OFF-WRT', organization=organization, parent=grandparent
        )
        child = Category.objects.create(
            name='Pens', code='OFF-WRT-PEN', organization=organization, parent=parent
        )

        ancestors = child.get_ancestors()
        assert grandparent in ancestors
        assert parent in ancestors
        assert len(ancestors) == 2


@pytest.mark.django_db
class TestItemModel:
    """Tests for catalog Item model."""

    def test_create_item(self, category):
        """Can create item with required fields."""
        from apps.catalog.models import Item
        item = Item.objects.create(
            name='Stapler',
            sku='STPL-001',
            category=category,
            unit_of_measure='EA',
            unit_price=Decimal('12.99'),
        )
        assert item.name == 'Stapler'
        assert item.sku == 'STPL-001'
        assert item.unit_price == Decimal('12.99')

    def test_item_has_uuid_id(self, category):
        """Item should use UUID primary key."""
        from apps.catalog.models import Item
        item = Item.objects.create(
            name='Test Item',
            sku='TEST-001',
            category=category,
            unit_of_measure='EA',
            unit_price=Decimal('9.99'),
        )
        assert len(str(item.id)) == 36

    def test_item_string_representation(self, item):
        """String representation should include name and SKU."""
        assert 'Ballpoint Pen' in str(item)
        assert 'PEN-001' in str(item)

    def test_item_sku_unique_per_category(self, category):
        """Item SKU must be unique within the same category."""
        from apps.catalog.models import Item
        Item.objects.create(
            name='First Item',
            sku='UNIQUE-SKU',
            category=category,
            unit_of_measure='EA',
            unit_price=Decimal('5.00'),
        )

        with pytest.raises(Exception):  # IntegrityError
            Item.objects.create(
                name='Second Item',
                sku='UNIQUE-SKU',  # Same SKU in same category
                category=category,
                unit_of_measure='EA',
                unit_price=Decimal('10.00'),
            )

    def test_item_sku_can_duplicate_across_categories(self, category, organization):
        """Same SKU can exist in different categories."""
        from apps.catalog.models import Item, Category
        Item.objects.create(
            name='First Item',
            sku='SHARED-SKU',
            category=category,
            unit_of_measure='EA',
            unit_price=Decimal('5.00'),
        )

        # Create another category in same org
        other_category = Category.objects.create(
            name='Other', code='OTH', organization=organization
        )

        # Should succeed - same SKU but different category
        item2 = Item.objects.create(
            name='Second Item',
            sku='SHARED-SKU',
            category=other_category,
            unit_of_measure='EA',
            unit_price=Decimal('10.00'),
        )
        assert item2.sku == 'SHARED-SKU'

    def test_item_default_status_active(self, category):
        """New items default to ACTIVE status."""
        from apps.catalog.models import Item
        item = Item.objects.create(
            name='Active Item',
            sku='ACT-001',
            category=category,
            unit_of_measure='EA',
            unit_price=Decimal('5.00'),
        )
        assert item.status == 'ACTIVE'

    def test_item_belongs_to_category(self, item, category):
        """Item should be linked to its category."""
        assert item.category == category
        assert item in category.items.all()

    def test_item_inherits_organization_from_category(self, item, organization):
        """Item's organization should come from its category."""
        assert item.organization == organization


@pytest.mark.django_db
class TestItemPricing:
    """Tests for item pricing functionality."""

    def test_item_has_unit_price(self, item):
        """Item should have a unit price."""
        assert item.unit_price == Decimal('1.99')

    def test_item_price_can_be_updated(self, item):
        """Item price can be modified."""
        item.unit_price = Decimal('2.49')
        item.save()
        item.refresh_from_db()
        assert item.unit_price == Decimal('2.49')

    def test_item_can_have_zero_price(self, category):
        """Items can have zero price (free items)."""
        from apps.catalog.models import Item
        item = Item.objects.create(
            name='Free Sample',
            sku='FREE-001',
            category=category,
            unit_of_measure='EA',
            unit_price=Decimal('0.00'),
        )
        assert item.unit_price == Decimal('0.00')

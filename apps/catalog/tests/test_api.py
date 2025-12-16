"""
API tests for Catalog endpoints.

Tests for Category and Item viewsets including hierarchical operations.
"""

import pytest
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient

from apps.catalog.models import Category, Item
from apps.organizations.models import Organization
from apps.users.models import User


@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def other_organization(db):
    """Create another organization for isolation tests."""
    return Organization.objects.create(name='Other Org', code='OTHER001')


@pytest.fixture
def user(db, organization):
    """Create a test user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def admin_user(db, organization):
    """Create an admin user."""
    return User.objects.create_superuser(
        email='admin@example.com',
        password='adminpass123',
        first_name='Admin',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    """Return an authenticated admin API client."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def category(db, organization):
    """Create a test category."""
    return Category.objects.create(
        organization=organization,
        name='Electronics',
        code='ELEC',
        status='ACTIVE',
    )


@pytest.fixture
def child_category(db, organization, category):
    """Create a child category."""
    return Category.objects.create(
        organization=organization,
        name='Computers',
        code='COMP',
        parent=category,
        status='ACTIVE',
    )


@pytest.fixture
def grandchild_category(db, organization, child_category):
    """Create a grandchild category."""
    return Category.objects.create(
        organization=organization,
        name='Laptops',
        code='LAPTOP',
        parent=child_category,
        status='ACTIVE',
    )


@pytest.fixture
def item(db, category):
    """Create a test catalog item."""
    return Item.objects.create(
        category=category,
        name='Test Item',
        sku='TEST-001',
        description='Test item description',
        unit_of_measure='EA',
        unit_price=Decimal('99.99'),
        status='ACTIVE',
    )


@pytest.fixture
def item2(db, category):
    """Create another catalog item with different price."""
    return Item.objects.create(
        category=category,
        name='Expensive Item',
        sku='EXP-001',
        description='Expensive item',
        unit_of_measure='EA',
        unit_price=Decimal('500.00'),
        status='ACTIVE',
    )


@pytest.mark.django_db
class TestCategoryViewSet:
    """Tests for /api/v1/catalog/categories/ endpoints."""

    def test_list_categories(self, authenticated_client, category):
        """Can list categories in user's organization."""
        response = authenticated_client.get('/api/v1/catalog/categories/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Electronics'

    def test_create_category(self, authenticated_client, organization):
        """Can create a new category."""
        response = authenticated_client.post(
            '/api/v1/catalog/categories/',
            {
                'organization': str(organization.id),
                'name': 'Office Supplies',
                'code': 'OFFICE',
                'status': 'ACTIVE',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Category.objects.filter(name='Office Supplies').exists()

    def test_get_category_detail(self, authenticated_client, category):
        """Can get category details."""
        response = authenticated_client.get(f'/api/v1/catalog/categories/{category.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Electronics'
        assert response.data['code'] == 'ELEC'

    def test_update_category(self, authenticated_client, category):
        """Can update a category."""
        response = authenticated_client.patch(
            f'/api/v1/catalog/categories/{category.id}/',
            {'description': 'Updated description'},
        )
        assert response.status_code == status.HTTP_200_OK
        category.refresh_from_db()
        assert category.description == 'Updated description'

    def test_delete_category(self, authenticated_client, category):
        """Can delete a category."""
        response = authenticated_client.delete(f'/api/v1/catalog/categories/{category.id}/')
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_organization_isolation(self, authenticated_client, other_organization):
        """Users cannot see categories from other organizations."""
        Category.objects.create(
            organization=other_organization,
            name='Other Category',
            code='OTHER',
            status='ACTIVE',
        )
        response = authenticated_client.get('/api/v1/catalog/categories/')
        assert response.status_code == status.HTTP_200_OK
        # Should not see category from other organization
        for cat in response.data['results']:
            assert cat['name'] != 'Other Category'


@pytest.mark.django_db
class TestCategoryHierarchy:
    """Tests for category hierarchy actions."""

    def test_get_category_tree(self, authenticated_client, category, child_category, grandchild_category):
        """Can get category tree structure."""
        response = authenticated_client.get('/api/v1/catalog/categories/tree/')
        assert response.status_code == status.HTTP_200_OK
        # Should return only root categories
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Electronics'

    def test_get_category_children(self, authenticated_client, category, child_category):
        """Can get direct children of a category."""
        response = authenticated_client.get(f'/api/v1/catalog/categories/{category.id}/children/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Computers'

    def test_get_category_ancestors(self, authenticated_client, grandchild_category):
        """Can get ancestors of a category."""
        response = authenticated_client.get(
            f'/api/v1/catalog/categories/{grandchild_category.id}/ancestors/'
        )
        assert response.status_code == status.HTTP_200_OK
        # Should return parent and grandparent
        assert len(response.data) == 2
        names = [c['name'] for c in response.data]
        assert 'Electronics' in names
        assert 'Computers' in names

    def test_get_category_items(self, authenticated_client, category, item):
        """Can get items in a category."""
        response = authenticated_client.get(f'/api/v1/catalog/categories/{category.id}/items/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Test Item'


@pytest.mark.django_db
class TestItemViewSet:
    """Tests for /api/v1/catalog/items/ endpoints."""

    def test_list_items(self, authenticated_client, item):
        """Can list items in user's organization."""
        response = authenticated_client.get('/api/v1/catalog/items/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Test Item'

    def test_create_item(self, authenticated_client, category):
        """Can create a new item."""
        response = authenticated_client.post(
            '/api/v1/catalog/items/',
            {
                'category': str(category.id),
                'name': 'New Item',
                'sku': 'NEW-001',
                'unit_of_measure': 'EA',
                'unit_price': '25.00',
                'status': 'ACTIVE',
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Item.objects.filter(sku='NEW-001').exists()

    def test_get_item_detail(self, authenticated_client, item):
        """Can get item details."""
        response = authenticated_client.get(f'/api/v1/catalog/items/{item.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Test Item'
        assert response.data['sku'] == 'TEST-001'

    def test_update_item(self, authenticated_client, item):
        """Can update an item."""
        response = authenticated_client.patch(
            f'/api/v1/catalog/items/{item.id}/',
            {'unit_price': '149.99'},
        )
        assert response.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.unit_price == Decimal('149.99')

    def test_filter_by_price_range(self, authenticated_client, item, item2):
        """Can filter items by price range."""
        # Filter for items under $200
        response = authenticated_client.get('/api/v1/catalog/items/?max_price=200')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['sku'] == 'TEST-001'

        # Filter for items over $200
        response = authenticated_client.get('/api/v1/catalog/items/?min_price=200')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['sku'] == 'EXP-001'

        # Filter for items in a range
        response = authenticated_client.get('/api/v1/catalog/items/?min_price=50&max_price=150')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['sku'] == 'TEST-001'

    def test_search_items(self, authenticated_client, item, item2):
        """Can search items by name or SKU."""
        response = authenticated_client.get('/api/v1/catalog/items/?search=Expensive')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Expensive Item'

    def test_filter_by_category(self, authenticated_client, item, child_category):
        """Can filter items by category."""
        # Create item in child category
        Item.objects.create(
            category=child_category,
            name='Child Item',
            sku='CHILD-001',
            unit_of_measure='EA',
            unit_price=Decimal('50.00'),
            status='ACTIVE',
        )

        response = authenticated_client.get(
            f'/api/v1/catalog/items/?category={child_category.id}'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Child Item'


@pytest.mark.django_db
class TestCatalogAdminAccess:
    """Tests for admin-specific catalog access."""

    def test_admin_sees_all_organizations(self, admin_client, category, other_organization):
        """Admin users can see categories from all organizations."""
        Category.objects.create(
            organization=other_organization,
            name='Other Category',
            code='OTHER',
            status='ACTIVE',
        )
        response = admin_client.get('/api/v1/catalog/categories/')
        assert response.status_code == status.HTTP_200_OK
        # Admin should see both categories
        assert len(response.data['results']) == 2

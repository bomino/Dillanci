"""
Catalog serializers for API endpoints.
"""

from rest_framework import serializers

from apps.catalog.models import Category, Item


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for category list and detail views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name', read_only=True
    )
    full_path = serializers.CharField(
        source='get_full_path', read_only=True
    )
    children_count = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'code',
            'description',
            'organization',
            'organization_name',
            'parent',
            'parent_name',
            'full_path',
            'status',
            'children_count',
            'items_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_children_count(self, obj):
        return obj.children.count()

    def get_items_count(self, obj):
        return obj.items.count()


class CategoryTreeSerializer(serializers.ModelSerializer):
    """Serializer for category tree view with nested children."""

    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'code', 'status', 'children']

    def get_children(self, obj):
        children = obj.children.filter(status='ACTIVE')
        return CategoryTreeSerializer(children, many=True).data


class ItemSerializer(serializers.ModelSerializer):
    """Serializer for item list and detail views."""

    category_name = serializers.CharField(
        source='category.name', read_only=True
    )
    category_path = serializers.CharField(
        source='category.get_full_path', read_only=True
    )
    organization = serializers.UUIDField(
        source='category.organization.id', read_only=True
    )
    organization_name = serializers.CharField(
        source='category.organization.name', read_only=True
    )

    class Meta:
        model = Item
        fields = [
            'id',
            'name',
            'sku',
            'description',
            'category',
            'category_name',
            'category_path',
            'organization',
            'organization_name',
            'unit_of_measure',
            'unit_price',
            'status',
            'manufacturer',
            'manufacturer_part_number',
            'lead_time_days',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ItemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for item list views."""

    category_name = serializers.CharField(
        source='category.name', read_only=True
    )

    class Meta:
        model = Item
        fields = [
            'id',
            'name',
            'sku',
            'category',
            'category_name',
            'unit_of_measure',
            'unit_price',
            'status',
        ]

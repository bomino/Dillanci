"""
Catalog views and viewsets for API endpoints.
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.catalog.models import Category, Item
from apps.catalog.serializers import (
    CategorySerializer,
    CategoryTreeSerializer,
    ItemListSerializer,
    ItemSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for category management.

    Supports hierarchical categories with parent-child relationships.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'organization', 'parent']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'code', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Get category tree structure (root categories with nested children)."""
        queryset = self.get_queryset().filter(parent__isnull=True, status='ACTIVE')
        serializer = CategoryTreeSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get direct children of a category."""
        category = self.get_object()
        children = category.children.filter(status='ACTIVE')
        serializer = CategorySerializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def ancestors(self, request, pk=None):
        """Get all ancestors of a category (parent chain to root)."""
        category = self.get_object()
        ancestors = category.get_ancestors()
        serializer = CategorySerializer(ancestors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Get all items in this category."""
        category = self.get_object()
        items = category.items.filter(status='ACTIVE')
        serializer = ItemListSerializer(items, many=True)
        return Response(serializer.data)


class ItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for catalog item management.
    """

    queryset = Item.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'category', 'unit_of_measure']
    search_fields = ['name', 'sku', 'description', 'manufacturer']
    ordering_fields = ['name', 'sku', 'unit_price', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return ItemListSerializer
        return ItemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(category__organization=user.organization)

        # Filter by price range if provided
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        if min_price:
            queryset = queryset.filter(unit_price__gte=min_price)
        if max_price:
            queryset = queryset.filter(unit_price__lte=max_price)

        return queryset

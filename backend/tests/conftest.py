"""
Global pytest fixtures for the procurement platform.

This file is automatically loaded by pytest and provides
fixtures available to all test modules.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """Return an unauthenticated DRF API client."""
    return APIClient()


@pytest.fixture
def user(db):
    """Create and return a test user."""
    User = get_user_model()
    return User.objects.create_user(
        email='testuser@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an API client authenticated as the test user."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_user(db):
    """Create and return an admin/superuser."""
    User = get_user_model()
    return User.objects.create_superuser(
        email='admin@example.com',
        password='adminpass123',
        first_name='Admin',
        last_name='User',
    )


@pytest.fixture
def admin_client(api_client, admin_user):
    """Return an API client authenticated as admin."""
    api_client.force_authenticate(user=admin_user)
    return api_client

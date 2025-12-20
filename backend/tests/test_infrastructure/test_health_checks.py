"""
Tests for health check endpoints.

These tests verify that health check endpoints are properly configured
and return expected responses for monitoring systems.
"""

import json

import pytest
from unittest.mock import patch, MagicMock


class TestHealthCheckFunctions:
    """Unit tests for health check functions."""

    def test_check_database_healthy(self):
        """Database check should return healthy when connection works."""
        from apps.core.health import check_database

        # Mock the database connection
        with patch('apps.core.health.connection') as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
            mock_cursor.execute = MagicMock()
            mock_cursor.fetchone = MagicMock(return_value=(1,))

            result = check_database()

            assert result['status'] == 'healthy'
            assert 'response_time_ms' in result
            assert isinstance(result['response_time_ms'], float)

    def test_check_database_unhealthy(self):
        """Database check should return unhealthy when connection fails."""
        from apps.core.health import check_database

        with patch('apps.core.health.connection') as mock_conn:
            mock_conn.cursor.side_effect = Exception("Connection refused")

            result = check_database()

            assert result['status'] == 'unhealthy'
            assert 'error' in result

    def test_check_cache_healthy(self):
        """Cache check should return healthy when Redis works."""
        from apps.core.health import check_cache

        with patch('apps.core.health.cache') as mock_cache:
            mock_cache.set = MagicMock()
            mock_cache.get = MagicMock(return_value='ok')
            mock_cache.delete = MagicMock()

            result = check_cache()

            assert result['status'] == 'healthy'
            assert 'response_time_ms' in result

    def test_check_cache_unhealthy(self):
        """Cache check should return unhealthy when Redis fails."""
        from apps.core.health import check_cache

        with patch('apps.core.health.cache') as mock_cache:
            mock_cache.set.side_effect = Exception("Redis connection refused")

            result = check_cache()

            assert result['status'] == 'unhealthy'
            assert 'error' in result

    def test_check_cache_mismatch(self):
        """Cache check should return unhealthy when read/write mismatch."""
        from apps.core.health import check_cache

        with patch('apps.core.health.cache') as mock_cache:
            mock_cache.set = MagicMock()
            mock_cache.get = MagicMock(return_value='wrong_value')
            mock_cache.delete = MagicMock()

            result = check_cache()

            assert result['status'] == 'unhealthy'

    def test_check_celery_with_workers(self):
        """Celery check should return healthy when workers exist."""
        from apps.core.health import check_celery

        with patch('celery.current_app') as mock_app:
            mock_inspector = MagicMock()
            mock_inspector.active.return_value = {
                'celery@worker1': [],
                'celery@worker2': [],
            }
            mock_app.control.inspect.return_value = mock_inspector

            result = check_celery()

            assert result['status'] == 'healthy'
            assert result['workers'] == 2
            assert 'worker_names' in result

    def test_check_celery_no_workers(self):
        """Celery check should return degraded when no workers respond."""
        from apps.core.health import check_celery

        with patch('celery.current_app') as mock_app:
            mock_inspector = MagicMock()
            mock_inspector.active.return_value = None
            mock_app.control.inspect.return_value = mock_inspector

            result = check_celery()

            assert result['status'] == 'degraded'
            assert result['workers'] == 0


class TestHealthCheckViews:
    """Tests for health check view responses."""

    def test_simple_health_check_returns_healthy(self):
        """Simple health check should always return healthy if app is running."""
        from django.test import RequestFactory
        from apps.core.health import health_check_simple

        factory = RequestFactory()
        request = factory.get('/api/v1/health/')

        response = health_check_simple(request)

        assert response.status_code == 200
        import json
        data = json.loads(response.content)
        assert data['status'] == 'healthy'
        assert data['service'] == 'dillanci-api'

    def test_liveness_check_returns_alive(self):
        """Liveness check should return alive."""
        from django.test import RequestFactory
        from apps.core.health import LivenessCheckView

        factory = RequestFactory()
        request = factory.get('/api/v1/health/live/')

        view = LivenessCheckView.as_view()
        response = view(request)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data['alive'] is True

    def test_readiness_check_with_healthy_deps(self):
        """Readiness check should return ready when deps are healthy."""
        from django.test import RequestFactory
        from apps.core.health import ReadinessCheckView

        factory = RequestFactory()
        request = factory.get('/api/v1/health/ready/')

        with patch('apps.core.health.check_database') as mock_db, \
             patch('apps.core.health.check_cache') as mock_cache:
            mock_db.return_value = {'status': 'healthy'}
            mock_cache.return_value = {'status': 'healthy'}

            view = ReadinessCheckView.as_view()
            response = view(request)

            assert response.status_code == 200
            data = json.loads(response.content)
            assert data['ready'] is True

    def test_readiness_check_with_unhealthy_deps(self):
        """Readiness check should return not ready when deps are unhealthy."""
        from django.test import RequestFactory
        from apps.core.health import ReadinessCheckView

        factory = RequestFactory()
        request = factory.get('/api/v1/health/ready/')

        with patch('apps.core.health.check_database') as mock_db, \
             patch('apps.core.health.check_cache') as mock_cache:
            mock_db.return_value = {'status': 'unhealthy', 'error': 'connection refused'}
            mock_cache.return_value = {'status': 'healthy'}

            view = ReadinessCheckView.as_view()
            response = view(request)

            assert response.status_code == 503
            data = json.loads(response.content)
            assert data['ready'] is False

    def test_detailed_health_check_returns_all_checks(self):
        """Detailed health check should return status of all dependencies."""
        from django.test import RequestFactory
        from apps.core.health import HealthCheckView

        factory = RequestFactory()
        request = factory.get('/api/v1/health/detailed/')

        with patch('apps.core.health.check_database') as mock_db, \
             patch('apps.core.health.check_cache') as mock_cache, \
             patch('apps.core.health.check_celery') as mock_celery:
            mock_db.return_value = {'status': 'healthy', 'response_time_ms': 1.5}
            mock_cache.return_value = {'status': 'healthy', 'response_time_ms': 0.5}
            mock_celery.return_value = {'status': 'healthy', 'workers': 2}

            view = HealthCheckView.as_view()
            response = view(request)

            assert response.status_code == 200
            data = json.loads(response.content)
            assert data['status'] == 'healthy'
            assert 'database' in data['checks']
            assert 'cache' in data['checks']
            assert 'celery' in data['checks']

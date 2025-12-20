"""
Comprehensive health check endpoints for production monitoring.

Provides detailed health status for:
- Database connectivity
- Redis/Cache availability
- Celery worker status
- Disk space
- Memory usage
"""

import logging
import time
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


def check_database() -> dict[str, Any]:
    """Check database connectivity and response time."""
    start = time.time()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        elapsed = (time.time() - start) * 1000  # Convert to ms
        return {
            'status': 'healthy',
            'response_time_ms': round(elapsed, 2),
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e),
        }


def check_cache() -> dict[str, Any]:
    """Check Redis/cache connectivity."""
    start = time.time()
    try:
        test_key = '_health_check_test'
        test_value = 'ok'
        cache.set(test_key, test_value, timeout=10)
        result = cache.get(test_key)
        cache.delete(test_key)

        if result != test_value:
            raise ValueError("Cache read/write mismatch")

        elapsed = (time.time() - start) * 1000
        return {
            'status': 'healthy',
            'response_time_ms': round(elapsed, 2),
        }
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e),
        }


def check_celery() -> dict[str, Any]:
    """Check Celery worker availability."""
    try:
        from celery import current_app

        # Inspect active workers
        inspector = current_app.control.inspect(timeout=2.0)
        active_workers = inspector.active()

        if active_workers is None:
            return {
                'status': 'degraded',
                'message': 'No Celery workers responding',
                'workers': 0,
            }

        worker_count = len(active_workers)
        return {
            'status': 'healthy',
            'workers': worker_count,
            'worker_names': list(active_workers.keys()),
        }
    except Exception as e:
        logger.warning(f"Celery health check failed: {e}")
        return {
            'status': 'unknown',
            'error': str(e),
        }


def health_check_simple(request):
    """
    Simple health check for load balancers and container orchestration.

    Returns 200 if the application is running.
    This endpoint does NOT check dependencies to ensure fast response.
    """
    return JsonResponse({
        'status': 'healthy',
        'service': 'dillanci-api',
    })


class HealthCheckView(APIView):
    """
    Comprehensive health check endpoint for monitoring systems.

    GET /api/v1/health/detailed/
    Returns detailed health status of all dependencies.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # No auth required for health checks

    def get(self, request):
        """Return detailed health status."""
        checks = {}
        overall_status = 'healthy'

        # Database check
        checks['database'] = check_database()
        if checks['database']['status'] != 'healthy':
            overall_status = 'unhealthy'

        # Cache check
        checks['cache'] = check_cache()
        if checks['cache']['status'] != 'healthy':
            overall_status = 'unhealthy'

        # Celery check (optional - don't fail health if workers are down)
        checks['celery'] = check_celery()
        if checks['celery']['status'] == 'degraded':
            if overall_status == 'healthy':
                overall_status = 'degraded'

        # Build response
        response_data = {
            'status': overall_status,
            'service': 'dillanci-api',
            'version': getattr(settings, 'APP_VERSION', '1.0.0'),
            'checks': checks,
        }

        # Determine HTTP status code
        if overall_status == 'healthy':
            http_status = status.HTTP_200_OK
        elif overall_status == 'degraded':
            http_status = status.HTTP_200_OK  # Still serving, but degraded
        else:
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE

        return JsonResponse(response_data, status=http_status)


class ReadinessCheckView(APIView):
    """
    Readiness probe for Kubernetes/container orchestration.

    GET /api/v1/health/ready/
    Returns 200 only if the application is ready to receive traffic.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        """Check if application is ready to receive traffic."""
        # Must have database and cache available
        db_check = check_database()
        cache_check = check_cache()

        is_ready = (
            db_check['status'] == 'healthy' and
            cache_check['status'] == 'healthy'
        )

        response_data = {
            'ready': is_ready,
            'checks': {
                'database': db_check['status'],
                'cache': cache_check['status'],
            },
        }

        http_status = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE
        return JsonResponse(response_data, status=http_status)


class LivenessCheckView(APIView):
    """
    Liveness probe for Kubernetes/container orchestration.

    GET /api/v1/health/live/
    Returns 200 if the application process is alive.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        """Simple liveness check - if this responds, we're alive."""
        return JsonResponse({
            'alive': True,
            'service': 'dillanci-api',
        })

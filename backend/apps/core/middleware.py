"""
Custom middleware for the Dillanci platform.

Includes:
- Request correlation ID for distributed tracing
- Request logging with timing
"""

import logging
import time
import uuid
from typing import Callable

from django.http import HttpRequest, HttpResponse

logger = logging.getLogger(__name__)

# Thread-local storage for correlation ID
import threading
_correlation_id = threading.local()


def get_correlation_id() -> str | None:
    """Get the current request's correlation ID."""
    return getattr(_correlation_id, 'value', None)


def set_correlation_id(value: str) -> None:
    """Set the correlation ID for the current request."""
    _correlation_id.value = value


class CorrelationIdMiddleware:
    """
    Middleware to add correlation IDs to requests for distributed tracing.

    - Checks for incoming X-Correlation-ID or X-Request-ID header
    - Generates a new UUID if none provided
    - Adds correlation ID to response headers
    - Makes correlation ID available to logging

    Usage in logs:
        correlation_id = get_correlation_id()
        logger.info(f"[{correlation_id}] Processing request...")
    """

    HEADER_NAMES = ['X-Correlation-ID', 'X-Request-ID']
    RESPONSE_HEADER = 'X-Correlation-ID'

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Try to get correlation ID from incoming headers
        correlation_id = None
        for header_name in self.HEADER_NAMES:
            # Django converts headers to META format
            meta_key = f'HTTP_{header_name.upper().replace("-", "_")}'
            correlation_id = request.META.get(meta_key)
            if correlation_id:
                break

        # Generate new ID if none provided
        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        # Store in thread-local storage for access in views/logging
        set_correlation_id(correlation_id)

        # Add to request for easy access
        request.correlation_id = correlation_id

        # Process request
        response = self.get_response(request)

        # Add correlation ID to response headers
        response[self.RESPONSE_HEADER] = correlation_id

        # Clear thread-local storage
        set_correlation_id(None)

        return response


class RequestLoggingMiddleware:
    """
    Middleware to log request details including timing.

    Logs:
    - Request method and path
    - Response status code
    - Request duration in milliseconds
    - Correlation ID (if CorrelationIdMiddleware is enabled)
    """

    # Paths to exclude from logging (health checks, static files)
    EXCLUDED_PATHS = [
        '/api/v1/health/',
        '/api/v1/health/live/',
        '/api/v1/health/ready/',
        '/api/v1/health/detailed/',
        '/static/',
        '/media/',
        '/__debug__/',
    ]

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Skip logging for excluded paths
        if any(request.path.startswith(path) for path in self.EXCLUDED_PATHS):
            return self.get_response(request)

        # Record start time
        start_time = time.time()

        # Process request
        response = self.get_response(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Get correlation ID if available
        correlation_id = getattr(request, 'correlation_id', 'N/A')

        # Log request details
        log_data = {
            'method': request.method,
            'path': request.path,
            'status': response.status_code,
            'duration_ms': round(duration_ms, 2),
            'correlation_id': correlation_id,
            'user': str(request.user) if hasattr(request, 'user') and request.user.is_authenticated else 'anonymous',
        }

        # Choose log level based on status code
        if response.status_code >= 500:
            logger.error(f"Request: {log_data}")
        elif response.status_code >= 400:
            logger.warning(f"Request: {log_data}")
        else:
            logger.info(f"Request: {log_data}")

        return response

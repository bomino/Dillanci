"""
Tests for custom middleware.

These tests verify that correlation ID middleware and request logging
work correctly for distributed tracing and observability.
"""

import pytest
from unittest.mock import patch, MagicMock
from django.test import RequestFactory, override_settings


class TestCorrelationIdMiddleware:
    """Tests for CorrelationIdMiddleware."""

    def test_generates_correlation_id_when_none_provided(self):
        """Should generate a new UUID when no correlation ID header is present."""
        from apps.core.middleware import CorrelationIdMiddleware

        factory = RequestFactory()
        request = factory.get('/api/v1/test/')

        def get_response(req):
            # Check that correlation_id was added to request
            assert hasattr(req, 'correlation_id')
            assert req.correlation_id is not None
            assert len(req.correlation_id) == 36  # UUID format
            return MagicMock(status_code=200, __setitem__=MagicMock())

        middleware = CorrelationIdMiddleware(get_response)
        response = middleware(request)

        # Check that correlation ID was added to response headers
        assert response.__setitem__.called

    def test_uses_provided_correlation_id(self):
        """Should use X-Correlation-ID header when provided."""
        from apps.core.middleware import CorrelationIdMiddleware

        factory = RequestFactory()
        provided_id = 'test-correlation-id-12345'
        request = factory.get('/api/v1/test/', HTTP_X_CORRELATION_ID=provided_id)

        captured_id = None

        def get_response(req):
            nonlocal captured_id
            captured_id = req.correlation_id
            return MagicMock(status_code=200, __setitem__=MagicMock())

        middleware = CorrelationIdMiddleware(get_response)
        middleware(request)

        assert captured_id == provided_id

    def test_uses_request_id_header_as_fallback(self):
        """Should use X-Request-ID header when X-Correlation-ID is not present."""
        from apps.core.middleware import CorrelationIdMiddleware

        factory = RequestFactory()
        request_id = 'request-id-67890'
        request = factory.get('/api/v1/test/', HTTP_X_REQUEST_ID=request_id)

        captured_id = None

        def get_response(req):
            nonlocal captured_id
            captured_id = req.correlation_id
            return MagicMock(status_code=200, __setitem__=MagicMock())

        middleware = CorrelationIdMiddleware(get_response)
        middleware(request)

        assert captured_id == request_id

    def test_get_correlation_id_returns_current_id(self):
        """get_correlation_id() should return the current request's correlation ID."""
        from apps.core.middleware import (
            CorrelationIdMiddleware,
            get_correlation_id,
            set_correlation_id,
        )

        # Initially should be None
        set_correlation_id(None)
        assert get_correlation_id() is None

        # Set a value
        test_id = 'test-id-123'
        set_correlation_id(test_id)
        assert get_correlation_id() == test_id

        # Clean up
        set_correlation_id(None)


class TestRequestLoggingMiddleware:
    """Tests for RequestLoggingMiddleware."""

    def test_logs_request_with_200_response(self):
        """Should log INFO for successful requests."""
        from apps.core.middleware import RequestLoggingMiddleware

        factory = RequestFactory()
        request = factory.get('/api/v1/users/')
        request.user = MagicMock(is_authenticated=True, __str__=lambda self: 'testuser')
        request.correlation_id = 'test-123'

        mock_response = MagicMock(status_code=200)

        def get_response(req):
            return mock_response

        middleware = RequestLoggingMiddleware(get_response)

        with patch('apps.core.middleware.logger') as mock_logger:
            response = middleware(request)

            assert response.status_code == 200
            assert mock_logger.info.called

    def test_logs_warning_for_4xx_response(self):
        """Should log WARNING for client error responses."""
        from apps.core.middleware import RequestLoggingMiddleware

        factory = RequestFactory()
        request = factory.get('/api/v1/users/')
        request.user = MagicMock(is_authenticated=True, __str__=lambda self: 'testuser')
        request.correlation_id = 'test-123'

        mock_response = MagicMock(status_code=404)

        def get_response(req):
            return mock_response

        middleware = RequestLoggingMiddleware(get_response)

        with patch('apps.core.middleware.logger') as mock_logger:
            response = middleware(request)

            assert response.status_code == 404
            assert mock_logger.warning.called

    def test_logs_error_for_5xx_response(self):
        """Should log ERROR for server error responses."""
        from apps.core.middleware import RequestLoggingMiddleware

        factory = RequestFactory()
        request = factory.get('/api/v1/users/')
        request.user = MagicMock(is_authenticated=True, __str__=lambda self: 'testuser')
        request.correlation_id = 'test-123'

        mock_response = MagicMock(status_code=500)

        def get_response(req):
            return mock_response

        middleware = RequestLoggingMiddleware(get_response)

        with patch('apps.core.middleware.logger') as mock_logger:
            response = middleware(request)

            assert response.status_code == 500
            assert mock_logger.error.called

    def test_excludes_health_check_paths(self):
        """Should not log health check endpoints."""
        from apps.core.middleware import RequestLoggingMiddleware

        factory = RequestFactory()
        excluded_paths = [
            '/api/v1/health/',
            '/api/v1/health/live/',
            '/api/v1/health/ready/',
            '/static/js/app.js',
        ]

        for path in excluded_paths:
            request = factory.get(path)

            def get_response(req):
                return MagicMock(status_code=200)

            middleware = RequestLoggingMiddleware(get_response)

            with patch('apps.core.middleware.logger') as mock_logger:
                middleware(request)

                # Should not log for excluded paths
                assert not mock_logger.info.called, f"Should not log for {path}"
                assert not mock_logger.warning.called
                assert not mock_logger.error.called

    def test_handles_anonymous_user(self):
        """Should handle anonymous users correctly."""
        from apps.core.middleware import RequestLoggingMiddleware

        factory = RequestFactory()
        request = factory.get('/api/v1/public/')
        request.user = MagicMock(is_authenticated=False)
        request.correlation_id = 'test-123'

        mock_response = MagicMock(status_code=200)

        def get_response(req):
            return mock_response

        middleware = RequestLoggingMiddleware(get_response)

        with patch('apps.core.middleware.logger') as mock_logger:
            response = middleware(request)

            assert response.status_code == 200
            # Should contain 'anonymous' in the log
            call_args = mock_logger.info.call_args
            assert 'anonymous' in str(call_args)

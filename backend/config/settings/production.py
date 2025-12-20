"""
Production settings for Procurement Platform.
"""

import os

import sentry_sdk
import structlog
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration

from .base import *  # noqa: F401, F403

DEBUG = False

# =============================================================================
# Sentry Error Tracking & Performance Monitoring
# =============================================================================

SENTRY_DSN = os.environ.get('SENTRY_DSN')

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(
                transaction_style='url',
                middleware_spans=True,
            ),
            CeleryIntegration(monitor_beat_tasks=True),
            RedisIntegration(),
            LoggingIntegration(
                level=None,  # Capture all as breadcrumbs
                event_level='ERROR',  # Send errors+ to Sentry
            ),
        ],
        # Performance monitoring
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        # Profile sample rate (requires traces)
        profiles_sample_rate=float(os.environ.get('SENTRY_PROFILES_SAMPLE_RATE', '0.1')),
        # Environment
        environment=os.environ.get('SENTRY_ENVIRONMENT', 'production'),
        # Release version
        release=os.environ.get('APP_VERSION', '1.0.0'),
        # Don't send PII by default
        send_default_pii=False,
        # Attach request data
        request_bodies='small',
    )

# Security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# =============================================================================
# CORS Configuration for Production
# =============================================================================
# IMPORTANT: CORS_ALLOWED_ORIGINS must be set in environment for production
# Example: CORS_ALLOWED_ORIGINS=https://app.dillanci.com,https://dillanci.com
#
# The base.py defaults to localhost which is NOT suitable for production.
# This override ensures production CORS is explicitly configured.

CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS if origin.strip()]

if not CORS_ALLOWED_ORIGINS:
    raise ValueError(
        "CORS_ALLOWED_ORIGINS environment variable must be set in production. "
        "Example: CORS_ALLOWED_ORIGINS=https://app.dillanci.com"
    )

# Only allow credentials from explicitly allowed origins
CORS_ALLOW_CREDENTIALS = True

# Restrict allowed headers and methods
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-correlation-id',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Cache preflight requests for 1 hour
CORS_PREFLIGHT_MAX_AGE = 3600

# Also update CSRF trusted origins for production
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in CSRF_TRUSTED_ORIGINS if origin.strip()]

if not CSRF_TRUSTED_ORIGINS:
    # Use CORS origins if CSRF origins not explicitly set
    CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS.copy()

# Content Security Policy (django-csp)
# Protects against XSS by controlling which resources can be loaded
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")  # Tailwind CSS requires inline styles
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com")
CSP_CONNECT_SRC = ("'self'",)
CSP_FRAME_ANCESTORS = ("'none'",)
CSP_FORM_ACTION = ("'self'",)
CSP_BASE_URI = ("'self'",)
CSP_OBJECT_SRC = ("'none'",)

# Add CSP middleware - insert after SecurityMiddleware
MIDDLEWARE.insert(1, 'csp.middleware.CSPMiddleware')

# Secret key must be set in environment
SECRET_KEY = os.environ['SECRET_KEY']

# Allowed hosts must be set in environment
ALLOWED_HOSTS = os.environ['ALLOWED_HOSTS'].split(',')

# Database from environment
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DB_NAME'],
        'USER': os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST': os.environ['DB_HOST'],
        'PORT': os.environ.get('DB_PORT', '5432'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}

# =============================================================================
# Correlation ID & Request Logging Middleware
# =============================================================================

# Insert correlation ID middleware early in the chain
MIDDLEWARE.insert(2, 'apps.core.middleware.CorrelationIdMiddleware')
MIDDLEWARE.append('apps.core.middleware.RequestLoggingMiddleware')

# =============================================================================
# Structured Logging with structlog
# =============================================================================

# Configure structlog for JSON output
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

# Override LOGGING for production with JSON format
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': structlog.stdlib.ProcessorFormatter,
            'processor': structlog.processors.JSONRenderer(),
            'foreign_pre_chain': [
                structlog.contextvars.merge_contextvars,
                structlog.stdlib.add_log_level,
                structlog.stdlib.add_logger_name,
                structlog.processors.TimeStamper(fmt="iso"),
            ],
        },
        'plain': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# =============================================================================
# AWS S3 File Storage (django-storages)
# =============================================================================

# Only configure S3 if credentials are provided
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME:
    # Use S3 for media files
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

    # S3 settings
    AWS_DEFAULT_ACL = 'private'  # Don't make files public by default
    AWS_S3_FILE_OVERWRITE = False  # Don't overwrite files with same name
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',  # 1 day cache
    }
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_QUERYSTRING_AUTH = True  # Use signed URLs for access
    AWS_QUERYSTRING_EXPIRE = 3600  # Signed URLs expire in 1 hour

    # Custom domain (optional - for CloudFront CDN)
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN')

    # Static files can also be served from S3 (optional)
    if os.environ.get('USE_S3_FOR_STATIC', 'false').lower() == 'true':
        STATICFILES_STORAGE = 'storages.backends.s3boto3.S3StaticStorage'
        AWS_LOCATION = 'static'
        STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN or AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/static/'

# =============================================================================
# Application Version
# =============================================================================

APP_VERSION = os.environ.get('APP_VERSION', '1.0.0')

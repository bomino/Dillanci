# CDN & Monitoring Setup Guide

## CDN Configuration

### AWS CloudFront Setup

#### 1. Create CloudFront Distribution

```bash
# Using AWS CLI
aws cloudfront create-distribution \
    --origin-domain-name dillanci-media.s3.amazonaws.com \
    --default-root-object index.html
```

#### 2. Environment Configuration

```bash
# .env.production
AWS_S3_CUSTOM_DOMAIN=cdn.dillanci.com
AWS_CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC
```

#### 3. Django Settings

```python
# config/settings/production.py

# CloudFront settings
AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN')
AWS_CLOUDFRONT_KEY_ID = os.environ.get('AWS_CLOUDFRONT_KEY_ID')
AWS_CLOUDFRONT_KEY = os.environ.get('AWS_CLOUDFRONT_KEY')

# Static files with CloudFront
if AWS_S3_CUSTOM_DOMAIN:
    STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/static/'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
```

#### 4. Cache Configuration

| Content Type | TTL | Cache-Control |
|--------------|-----|---------------|
| Static Assets (JS/CSS) | 1 year | `max-age=31536000, immutable` |
| Images | 30 days | `max-age=2592000` |
| API Responses | No cache | `no-cache, no-store` |
| HTML | 1 hour | `max-age=3600` |

```python
# Whitenoise configuration for cache headers
WHITENOISE_MAX_AGE = 31536000  # 1 year for static files
```

### Frontend Static Assets (Vite)

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Content-hashed filenames for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
});
```

---

## Monitoring Setup

### 1. Uptime Monitoring

#### UptimeRobot (Free Tier)

1. Create account at https://uptimerobot.com
2. Add monitors:

| Monitor Type | URL | Check Interval |
|--------------|-----|----------------|
| HTTP(S) | `https://app.dillanci.com/api/v1/health/` | 5 min |
| HTTP(S) | `https://app.dillanci.com/api/v1/health/ready/` | 5 min |
| Keyword | `https://app.dillanci.com/login` | 5 min |

3. Configure alerts:
   - Email to ops@dillanci.com
   - Slack webhook to #alerts channel
   - SMS for critical (optional)

#### AWS CloudWatch Synthetics

```yaml
# cloudwatch-canary.yaml
Resources:
  HealthCheckCanary:
    Type: AWS::Synthetics::Canary
    Properties:
      Name: dillanci-health-check
      RuntimeVersion: syn-nodejs-puppeteer-6.2
      Code:
        Handler: pageLoadBlueprint.handler
        S3Bucket: dillanci-canary-artifacts
        S3Key: health-check.zip
      Schedule:
        Expression: rate(5 minutes)
      RunConfig:
        TimeoutInSeconds: 60
```

### 2. Application Performance Monitoring (APM)

#### Sentry Configuration

Already configured in `production.py`:

```python
SENTRY_DSN = os.environ.get('SENTRY_DSN')
SENTRY_ENVIRONMENT = os.environ.get('SENTRY_ENVIRONMENT', 'production')

sentry_sdk.init(
    dsn=SENTRY_DSN,
    environment=SENTRY_ENVIRONMENT,
    traces_sample_rate=0.1,  # 10% of transactions
    profiles_sample_rate=0.1,  # 10% of profiled transactions
    integrations=[
        DjangoIntegration(),
        CeleryIntegration(),
        RedisIntegration(),
    ],
)
```

#### Dashboard Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | > 5% errors in 5 min | Critical |
| Slow Transactions | P95 > 2s | Warning |
| Unhandled Exception | Any | High |
| Memory Usage | > 90% | Warning |

### 3. Log Aggregation

#### CloudWatch Logs Setup

```python
# config/settings/production.py
LOGGING = {
    'version': 1,
    'handlers': {
        'watchtower': {
            'level': 'INFO',
            'class': 'watchtower.CloudWatchLogHandler',
            'log_group': 'dillanci-production',
            'stream_name': '{strftime:%Y-%m-%d}',
            'use_queues': True,
        },
    },
    'loggers': {
        'django': {
            'handlers': ['watchtower'],
            'level': 'INFO',
        },
    },
}
```

#### Log Insights Queries

```sql
-- Error rate over time
fields @timestamp, @message
| filter @message like /ERROR/
| stats count(*) as errors by bin(5m)

-- Slow requests
fields @timestamp, @message
| filter @message like /Request took/
| parse @message /Request took (?<duration>\d+)ms/
| filter duration > 1000
| sort duration desc
| limit 20

-- Authentication failures
fields @timestamp, @message
| filter @message like /LOGIN_FAILED/
| stats count(*) by bin(1h)
```

### 4. Infrastructure Metrics

#### Docker Container Metrics

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secret
```

#### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| CPU Usage | Docker/Cloud | > 80% for 5 min |
| Memory Usage | Docker/Cloud | > 85% |
| Disk Usage | Docker/Cloud | > 80% |
| DB Connections | PostgreSQL | > 80 of max_connections |
| Redis Memory | Redis | > 75% maxmemory |
| Request Rate | Application | Baseline +50% |
| Error Rate | Sentry | > 1% |
| Response Time P95 | Sentry | > 1s |

### 5. Alerting Configuration

#### PagerDuty Integration (Optional)

```python
# config/settings/production.py
PAGERDUTY_SERVICE_KEY = os.environ.get('PAGERDUTY_SERVICE_KEY')

# In Sentry dashboard:
# Settings > Integrations > PagerDuty
# Map alert rules to PagerDuty escalation policies
```

#### Slack Webhook

```python
# For custom alerts
SLACK_WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL')

def send_slack_alert(message, severity='warning'):
    color = {'critical': 'danger', 'warning': 'warning', 'info': 'good'}
    requests.post(SLACK_WEBHOOK_URL, json={
        'attachments': [{
            'color': color.get(severity, 'warning'),
            'text': message,
            'ts': time.time()
        }]
    })
```

---

## Checklist

### CDN Setup
- [ ] Create S3 bucket for static assets
- [ ] Create CloudFront distribution
- [ ] Configure custom domain (cdn.dillanci.com)
- [ ] Set up SSL certificate (ACM)
- [ ] Configure cache behaviors
- [ ] Update Django settings
- [ ] Deploy and verify assets are served from CDN

### Uptime Monitoring
- [ ] Set up UptimeRobot account
- [ ] Add health check monitors
- [ ] Configure alert recipients
- [ ] Test alerting

### APM (Sentry)
- [ ] Create Sentry project
- [ ] Add SENTRY_DSN to production secrets
- [ ] Configure alert rules
- [ ] Test error tracking

### Log Aggregation
- [ ] Set up CloudWatch log group
- [ ] Configure Django logging to CloudWatch
- [ ] Create log insights queries
- [ ] Set up log-based alerts

### Infrastructure Metrics
- [ ] Configure container health checks
- [ ] Set up metric collection (Prometheus or CloudWatch)
- [ ] Create Grafana dashboards
- [ ] Configure alerting thresholds

---

*This documentation was last updated: December 2024*

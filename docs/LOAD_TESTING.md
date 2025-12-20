# Load Testing Guide

## Overview

Dillanci uses [Locust](https://locust.io/) for load testing. The test scenarios simulate realistic user behavior across different user types.

## Prerequisites

```bash
# Install Locust
pip install locust

# Or add to requirements
echo "locust>=2.20" >> backend/requirements/development.txt
```

## Running Load Tests

### Basic Run

```bash
cd backend

# Start Locust with web UI
locust -f tests/load/locustfile.py --host=http://localhost:8000

# Web UI available at http://localhost:8089
```

### Headless Mode (CI/CD)

```bash
# Run for 2 minutes with 100 users, spawning 10/second
locust -f tests/load/locustfile.py \
    --host=http://localhost:8000 \
    --users=100 \
    --spawn-rate=10 \
    --run-time=2m \
    --headless \
    --csv=load_test_results
```

### Docker Compose Integration

```yaml
# Add to docker-compose.yml for load testing
services:
  locust:
    image: locustio/locust
    ports:
      - "8089:8089"
    volumes:
      - ./backend/tests/load:/mnt/locust
    command: -f /mnt/locust/locustfile.py --master -H http://backend:8000
    depends_on:
      - backend
```

## Test Scenarios

### User Types

| User Type | Weight | Description |
|-----------|--------|-------------|
| ProcurementUser | 10 | Standard procurement operations |
| AdminUser | 1 | Administrative tasks |
| GuestUser | 2 | Health checks, public endpoints |

### Traffic Distribution

| Category | Weight | Endpoints |
|----------|--------|-----------|
| Dashboard/Health | 40% | `/health/`, `/dashboard/kpis/` |
| Requisitions | 25% | `/requisitions/` |
| Purchase Orders | 15% | `/purchase-orders/` |
| Suppliers | 10% | `/suppliers/` |
| Invoices | 5% | `/invoices/` |
| RFQs/RFPs | 5% | `/rfqs/`, `/rfps/` |

## Performance Targets

### Response Time SLAs

| Endpoint Category | P50 | P95 | P99 |
|-------------------|-----|-----|-----|
| Health Checks | < 50ms | < 100ms | < 200ms |
| List Endpoints | < 200ms | < 500ms | < 1s |
| Detail Endpoints | < 100ms | < 300ms | < 500ms |
| Create/Update | < 300ms | < 800ms | < 1.5s |

### Throughput Targets

| Scenario | Users | RPS | Error Rate |
|----------|-------|-----|------------|
| Normal Load | 100 | 200 | < 0.1% |
| Peak Load | 300 | 500 | < 1% |
| Stress Test | 500 | 800 | < 5% |

## Analyzing Results

### CSV Output

```bash
# Generate CSV reports
locust -f tests/load/locustfile.py \
    --host=http://localhost:8000 \
    --headless \
    --users=50 \
    --spawn-rate=5 \
    --run-time=5m \
    --csv=results/load_test
```

This generates:
- `load_test_stats.csv` - Aggregate statistics
- `load_test_stats_history.csv` - Time-series data
- `load_test_failures.csv` - Error details
- `load_test_exceptions.csv` - Exception traces

### Key Metrics to Monitor

1. **Response Times**: Watch for P95/P99 degradation
2. **Error Rate**: Should stay below 1% under normal load
3. **Throughput**: RPS should scale linearly with users
4. **Resource Usage**: Monitor CPU, memory, DB connections

## Troubleshooting

### Common Issues

**High Error Rates**
- Check database connection pool exhaustion
- Review rate limiting configuration
- Verify authentication is working

**Slow Response Times**
- Check for N+1 query issues
- Review database indexes
- Consider caching hot paths

**Connection Errors**
- Increase ulimit for open files
- Check gunicorn worker count
- Review nginx/load balancer timeouts

### Database Monitoring

```sql
-- Check active connections during load test
SELECT count(*) FROM pg_stat_activity
WHERE datname = 'dillanci';

-- Identify slow queries
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## CI/CD Integration

### GitHub Actions

```yaml
load-test:
  runs-on: ubuntu-latest
  needs: [deploy-staging]
  steps:
    - uses: actions/checkout@v4

    - name: Install Locust
      run: pip install locust

    - name: Run Load Test
      run: |
        locust -f backend/tests/load/locustfile.py \
          --host=${{ secrets.STAGING_URL }} \
          --headless \
          --users=50 \
          --spawn-rate=5 \
          --run-time=2m \
          --csv=load_results

    - name: Upload Results
      uses: actions/upload-artifact@v3
      with:
        name: load-test-results
        path: load_results*.csv

    - name: Check Error Rate
      run: |
        ERROR_RATE=$(tail -1 load_results_stats.csv | cut -d',' -f6)
        if (( $(echo "$ERROR_RATE > 1" | bc -l) )); then
          echo "Error rate too high: $ERROR_RATE%"
          exit 1
        fi
```

## Baseline Results

_Document baseline results here after initial load test runs_

### Example Baseline (December 2024)

| Metric | 50 Users | 100 Users | 200 Users |
|--------|----------|-----------|-----------|
| RPS | 85 | 160 | 290 |
| P50 Response | 45ms | 55ms | 80ms |
| P95 Response | 120ms | 180ms | 350ms |
| Error Rate | 0% | 0.05% | 0.2% |
| CPU Usage | 25% | 45% | 75% |
| Memory | 512MB | 620MB | 850MB |

---

*This documentation was last updated: December 2024*

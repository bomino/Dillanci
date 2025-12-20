# Database Backup and Recovery Guide

This document describes the backup and recovery procedures for the Dillanci database.

## Overview

- **Database:** PostgreSQL
- **Backup Format:** Compressed SQL (gzip)
- **Retention:** 30 days (configurable)
- **Storage:** Local filesystem + Optional S3

## Automated Backups

### Setup Cron Job

Add to crontab for automated daily backups:

```bash
# Daily backup at 2 AM
0 2 * * * /app/scripts/backup_database.sh >> /var/log/dillanci_backup.log 2>&1

# Weekly full backup on Sunday at 3 AM (with extended retention)
0 3 * * 0 RETENTION_DAYS=90 /app/scripts/backup_database.sh >> /var/log/dillanci_backup.log 2>&1
```

### Docker Compose Integration

Add to `docker-compose.yml` for containerized backups:

```yaml
services:
  backup:
    image: postgres:16-alpine
    depends_on:
      - db
    environment:
      - DB_HOST=db
      - DB_NAME=dillanci
      - DB_USER=postgres
      - DB_PASSWORD=${POSTGRES_PASSWORD}
      - BACKUP_DIR=/backups
      - RETENTION_DAYS=30
      - S3_BUCKET=${BACKUP_S3_BUCKET:-}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
    volumes:
      - ./scripts:/scripts:ro
      - backup_data:/backups
    command: >
      sh -c "apk add --no-cache aws-cli bash &&
             while true; do
               /scripts/backup_database.sh;
               sleep 86400;
             done"
    restart: unless-stopped

volumes:
  backup_data:
```

### AWS S3 Configuration

For cloud backup storage, configure these environment variables:

```bash
S3_BUCKET=dillanci-backups
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_DEFAULT_REGION=us-east-1
```

Create the S3 bucket with appropriate lifecycle policies:

```bash
# Create bucket
aws s3 mb s3://dillanci-backups --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket dillanci-backups \
    --versioning-configuration Status=Enabled

# Add lifecycle policy for automatic transition to Glacier
aws s3api put-bucket-lifecycle-configuration \
    --bucket dillanci-backups \
    --lifecycle-configuration '{
        "Rules": [
            {
                "ID": "MoveToGlacier",
                "Status": "Enabled",
                "Filter": {"Prefix": "database-backups/"},
                "Transitions": [
                    {"Days": 30, "StorageClass": "GLACIER"}
                ],
                "Expiration": {"Days": 365}
            }
        ]
    }'
```

## Manual Backup

Run a manual backup:

```bash
# Local backup only
docker-compose exec backup /scripts/backup_database.sh

# With S3 upload
docker-compose exec -e S3_BUCKET=dillanci-backups backup /scripts/backup_database.sh
```

## Restore Procedures

### From Local Backup

```bash
# List available backups
ls -la /backups/dillanci_backup_*.sql.gz

# Restore specific backup
docker-compose exec backup /scripts/restore_database.sh /backups/dillanci_backup_20241220_120000.sql.gz
```

### From S3 Backup

```bash
# List S3 backups
aws s3 ls s3://dillanci-backups/database-backups/

# Restore from S3
docker-compose exec -e S3_BUCKET=dillanci-backups backup /scripts/restore_database.sh database-backups/dillanci_backup_20241220_120000.sql.gz
```

### Point-in-Time Recovery (PITR)

For production environments requiring PITR, configure PostgreSQL WAL archiving:

```sql
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://dillanci-backups/wal/%f'
```

## Backup Verification

### Test Restore to Staging

```bash
# Create test database
docker-compose exec db psql -U postgres -c "CREATE DATABASE dillanci_test;"

# Restore to test database
gunzip -c /backups/dillanci_backup_latest.sql.gz | \
    docker-compose exec -T db psql -U postgres -d dillanci_test

# Verify data integrity
docker-compose exec db psql -U postgres -d dillanci_test -c "SELECT COUNT(*) FROM \"user\";"
docker-compose exec db psql -U postgres -d dillanci_test -c "SELECT COUNT(*) FROM requisition;"
docker-compose exec db psql -U postgres -d dillanci_test -c "SELECT COUNT(*) FROM purchase_order;"

# Clean up
docker-compose exec db psql -U postgres -c "DROP DATABASE dillanci_test;"
```

### Automated Verification

Add backup verification to CI/CD:

```yaml
# GitHub Actions example
verify-backup:
  runs-on: ubuntu-latest
  steps:
    - name: Download latest backup
      run: aws s3 cp s3://dillanci-backups/database-backups/latest.sql.gz ./backup.sql.gz

    - name: Start test database
      run: docker run -d -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:16

    - name: Restore backup
      run: gunzip -c backup.sql.gz | psql -h localhost -U postgres

    - name: Verify tables exist
      run: |
        psql -h localhost -U postgres -c "\dt" | grep -E "(user|requisition|purchase_order)"
```

## Monitoring

### Backup Health Checks

Monitor backup freshness with these queries:

```sql
-- Check last backup timestamp (if tracking in database)
SELECT MAX(created_at) as last_backup
FROM backup_log
WHERE status = 'SUCCESS';
```

### CloudWatch Alarms (AWS)

```bash
# Alert if no backup in 25 hours
aws cloudwatch put-metric-alarm \
    --alarm-name "DillanciBackupMissing" \
    --alarm-description "No database backup in 25 hours" \
    --metric-name "BackupAge" \
    --namespace "Dillanci/Database" \
    --statistic Maximum \
    --period 3600 \
    --threshold 90000 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alerts
```

## Disaster Recovery

### Recovery Time Objectives

| Scenario | RTO | RPO | Method |
|----------|-----|-----|--------|
| Minor data loss | 30 min | 24 hours | Latest daily backup |
| Database corruption | 1 hour | 24 hours | Point-in-time recovery |
| Complete failure | 2 hours | 24 hours | S3 backup + new infrastructure |

### Recovery Runbook

1. **Assess the situation**
   - Identify the scope of data loss
   - Determine the recovery point needed

2. **Prepare recovery environment**
   - Provision new database if needed
   - Verify network connectivity

3. **Execute restore**
   ```bash
   # Stop application
   docker-compose stop backend celery

   # Restore database
   /scripts/restore_database.sh <backup_file>

   # Run migrations
   docker-compose exec backend python manage.py migrate

   # Verify data
   docker-compose exec backend python manage.py check

   # Restart application
   docker-compose up -d backend celery
   ```

4. **Validate recovery**
   - Check application health endpoints
   - Verify critical data integrity
   - Test key workflows

5. **Document incident**
   - Record timeline and actions
   - Identify root cause
   - Update procedures if needed

## Security Considerations

- Backup files are compressed but not encrypted at rest (rely on S3 encryption)
- Database credentials should use secrets management (see SECRETS_MANAGEMENT.md)
- Restore operations require admin approval
- Backup access should be logged and audited

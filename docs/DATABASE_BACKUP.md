# Database Backup & Restore Guide

## Overview

This guide covers database backup and restore procedures for the Dillanci Procurement Platform. Regular backups are critical for disaster recovery and data protection.

## Backup Strategy

### Recommended Schedule

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Full Backup | Daily at 2:00 AM UTC | 30 days | Local + S3 |
| Weekly Archive | Sunday 3:00 AM UTC | 90 days | S3 Glacier |
| Monthly Archive | 1st of month | 1 year | S3 Glacier Deep Archive |

### Backup Contents

- All database tables and data
- Database schema (tables, indexes, constraints)
- Sequences and their current values
- No user credentials or ownership info (portable between environments)

## Quick Start

### Prerequisites

1. PostgreSQL client tools installed (`pg_dump`, `psql`)
2. Required environment variables set
3. AWS CLI installed (for S3 uploads)

### Environment Variables

```bash
# Required
export POSTGRES_HOST=localhost
export POSTGRES_DB=dillanci
export POSTGRES_USER=dillanci
export POSTGRES_PASSWORD=your_password

# Optional
export POSTGRES_PORT=5432
export AWS_S3_BUCKET=dillanci-backups
export BACKUP_RETENTION_DAYS=30
export BACKUP_DIR=/path/to/backups
```

### Create a Backup

```bash
# Basic backup
./scripts/backup/backup_database.sh

# Backup with S3 upload
./scripts/backup/backup_database.sh --s3

# Backup with custom retention
./scripts/backup/backup_database.sh --retain-days 60

# Dry run (show what would be done)
./scripts/backup/backup_database.sh --dry-run
```

### Restore from Backup

```bash
# Basic restore (prompts for confirmation)
./scripts/backup/restore_database.sh backups/database/dillanci_dillanci_20241220_120000.sql.gz

# Restore to different database
./scripts/backup/restore_database.sh backup.sql.gz --target-db dillanci_staging

# Skip pre-restore backup
./scripts/backup/restore_database.sh backup.sql.gz --no-backup

# Dry run
./scripts/backup/restore_database.sh backup.sql.gz --dry-run
```

## Automated Backups

### Cron Setup (Linux)

Add to crontab (`crontab -e`):

```cron
# Daily backup at 2:00 AM UTC with S3 upload
0 2 * * * /path/to/dillanci-app/scripts/backup/backup_database.sh --s3 >> /var/log/dillanci-backup.log 2>&1

# Weekly cleanup of old backups (runs at 3:00 AM Sunday)
0 3 * * 0 find /path/to/dillanci-app/backups/database -name "*.sql.gz" -mtime +30 -delete
```

### Docker Cron Container

For Docker deployments, add a backup container to `docker-compose.yml`:

```yaml
services:
  backup:
    image: postgres:15-alpine
    volumes:
      - ./scripts/backup:/scripts
      - ./backups:/backups
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    entrypoint: /bin/sh -c "crond -f"
    depends_on:
      - db
```

### AWS Backup Automation

For production, consider using AWS services:

1. **RDS Automated Backups** - If using Amazon RDS
2. **AWS Backup** - For managed backup lifecycle
3. **Lambda + EventBridge** - For custom backup schedules

## AWS S3 Configuration

### Bucket Policy

Create a bucket with appropriate lifecycle rules:

```json
{
  "Rules": [
    {
      "ID": "Move to Glacier after 30 days",
      "Status": "Enabled",
      "Prefix": "database-backups/",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

### IAM Policy

Minimum permissions for backup user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::dillanci-backups",
        "arn:aws:s3:::dillanci-backups/*"
      ]
    }
  ]
}
```

## Point-in-Time Recovery (PITR)

For production databases, enable PITR with PostgreSQL WAL archiving:

### PostgreSQL Configuration

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://dillanci-backups/wal/%f'
archive_timeout = 60
```

### Recovery

1. Restore base backup
2. Apply WAL files up to target time
3. Create recovery.conf with target time

```ini
# recovery.conf
restore_command = 'aws s3 cp s3://dillanci-backups/wal/%f %p'
recovery_target_time = '2024-12-20 14:30:00 UTC'
recovery_target_action = 'promote'
```

## Disaster Recovery Runbook

### Scenario 1: Data Corruption

1. Stop application traffic (maintenance mode)
2. Identify last known good backup
3. Create backup of current state (for forensics)
4. Restore from good backup
5. Verify data integrity
6. Resume application traffic

### Scenario 2: Complete Database Loss

1. Provision new database server
2. Download latest backup from S3
3. Restore using `restore_database.sh`
4. Update application configuration
5. Verify connectivity and data
6. Resume operations

### Scenario 3: Accidental Data Deletion

1. Check if within WAL retention period
2. Use PITR to recover to just before deletion
3. Or: restore specific tables from backup

```sql
-- Restore single table from backup
CREATE TABLE users_restored AS
SELECT * FROM dblink('host=backup_host dbname=backup_db', 'SELECT * FROM users')
AS t1(id uuid, email varchar, ...);
```

## Monitoring & Alerts

### Health Checks

The backup script creates logs at:
- `logs/backup/backup_YYYYMMDD_HHMMSS.log`

Monitor for:
- Backup completion (success/failure)
- Backup size (sudden changes may indicate issues)
- S3 upload success
- Retention cleanup

### CloudWatch Metrics (if using AWS)

```yaml
# Recommended alarms
- BackupAgeTooOld: > 26 hours since last backup
- BackupSizeAnomaly: > 50% change from average
- S3UploadFailed: Upload errors > 0
```

## Testing Backups

**Critical: Test restore procedures regularly!**

### Monthly Restore Test

1. Spin up test database instance
2. Restore latest backup
3. Run application smoke tests
4. Verify critical data is present
5. Document results
6. Destroy test instance

### Restore Test Checklist

- [ ] Backup file downloads correctly from S3
- [ ] Backup file passes integrity check
- [ ] Restore completes without errors
- [ ] All tables are present
- [ ] Row counts match expected values
- [ ] Application can connect and read data
- [ ] Critical queries return expected results

## Troubleshooting

### Common Issues

**Backup fails with "connection refused"**
- Check POSTGRES_HOST is correct
- Verify database is running
- Check firewall/security groups

**Backup file is empty**
- Check POSTGRES_PASSWORD is correct
- Verify user has read permissions

**S3 upload fails**
- Check AWS credentials
- Verify bucket exists and permissions
- Check network connectivity

**Restore fails with "permission denied"**
- User needs CREATEDB or owner privileges
- Check if tables are locked

### Recovery from Failed Restore

If restore fails partway through:

1. Check log file for specific error
2. If database is corrupted, drop and recreate:
   ```sql
   DROP DATABASE IF EXISTS dillanci;
   CREATE DATABASE dillanci OWNER dillanci;
   ```
3. Retry restore

## Security Considerations

1. **Encrypt backups at rest** - S3 server-side encryption enabled
2. **Encrypt in transit** - Use TLS for database connections
3. **Limit access** - Backup credentials separate from app credentials
4. **Audit access** - Log who accesses backup files
5. **Test destruction** - Ensure deleted backups are actually deleted

## Contact

For backup-related emergencies:
- DevOps Team: devops@dillanci.com
- On-call: Check PagerDuty schedule

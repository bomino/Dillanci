#!/bin/bash
# Database Backup Script for Dillanci
# This script creates timestamped PostgreSQL backups with retention policy

set -e

# Configuration (can be overridden via environment variables)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${DB_NAME:-dillanci}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dillanci_backup_${TIMESTAMP}.sql.gz"

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database backup..."

# Create compressed backup
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file not created!"
    exit 1
fi

# Upload to S3 if bucket is configured
if [ -n "${S3_BUCKET}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/database-backups/$(basename ${BACKUP_FILE})" \
        --storage-class STANDARD_IA
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploaded to S3: s3://${S3_BUCKET}/database-backups/$(basename ${BACKUP_FILE})"
fi

# Clean up old local backups
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "dillanci_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Clean up old S3 backups (if S3 is configured)
if [ -n "${S3_BUCKET}" ]; then
    # List and delete S3 objects older than retention period
    CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)
    aws s3api list-objects-v2 \
        --bucket "${S3_BUCKET}" \
        --prefix "database-backups/" \
        --query "Contents[?LastModified<='${CUTOFF_DATE}'].Key" \
        --output text | tr '\t' '\n' | while read key; do
            if [ -n "${key}" ] && [ "${key}" != "None" ]; then
                aws s3 rm "s3://${S3_BUCKET}/${key}"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deleted old S3 backup: ${key}"
            fi
        done
fi

# List current backups
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current backups:"
ls -lh "${BACKUP_DIR}"/dillanci_backup_*.sql.gz 2>/dev/null || echo "No local backups found"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully!"

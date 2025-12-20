#!/bin/bash
# Database Restore Script for Dillanci
# This script restores a PostgreSQL backup from local or S3

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${DB_NAME:-dillanci}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
S3_BUCKET="${S3_BUCKET:-}"

# Usage
usage() {
    echo "Usage: $0 <backup_file_or_s3_key>"
    echo ""
    echo "Examples:"
    echo "  $0 /backups/dillanci_backup_20241220_120000.sql.gz"
    echo "  $0 database-backups/dillanci_backup_20241220_120000.sql.gz"
    echo ""
    echo "Options:"
    echo "  If S3_BUCKET is set and the file is not found locally,"
    echo "  it will be downloaded from S3."
    exit 1
}

if [ -z "$1" ]; then
    usage
fi

BACKUP_SOURCE="$1"
TEMP_RESTORE_FILE="/tmp/dillanci_restore_$(date +%s).sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database restore..."

# Determine if backup is local or S3
if [ -f "${BACKUP_SOURCE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using local backup file: ${BACKUP_SOURCE}"
    BACKUP_FILE="${BACKUP_SOURCE}"
elif [ -n "${S3_BUCKET}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Downloading from S3: s3://${S3_BUCKET}/${BACKUP_SOURCE}"
    aws s3 cp "s3://${S3_BUCKET}/${BACKUP_SOURCE}" "${TEMP_RESTORE_FILE}"
    BACKUP_FILE="${TEMP_RESTORE_FILE}"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file not found: ${BACKUP_SOURCE}"
    exit 1
fi

# Verify backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file does not exist: ${BACKUP_FILE}"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup file size: ${BACKUP_SIZE}"

# Confirmation prompt
echo ""
echo "WARNING: This will DROP and RECREATE the database '${DB_NAME}'!"
echo "All existing data will be lost."
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore cancelled by user."
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Terminating active connections..."

# Terminate active connections
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropping existing database..."

# Drop and recreate database
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};"

PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "CREATE DATABASE ${DB_NAME};"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring backup..."

# Restore the backup
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running post-restore migrations..."

# Run any pending migrations
cd /app && python manage.py migrate --noinput || echo "Migrations skipped (not in Django context)"

# Clean up temp file
if [ -f "${TEMP_RESTORE_FILE}" ]; then
    rm -f "${TEMP_RESTORE_FILE}"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database restore completed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify the application is working correctly"
echo "2. Check for any data consistency issues"
echo "3. Run: python manage.py check --deploy"

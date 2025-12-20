#!/bin/bash
#
# Database Backup Script for Dillanci Procurement Platform
#
# This script creates PostgreSQL database backups with:
# - Timestamped backup files
# - Compression using gzip
# - Retention policy enforcement
# - Optional S3 upload for off-site storage
# - Logging and error handling
#
# Usage:
#   ./backup_database.sh [OPTIONS]
#
# Options:
#   --full              Full backup (default)
#   --s3                Upload to S3 after backup
#   --retain-days N     Keep backups for N days (default: 30)
#   --dry-run           Show what would be done without doing it
#
# Environment Variables Required:
#   POSTGRES_HOST       Database host
#   POSTGRES_DB         Database name
#   POSTGRES_USER       Database user
#   POSTGRES_PASSWORD   Database password
#
# Optional Environment Variables:
#   AWS_S3_BUCKET       S3 bucket for off-site backups
#   BACKUP_RETENTION_DAYS   Override default retention (30 days)
#   BACKUP_DIR          Override default backup directory
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Backup directory (default: ./backups relative to project root)
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups/database}"

# Retention policy (default: 30 days)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup filename
BACKUP_FILE="dillanci_${POSTGRES_DB:-dillanci}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

# Log file
LOG_DIR="$PROJECT_ROOT/logs/backup"
LOG_FILE="$LOG_DIR/backup_${TIMESTAMP}.log"

# =============================================================================
# Functions
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
error() { log "ERROR" "$@"; }

check_prerequisites() {
    info "Checking prerequisites..."

    # Check pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi

    # Check required environment variables
    local required_vars=("POSTGRES_HOST" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
            exit 1
        fi
    done

    info "All prerequisites met"
}

create_directories() {
    info "Creating backup and log directories..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
}

perform_backup() {
    info "Starting database backup..."
    info "Database: ${POSTGRES_DB} @ ${POSTGRES_HOST}"
    info "Backup file: $BACKUP_PATH"

    local start_time=$(date +%s)

    # Set password for pg_dump
    export PGPASSWORD="${POSTGRES_PASSWORD}"

    # Perform backup with compression
    pg_dump \
        --host="${POSTGRES_HOST}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="${POSTGRES_DB}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --if-exists \
        --clean \
        --verbose \
        2>> "$LOG_FILE" \
        | gzip > "$BACKUP_PATH"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Verify backup file exists and has size
    if [[ -f "$BACKUP_PATH" ]] && [[ -s "$BACKUP_PATH" ]]; then
        local size=$(du -h "$BACKUP_PATH" | cut -f1)
        info "Backup completed successfully in ${duration}s"
        info "Backup size: $size"
    else
        error "Backup file is empty or missing"
        exit 1
    fi

    # Unset password
    unset PGPASSWORD
}

upload_to_s3() {
    if [[ -z "${AWS_S3_BUCKET:-}" ]]; then
        warn "AWS_S3_BUCKET not set, skipping S3 upload"
        return
    fi

    info "Uploading backup to S3..."

    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Please install aws-cli for S3 uploads."
        return 1
    fi

    local s3_path="s3://${AWS_S3_BUCKET}/database-backups/$(date +%Y/%m)/$BACKUP_FILE"

    aws s3 cp "$BACKUP_PATH" "$s3_path" \
        --storage-class STANDARD_IA \
        2>> "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        info "Uploaded to $s3_path"
    else
        error "S3 upload failed"
        return 1
    fi
}

cleanup_old_backups() {
    info "Cleaning up backups older than $RETENTION_DAYS days..."

    local deleted_count=0

    # Find and delete old local backups
    while IFS= read -r -d '' file; do
        info "Deleting old backup: $file"
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "dillanci_*.sql.gz" -type f -mtime +$RETENTION_DAYS -print0)

    info "Deleted $deleted_count old backup(s)"

    # Clean up old log files too
    find "$LOG_DIR" -name "backup_*.log" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
}

verify_backup() {
    info "Verifying backup integrity..."

    # Test gzip integrity
    if gzip -t "$BACKUP_PATH" 2>/dev/null; then
        info "Backup integrity check passed"
    else
        error "Backup integrity check failed"
        exit 1
    fi

    # Count tables in backup
    local table_count=$(zcat "$BACKUP_PATH" | grep -c "^CREATE TABLE" || echo 0)
    info "Backup contains $table_count table definitions"
}

show_summary() {
    echo ""
    echo "=============================================="
    echo "         BACKUP SUMMARY"
    echo "=============================================="
    echo "Database:     ${POSTGRES_DB}"
    echo "Host:         ${POSTGRES_HOST}"
    echo "Backup File:  $BACKUP_FILE"
    echo "Size:         $(du -h "$BACKUP_PATH" | cut -f1)"
    echo "Location:     $BACKUP_PATH"
    echo "Log:          $LOG_FILE"
    echo "=============================================="
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    local upload_s3=false
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --s3)
                upload_s3=true
                shift
                ;;
            --retain-days)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                head -35 "$0" | tail -30
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    if [[ "$dry_run" == true ]]; then
        echo "[DRY RUN] Would create backup at: $BACKUP_PATH"
        echo "[DRY RUN] Would retain backups for: $RETENTION_DAYS days"
        [[ "$upload_s3" == true ]] && echo "[DRY RUN] Would upload to S3"
        exit 0
    fi

    # Create log directory early
    mkdir -p "$LOG_DIR"

    info "=========================================="
    info "Starting Dillanci Database Backup"
    info "=========================================="

    check_prerequisites
    create_directories
    perform_backup
    verify_backup

    if [[ "$upload_s3" == true ]]; then
        upload_to_s3
    fi

    cleanup_old_backups
    show_summary

    info "Backup process completed successfully"
}

main "$@"

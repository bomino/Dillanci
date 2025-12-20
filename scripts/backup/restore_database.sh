#!/bin/bash
#
# Database Restore Script for Dillanci Procurement Platform
#
# This script restores PostgreSQL database from backup with:
# - Validation before restore
# - Optional backup of current database before restore
# - Logging and error handling
#
# Usage:
#   ./restore_database.sh BACKUP_FILE [OPTIONS]
#
# Options:
#   --no-backup         Skip backing up current database before restore
#   --target-db NAME    Restore to different database name
#   --dry-run           Show what would be done without doing it
#
# Environment Variables Required:
#   POSTGRES_HOST       Database host
#   POSTGRES_DB         Database name
#   POSTGRES_USER       Database user
#   POSTGRES_PASSWORD   Database password
#
# Example:
#   ./restore_database.sh backups/database/dillanci_dillanci_20241220_120000.sql.gz
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$PROJECT_ROOT/logs/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/restore_${TIMESTAMP}.log"

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

    # Check psql is available
    if ! command -v psql &> /dev/null; then
        error "psql not found. Please install PostgreSQL client tools."
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

validate_backup() {
    local backup_file="$1"

    info "Validating backup file..."

    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi

    # Check file is a valid gzip
    if ! gzip -t "$backup_file" 2>/dev/null; then
        error "Backup file is not a valid gzip file"
        exit 1
    fi

    # Check file has SQL content
    local line_count=$(zcat "$backup_file" | wc -l)
    if [[ $line_count -lt 10 ]]; then
        error "Backup file appears to be too small or empty"
        exit 1
    fi

    info "Backup file validated: $line_count lines"
}

backup_current_database() {
    local target_db="$1"

    info "Creating backup of current database before restore..."

    local pre_restore_backup="$PROJECT_ROOT/backups/database/pre_restore_${target_db}_${TIMESTAMP}.sql.gz"
    mkdir -p "$(dirname "$pre_restore_backup")"

    export PGPASSWORD="${POSTGRES_PASSWORD}"

    pg_dump \
        --host="${POSTGRES_HOST}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="$target_db" \
        --format=plain \
        --no-owner \
        --no-privileges \
        2>> "$LOG_FILE" \
        | gzip > "$pre_restore_backup"

    unset PGPASSWORD

    if [[ -f "$pre_restore_backup" ]] && [[ -s "$pre_restore_backup" ]]; then
        info "Pre-restore backup created: $pre_restore_backup"
    else
        warn "Pre-restore backup may have failed"
    fi
}

perform_restore() {
    local backup_file="$1"
    local target_db="$2"

    info "Starting database restore..."
    info "Source: $backup_file"
    info "Target: $target_db @ ${POSTGRES_HOST}"

    local start_time=$(date +%s)

    export PGPASSWORD="${POSTGRES_PASSWORD}"

    # Restore from backup
    zcat "$backup_file" | psql \
        --host="${POSTGRES_HOST}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="$target_db" \
        --set ON_ERROR_STOP=on \
        2>> "$LOG_FILE"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    unset PGPASSWORD

    info "Restore completed in ${duration}s"
}

verify_restore() {
    local target_db="$1"

    info "Verifying database restore..."

    export PGPASSWORD="${POSTGRES_PASSWORD}"

    # Count tables
    local table_count=$(psql \
        --host="${POSTGRES_HOST}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="$target_db" \
        --tuples-only \
        --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
        2>/dev/null | tr -d ' ')

    unset PGPASSWORD

    if [[ "$table_count" -gt 0 ]]; then
        info "Restore verified: $table_count tables in database"
    else
        error "Restore verification failed: no tables found"
        exit 1
    fi
}

show_summary() {
    local backup_file="$1"
    local target_db="$2"

    echo ""
    echo "=============================================="
    echo "         RESTORE SUMMARY"
    echo "=============================================="
    echo "Source File:  $backup_file"
    echo "Target DB:    $target_db"
    echo "Host:         ${POSTGRES_HOST}"
    echo "Log:          $LOG_FILE"
    echo "=============================================="
    echo ""
}

show_usage() {
    head -25 "$0" | tail -20
    exit 0
}

# =============================================================================
# Main
# =============================================================================

main() {
    local backup_file=""
    local skip_backup=false
    local target_db="${POSTGRES_DB}"
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-backup)
                skip_backup=true
                shift
                ;;
            --target-db)
                target_db="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                show_usage
                ;;
            -*)
                error "Unknown option: $1"
                exit 1
                ;;
            *)
                backup_file="$1"
                shift
                ;;
        esac
    done

    if [[ -z "$backup_file" ]]; then
        error "No backup file specified"
        show_usage
    fi

    if [[ "$dry_run" == true ]]; then
        echo "[DRY RUN] Would restore from: $backup_file"
        echo "[DRY RUN] Would restore to database: $target_db"
        [[ "$skip_backup" == false ]] && echo "[DRY RUN] Would backup current database first"
        exit 0
    fi

    # Create log directory
    mkdir -p "$LOG_DIR"

    info "=========================================="
    info "Starting Dillanci Database Restore"
    info "=========================================="

    check_prerequisites
    validate_backup "$backup_file"

    if [[ "$skip_backup" == false ]]; then
        backup_current_database "$target_db"
    fi

    echo ""
    warn "⚠️  WARNING: This will DROP and recreate tables in database: $target_db"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        info "Restore cancelled by user"
        exit 0
    fi

    perform_restore "$backup_file" "$target_db"
    verify_restore "$target_db"
    show_summary "$backup_file" "$target_db"

    info "Restore process completed successfully"
}

main "$@"

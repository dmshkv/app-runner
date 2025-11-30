#!/bin/bash
set -euo pipefail

# Database management commands
# Usage: ./scripts/aws/db-commands.sh [command] [profile]
# Commands: status, backup, restore, logs, connect

COMMAND="${1:-status}"
PROFILE="${2:-${AWS_PROFILE:-default}}"
DB_INSTANCE="app-runner-db"

case $COMMAND in
  status)
    echo "📊 Database Status:"
    aws rds describe-db-instances \
      --profile "$PROFILE" \
      --db-instance-identifier "$DB_INSTANCE" \
      --query 'DBInstances[0].[DBInstanceIdentifier,DBInstanceStatus,DBInstanceClass,Engine,AllocatedStorage]' \
      --output table
    ;;

  backup)
    echo "💾 Creating backup..."
    BACKUP_ID="${DB_INSTANCE}-$(date +%Y%m%d-%H%M%S)"
    aws rds create-db-snapshot \
      --profile "$PROFILE" \
      --db-instance-identifier "$DB_INSTANCE" \
      --db-snapshot-identifier "$BACKUP_ID"
    echo "✅ Backup started: $BACKUP_ID"
    ;;

  backups)
    echo "📋 Recent Backups:"
    aws rds describe-db-snapshots \
      --profile "$PROFILE" \
      --db-instance-identifier "$DB_INSTANCE" \
      --query 'DBSnapshots[0:5].[DBSnapshotIdentifier,SnapshotCreateTime,Status,AllocatedStorage]' \
      --output table
    ;;

  logs)
    echo "📝 Recent DB Logs (last 50 entries):"
    aws rds describe-db-log-files \
      --profile "$PROFILE" \
      --db-instance-identifier "$DB_INSTANCE" \
      --query 'DescribeDBLogFiles[0:10].[LogFileName,LastWritten,Size]' \
      --output table
    ;;

  info)
    echo "ℹ️  Database Information:"
    aws rds describe-db-instances \
      --profile "$PROFILE" \
      --db-instance-identifier "$DB_INSTANCE" \
      --query 'DBInstances[0]' \
      --output json | jq '{
        Endpoint: .Endpoint,
        Engine: .Engine,
        EngineVersion: .EngineVersion,
        DBInstanceClass: .DBInstanceClass,
        AllocatedStorage: .AllocatedStorage,
        BackupRetentionPeriod: .BackupRetentionPeriod,
        PreferredBackupWindow: .PreferredBackupWindow,
        PreferredMaintenanceWindow: .PreferredMaintenanceWindow,
        MultiAZ: .MultiAZ,
        StorageType: .StorageType,
        Iops: .Iops
      }'
    ;;

  *)
    echo "❌ Unknown command: $COMMAND"
    echo ""
    echo "Available commands:"
    echo "  status      - Show database status"
    echo "  backup      - Create a snapshot backup"
    echo "  backups     - List recent backups"
    echo "  logs        - Show database logs"
    echo "  info        - Show detailed database info"
    echo ""
    echo "Usage: $0 [command] [profile]"
    exit 1
    ;;
esac

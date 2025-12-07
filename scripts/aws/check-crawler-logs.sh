#!/bin/bash
# Check crawler Lambda logs
# Usage: ./check-crawler-logs.sh [env] [follow]

set -e

ENV="${1:-dev}"
FOLLOW="${2:-false}"
PROFILE="${AWS_PROFILE:-dmieshkov}"

echo "📋 Checking crawler logs for environment: $ENV"
echo ""

if [ "$FOLLOW" = "follow" ] || [ "$FOLLOW" = "-f" ]; then
  echo "Following logs (Ctrl+C to stop)..."
  aws logs tail /aws/lambda/crawler-dataextractor-$ENV \
    --region ca-central-1 \
    --profile "$PROFILE" \
    --follow
else
  echo "Last 50 log entries (last 10 minutes):"
  echo ""
  aws logs tail /aws/lambda/crawler-dataextractor-$ENV \
    --region ca-central-1 \
    --profile "$PROFILE" \
    --since 10m \
    --format short
fi

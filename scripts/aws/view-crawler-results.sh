#!/bin/bash
# View crawler execution results
# Usage: ./view-crawler-results.sh [env] [minutes]

set -e

ENV="${1:-dev}"
MINUTES="${2:-10}"
PROFILE="${AWS_PROFILE:-dmieshkov}"
REGION="ca-central-1"

echo "🔍 Crawler Execution Results (last $MINUTES minutes)"
echo "======================================================"
echo ""

# Calculate start time (in milliseconds)
START_TIME=$(($(date +%s) - (MINUTES * 60)))000

echo "📊 Summary Statistics"
echo "--------------------"

# Count successful crawls
SUCCESS_COUNT=$(aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --start-time $START_TIME \
  --filter-pattern "✅ Results published to SNS" \
  --query 'length(events)' \
  --output text 2>/dev/null || echo "0")

# Count failed crawls
ERROR_COUNT=$(aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --start-time $START_TIME \
  --filter-pattern "❌ Fatal error" \
  --query 'length(events)' \
  --output text 2>/dev/null || echo "0")

echo "✅ Successful crawls: $SUCCESS_COUNT"
echo "❌ Failed crawls: $ERROR_COUNT"
echo ""

echo "🌐 Crawled URLs"
echo "--------------"

# Get crawled URLs
aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --start-time $START_TIME \
  --filter-pattern "Processing crawl" \
  --query 'events[*].message' \
  --output text 2>/dev/null | \
  sed 's/.*Processing crawl: //' | \
  sed 's/^[^ ]* [^ ]* [^ ]* [^ ]* INFO //' || echo "No crawls found"

echo ""
echo "📄 Page Titles"
echo "-------------"

# Get page titles
aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --start-time $START_TIME \
  --filter-pattern "Page title" \
  --query 'events[*].message' \
  --output text 2>/dev/null | \
  sed 's/.*Page title: //' | \
  sed 's/^[^ ]* [^ ]* [^ ]* [^ ]* INFO //' || echo "No titles found"

echo ""
echo "⏱️  Execution Times"
echo "------------------"

# Get Lambda execution reports
aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --start-time $START_TIME \
  --filter-pattern "REPORT RequestId" \
  --query 'events[-5:].message' \
  --output text 2>/dev/null | \
  grep -E "(Duration|Memory)" || echo "No execution reports found"

echo ""
echo "---"
echo ""
echo "For detailed logs:"
echo "  ./scripts/aws/check-crawler-logs.sh $ENV"
echo ""
echo "To follow logs in real-time:"
echo "  ./scripts/aws/check-crawler-logs.sh $ENV follow"

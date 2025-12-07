#!/bin/bash

# Trigger Crawler via EventBridge
# Usage: ./scripts/aws/trigger-crawler.sh [url] [environment]

set -e

URL=${1:-"https://example.com"}
ENVIRONMENT=${2:-dev}

echo "🎯 Triggering Crawler via EventBridge"
echo "================================"
echo "URL: $URL"
echo "Environment: $ENVIRONMENT"
echo ""

# Send event to EventBridge
aws events put-events --entries '[
  {
    "Source": "custom.crawler",
    "DetailType": "CrawlRequest",
    "Detail": "{\"url\": \"'$URL'\", \"timeout\": 30000}"
  }
]'

echo ""
echo "✅ Event sent to EventBridge!"
echo "📊 Check CloudWatch Logs for execution details:"
echo "aws logs tail /aws/lambda/crawler-dataextractor-$ENVIRONMENT --follow"

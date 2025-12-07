#!/bin/bash

# Test Crawler Lambda Function
# Usage: ./scripts/aws/test-crawler.sh [url] [environment]

set -e

URL=${1:-"https://example.com"}
ENVIRONMENT=${2:-dev}
FUNCTION_NAME="crawler-dataextractor-${ENVIRONMENT}"

echo "🧪 Testing Crawler Function"
echo "================================"
echo "Function: $FUNCTION_NAME"
echo "URL: $URL"
echo ""

# Create test event
TEST_EVENT=$(cat <<EOF
{
  "url": "$URL",
  "timeout": 30000
}
EOF
)

echo "📤 Invoking Lambda function..."
aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$TEST_EVENT" \
  --cli-binary-format raw-in-base64-out \
  response.json

echo ""
echo "📥 Response:"
cat response.json | jq '.'

echo ""
echo "✅ Test completed!"

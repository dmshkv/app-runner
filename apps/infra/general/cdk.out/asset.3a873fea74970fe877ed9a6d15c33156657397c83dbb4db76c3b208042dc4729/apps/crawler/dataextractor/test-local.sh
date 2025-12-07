#!/bin/bash
# Local test script for crawler with SQS architecture
# Usage: ./test-local.sh [url]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Default URL
URL="${1:-https://example.com}"

echo "🧪 Testing Crawler Locally"
echo "=========================="
echo "URL: $URL"
echo ""

# Check if Node.js dependencies are installed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd "$PROJECT_ROOT"
  npm install
fi

# Build the project
echo "🔨 Building crawler..."
cd "$PROJECT_ROOT"
npx nx build dataextractor

echo ""
echo "🚀 Running crawler..."
echo ""

# Set environment variables (optional for local test)
export SQS_QUEUE_URL="" # Empty for local test
export SNS_TOPIC_ARN="" # Empty for local test

# Run the test
cd "$PROJECT_ROOT"
npx ts-node apps/crawler/dataextractor/src/test-local.ts

echo ""
echo "✅ Local test complete!"

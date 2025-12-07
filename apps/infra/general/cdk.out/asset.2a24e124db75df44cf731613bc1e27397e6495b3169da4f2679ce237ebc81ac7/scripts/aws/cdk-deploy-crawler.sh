#!/bin/bash

# Deploy Crawler Stack
# Usage: ./scripts/aws/cdk-deploy-crawler.sh [environment]

set -e

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/apps/infra/general"

echo "🚀 Deploying Crawler Stack for environment: $ENVIRONMENT"
echo "================================================"

# Navigate to infrastructure directory
cd "$INFRA_DIR"

# Check if CDK is bootstrapped
echo "📦 Ensuring CDK bootstrap..."
npx cdk bootstrap --context environment="$ENVIRONMENT"

# Build the crawler application
echo "🔨 Building crawler application..."
cd "$PROJECT_ROOT"
npx nx build dataextractor

# Synthesize CDK stack
echo "🔄 Synthesizing CDK stack..."
cd "$INFRA_DIR"
npx cdk synth --app "npx ts-node src/main-crawler.ts" --context environment="$ENVIRONMENT"

# Deploy the stack
echo "☁️  Deploying to AWS..."
npx cdk deploy \
  --app "npx ts-node src/main-crawler.ts" \
  --context environment="$ENVIRONMENT" \
  --require-approval never \
  --all

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📝 To trigger the crawler, use EventBridge:"
echo "aws events put-events --entries file://crawler-event.json"
echo ""

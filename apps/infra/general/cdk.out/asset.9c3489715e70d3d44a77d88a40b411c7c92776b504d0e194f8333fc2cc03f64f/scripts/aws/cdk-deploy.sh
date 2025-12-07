#!/bin/bash
set -euo pipefail

# Deploy AWS CDK stacks
# Usage: ./scripts/aws/cdk-deploy.sh [environment]

ENVIRONMENT="${1:-${CDK_ENVIRONMENT:-dev}}"
PROFILE="${AWS_PROFILE:-default}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "❌ Invalid environment: $ENVIRONMENT"
  echo "Valid environments: dev, staging, prod"
  exit 1
fi

echo "🚀 Deploying CDK stack for: $ENVIRONMENT"
echo "   Profile: $PROFILE"
echo ""

cd "$(dirname "$0")/../../apps/infra/general"

# Bootstrap CDK if needed
echo "📋 Bootstrapping CDK..."
npx cdk bootstrap \
  aws://"$(aws sts get-caller-identity --query Account --output text --profile "$PROFILE")"/"$(aws configure get region --profile "$PROFILE")" \
  --profile "$PROFILE" 2>/dev/null || true

# Deploy
echo "📦 Deploying stack..."
npm run deploy -- --require-approval=never --context environment="$ENVIRONMENT" --profile "$PROFILE"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Get outputs:"
aws cloudformation describe-stacks \
  --stack-name "app-runner-$ENVIRONMENT" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table

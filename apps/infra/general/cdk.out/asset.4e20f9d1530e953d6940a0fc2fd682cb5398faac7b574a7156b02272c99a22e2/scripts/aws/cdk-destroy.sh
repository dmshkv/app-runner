#!/bin/bash
set -euo pipefail

# Destroy CDK stacks
# Usage: ./scripts/aws/cdk-destroy.sh [environment]

ENVIRONMENT="${1:-${CDK_ENVIRONMENT:-dev}}"
PROFILE="${AWS_PROFILE:-default}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "❌ Invalid environment: $ENVIRONMENT"
  exit 1
fi

echo "⚠️  This will destroy all resources in: $ENVIRONMENT"
echo "Stack: app-runner-$ENVIRONMENT"
echo ""
read -p "Are you sure? Type 'yes' to confirm: " -r
echo ""

if [[ ! $REPLY =~ ^yes$ ]]; then
  echo "Aborted."
  exit 0
fi

cd "$(dirname "$0")/../../apps/infra/general"

echo "🗑️  Destroying stack..."
npm run destroy -- --force --context environment="$ENVIRONMENT" --profile "$PROFILE"

echo "✅ Stack destroyed!"

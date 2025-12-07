#!/bin/bash
set -euo pipefail

# Show CDK diff before deployment
# Usage: ./scripts/aws/cdk-diff.sh [environment]

ENVIRONMENT="${1:-${CDK_ENVIRONMENT:-dev}}"
PROFILE="${AWS_PROFILE:-default}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "❌ Invalid environment: $ENVIRONMENT"
  exit 1
fi

echo "📊 CDK Diff for: $ENVIRONMENT"
echo ""

cd "$(dirname "$0")/../../apps/infra/general"

npm run diff -- --context environment="$ENVIRONMENT" --profile "$PROFILE"

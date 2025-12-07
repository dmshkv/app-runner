#!/bin/bash
set -euo pipefail

# Deploy CDK stack for EC2
# Usage: ./scripts/aws/cdk-deploy-ec2.sh [environment]

ENVIRONMENT="${1:-dev}"
PROFILE="${AWS_PROFILE:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CDK_DIR="$PROJECT_ROOT/apps/infra/general"

echo "🚀 Deploying EC2 infrastructure for $ENVIRONMENT..."
echo "   Profile: $PROFILE"
echo ""

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
  echo "⚠️  Environment file not found: .env.$ENVIRONMENT"
  echo "   Initializing environment..."
  "$SCRIPT_DIR/init-env.sh" "$PROFILE" "$ENVIRONMENT"
fi

# Load environment variables
set -a
source "$PROJECT_ROOT/.env.$ENVIRONMENT"
set +a

# Build CDK app
echo "📦 Building CDK app..."
cd "$CDK_DIR"
npm run build

# Deploy stack
echo ""
echo "🚀 Deploying CDK stack..."
npx cdk deploy \
  --app "node lib/main-ec2.js" \
  --context environment="$ENVIRONMENT" \
  --profile "$PROFILE" \
  --require-approval never \
  --outputs-file "$PROJECT_ROOT/cdk-outputs-$ENVIRONMENT.json"

echo ""
echo "✅ Deployment complete!"
echo ""

# Extract outputs
if [ -f "$PROJECT_ROOT/cdk-outputs-$ENVIRONMENT.json" ]; then
  echo "📋 Stack Outputs:"
  cat "$PROJECT_ROOT/cdk-outputs-$ENVIRONMENT.json" | jq -r '.[]'
  echo ""
  
  # Extract ALB DNS
  ALB_DNS=$(cat "$PROJECT_ROOT/cdk-outputs-$ENVIRONMENT.json" | jq -r '.[] | .ALBDomain // empty')
  if [ -n "$ALB_DNS" ]; then
    echo "🌐 API URL: http://$ALB_DNS/api"
  fi
fi

echo ""
echo "Next steps:"
echo "  1. Push your Docker image: make docker-push-dev"
echo "  2. Update EC2 instances: ./scripts/aws/ec2-update.sh $ENVIRONMENT"
echo "  3. Check health: curl http://\$ALB_DNS/api"

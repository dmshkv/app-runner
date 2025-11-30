#!/bin/bash
set -euo pipefail

# Deploy applications to AWS
# Usage: ./scripts/aws/deploy.sh [environment] [service]
# Examples:
#   ./scripts/aws/deploy.sh dev api       # Deploy API to dev
#   ./scripts/aws/deploy.sh prod all      # Deploy both to prod

ENVIRONMENT="${1:-dev}"
SERVICE="${2:-all}"
PROFILE="${AWS_PROFILE:-default}"

# Load environment config

if [ "$ENVIRONMENT" = "prod" ]; then
  echo "❌ Prod deployment is currently disabled. Contact admin for instructions."
  exit 1
fi

if [ ! -f ".env.${ENVIRONMENT}" ]; then
  echo "❌ Environment file not found: .env.${ENVIRONMENT}"
  echo "Run: ./scripts/aws/init-env.sh $PROFILE $ENVIRONMENT"
  exit 1
fi

set -a
source ".env.${ENVIRONMENT}"
set +a

echo "🚀 Deploying to $ENVIRONMENT environment..."
echo "   Region: $AWS_REGION"
echo "   Account: $AWS_ACCOUNT_ID"
echo ""

# Build NX project
build_and_push() {
  local svc=$1
  
  echo "📦 Building $svc..."
  npx nx build "$svc" --configuration production

  echo "🐳 Building Docker image..."
  case $svc in
    general)
      docker build -f "apps/api/general/Dockerfile" \
        -t "app-runner-api:${ENVIRONMENT}" .
      ;;
    root)
      docker build -f "apps/web/root/Dockerfile" \
        -t "app-runner-web:${ENVIRONMENT}" .
      ;;
  esac

  echo "✅ Built $svc"
}

case $SERVICE in
  api)
    build_and_push "general"
    ./scripts/aws/ecr-push.sh api "$PROFILE" "${ENVIRONMENT}"
    ;;
  *)
    echo "❌ Unknown service: $SERVICE"
    exit 1
    ;;
esac

echo ""
echo "✅ Deployment complete!"
echo "Next steps:"
echo "  - Update your ECS/App Runner services with new images"
echo "  - Or deploy via CloudFormation/CDK"

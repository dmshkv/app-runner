#!/bin/bash
set -euo pipefail

# Build and push Docker images to ECR
# Usage: ./scripts/aws/ecr-push.sh [service] [profile] [tag]
# Examples:
#   ./scripts/aws/ecr-push.sh api myprofile latest
#   ./scripts/aws/ecr-push.sh web myprofile v1.0.0
#   ./scripts/aws/ecr-push.sh all myprofile $(git rev-parse --short HEAD)

SERVICE="${1:-all}"
PROFILE="${2:-${AWS_PROFILE:-default}}"
TAG="${3:-latest}"

# Load AWS config
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text)
REGION=$(aws configure get region --profile "$PROFILE" || echo "ca-central-1")

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region "$REGION" --profile "$PROFILE" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

push_service() {
  local svc=$1
  local dockerfile_path="apps/$svc/Dockerfile"
  local build_context="."
  # Extract base service name (api or web) from path like "api/general"
  local base_service=$(echo "$svc" | cut -d'/' -f1)
  local image_name="app-runner-${base_service}"
  local repository="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${image_name}"

  if [ ! -f "$dockerfile_path" ]; then
    echo "❌ Dockerfile not found: $dockerfile_path"
    return 1
  fi

  echo ""
  echo "🏗️  Building $svc image..."
  docker build -f "$dockerfile_path" \
    -t "$image_name:$TAG" \
    -t "$image_name:latest" \
    "$build_context"

  echo "📤 Pushing to ECR: $repository:$TAG"
  docker tag "$image_name:$TAG" "$repository:$TAG"
  docker tag "$image_name:latest" "$repository:latest"
  docker push "$repository:$TAG"
  docker push "$repository:latest"

  echo "✅ Pushed: $repository:$TAG"
}

case $SERVICE in
  api)
    push_service "api/general"
    ;;
  *)
    echo "❌ Unknown service: $SERVICE"
    echo "Usage: $0 [api] [profile] [tag]"
    exit 1
    ;;
esac

echo ""
echo "✅ Push complete!"
echo "Repository: ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

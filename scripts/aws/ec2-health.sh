#!/bin/bash
set -euo pipefail

# Check health of EC2 deployment
# Usage: ./scripts/aws/ec2-health.sh [environment]

ENVIRONMENT="${1:-dev}"
PROFILE="${AWS_PROFILE:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🏥 Checking health for $ENVIRONMENT environment..."
echo ""

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
  set -a
  source "$PROJECT_ROOT/.env.$ENVIRONMENT"
  set +a
else
  echo "❌ Environment file not found: .env.$ENVIRONMENT"
  exit 1
fi

# Get Auto Scaling Group details
ASG_NAME="app-runner-api-${ENVIRONMENT}"

echo "📋 Auto Scaling Group Status:"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --profile "$PROFILE" \
  --region "${AWS_REGION:-ca-central-1}" \
  --query 'AutoScalingGroups[0].{
    Name: AutoScalingGroupName,
    Desired: DesiredCapacity,
    Min: MinSize,
    Max: MaxSize,
    Current: length(Instances),
    Healthy: length(Instances[?HealthStatus==`Healthy`])
  }' \
  --output table

echo ""
echo "📋 Instance Details:"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --profile "$PROFILE" \
  --region "${AWS_REGION:-ca-central-1}" \
  --query 'AutoScalingGroups[0].Instances[*].{
    InstanceId: InstanceId,
    AZ: AvailabilityZone,
    Health: HealthStatus,
    Lifecycle: LifecycleState
  }' \
  --output table

# Get Load Balancer details
echo ""
echo "📋 Load Balancer Status:"

# Try to get ALB DNS from CDK outputs
if [ -f "$PROJECT_ROOT/cdk-outputs-$ENVIRONMENT.json" ]; then
  ALB_DNS=$(cat "$PROJECT_ROOT/cdk-outputs-$ENVIRONMENT.json" | jq -r '.[] | .ALBDomain // empty')
  
  if [ -n "$ALB_DNS" ]; then
    echo "   ALB DNS: $ALB_DNS"
    echo ""
    
    # Test API health
    echo "🔍 Testing API endpoint..."
    if curl -f -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/api" | grep -q "^[23]"; then
      echo "   ✅ API is responding (http://$ALB_DNS/api)"
      
      # Get response
      echo ""
      echo "📝 API Response:"
      curl -s "http://$ALB_DNS/api" | head -20
    else
      echo "   ❌ API is not responding"
    fi
  fi
fi

# Get Target Group health
echo ""
echo "📋 Target Group Health:"

TG_ARN=$(aws elbv2 describe-target-groups \
  --profile "$PROFILE" \
  --region "${AWS_REGION:-ca-central-1}" \
  --query "TargetGroups[?contains(TargetGroupName, 'app-runner') && contains(TargetGroupName, '${ENVIRONMENT}')].TargetGroupArn" \
  --output text | head -1)

if [ -n "$TG_ARN" ]; then
  aws elbv2 describe-target-health \
    --target-group-arn "$TG_ARN" \
    --profile "$PROFILE" \
    --region "${AWS_REGION:-ca-central-1}" \
    --query 'TargetHealthDescriptions[*].{
      Target: Target.Id,
      Port: Target.Port,
      Health: TargetHealth.State,
      Reason: TargetHealth.Reason
    }' \
    --output table
else
  echo "   ⚠️  Target group not found"
fi

echo ""
echo "✅ Health check complete!"

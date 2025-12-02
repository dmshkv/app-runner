#!/bin/bash
set -euo pipefail

# Update EC2 instances with new Docker image
# Usage: ./scripts/aws/ec2-update.sh [environment] [strategy]
#   strategy: rolling (default) | all-at-once

ENVIRONMENT="${1:-dev}"
STRATEGY="${2:-rolling}"
PROFILE="${AWS_PROFILE:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔄 Updating EC2 instances for $ENVIRONMENT environment..."
echo "   Strategy: $STRATEGY"
echo "   Profile: $PROFILE"
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

# Get Auto Scaling Group name
ASG_NAME="app-runner-api-${ENVIRONMENT}"

# Check if ASG exists
if ! aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --profile "$PROFILE" \
  --region "${AWS_REGION:-ca-central-1}" \
  --output text &>/dev/null; then
  echo "❌ Auto Scaling Group not found: $ASG_NAME"
  echo "   Deploy the infrastructure first: ./scripts/aws/cdk-deploy-ec2.sh $ENVIRONMENT"
  exit 1
fi

echo "📋 Getting instance list..."
INSTANCE_IDS=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --profile "$PROFILE" \
  --region "${AWS_REGION:-ca-central-1}" \
  --query 'AutoScalingGroups[0].Instances[?HealthStatus==`Healthy`].InstanceId' \
  --output text)

if [ -z "$INSTANCE_IDS" ]; then
  echo "❌ No healthy instances found in ASG: $ASG_NAME"
  exit 1
fi

echo "Found instances: $INSTANCE_IDS"
echo ""

# Function to update a single instance
update_instance() {
  local instance_id=$1
  
  echo "🔄 Updating instance: $instance_id"
  
  # Send command via SSM
  COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$instance_id" \
    --document-name "AWS-RunShellScript" \
    --profile "$PROFILE" \
    --region "${AWS_REGION:-ca-central-1}" \
    --parameters 'commands=[
      "set -e",
      "export AWS_DEFAULT_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)",
      "export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)",
      "echo \"Logging into ECR...\"",
      "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
      "echo \"Pulling latest image...\"",
      "docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/app-runner-api:latest",
      "echo \"Restarting service...\"",
      "systemctl restart app-runner-api",
      "sleep 5",
      "echo \"Checking service status...\"",
      "systemctl status app-runner-api --no-pager",
      "echo \"Health check...\"",
      "curl -f http://localhost:3000/api || exit 1",
      "echo \"✅ Update complete for instance $instance_id\""
    ]' \
    --output text \
    --query 'Command.CommandId')
  
  echo "   Command ID: $COMMAND_ID"
  
  # Wait for command to complete
  echo "   Waiting for command to complete..."
  aws ssm wait command-executed \
    --command-id "$COMMAND_ID" \
    --instance-id "$instance_id" \
    --profile "$PROFILE" \
    --region "${AWS_REGION:-ca-central-1}" || {
      echo "   ⚠️  Command execution timed out or failed"
      return 1
    }
  
  # Get command output
  OUTPUT=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$instance_id" \
    --profile "$PROFILE" \
    --region "${AWS_REGION:-ca-central-1}" \
    --query 'StandardOutputContent' \
    --output text)
  
  if echo "$OUTPUT" | grep -q "✅ Update complete"; then
    echo "   ✅ Instance updated successfully"
    return 0
  else
    echo "   ❌ Update failed"
    echo "$OUTPUT"
    return 1
  fi
}

# Update instances based on strategy
case $STRATEGY in
  rolling)
    echo "🔄 Rolling update strategy..."
    INSTANCE_ARRAY=($INSTANCE_IDS)
    TOTAL=${#INSTANCE_ARRAY[@]}
    CURRENT=0
    
    for instance_id in "${INSTANCE_ARRAY[@]}"; do
      CURRENT=$((CURRENT + 1))
      echo ""
      echo "[$CURRENT/$TOTAL] Updating instance: $instance_id"
      
      if update_instance "$instance_id"; then
        echo "✅ Instance updated successfully"
        
        # Wait a bit before next instance
        if [ $CURRENT -lt $TOTAL ]; then
          echo "⏳ Waiting 30 seconds before next instance..."
          sleep 30
        fi
      else
        echo "❌ Failed to update instance: $instance_id"
        echo "⚠️  Rolling update stopped. Manual intervention required."
        exit 1
      fi
    done
    ;;
    
  all-at-once)
    echo "🔄 All-at-once update strategy..."
    for instance_id in $INSTANCE_IDS; do
      update_instance "$instance_id" &
    done
    
    # Wait for all background jobs
    wait
    echo "✅ All instances updated"
    ;;
    
  *)
    echo "❌ Unknown strategy: $STRATEGY"
    echo "   Valid strategies: rolling, all-at-once"
    exit 1
    ;;
esac

echo ""
echo "✅ EC2 update complete!"
echo ""
echo "Next steps:"
echo "  - Check ALB health: aws elbv2 describe-target-health --target-group-arn <TG_ARN> --profile $PROFILE"
echo "  - Test API: curl http://\$ALB_DNS/api"

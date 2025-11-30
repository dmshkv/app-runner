#!/bin/bash
set -euo pipefail

# Initialize local environment variables from AWS
# Usage: ./scripts/aws/init-env.sh [profile] [environment]

PROFILE="${1:-${AWS_PROFILE:-default}}"
ENVIRONMENT="${2:-local}"
ENV_FILE=".env.${ENVIRONMENT}"

echo "🔍 Fetching AWS resources for profile: $PROFILE..."

# Get RDS endpoint and details
DB_ENDPOINT=$(aws rds describe-db-instances \
  --profile "$PROFILE" \
  --db-instance-identifier app-runner-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

DB_PORT=$(aws rds describe-db-instances \
  --profile "$PROFILE" \
  --db-instance-identifier app-runner-db \
  --query 'DBInstances[0].Endpoint.Port' \
  --output text)

DB_NAME=$(aws rds describe-db-instances \
  --profile "$PROFILE" \
  --db-instance-identifier app-runner-db \
  --query 'DBInstances[0].DBName' \
  --output text)

DB_USER=$(aws rds describe-db-instances \
  --profile "$PROFILE" \
  --db-instance-identifier app-runner-db \
  --query 'DBInstances[0].MasterUsername' \
  --output text)

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity \
  --profile "$PROFILE" \
  --query 'Account' \
  --output text)

# Get AWS Region
REGION=$(aws configure get region --profile "$PROFILE" || echo "ca-central-1")

# Get ECR repository URI (or create placeholder)
ECR_API=$(aws ecr describe-repositories \
  --profile "$PROFILE" \
  --repository-names app-runner-api \
  --query 'repositories[0].repositoryUri' \
  --output text 2>/dev/null || echo "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/app-runner-api")

ECR_WEB=$(aws ecr describe-repositories \
  --profile "$PROFILE" \
  --repository-names app-runner-web \
  --query 'repositories[0].repositoryUri' \
  --output text 2>/dev/null || echo "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/app-runner-web")

# Generate .env file
cat > "$ENV_FILE" << EOF
# AWS Configuration
AWS_PROFILE=$PROFILE
AWS_REGION=$REGION
AWS_ACCOUNT_ID=$ACCOUNT_ID

# Database Configuration
DATABASE_URL=postgresql://${DB_USER}:YOUR_DB_PASSWORD@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}
DB_SSL=true
DB_ENDPOINT=$DB_ENDPOINT
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER

# ECR Configuration
ECR_API_REGISTRY=$ECR_API
ECR_WEB_REGISTRY=$ECR_WEB
ECR_REGION=$REGION

# Application Configuration
NODE_ENV=$ENVIRONMENT
API_PORT=3000
WEB_PORT=3001

EOF

echo "✅ Environment file created: $ENV_FILE"
echo ""
echo "📋 Generated configuration:"
echo "   AWS Region: $REGION"
echo "   Account ID: $ACCOUNT_ID"
echo "   Database: $DB_USER@$DB_ENDPOINT:$DB_PORT/$DB_NAME"
echo "   API Registry: $ECR_API"
echo "   Web Registry: $ECR_WEB"
echo ""
echo "⚠️  NOTE: Update DATABASE_URL with your actual password"
echo "   Then run: source $ENV_FILE"

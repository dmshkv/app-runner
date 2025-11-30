# AWS Development & Deployment Guide

This guide explains how to use AWS CLI and local scripts to simplify development and deployment for your app-runner project.

## Quick Start

### 1. Initialize AWS Environment

```bash
# Generate environment variables from AWS resources
make aws-init ENV=dev

# Or manually:
./scripts/aws/init-env.sh dmieshkov dev

# Then update .env.dev with your database password
source .env.dev
```

### 2. Local Development

```bash
# Check your setup
make check-env

# Start local services (Docker Compose)
make dev

# View logs
make dev-logs

# Stop services
make dev-down
```

### 3. Build & Test

```bash
# Run linting and tests
make lint test

# Build all projects
make build
```

### 4. Deploy to AWS

```bash
# Deploy to dev environment
make deploy-dev

# Deploy to production
make deploy-prod
```

## Available Commands

### AWS Infrastructure

```bash
# Check AWS status
make aws-status

# Database operations
make aws-backup      # Create RDS snapshot
make aws-backups     # List recent snapshots
make aws-info        # Show database details
make aws-logs        # Show database logs
```

### Development

```bash
make dev             # Start local services
make dev-down        # Stop local services
make dev-logs        # Stream logs
make lint            # Run ESLint
make test            # Run tests
make build           # Build all projects
```

### Docker & ECR

```bash
make docker-build         # Build images locally
make docker-push-dev      # Push to ECR with dev tag
make docker-push-prod     # Push to ECR with prod tag
```

### CI/CD

```bash
make ci-test         # Run all tests (for CI)
make ci-build        # Build for CI
```

## Directory Structure

```
scripts/
├── aws/
│   ├── init-env.sh      # Generate .env from AWS resources
│   ├── db-commands.sh   # Database operations (backup, logs, etc)
│   ├── ecr-push.sh      # Build and push Docker images to ECR
│   └── deploy.sh        # Full deployment pipeline
```

## Typical Workflow

### Local Development

1. **Setup**
   ```bash
   make aws-init ENV=dev
   source .env.dev
   make check-env
   ```

2. **Development**
   ```bash
   make dev              # Start services
   npm run start         # Start dev server
   # Edit code...
   make lint test build  # Validate changes
   ```

3. **Test**
   ```bash
   make ci-test          # Run full test suite
   ```

### Before Committing

```bash
# Ensure everything passes
make lint test build

# Push to branch
git add .
git commit -m "feat: your change"
git push origin your-branch
```

### After Merge to Master

GitHub Actions automatically:
1. Runs `make ci-test`
2. Builds Docker images
3. Pushes to ECR
4. Deploys to AWS

(Requires GitHub Secrets setup - see below)

## GitHub Secrets Configuration

To enable automatic ECR push and deployment, add these secrets to your GitHub repository:

### Settings → Secrets and variables → Actions

```
AWS_ROLE_TO_ASSUME: arn:aws:iam::<YOUR_ACCOUNT_ID>:role/github-actions-role
```

### Create AWS IAM Role for GitHub

```bash
# Create IAM role with ECR and ECS permissions
# Note: Replace 503411876186 with your actual AWS Account ID
aws iam create-role \
  --role-name github-actions-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:dmshkv/app-runner:ref:refs/heads/master"
        }
      }
    }]
  }' \
  --profile dmieshkov

# Attach ECR permissions
aws iam attach-role-policy \
  --role-name github-actions-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser \
  --profile dmieshkov
```

## Environment Files

### `.env.dev`
Development environment with test database and ECR registry.

### `.env.prod`
Production environment pointing to production database.

**Format:**
```bash
# AWS Configuration
AWS_PROFILE=dmieshkov
AWS_REGION=ca-central-1
AWS_ACCOUNT_ID=<YOUR_ACCOUNT_ID>

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/db
DB_SSL=true

# ECR Configuration
ECR_API_REGISTRY=<YOUR_ACCOUNT_ID>.dkr.ecr.ca-central-1.amazonaws.com/app-runner-api
ECR_WEB_REGISTRY=<YOUR_ACCOUNT_ID>.dkr.ecr.ca-central-1.amazonaws.com/app-runner-web

# Application Configuration
NODE_ENV=dev
API_PORT=3000
WEB_PORT=3001
```

## Troubleshooting

### AWS CLI Issues

```bash
# Check credentials
aws sts get-caller-identity --profile dmieshkov

# Set default profile
export AWS_PROFILE=dmieshkov

# Verify region
aws configure get region --profile dmieshkov
```

### Docker Issues

```bash
# Login to ECR again
aws ecr get-login-password --region ca-central-1 --profile dmieshkov | \
  docker login --username AWS --password-stdin <YOUR_ACCOUNT_ID>.dkr.ecr.ca-central-1.amazonaws.com

# Check image
docker images | grep app-runner
```

### Database Connection

```bash
# Test connection
psql postgresql://user:password@app-runner-db.clkm6cgegwyk.ca-central-1.rds.amazonaws.com:5432/main

# View database status
make aws-info
```

## Production Deployment

### Manual Deployment

```bash
# 1. Prepare
make deploy-prod

# 2. Verify images in ECR
aws ecr describe-images --repository-name app-runner-api --profile dmieshkov

# 3. Update your ECS/App Runner service with new image tags
# 4. Monitor deployment
```

### Automated Deployment (GitHub Actions)

1. Push to `master` branch
2. GitHub Actions automatically:
   - Runs tests
   - Builds Docker images
   - Pushes to ECR
   - Outputs image URIs in job summary

3. Use the image URIs in your deployment tool (ECS, App Runner, CloudFormation, etc)

## Advanced Usage

### Create Database Backup Before Deployment

```bash
make aws-backup
# Wait for backup to complete
make aws-backups  # Verify
```

### Build Specific Service

```bash
./scripts/aws/ecr-push.sh api dmieshkov latest      # Only API
./scripts/aws/ecr-push.sh web dmieshkov v1.0.0      # Only Web with tag
```

### View Deployment Artifacts

After `make deploy-prod`, images are available at:
- API: `<YOUR_ACCOUNT_ID>.dkr.ecr.ca-central-1.amazonaws.com/app-runner-api:latest`
- Web: `<YOUR_ACCOUNT_ID>.dkr.ecr.ca-central-1.amazonaws.com/app-runner-web:latest`

## Next Steps

1. **[Optional] Set up AWS CDK** for infrastructure as code
2. **[Optional] Set up Terraform** for infrastructure management
3. **Test GitHub Actions** by pushing to a branch
4. **Monitor deployments** using CloudWatch
5. **Set up auto-scaling** for production workloads

# EC2 Deployment Guide for apps/api/general

## Overview

This guide provides a complete plan for deploying the NX API application (`apps/api/general`) to AWS EC2 instances using Infrastructure as Code (CDK).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  Application Load    │
           │     Balancer         │
           │   (Port 80/443)      │
           └──────────┬───────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐          ┌───────────────┐
│  EC2 Instance │          │  EC2 Instance │
│   (t3.micro)  │   ...    │   (t3.micro)  │
│               │          │               │
│  Docker       │          │  Docker       │
│  App:3000     │          │  App:3000     │
└───────┬───────┘          └───────┬───────┘
        │                          │
        └──────────┬───────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   RDS Postgres   │
         │   (existing)     │
         └─────────────────┘
```

## Prerequisites

### 1. AWS Account Setup

**What you need:**
- ✅ AWS Account (you have: 503411876186)
- ✅ AWS CLI configured with profile: `dmieshkov`
- ✅ Appropriate IAM permissions for:
  - EC2 (create/manage instances, security groups, key pairs)
  - VPC (create/manage VPC, subnets, NAT gateways)
  - ELB (create/manage Application Load Balancers)
  - Auto Scaling (create/manage Auto Scaling Groups)
  - ECR (already exists: `app-runner-api`)
  - CloudFormation (deploy CDK stacks)
  - IAM (create roles for EC2 instances)
  - Systems Manager (for instance management)

**Verify prerequisites:**
```bash
make check-env
```

### 2. ECR Repository

**Status:** ✅ Already created
- Repository: `app-runner-api`
- Region: `ca-central-1`
- URI: `503411876186.dkr.ecr.ca-central-1.amazonaws.com/app-runner-api`

### 3. RDS Database

**Status:** ✅ Already exists
- Endpoint: `app-runner-db.clkm6cgegwyk.ca-central-1.rds.amazonaws.com`
- Database: `main`
- Port: 5432

**Security Group Note:** The CDK stack will need to update the RDS security group to allow connections from the EC2 instances.

### 4. Local Development Tools

- ✅ Node.js & npm (for building)
- ✅ Docker (for containerization)
- ✅ AWS CDK CLI: `npm install -g aws-cdk`
- ✅ jq (for JSON processing): `brew install jq`

## Application Analysis

### NX Application: `apps/api/general`

**Status:** ✅ Verified runnable

**Build output:**
- Location: `dist/apps/api/general/`
- Entry point: `main.js`
- Dependencies: Packaged via webpack

**Runtime requirements:**
- Node.js 20
- Environment variables:
  - `NODE_ENV`: Environment name (dev/staging/prod)
  - `PORT`: API port (default: 3000)
  - `DATABASE_URL`: PostgreSQL connection string (required)
  - `DB_SSL`: Enable SSL for database (true/false)

**Health check endpoint:** `/api`

## Deployment Plan

### Phase 1: Build and Push Docker Image

```bash
# 1. Build the NX application
npx nx build general --configuration production

# 2. Build Docker image
docker build -f apps/api/general/Dockerfile -t app-runner-api:latest .

# 3. Push to ECR
make docker-push-dev
```

### Phase 2: Deploy EC2 Infrastructure

The CDK stack creates:

1. **VPC** with public and private subnets across 2 AZs
2. **Application Load Balancer** in public subnets
3. **Auto Scaling Group** with EC2 instances in private subnets
4. **Security Groups** for ALB and EC2 instances
5. **IAM Role** for EC2 with ECR pull permissions and SSM access
6. **Target Group** with health checks

```bash
# Deploy EC2 infrastructure
make ec2-deploy ENV=dev
```

**What happens:**
- Creates VPC (10.0.0.0/16 for dev)
- Launches EC2 instances (t3.micro for dev)
- Configures ALB with health checks
- Sets up Auto Scaling (min: 1, desired: 1, max: 2)
- Instances automatically:
  - Install Docker
  - Pull image from ECR
  - Run container with systemd service
  - Register with ALB

**Estimated time:** 10-15 minutes

**Cost estimate (dev):**
- EC2 t3.micro: ~$0.0104/hour × 1 = ~$7.49/month
- ALB: ~$0.0225/hour = ~$16.20/month
- NAT Gateway: ~$0.045/hour = ~$32.40/month
- Data transfer: varies
- **Total: ~$56/month** (much cheaper than Fargate)

### Phase 3: Update EC2 Instances

After deploying new Docker images:

```bash
# Rolling update (one instance at a time)
make ec2-update ENV=dev

# Or all instances at once (faster, but brief downtime)
make ec2-update-fast ENV=dev
```

**Rolling update process:**
1. Pulls latest image from ECR
2. Restarts Docker container
3. Waits for health check
4. Proceeds to next instance

### Phase 4: Health Check

```bash
make ec2-health ENV=dev
```

**Checks:**
- Auto Scaling Group status
- Instance health
- Load Balancer status
- Target Group health
- API endpoint response

## Deployment Commands

### Quick Reference

```bash
# Full deployment pipeline
make ec2-full-deploy ENV=dev

# Individual steps
make build                    # Build NX app
make docker-build            # Build Docker image
make docker-push-dev         # Push to ECR
make ec2-deploy ENV=dev      # Deploy infrastructure
make ec2-update ENV=dev      # Update instances
make ec2-health ENV=dev      # Check health

# Maintenance
make ec2-update ENV=dev      # Rolling update
make ec2-update-fast ENV=dev # Fast update (all at once)
```

### Environment Configuration

Edit `.env.dev` to configure:

```bash
# AWS Configuration
AWS_PROFILE=dmieshkov
AWS_REGION=ca-central-1
AWS_ACCOUNT_ID=503411876186

# Database Configuration
DATABASE_URL=postgresql://postgres:PASSWORD@app-runner-db.clkm6cgegwyk.ca-central-1.rds.amazonaws.com:5432/main
DB_SSL=true

# Application Configuration
NODE_ENV=dev
API_PORT=3000
```

## Infrastructure Configuration

Configuration is in `apps/infra/general/cdk.json`:

```json
{
  "dev": {
    "environment": "dev",
    "vpcCidr": "10.0.0.0/16",
    "apiInstanceCount": 1,
    "apiInstanceType": "t3.micro",
    "enableLogging": true,
    "enableMonitoring": false
  }
}
```

**Scaling configuration:**
- `apiInstanceCount`: Number of instances to run
- `apiInstanceType`: EC2 instance type
- Auto-scaling: Enabled at 70% CPU utilization

## Differences from ECS Fargate Stack

| Feature | ECS Fargate | EC2 |
|---------|-------------|-----|
| Compute | Serverless containers | EC2 instances |
| Pricing | Pay per task | Pay per instance hour |
| Management | AWS managed | Self-managed OS |
| Scaling | Automatic | Auto Scaling Groups |
| Cost (dev) | ~$30-40/month | ~$56/month |
| Cost (prod) | ~$200+/month | ~$100-120/month |
| Deployment | Task update | Instance update |
| Cold start | None | Instance launch time |

**When to use EC2:**
- Need lower cost at scale
- Want OS-level control
- Running consistent workloads
- Need specific instance features

**When to use Fargate:**
- Want zero infrastructure management
- Variable/unpredictable workloads
- Rapid scaling requirements
- Development/testing environments

## Security Considerations

### 1. EC2 Instance Access

Instances are managed via **AWS Systems Manager Session Manager** (no SSH keys needed):

```bash
# Connect to instance
aws ssm start-session --target i-1234567890abcdef0 --profile dmieshkov
```

### 2. Security Groups

- **ALB Security Group:** Allows HTTP/HTTPS from internet
- **EC2 Security Group:** Allows port 3000 from ALB only
- **RDS Security Group:** Needs update to allow EC2 instances

### 3. IAM Permissions

EC2 instances have:
- ECR pull permissions
- CloudWatch logging
- Systems Manager access

### 4. Network Security

- EC2 instances in **private subnets**
- Internet access via **NAT Gateway**
- Load Balancer in **public subnets**

## Troubleshooting

### Instance not starting

```bash
# Check Auto Scaling Group events
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name app-runner-api-dev \
  --profile dmieshkov

# Check instance system log
aws ec2 get-console-output \
  --instance-id i-1234567890abcdef0 \
  --profile dmieshkov
```

### Container not running

```bash
# Connect to instance
aws ssm start-session --target i-1234567890abcdef0 --profile dmieshkov

# Check service status
sudo systemctl status app-runner-api

# Check Docker logs
sudo docker logs app-runner-api

# Check container
sudo docker ps -a
```

### Health check failing

```bash
# Check target health
make ec2-health ENV=dev

# Test locally on instance
curl http://localhost:3000/api

# Check ALB logs
aws logs tail /aws/elasticloadbalancing/app-runner-api-dev --follow --profile dmieshkov
```

### Database connection issues

Ensure RDS security group allows connections from EC2 security group:

```bash
# Get EC2 security group ID from CDK outputs
cat cdk-outputs-dev.json | jq -r '.[] | .SecurityGroupId'

# Add ingress rule to RDS security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-ec2-xxx \
  --profile dmieshkov
```

## Rollback Strategy

### Quick rollback

```bash
# 1. Tag previous working image
docker tag app-runner-api:previous app-runner-api:latest
make docker-push-dev

# 2. Update instances
make ec2-update ENV=dev
```

### Full rollback

```bash
# Redeploy previous CDK version
git checkout <previous-commit>
make ec2-deploy ENV=dev
```

## Monitoring

### CloudWatch Metrics

Auto-scaling monitors:
- CPU Utilization (scales at >70%)
- Request Count (scales at >1000 req/min)

### Custom Alarms

Add to CDK stack:
```typescript
const alarm = new cloudwatch.Alarm(this, 'HighCPU', {
  metric: asg.metricCPUUtilization(),
  threshold: 80,
  evaluationPeriods: 2,
});
```

## Next Steps

1. **Manual prerequisite:** Update RDS security group to allow EC2 access
2. **Run:** `make ec2-full-deploy ENV=dev`
3. **Verify:** `make ec2-health ENV=dev`
4. **Test API:** `curl http://<ALB-DNS>/api`
5. **Set up monitoring:** CloudWatch dashboards
6. **Configure domain:** Route53 + ACM certificate for HTTPS
7. **Enable backups:** Regular RDS and AMI snapshots

## Production Considerations

Before deploying to production:

1. **Enable Multi-AZ:** Set `multiAz: true` in CDK config
2. **Increase capacity:** Adjust `apiInstanceCount` and instance type
3. **Enable monitoring:** Set `enableMonitoring: true`
4. **Add HTTPS:** Configure ACM certificate and HTTPS listener
5. **Set up backup:** Automated AMI creation
6. **Configure alarms:** CloudWatch alerts for critical metrics
7. **Enable logging:** Enhanced monitoring and log aggregation
8. **Secrets management:** Move database credentials to AWS Secrets Manager

## Summary

✅ **Application verified:** Builds and runs successfully  
✅ **Infrastructure ready:** EC2 CDK stack created  
✅ **Deployment scripts:** Automated deployment and updates  
✅ **Health checks:** Monitoring and verification tools  
✅ **Documentation:** Complete deployment guide  

**Prerequisites needed:**
1. AWS Account with appropriate permissions ✅
2. ECR repository ✅ (already exists)
3. RDS database ✅ (already exists)
4. Update RDS security group ⚠️ (manual step)

**Estimated deployment time:** 15-20 minutes  
**Estimated monthly cost (dev):** ~$56

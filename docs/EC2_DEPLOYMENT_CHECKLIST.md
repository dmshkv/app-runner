# EC2 Deployment Changes Checklist

This document lists all changes required to complete the EC2 deployment setup for `apps/api/general`.

## ✅ Completed Changes

### 1. Infrastructure Code
- ✅ Created `apps/infra/general/src/app-runner-ec2-stack.ts` - EC2-based CDK stack
- ✅ Created `apps/infra/general/src/main-ec2.ts` - CDK app entry point for EC2

### 2. Deployment Scripts
- ✅ Created `scripts/aws/cdk-deploy-ec2.sh` - EC2 infrastructure deployment
- ✅ Created `scripts/aws/ec2-update.sh` - Rolling updates for EC2 instances
- ✅ Created `scripts/aws/ec2-health.sh` - Health check script
- ✅ Made all scripts executable

### 3. Makefile Updates
- ✅ Added `ec2-deploy` command - Deploy EC2 infrastructure
- ✅ Added `ec2-update` command - Rolling instance updates
- ✅ Added `ec2-update-fast` command - Fast update (all at once)
- ✅ Added `ec2-health` command - Health check
- ✅ Added `ec2-full-deploy` command - Complete deployment pipeline

### 4. Documentation
- ✅ Created `EC2_DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- ✅ Created this checklist

## ⚠️ Manual Steps Required

### 1. AWS Infrastructure Prerequisites

#### A. Update RDS Security Group
**Why:** Allow EC2 instances to connect to the database

**Steps:**
```bash
# After deploying EC2 stack, get the EC2 security group ID
cat cdk-outputs-dev.json | jq -r '.[] | .SecurityGroupId'

# Get RDS security group ID
aws rds describe-db-instances \
  --db-instance-identifier app-runner-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text \
  --profile dmieshkov

# Add ingress rule
aws ec2 authorize-security-group-ingress \
  --group-id <RDS-SG-ID> \
  --protocol tcp \
  --port 5432 \
  --source-group <EC2-SG-ID> \
  --profile dmieshkov \
  --region ca-central-1
```

**Alternative:** Update the RDS security group in AWS Console:
1. Go to RDS → Databases → app-runner-db
2. Click on the VPC security group
3. Add inbound rule: PostgreSQL (5432) from EC2 security group

#### B. Verify IAM Permissions
Ensure your IAM user/role has permissions for:
- EC2 (full access for dev/test)
- VPC (create/manage)
- ELB (create/manage ALB)
- Auto Scaling
- CloudFormation
- IAM (create roles)
- Systems Manager

**Quick check:**
```bash
# Try a dry-run
cd apps/infra/general
npx cdk synth --app "node lib/main-ec2.js" --context environment=dev
```

### 2. Application Configuration

#### A. Set Database Password in .env.dev
Edit `.env.dev` and update the `DATABASE_URL` with the actual password:

```bash
# Current (placeholder)
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@app-runner-db.clkm6cgegwyk.ca-central-1.rds.amazonaws.com:5432/main

# Update to (with real password)
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@app-runner-db.clkm6cgegwyk.ca-central-1.rds.amazonaws.com:5432/main
```

#### B. Build CDK Infrastructure Code
```bash
cd apps/infra/general
npm install  # Ensure dependencies are installed
npm run build
```

### 3. Optional Improvements

#### A. Make Database Connection Optional (for testing)
Update `apps/api/general/src/app/app.module.ts` to make database optional:

```typescript
TypeOrmModule.forRootAsync({
  useFactory: () => {
    const config = {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV === 'development',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
    
    // Make database optional for testing
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️  DATABASE_URL not set - running without database');
      return { ...config, synchronize: false, autoLoadEntities: false };
    }
    
    return config;
  },
}),
```

#### B. Add Environment Variables to EC2 User Data
If you need additional environment variables, update the user data in `app-runner-ec2-stack.ts`:

```typescript
'ExecStart=/usr/bin/docker run --name app-runner-api \\',
'  -p 3000:3000 \\',
'  -e NODE_ENV=${env} \\',
'  -e PORT=3000 \\',
'  -e DATABASE_URL=${DATABASE_URL:-} \\',
'  -e DB_SSL=${DB_SSL:-false} \\',
'  -e YOUR_CUSTOM_VAR=${YOUR_VALUE} \\',  // Add here
```

#### C. Add HTTPS Support
For production, add HTTPS:

1. Request ACM certificate
2. Update ALB to add HTTPS listener
3. Update security group to allow 443

Example code for `app-runner-ec2-stack.ts`:

```typescript
// Request certificate (do this manually or via CDK)
const certificate = acm.Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:...'
);

// Add HTTPS listener
const httpsListener = alb.addListener('https', {
  port: 443,
  protocol: elbv2.ApplicationProtocol.HTTPS,
  certificates: [certificate],
});

httpsListener.addTargetGroups('default', {
  targetGroups: [apiTargetGroup],
});
```

## 🚀 Deployment Steps

### First-Time Deployment

```bash
# 1. Ensure prerequisites
make check-env

# 2. Build application and Docker image
make build
make docker-build

# 3. Push to ECR
make docker-push-dev

# 4. Deploy EC2 infrastructure
make ec2-deploy ENV=dev

# 5. Wait for deployment to complete (~10-15 minutes)

# 6. Update RDS security group (manual step above)

# 7. Check health
make ec2-health ENV=dev

# 8. Test API
curl http://$(cat cdk-outputs-dev.json | jq -r '.[] | .ALBDomain')/api
```

### Subsequent Deployments

```bash
# Quick deployment
make ec2-full-deploy ENV=dev

# Or step by step
make build
make docker-push-dev
make ec2-update ENV=dev
```

## 📋 Testing Checklist

Before considering deployment complete:

- [ ] CDK synthesizes without errors
- [ ] Docker image builds successfully
- [ ] Image pushed to ECR
- [ ] CDK stack deploys without errors
- [ ] EC2 instances launch and become healthy
- [ ] Auto Scaling Group shows healthy instances
- [ ] Target Group shows healthy targets
- [ ] ALB responds to HTTP requests
- [ ] API endpoint returns expected response
- [ ] Database connection works (if configured)
- [ ] Health check script passes
- [ ] Rolling update works correctly

## 🔍 Validation Commands

```bash
# Check if everything is ready
make check-env

# Verify Docker image
docker images | grep app-runner-api

# Verify ECR
aws ecr describe-images \
  --repository-name app-runner-api \
  --profile dmieshkov \
  --region ca-central-1

# Verify stack
aws cloudformation describe-stacks \
  --stack-name app-runner-ec2-dev \
  --profile dmieshkov \
  --region ca-central-1

# Complete health check
make ec2-health ENV=dev
```

## 🛠️ Troubleshooting Guide

### Issue: CDK deployment fails with "rate exceeded"
**Solution:** Wait a few minutes and retry

### Issue: Instances fail to launch
**Solution:** Check Auto Scaling Group activities:
```bash
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name app-runner-api-dev \
  --profile dmieshkov \
  --max-records 10
```

### Issue: Container fails to start on instance
**Solution:** Connect via SSM and check logs:
```bash
aws ssm start-session --target <instance-id> --profile dmieshkov
sudo systemctl status app-runner-api
sudo docker logs app-runner-api
```

### Issue: Database connection fails
**Solution:** 
1. Check RDS security group has ingress rule for EC2 SG
2. Verify DATABASE_URL is correct in .env.dev
3. Test connection from EC2 instance:
```bash
aws ssm start-session --target <instance-id> --profile dmieshkov
docker exec -it app-runner-api sh
wget -O- app-runner-db.clkm6cgegwyk.ca-central-1.rds.amazonaws.com:5432
```

### Issue: Health checks failing
**Solution:**
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <TG-ARN> \
  --profile dmieshkov

# Check if app is responding on instance
aws ssm start-session --target <instance-id> --profile dmieshkov
curl http://localhost:3000/api
```

## 📊 Cost Optimization Tips

1. **Use Spot Instances:** Save up to 90%
   ```typescript
   spotPrice: '0.01', // Add to ASG config
   ```

2. **Schedule scaling:** Scale down during off-hours
   ```bash
   aws autoscaling put-scheduled-update-group-action \
     --auto-scaling-group-name app-runner-api-dev \
     --scheduled-action-name scale-down-evening \
     --recurrence "0 22 * * *" \
     --desired-capacity 0
   ```

3. **Use smaller NAT Gateway:** Consider NAT instances for dev

4. **Right-size instances:** Monitor CPU/memory and adjust type

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ CDK stack deploys without errors
2. ✅ EC2 instances are running and healthy
3. ✅ ALB returns HTTP 200 for `/api`
4. ✅ Auto Scaling Group maintains desired capacity
5. ✅ Target Group shows all targets healthy
6. ✅ Application connects to database
7. ✅ Rolling updates work without downtime
8. ✅ Health checks pass consistently

## 📝 Notes

- **Current infrastructure:** Uses ECS Fargate (existing CDK stack)
- **New infrastructure:** EC2-based (parallel deployment possible)
- **Migration path:** Can test EC2 alongside Fargate, then switch DNS
- **Rollback:** Keep Fargate stack until EC2 is proven stable

## 🔄 Maintenance Tasks

### Regular Updates
```bash
# Weekly: Update and deploy
make build
make docker-push-dev
make ec2-update ENV=dev
```

### Monthly Reviews
- Review CloudWatch metrics
- Check instance costs
- Update instance types if needed
- Review security group rules
- Update AMI to latest Amazon Linux

### Quarterly Tasks
- Review and update CDK dependencies
- Audit IAM permissions
- Review and optimize costs
- Test disaster recovery procedures

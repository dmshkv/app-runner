# AWS Region Configuration

## Standard Region

**All AWS resources must be deployed to: `ca-central-1` (Canada - Montreal)**

This is enforced across all infrastructure, scripts, and deployment workflows.

## Why Canada Central?

- **Data Sovereignty**: Canadian data residency requirements
- **Latency**: Optimal for Canadian users
- **Compliance**: PIPEDA compliance
- **Cost**: Competitive pricing

## Configuration Files

### Infrastructure (CDK)

All CDK stacks default to `ca-central-1`:

**Files:**
- `apps/infra/general/src/main.ts`
- `apps/infra/general/src/main-crawler.ts`
- `apps/infra/general/src/main-ec2.ts`

**Configuration:**
```typescript
env: {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ca-central-1',
}
```

### Deployment Scripts

All scripts use `ca-central-1` as default:

**Files:**
- `scripts/aws/check-costs.sh`
- `scripts/aws/send-crawl-command.sh`
- `scripts/aws/init-env.sh`
- `scripts/aws/ecr-push.sh`
- `scripts/aws/ec2-health.sh`

**Configuration:**
```bash
REGION="${AWS_REGION:-ca-central-1}"
```

### AWS Profile Configuration

Ensure your AWS profile is configured for Canada:

```bash
# View current region
aws configure get region --profile default

# Set Canada as default region
aws configure set region ca-central-1 --profile default
```

### Environment Variables

Set region in your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
export AWS_REGION=ca-central-1
export CDK_DEFAULT_REGION=ca-central-1
```

## Verification

### Check Current Configuration

```bash
# Check AWS CLI region
aws configure get region

# Check CDK region
echo $CDK_DEFAULT_REGION

# Check environment variable
echo $AWS_REGION
```

### Verify Deployed Resources

```bash
# List EC2 instances in Canada
aws ec2 describe-instances --region ca-central-1

# List RDS instances in Canada
aws rds describe-db-instances --region ca-central-1

# List Lambda functions in Canada
aws lambda list-functions --region ca-central-1

# List CloudFormation stacks in Canada
aws cloudformation list-stacks --region ca-central-1
```

## Override (Not Recommended)

If you need to temporarily use a different region:

```bash
# For single command
aws ec2 describe-instances --region us-east-1

# For entire session
export AWS_REGION=us-east-1
./scripts/aws/cdk-deploy.sh dev

# Reset back to Canada
export AWS_REGION=ca-central-1
```

## Region-Specific Considerations

### 1. **ECR (Container Registry)**

Docker images are region-specific. Always use Canada ECR:

```bash
# Login to Canada ECR
aws ecr get-login-password --region ca-central-1 | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.ca-central-1.amazonaws.com
```

### 2. **Lambda Functions**

Lambda functions must be deployed in the same region as their triggers:

- EventBridge rules: `ca-central-1`
- SQS queues: `ca-central-1`
- SNS topics: `ca-central-1`

### 3. **VPC and Networking**

VPC peering and networking must be within the same region:

- VPC: `ca-central-1`
- Subnets: `ca-central-1a`, `ca-central-1b`
- NAT Gateway: `ca-central-1`

### 4. **Database (RDS)**

Database and read replicas in Canada:

- Primary: `ca-central-1a`
- Standby: `ca-central-1b`
- Backups: Stored in `ca-central-1`

### 5. **S3 Buckets**

While S3 is global, buckets should be created in Canada:

```bash
aws s3api create-bucket \
  --bucket my-bucket-name \
  --region ca-central-1 \
  --create-bucket-configuration LocationConstraint=ca-central-1
```

## Cost Optimization

Canada region pricing is competitive with US regions:

| Service | Canada | US East 1 | Difference |
|---------|--------|-----------|------------|
| Lambda | $0.0000166667/GB-s | $0.0000166667/GB-s | Same |
| EC2 t3.micro | $0.0116/hr | $0.0104/hr | +11% |
| RDS db.t3.micro | $0.018/hr | $0.017/hr | +6% |
| NAT Gateway | $0.045/hr | $0.045/hr | Same |
| Data Transfer | $0.09/GB | $0.09/GB | Same |

**The slight premium (~5-10%) is justified by data sovereignty and compliance benefits.**

## Checklist for New Services

When adding new AWS services:

- [ ] Set region to `ca-central-1` in CDK code
- [ ] Set region to `ca-central-1` in deployment scripts
- [ ] Verify resource is available in Canada region (most are)
- [ ] Test deployment in `dev` environment first
- [ ] Document any region-specific configurations
- [ ] Update this document if needed

## Available AWS Services in ca-central-1

All major services are available:

✅ EC2, ECS, EKS, Lambda  
✅ RDS, DynamoDB, ElastiCache  
✅ S3, EBS, EFS  
✅ VPC, ELB, CloudFront  
✅ SQS, SNS, EventBridge  
✅ CloudWatch, CloudTrail  
✅ IAM (global), Secrets Manager  
✅ ECR, CodeDeploy, CodePipeline  
✅ API Gateway, Route53 (global)

## Support

If you encounter region-specific issues:

1. Check [AWS Regional Services List](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/)
2. Verify the service is available in `ca-central-1`
3. Check AWS SDK region configuration
4. Review CloudFormation/CDK error messages for region constraints

## References

- AWS Canada Region: https://aws.amazon.com/about-aws/global-infrastructure/regions_az/
- Canada Data Residency: https://aws.amazon.com/compliance/canada-data-privacy/
- PIPEDA Compliance: https://aws.amazon.com/compliance/pipeda/

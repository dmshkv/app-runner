# AWS CDK Infrastructure

This directory contains Infrastructure as Code (IaC) definitions for the app-runner project using AWS CDK.

**Note:** This is a configuration directory only, not an NX project. CDK dependencies are managed in the root `package.json`. Run all commands from the workspace root.

## Setup

### 1. Install Dependencies

From the workspace root:

```bash
npm install
```

### 2. Ensure AWS Credentials

```bash
export AWS_PROFILE=<your-profile>
aws sts get-caller-identity
```

## Building

From the workspace root:

```bash
npm run build -- infra-general
```

Or use the Makefile:

```bash
make cdk-build
```

## Structure

```
src/
├── main.ts              # CDK App entry point
├── app-runner-stack.ts  # Main stack definition
└── index.ts            # Exports
```

## Usage

### Build

```bash
npm run build
```

### Synthesize CloudFormation

```bash
npm run synth
```

### Deploy

```bash
# Deploy dev environment
npm run deploy:dev

# Deploy staging
npm run deploy:staging

# Deploy production
npm run deploy:prod

# Deploy specific stack
npm run deploy -- --context environment=prod
```

### Diff

```bash
npm run diff
```

### Destroy

```bash
npm run destroy
```

## Environments

### Development

- **Instance Count**: API 1, Web 1
- **Instance Type**: t3.micro
- **Backup Retention**: 1 day
- **Monitoring**: Disabled
- **CIDR**: 10.0.0.0/16

### Staging

- **Instance Count**: API 2, Web 2
- **Instance Type**: t3.small
- **Backup Retention**: 7 days
- **Monitoring**: Enabled
- **CIDR**: 10.1.0.0/16

### Production

- **Instance Count**: API 3, Web 3
- **Instance Type**: t3.medium
- **Backup Retention**: 30 days
- **Monitoring**: Enabled
- **Multi-AZ**: Yes
- **CIDR**: 10.2.0.0/16

## Architecture

Each environment includes:

- **VPC** with public, private, and isolated subnets
- **Security Groups** for ALB, ECS, and RDS
- **ECS Cluster** with Fargate launch type
- **Application Load Balancer** with path-based routing
- **Fargate Services** for API and Web
- **CloudWatch Logs** for application logging
- **IAM Roles** for ECS task execution

## Environment Variables

The stacks are configured via `cdk.json`. Each environment has:

- `environment`: Environment name (dev/staging/prod)
- `vpcCidr`: VPC CIDR block
- `apiInstanceCount`: Number of API containers
- `apiInstanceType`: EC2 instance type for API
- `webInstanceCount`: Number of Web containers
- `enableLogging`: Enable CloudWatch logs retention
- `enableMonitoring`: Enable Container Insights
- `backupRetentionDays`: RDS backup retention
- `multiAz`: Multi-AZ deployment (prod only)

## Outputs

After deployment, CDK outputs:

- `ALBDomain`: Load Balancer DNS name
- `APIServiceArn`: API ECS service ARN
- `WebServiceArn`: Web ECS service ARN

## Next Steps

1. Update container image tags after ECR deployment
2. Configure RDS security groups if using separate RDS
3. Set up Route53 DNS records pointing to ALB
4. Configure SSL/TLS certificates
5. Set up auto-scaling policies

## Troubleshooting

### Bootstrap CDK

If you get bootstrap errors:

```bash
npx cdk bootstrap aws://$ACCOUNT_ID/ca-central-1 --profile $AWS_PROFILE
```

### Check Deployment Status

```bash
aws cloudformation describe-stacks --stack-name app-runner-dev --profile $AWS_PROFILE
```

### View Events

```bash
aws cloudformation describe-stack-events --stack-name app-runner-dev --profile $AWS_PROFILE
```

## Security

- Secrets are managed via environment variables and AWS Secrets Manager
- All database traffic uses security groups
- ALB uses HTTP (configure HTTPS via AWS Certificate Manager)
- Logging is retained per environment configuration
- IAM roles follow least-privilege principle

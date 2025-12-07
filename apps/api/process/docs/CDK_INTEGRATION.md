# AWS CDK Integration Guide for Process API

This guide shows how to integrate the Process API service with your existing AWS infrastructure.

## 🏗️ Infrastructure Components Needed

1. **RDS PostgreSQL Database**
2. **SQS Queues** (Command & Results)
3. **ECS/Fargate or EC2 Instance** (for Process API)
4. **VPC & Security Groups**
5. **IAM Roles & Permissions**

## 📋 SQS Queue Setup

### Queue 1: Crawler Commands (Existing)
- **Name**: `crawler-commands-{env}`
- **Purpose**: Process API → Crawler Lambda
- **Message Format**: Crawl commands

### Queue 2: Crawler Results (New or SNS Alternative)
- **Name**: `crawler-results-{env}`
- **Purpose**: Crawler Lambda → Process API
- **Message Format**: Crawl results

### Option A: Direct SQS
```typescript
// In your CDK stack (apps/infra/general/lib/*.ts)

const resultsQueue = new sqs.Queue(this, 'CrawlerResultsQueue', {
  queueName: `crawler-results-${environment}`,
  visibilityTimeout: cdk.Duration.seconds(300),
  retentionPeriod: cdk.Duration.days(4),
  deadLetterQueue: {
    queue: new sqs.Queue(this, 'CrawlerResultsDLQ', {
      queueName: `crawler-results-dlq-${environment}`,
    }),
    maxReceiveCount: 3,
  },
});

// Grant crawler Lambda permissions to send messages
resultsQueue.grantSendMessages(crawlerLambda);

// Output queue URL for Process API
new cdk.CfnOutput(this, 'ResultsQueueUrl', {
  value: resultsQueue.queueUrl,
  exportName: `CrawlerResultsQueueUrl-${environment}`,
});
```

### Option B: SNS to SQS (More Flexible)
```typescript
// Create SNS topic for results
const resultsTopic = new sns.Topic(this, 'CrawlerResultsTopic', {
  topicName: `crawler-results-${environment}`,
});

// Subscribe SQS queue to SNS topic
const resultsQueue = new sqs.Queue(this, 'CrawlerResultsQueue', {
  queueName: `crawler-results-${environment}`,
});

resultsTopic.addSubscription(
  new snsSubscriptions.SqsSubscription(resultsQueue)
);

// Crawler publishes to SNS (already exists in your setup)
resultsTopic.grantPublish(crawlerLambda);
```

## 🗄️ RDS Database Setup

### Option A: New RDS Instance
```typescript
// In your CDK stack
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const vpc = new ec2.Vpc(this, 'ProcessApiVpc', {
  maxAzs: 2,
});

const dbInstance = new rds.DatabaseInstance(this, 'ProcessDatabase', {
  engine: rds.DatabaseInstanceEngine.postgres({
    version: rds.PostgresEngineVersion.VER_15,
  }),
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  vpc,
  databaseName: 'app_runner',
  credentials: rds.Credentials.fromGeneratedSecret('postgres'),
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  backupRetention: cdk.Duration.days(7),
  deletionProtection: environment === 'prod',
  publiclyAccessible: false,
});

// Output connection details
new cdk.CfnOutput(this, 'DatabaseEndpoint', {
  value: dbInstance.dbInstanceEndpointAddress,
});

new cdk.CfnOutput(this, 'DatabaseSecretArn', {
  value: dbInstance.secret?.secretArn || '',
});
```

### Option B: Use Existing RDS
```typescript
// Import existing database
const dbInstance = rds.DatabaseInstance.fromDatabaseInstanceAttributes(
  this,
  'ExistingDatabase',
  {
    instanceIdentifier: 'existing-db-identifier',
    instanceEndpointAddress: 'db.xxxxx.region.rds.amazonaws.com',
    port: 5432,
    securityGroups: [existingSecurityGroup],
  }
);
```

## 🚀 Process API Deployment

### Option A: ECS/Fargate (Recommended)
```typescript
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';

const cluster = new ecs.Cluster(this, 'ProcessApiCluster', {
  vpc,
});

const taskDefinition = new ecs.FargateTaskDefinition(this, 'ProcessApiTask', {
  memoryLimitMiB: 512,
  cpu: 256,
});

const container = taskDefinition.addContainer('ProcessApi', {
  image: ecs.ContainerImage.fromRegistry('your-ecr-repo/process-api:latest'),
  environment: {
    AWS_REGION: this.region,
    NODE_ENV: environment,
    PORT: '3000',
  },
  secrets: {
    DATABASE_URL: ecs.Secret.fromSecretsManager(dbInstance.secret!),
    SQS_CRAWL_QUEUE_URL: ecs.Secret.fromSsmParameter(
      ssm.StringParameter.fromStringParameterName(
        this,
        'CrawlQueueUrl',
        '/crawler/crawl-queue-url'
      )
    ),
    SQS_RESULTS_QUEUE_URL: ecs.Secret.fromSsmParameter(
      ssm.StringParameter.fromStringParameterName(
        this,
        'ResultsQueueUrl',
        '/crawler/results-queue-url'
      )
    ),
  },
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: 'process-api',
  }),
});

container.addPortMappings({
  containerPort: 3000,
});

const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
  this,
  'ProcessApiService',
  {
    cluster,
    taskDefinition,
    publicLoadBalancer: true,
    desiredCount: 2,
  }
);

// Grant permissions
commandsQueue.grantSendMessages(taskDefinition.taskRole);
resultsQueue.grantConsumeMessages(taskDefinition.taskRole);
dbInstance.connections.allowFrom(
  fargateService.service,
  ec2.Port.tcp(5432)
);
```

### Option B: EC2 Instance (Existing Setup)
```typescript
// Add to existing EC2 instance user data
const userData = ec2.UserData.forLinux();
userData.addCommands(
  'yum update -y',
  'yum install -y docker',
  'service docker start',
  'usermod -a -G docker ec2-user',
  
  // Pull and run Process API
  'docker pull your-ecr-repo/process-api:latest',
  'docker run -d \\',
  '  -p 3000:3000 \\',
  `  -e DATABASE_URL=${databaseUrl} \\`,
  `  -e SQS_CRAWL_QUEUE_URL=${commandsQueue.queueUrl} \\`,
  `  -e SQS_RESULTS_QUEUE_URL=${resultsQueue.queueUrl} \\`,
  '  -e AWS_REGION=ca-central-1 \\',
  '  your-ecr-repo/process-api:latest'
);
```

## 🔐 IAM Permissions

### Process API IAM Policy
```typescript
const processApiPolicy = new iam.PolicyStatement({
  actions: [
    'sqs:SendMessage',
    'sqs:ReceiveMessage',
    'sqs:DeleteMessage',
    'sqs:GetQueueAttributes',
  ],
  resources: [
    commandsQueue.queueArn,
    resultsQueue.queueArn,
  ],
});

// For ECS task role
taskDefinition.taskRole.addToPrincipalPolicy(processApiPolicy);

// For EC2 instance role
instanceRole.addToPrincipalPolicy(processApiPolicy);
```

## 🔧 Environment Variables Setup

### Store in AWS Systems Manager (SSM)
```bash
# Store configuration in SSM Parameter Store
aws ssm put-parameter \\
  --name "/process-api/database-url" \\
  --value "postgresql://user:pass@db.region.rds.amazonaws.com:5432/app_runner" \\
  --type "SecureString" \\
  --profile dmieshkov

aws ssm put-parameter \\
  --name "/process-api/crawl-queue-url" \\
  --value "https://sqs.region.amazonaws.com/.../crawler-commands-dev" \\
  --type "String" \\
  --profile dmieshkov

aws ssm put-parameter \\
  --name "/process-api/results-queue-url" \\
  --value "https://sqs.region.amazonaws.com/.../crawler-results-dev" \\
  --type "String" \\
  --profile dmieshkov
```

### Use in CDK
```typescript
const databaseUrl = ssm.StringParameter.valueForStringParameter(
  this,
  '/process-api/database-url'
);

const crawlQueueUrl = ssm.StringParameter.valueForStringParameter(
  this,
  '/process-api/crawl-queue-url'
);
```

## 🔄 Update Crawler to Send Results

### Modify Crawler Lambda
Your crawler already publishes to SNS. You have two options:

#### Option 1: Keep SNS, Subscribe SQS
```typescript
// In CDK - subscribe results queue to existing SNS topic
const existingTopic = sns.Topic.fromTopicArn(
  this,
  'ExistingResultsTopic',
  'arn:aws:sns:region:account:crawler-results-dev'
);

existingTopic.addSubscription(
  new snsSubscriptions.SqsSubscription(resultsQueue)
);
```

#### Option 2: Add Direct SQS Publishing
```typescript
// In crawler Lambda (apps/crawler/dataextractor/src/main-sqs.ts)
// Add SQS publishing alongside SNS

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});
const RESULTS_QUEUE_URL = process.env.RESULTS_QUEUE_URL;

// After publishing to SNS, also send to SQS
async function publishToResultsQueue(results: any) {
  if (!RESULTS_QUEUE_URL) return;
  
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: RESULTS_QUEUE_URL,
      MessageBody: JSON.stringify(results),
    })
  );
}
```

## 📦 Build & Deploy Pipeline

### 1. Build Docker Image
```bash
cd apps/api/process
docker build -t process-api:latest -f Dockerfile .
```

### 2. Push to ECR
```bash
# Login to ECR
aws ecr get-login-password --region ca-central-1 --profile dmieshkov | \\
  docker login --username AWS --password-stdin \\
  YOUR_ACCOUNT.dkr.ecr.ca-central-1.amazonaws.com

# Tag
docker tag process-api:latest \\
  YOUR_ACCOUNT.dkr.ecr.ca-central-1.amazonaws.com/process-api:latest

# Push
docker push YOUR_ACCOUNT.dkr.ecr.ca-central-1.amazonaws.com/process-api:latest
```

### 3. Deploy CDK Stack
```bash
cd apps/infra/general
AWS_PROFILE=dmieshkov cdk deploy ProcessApiStack
```

## ✅ Post-Deployment Checklist

- [ ] Verify database connection (check CloudWatch logs)
- [ ] Test SQS permissions (create a URL via API)
- [ ] Monitor SQS queues (check message flow)
- [ ] Test end-to-end workflow (URL → Crawler → Results)
- [ ] Set up CloudWatch alarms
- [ ] Configure auto-scaling (for ECS)
- [ ] Enable database backups
- [ ] Set up monitoring dashboard

## 🔍 Monitoring

### CloudWatch Metrics to Track
- ECS/EC2 CPU & Memory usage
- RDS connections & query performance
- SQS queue depth (commands & results)
- API response times
- Database query times

### CloudWatch Logs
- `/aws/ecs/process-api` - Application logs
- `/aws/rds/instance/process-db/` - Database logs
- Check for errors in URL processing
- Monitor SQS polling activity

## 🚨 Troubleshooting

### Common Issues

**1. Database connection timeout**
- Check security group rules
- Verify VPC configuration
- Check RDS publicly accessible setting

**2. SQS messages not received**
- Verify IAM permissions
- Check queue URL configuration
- Monitor DLQ for failed messages

**3. High memory usage**
- Adjust task definition memory limits
- Check for memory leaks in long-running polls
- Consider scaling horizontally

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS Security Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.Security.html)
- [SQS Best Practices](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html)

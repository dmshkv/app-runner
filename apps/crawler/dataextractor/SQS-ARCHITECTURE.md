# Crawler with SQS Queue Architecture

## Overview

The crawler now uses AWS SQS for command queueing, allowing it to process multiple URLs in a single Lambda invocation and significantly reducing cold start overhead.

## Architecture

```
┌─────────────┐
│   Client    │ Send crawl commands
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  SQS Queue      │ Long polling enabled (20s)
│  (Commands)     │
└────────┬────────┘
         │
         │ Triggers Lambda (SQS event source)
         ▼
┌─────────────────────────────────┐
│  Lambda (Crawler)               │
│  ┌───────────────────────────┐  │
│  │ 1. Process initial SQS    │  │
│  │    message (auto-trigger) │  │
│  │ 2. Crawl & extract data   │  │
│  │ 3. Publish results (SNS)  │  │
│  │ 4. Delete message         │  │
│  │ 5. Poll SQS for next      │  │
│  │    (long poll 20s)        │  │
│  │ 6. If message: goto 2     │  │
│  │ 7. If no message: exit    │  │
│  │ 8. If timeout: exit       │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         │ Publish results
         ▼
┌─────────────────┐
│  SNS Topic      │ Notifications
│  (Results)      │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Dead Letter    │ Failed messages (after 3 retries)
│  Queue (DLQ)    │
└─────────────────┘
```

## Key Benefits

### 1. **Browser Reuse**
- Browser launches once and processes multiple URLs
- Eliminates ~2-3 second cold start overhead per URL
- 10x+ throughput improvement

### 2. **Cost Efficiency**
- **Before**: 100 URLs = 100 Lambda invocations
- **After**: 100 URLs = ~10 Lambda invocations (10 URLs per instance)
- Same or lower cost with much better performance

### 3. **Reliability**
- Dead Letter Queue (DLQ) for failed messages
- Automatic retries (up to 3 attempts)
- Message visibility timeout prevents duplicate processing

### 4. **Scalability**
- Auto-scales based on queue depth
- Long polling reduces API calls
- Can process batches during traffic spikes

## Components

### SQS Command Queue
- **Name**: `crawler-commands-{env}`
- **Visibility Timeout**: 15 minutes (matches Lambda timeout)
- **Long Polling**: 20 seconds
- **Message Retention**: 4 days
- **Dead Letter Queue**: After 3 failed attempts

### Dead Letter Queue (DLQ)
- **Name**: `crawler-dlq-{env}`
- **Retention**: 14 days
- **Purpose**: Capture failed messages for debugging

### SNS Results Topic
- **Name**: `crawler-results-{env}`
- **Purpose**: Publish crawl completion events
- **Subscribers**: Can add email, Lambda, SQS, etc.

### Lambda Function
- **Timeout**: 15 minutes (increased from 5)
- **Memory**: 2048 MB
- **Trigger**: SQS event source (batch size: 1)
- **Environment Variables**:
  - `SQS_QUEUE_URL`: Command queue URL
  - `SNS_TOPIC_ARN`: Results topic ARN

## Message Types

### CRAWL Command
```json
{
  "type": "CRAWL",
  "url": "https://example.com",
  "waitForSelector": ".content",
  "timeout": 30000,
  "selectors": {
    "title": "h1",
    "price": ".price"
  },
  "extractFullHtml": true,
  "screenshot": false,
  "waitForNetworkIdle": true,
  "requestId": "unique-id"
}
```

### EXIT Command
```json
{
  "type": "EXIT"
}
```

Gracefully stops the Lambda instance after current processing completes.

## Deployment

### 1. Deploy Infrastructure
```bash
./scripts/aws/cdk-deploy-crawler.sh dev
```

This creates:
- SQS command queue
- Dead letter queue
- SNS results topic
- Lambda function with SQS trigger
- IAM roles and permissions

### Verify Deployment
```bash
aws cloudformation describe-stacks \
  --stack-name CrawlerStack-dev \
  --region ca-central-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

## Usage

### Send Single Crawl Request
```bash
./scripts/aws/send-crawl-command.sh dev CRAWL "https://example.com"
```

### Send Multiple URLs
```bash
for url in "https://site1.com" "https://site2.com" "https://site3.com"; do
  ./scripts/aws/send-crawl-command.sh dev CRAWL "$url"
  sleep 0.1
done
```

### Send EXIT Command
```bash
./scripts/aws/send-crawl-command.sh dev EXIT
```

### Monitor Logs
```bash
aws logs tail /aws/lambda/crawler-dataextractor-dev --region ca-central-1 --follow
```

### Check Queue Depth
```bash
aws sqs get-queue-attributes \
  --region ca-central-1 \
  --queue-url $(aws cloudformation describe-stacks \
    --stack-name CrawlerStack-dev \
    --region ca-central-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`CommandQueueUrl`].OutputValue' \
    --output text) \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible
```

### Subscribe to Results (Email)
```bash
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name CrawlerStack-dev \
  --region ca-central-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ResultsTopicArn`].OutputValue' \
  --output text)

aws sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Monitoring

### CloudWatch Metrics
- **Lambda Invocations**: How many times Lambda was triggered
- **SQS Messages**: Queue depth and processing rate
- **Lambda Duration**: Time per invocation
- **Lambda Errors**: Failed invocations

### CloudWatch Logs
```bash
# Real-time logs
aws logs tail /aws/lambda/crawler-dataextractor-dev --region ca-central-1 --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-dev \
  --region ca-central-1 \
  --filter-pattern "ERROR"

# Count processed URLs
aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-dataextractor-dev \
  --filter-pattern "Processing crawl" \
  | grep -c "Processing crawl"
```

### Check Dead Letter Queue
```bash
DLQ_URL=$(aws cloudformation describe-stacks \
  --stack-name CrawlerStack-dev \
  --region ca-central-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DeadLetterQueueUrl`].OutputValue' \
  --output text)

aws sqs receive-message --region ca-central-1 --queue-url "$DLQ_URL" --max-number-of-messages 10
```

## Cost Monitoring

### Check Current AWS Costs
```bash
./scripts/aws/check-costs.sh
```

This script shows:
- Running EC2 instances
- RDS databases
- NAT Gateways (expensive!)
- Elastic IPs (unattached)
- EBS volumes
- Lambda functions
- SQS queues
- SNS topics
- S3 buckets
- CloudWatch logs
- Cost breakdown by service

### Estimated Costs

**SQS**:
- $0.40 per 1M requests
- 1000 crawls = ~2000 requests (send + receive) = $0.0008

**Lambda**:
- $0.20 per 1M requests
- $0.0000166667 per GB-second
- 100 crawls @ 2GB for 30s avg = $0.01

**SNS**:
- $0.50 per 1M notifications
- 100 results = $0.00005

**Total**: ~$0.01 per 100 crawls (negligible)

## Troubleshooting

### Lambda Times Out
- Check CloudWatch logs for errors
- Increase Lambda timeout (currently 15 min max)
- Check if browser is hanging on specific URLs

### Messages in DLQ
```bash
# View failed messages
DLQ_URL=$(aws cloudformation describe-stacks \
  --stack-name CrawlerStack-dev \
  --region ca-central-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DeadLetterQueueUrl`].OutputValue' \
  --output text)

aws sqs receive-message --region ca-central-1 --queue-url "$DLQ_URL"
```

### No Results Published
- Check SNS topic subscriptions
- Verify `SNS_TOPIC_ARN` environment variable
- Check Lambda IAM permissions for SNS publish

### Queue Not Processing
- Verify Lambda has SQS event source mapping
- Check Lambda is not throttled
- Verify SQS queue permissions

## Cleanup

### Delete Stack
```bash
./scripts/aws/cdk-destroy.sh CrawlerStack-dev
```

This removes:
- Lambda function
- SQS queues (command + DLQ)
- SNS topic
- IAM roles
- CloudWatch logs (if retention expired)

## Migration from EventBridge

The stack still supports EventBridge for backward compatibility:

### EventBridge Trigger (Old Method)
```bash
./scripts/aws/trigger-crawler.sh "https://example.com" dev
```

### SQS Queue (New Method - Recommended)
```bash
./scripts/aws/send-crawl-command.sh dev CRAWL "https://example.com"
```

**Recommendation**: Use SQS for better performance and cost efficiency.

## Next Steps

1. **Test in dev environment**
   ```bash
   ./scripts/aws/send-crawl-command.sh dev CRAWL "https://example.com"
   ```

2. **Monitor performance**
   ```bash
   aws logs tail /aws/lambda/crawler-dataextractor-dev --follow
   ```

3. **Check costs**
   ```bash
   ./scripts/aws/check-costs.sh
   ```

4. **Subscribe to results**
   ```bash
   # Add your email to receive crawl completion notifications
   aws sns subscribe --topic-arn <RESULTS_TOPIC_ARN> --protocol email --notification-endpoint your@email.com
   ```

5. **Scale testing**
   ```bash
   # Send 100 URLs and monitor throughput
   for i in {1..100}; do
     ./scripts/aws/send-crawl-command.sh dev CRAWL "https://httpbin.org/delay/1"
   done
   ```

#!/bin/bash
# Check SQS queue status and messages
# Usage: ./check-queue-status.sh [env]

set -e

ENV="${1:-dev}"
PROFILE="${AWS_PROFILE:-dmieshkov}"
REGION="ca-central-1"

echo "📊 SQS Queue Status for environment: $ENV"
echo "=========================================="
echo ""

# Get queue URLs from CloudFormation
COMMAND_QUEUE_URL=$(aws cloudformation describe-stacks \
  --stack-name CrawlerStack-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`CommandQueueUrl`].OutputValue' \
  --output text)

DLQ_URL=$(aws cloudformation describe-stacks \
  --stack-name CrawlerStack-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`DeadLetterQueueUrl`].OutputValue' \
  --output text)

echo "📮 Command Queue"
echo "URL: $COMMAND_QUEUE_URL"
echo ""

# Get queue attributes
ATTRS=$(aws sqs get-queue-attributes \
  --queue-url "$COMMAND_QUEUE_URL" \
  --region $REGION \
  --profile "$PROFILE" \
  --attribute-names All \
  --output json)

VISIBLE=$(echo "$ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessages')
INFLIGHT=$(echo "$ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible')
DELAYED=$(echo "$ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessagesDelayed')

echo "Messages:"
echo "  Visible (waiting): $VISIBLE"
echo "  In-flight (processing): $INFLIGHT"
echo "  Delayed: $DELAYED"
echo ""

echo "☠️  Dead Letter Queue"
echo "URL: $DLQ_URL"
echo ""

# Get DLQ attributes
DLQ_ATTRS=$(aws sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --region $REGION \
  --profile "$PROFILE" \
  --attribute-names ApproximateNumberOfMessages \
  --output json)

DLQ_COUNT=$(echo "$DLQ_ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessages')

if [ "$DLQ_COUNT" -gt 0 ]; then
  echo "⚠️  Failed messages: $DLQ_COUNT"
  echo ""
  echo "To inspect failed messages:"
  echo "  aws sqs receive-message --queue-url \"$DLQ_URL\" --region $REGION --profile $PROFILE"
else
  echo "✅ No failed messages"
fi

echo ""
echo "---"
echo ""
echo "To send a new crawl command:"
echo "  ./scripts/aws/send-crawl-command.sh $ENV CRAWL \"https://example.com\""

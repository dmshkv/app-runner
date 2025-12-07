#!/bin/bash
# Send crawl commands to SQS queue

set -e

PROFILE="${AWS_PROFILE:-default}"
REGION="${AWS_REGION:-ca-central-1}"
ENV="${1:-dev}"
COMMAND_TYPE="${2:-CRAWL}"
URL="${3}"

# Get queue URL from CDK outputs
QUEUE_URL=$(aws cloudformation describe-stacks \
  --profile "$PROFILE" \
  --region "$REGION" \
  --stack-name "CrawlerStack-$ENV" \
  --query 'Stacks[0].Outputs[?OutputKey==`CommandQueueUrl`].OutputValue' \
  --output text)

if [ -z "$QUEUE_URL" ]; then
  echo "❌ Failed to get queue URL. Make sure the stack is deployed."
  exit 1
fi

echo "📮 Queue URL: $QUEUE_URL"

if [ "$COMMAND_TYPE" == "EXIT" ]; then
  # Send EXIT command
  MESSAGE='{"type":"EXIT"}'
  echo "🛑 Sending EXIT command..."
elif [ -z "$URL" ]; then
  echo "Usage: $0 <env> <CRAWL|EXIT> [url]"
  echo "Example: $0 dev CRAWL https://example.com"
  echo "Example: $0 dev EXIT"
  exit 1
else
  # Send CRAWL command
  MESSAGE=$(cat <<EOF
{
  "type": "CRAWL",
  "url": "$URL",
  "waitForNetworkIdle": true,
  "extractFullHtml": true,
  "screenshot": false,
  "requestId": "$(uuidgen)"
}
EOF
)
  echo "🕷️ Sending CRAWL command for: $URL"
fi

# Send message to SQS
aws sqs send-message \
  --profile "$PROFILE" \
  --region "$REGION" \
  --queue-url "$QUEUE_URL" \
  --message-body "$MESSAGE"

echo "✅ Message sent successfully!"
echo ""
echo "Monitor logs:"
echo "aws logs tail /aws/lambda/crawler-dataextractor-$ENV --follow --profile $PROFILE --region $REGION"

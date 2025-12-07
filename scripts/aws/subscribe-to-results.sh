#!/bin/bash
# Subscribe to crawler results via SNS
# Usage: ./subscribe-to-results.sh [env] [email|sqs|lambda] [endpoint]

set -e

ENV="${1:-dev}"
PROTOCOL="${2:-email}"
ENDPOINT="${3}"
PROFILE="${AWS_PROFILE:-dmieshkov}"
REGION="ca-central-1"

if [ -z "$ENDPOINT" ]; then
  echo "Usage: $0 <env> <protocol> <endpoint>"
  echo ""
  echo "Protocols:"
  echo "  email    - Send results to email address"
  echo "  sqs      - Send results to SQS queue (provide queue ARN)"
  echo "  lambda   - Invoke Lambda function (provide function ARN)"
  echo "  https    - POST to HTTPS endpoint (provide URL)"
  echo ""
  echo "Example:"
  echo "  $0 dev email your-email@example.com"
  exit 1
fi

echo "📢 Subscribing to crawler results"
echo "================================="
echo ""

# Get SNS topic ARN
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name CrawlerStack-$ENV \
  --region $REGION \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`ResultsTopicArn`].OutputValue' \
  --output text)

echo "Topic: $TOPIC_ARN"
echo "Protocol: $PROTOCOL"
echo "Endpoint: $ENDPOINT"
echo ""

# Subscribe
SUB_ARN=$(aws sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol "$PROTOCOL" \
  --notification-endpoint "$ENDPOINT" \
  --region $REGION \
  --profile "$PROFILE" \
  --query 'SubscriptionArn' \
  --output text)

echo "✅ Subscription created!"
echo ""

if [ "$PROTOCOL" = "email" ]; then
  echo "📧 Check your email ($ENDPOINT) and confirm the subscription"
  echo ""
  echo "After confirmation, you'll receive notifications for:"
  echo "  - Every successful crawl"
  echo "  - Crawl errors"
  echo "  - URL processed"
  echo "  - Page title"
  echo "  - HTTP status code"
else
  echo "Subscription ARN: $SUB_ARN"
fi

echo ""
echo "To test, send a crawl command:"
echo "  ./scripts/aws/send-crawl-command.sh $ENV CRAWL \"https://example.com\""

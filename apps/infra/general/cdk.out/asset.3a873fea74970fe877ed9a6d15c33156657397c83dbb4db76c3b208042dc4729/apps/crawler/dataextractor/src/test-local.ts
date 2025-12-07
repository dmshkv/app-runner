/**
 * Local test script for SQS-based crawler
 * Simulates Lambda invocation with mock SQS events
 */

import { SQSEvent, Context } from 'aws-lambda';
import { handler } from './main-sqs';

// Mock AWS Context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'crawler-dataextractor-dev',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:ca-central-1:123456789012:function:crawler-dataextractor-dev',
  memoryLimitInMB: '2048',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/crawler-dataextractor-dev',
  logStreamName: '2025/12/03/[$LATEST]test',
  getRemainingTimeInMillis: () => 900000, // 15 minutes
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Mock SQS Event with CRAWL command
const mockSQSEvent: SQSEvent = {
  Records: [
    {
      messageId: 'test-message-1',
      receiptHandle: 'test-receipt-handle',
      body: JSON.stringify({
        type: 'CRAWL',
        url: 'https://example.com',
        waitForSelector: 'body',
        timeout: 30000,
        selectors: {
          title: 'h1',
          content: 'p',
        },
        extractFullHtml: true,
        screenshot: false,
        waitForNetworkIdle: true,
        requestId: 'test-request-001',
      }),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: Date.now().toString(),
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: Date.now().toString(),
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:ca-central-1:123456789012:crawler-commands-dev',
      awsRegion: 'ca-central-1',
    },
  ],
};

/**
 * Run local test
 */
async function runLocalTest() {
  console.log('🧪 Starting local crawler test...');
  console.log('');
  console.log('Test Configuration:');
  console.log('- URL: https://example.com');
  console.log('- Selectors: title (h1), content (p)');
  console.log('- Extract full HTML: Yes');
  console.log('- Screenshot: No');
  console.log('');
  console.log('⚠️  Note: This will use local Chromium browser');
  console.log('⚠️  SQS polling will be skipped (no queue configured)');
  console.log('');

  try {
    const result = await handler(mockSQSEvent, mockContext);
    console.log('');
    console.log('✅ Test completed successfully!');
    console.log('');
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('');
    console.error('❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runLocalTest();
}

export { runLocalTest, mockSQSEvent, mockContext };

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export interface CrawlerStackProps extends cdk.StackProps {
  environment: string;
}

export class CrawlerStack extends cdk.Stack {
  public readonly crawlerFunction: lambda.Function;
  public readonly eventRule: events.Rule;
  public readonly commandQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly resultsTopicarn: sns.Topic;

  constructor(scope: Construct, id: string, props: CrawlerStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Dead Letter Queue for failed messages
    this.deadLetterQueue = new sqs.Queue(this, 'CrawlerDLQ', {
      queueName: `crawler-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14), // Keep failed messages for 14 days
    });

    // SQS Queue for crawler commands
    this.commandQueue = new sqs.Queue(this, 'CrawlerCommandQueue', {
      queueName: `crawler-commands-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(15), // Match Lambda timeout
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      retentionPeriod: cdk.Duration.days(4), // Keep messages for 4 days
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Move to DLQ after 3 failed attempts
      },
    });

    // SNS Topic for publishing crawl results
    this.resultsTopicarn = new sns.Topic(this, 'CrawlerResultsTopic', {
      topicName: `crawler-results-${environment}`,
      displayName: 'Crawler Results Notifications',
    });

    // Lambda function for crawler
    this.crawlerFunction = new lambda.DockerImageFunction(
      this,
      'CrawlerFunction',
      {
        functionName: `crawler-dataextractor-${environment}`,
        description: 'Web crawler and data extractor using Puppeteer',
        code: lambda.DockerImageCode.fromImageAsset(
          '../../..', // Build from workspace root
          {
            file: 'apps/crawler/dataextractor/Dockerfile',
          }
        ),
        timeout: cdk.Duration.minutes(15), // Increased to allow polling
        memorySize: 2048, // Chromium needs memory
        architecture: lambda.Architecture.X86_64,
        environment: {
          NODE_ENV: environment,
          SQS_QUEUE_URL: this.commandQueue.queueUrl,
          SNS_TOPIC_ARN: this.resultsTopicarn.topicArn,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
      }
    );

    // Grant CloudWatch Logs permissions
    this.crawlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Grant SQS permissions (read, delete messages)
    this.commandQueue.grantConsumeMessages(this.crawlerFunction);

    // Grant SNS publish permissions
    this.resultsTopicarn.grantPublish(this.crawlerFunction);

    // Add SQS as event source for Lambda
    this.crawlerFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.commandQueue, {
        batchSize: 1, // Process one message at a time
        maxBatchingWindow: cdk.Duration.seconds(0),
        reportBatchItemFailures: true,
      })
    );

    // EventBridge rule to trigger crawler
    this.eventRule = new events.Rule(this, 'CrawlerTriggerRule', {
      ruleName: `crawler-trigger-${environment}`,
      description: 'Triggers the crawler Lambda function',
      eventPattern: {
        source: ['custom.crawler'],
        detailType: ['CrawlRequest'],
      },
    });

    // Add Lambda as target
    this.eventRule.addTarget(
      new targets.LambdaFunction(this.crawlerFunction, {
        retryAttempts: 2,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'CrawlerFunctionName', {
      value: this.crawlerFunction.functionName,
      description: 'Crawler Lambda function name',
    });

    new cdk.CfnOutput(this, 'CrawlerFunctionArn', {
      value: this.crawlerFunction.functionArn,
      description: 'Crawler Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'EventBridgeRuleName', {
      value: this.eventRule.ruleName,
      description: 'EventBridge rule name',
    });

    new cdk.CfnOutput(this, 'CommandQueueUrl', {
      value: this.commandQueue.queueUrl,
      description: 'SQS Command Queue URL',
    });

    new cdk.CfnOutput(this, 'CommandQueueArn', {
      value: this.commandQueue.queueArn,
      description: 'SQS Command Queue ARN',
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: this.deadLetterQueue.queueUrl,
      description: 'Dead Letter Queue URL',
    });

    new cdk.CfnOutput(this, 'ResultsTopicArn', {
      value: this.resultsTopicarn.topicArn,
      description: 'SNS Results Topic ARN',
    });
  }
}

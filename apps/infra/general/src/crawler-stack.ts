import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface CrawlerStackProps extends cdk.StackProps {
  environment: string;
}

export class CrawlerStack extends cdk.Stack {
  public readonly crawlerFunction: lambda.Function;
  public readonly eventRule: events.Rule;

  constructor(scope: Construct, id: string, props: CrawlerStackProps) {
    super(scope, id, props);

    const { environment } = props;

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
        timeout: cdk.Duration.minutes(5),
        memorySize: 2048, // Chromium needs memory
        architecture: lambda.Architecture.X86_64,
        environment: {
          NODE_ENV: environment,
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
  }
}

#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CrawlerStack } from './crawler-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';

new CrawlerStack(app, `CrawlerStack-${environment}`, {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ca-central-1',
  },
  description: `Web Crawler and Data Extractor Stack - ${environment}`,
});

app.synth();

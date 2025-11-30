import * as cdk from 'aws-cdk-lib';
import { AppRunnerEC2Stack, EnvironmentConfig } from './app-runner-ec2-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

// Load environment-specific config
const configMap: { [key: string]: EnvironmentConfig } = {
  dev: app.node.tryGetContext('dev'),
  staging: app.node.tryGetContext('staging'),
  prod: app.node.tryGetContext('prod'),
};

const config = configMap[environment];

if (!config) {
  throw new Error(`Invalid environment: ${environment}. Must be dev, staging, or prod`);
}

// Create EC2-based stack
new AppRunnerEC2Stack(app, `AppRunner${capitalize(environment)}EC2Stack`, config, {
  stackName: `app-runner-ec2-${environment}`,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ca-central-1',
  },
  description: `App Runner EC2 infrastructure for ${environment} environment`,
});

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

app.synth();

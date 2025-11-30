import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface EnvironmentConfig {
  environment: string;
  vpcCidr: string;
  apiInstanceCount: number;
  apiInstanceType: string;
  webInstanceCount: number;
  enableLogging: boolean;
  enableMonitoring: boolean;
  backupRetentionDays: number;
  multiAz?: boolean;
}

export class AppRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: EnvironmentConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = config.environment;

    // VPC
    const vpc = new ec2.Vpc(this, `${env}-vpc`, {
      cidr: config.vpcCidr,
      natGateways: config.multiAz ? 3 : 1,
      maxAzs: config.multiAz ? 3 : 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${env}-public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${env}-private`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: `${env}-db`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Security Groups
    const albSecurityGroup = new ec2.SecurityGroup(this, `${env}-alb-sg`, {
      vpc,
      description: `ALB security group for ${env}`,
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP'
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS'
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, `${env}-ecs-sg`, {
      vpc,
      description: `ECS security group for ${env}`,
      allowAllOutbound: true,
    });
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.allTcp(),
      'Allow from ALB'
    );

    const dbSecurityGroup = new ec2.SecurityGroup(this, `${env}-db-sg`, {
      vpc,
      description: `RDS security group for ${env}`,
      allowAllOutbound: false,
    });
    dbSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from ECS'
    );

    // ECS Cluster
    const cluster = new ecs.Cluster(this, `${env}-cluster`, {
      vpc,
      containerInsights: config.enableMonitoring,
      clusterName: `app-runner-${env}`,
    });

    // ECR Repositories
    const apiRepository = ecr.Repository.fromRepositoryName(
      this,
      `${env}-api-repo`,
      'app-runner-api'
    );
    const webRepository = ecr.Repository.fromRepositoryName(
      this,
      `${env}-web-repo`,
      'app-runner-web'
    );

    // CloudWatch Log Groups
    const apiLogGroup = new logs.LogGroup(this, `${env}-api-logs`, {
      logGroupName: `/ecs/app-runner-api-${env}`,
      retention: config.enableLogging ? logs.RetentionDays.ONE_WEEK : logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const webLogGroup = new logs.LogGroup(this, `${env}-web-logs`, {
      logGroupName: `/ecs/app-runner-web-${env}`,
      retention: config.enableLogging ? logs.RetentionDays.ONE_WEEK : logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, `${env}-alb`, {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: `app-runner-${env}`,
    });

    const listener = alb.addListener('http', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // Fargate Task Definition for API
    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, `${env}-api-task`, {
      memoryLimitMiB: 512,
      cpu: 256,
      family: `app-runner-api-${env}`,
    });

    const apiContainer = apiTaskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'ecs',
        logGroup: apiLogGroup,
      }),
      environment: {
        NODE_ENV: env,
        PORT: '3000',
      },
      portMappings: [
        {
          containerPort: 3000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Fargate Task Definition for Web
    const webTaskDefinition = new ecs.FargateTaskDefinition(this, `${env}-web-task`, {
      memoryLimitMiB: 512,
      cpu: 256,
      family: `app-runner-web-${env}`,
    });

    const webContainer = webTaskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(webRepository, 'latest'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'ecs',
        logGroup: webLogGroup,
      }),
      environment: {
        NODE_ENV: env,
        PORT: '3001',
      },
      portMappings: [
        {
          containerPort: 3001,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Fargate Services
    const apiService = new ecs.FargateService(this, `${env}-api-service`, {
      cluster,
      taskDefinition: apiTaskDefinition,
      desiredCount: config.apiInstanceCount,
      serviceName: `app-runner-api-${env}`,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
    });

    const webService = new ecs.FargateService(this, `${env}-web-service`, {
      cluster,
      taskDefinition: webTaskDefinition,
      desiredCount: config.webInstanceCount,
      serviceName: `app-runner-web-${env}`,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
    });

    // ALB Target Groups
    // API service with path-based routing (priority 1 = highest)
    const apiTargetGroup = listener.addTargets('api', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [apiService],
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*']),
      ],
      healthCheck: {
        path: '/api',
        healthyHttpCodes: '200-499',
      },
    });

    // Web service as default (no priority, no conditions = default target)
    const webTargetGroup = listener.addTargets('web', {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [webService],
      healthCheck: {
        path: '/',
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'ALBDomain', {
      value: alb.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `app-runner-${env}-alb-domain`,
    });

    new cdk.CfnOutput(this, 'APIServiceArn', {
      value: apiService.serviceArn,
      description: 'API Service ARN',
      exportName: `app-runner-${env}-api-service-arn`,
    });

    new cdk.CfnOutput(this, 'WebServiceArn', {
      value: webService.serviceArn,
      description: 'Web Service ARN',
      exportName: `app-runner-${env}-web-service-arn`,
    });
  }
}

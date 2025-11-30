import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';

export interface EnvironmentConfig {
  environment: string;
  vpcCidr: string;
  apiInstanceCount: number;
  apiInstanceType: string;
  enableLogging: boolean;
  enableMonitoring: boolean;
  multiAz?: boolean;
}

export class AppRunnerEC2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: EnvironmentConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = config.environment;

    // VPC
    const vpc = new ec2.Vpc(this, `${env}-vpc`, {
      cidr: config.vpcCidr,
      natGateways: config.multiAz ? 2 : 1,
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
      ],
    });

    // Security Group for ALB
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

    // Security Group for EC2 API instances
    const apiSecurityGroup = new ec2.SecurityGroup(this, `${env}-api-sg`, {
      vpc,
      description: `API EC2 security group for ${env}`,
      allowAllOutbound: true,
    });
    apiSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow API traffic from ALB'
    );

    // IAM Role for EC2 instances
    const ec2Role = new iam.Role(this, `${env}-ec2-role`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      roleName: `app-runner-api-${env}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Grant ECR pull permissions
    ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
        ],
        resources: ['*'],
      })
    );

    // ECR Repository reference
    const apiRepository = ecr.Repository.fromRepositoryName(
      this,
      `${env}-api-repo`,
      'app-runner-api'
    );

    // User Data script for EC2 instances
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Update and install Docker',
      'yum update -y',
      'yum install -y docker',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -a -G docker ec2-user',
      '',
      '# Install AWS CLI v2',
      'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"',
      'unzip -q awscliv2.zip',
      './aws/install',
      'rm -rf aws awscliv2.zip',
      '',
      '# Get AWS region and account',
      'export AWS_DEFAULT_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)',
      'export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)',
      '',
      '# Login to ECR',
      'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
      '',
      '# Pull and run API container',
      `docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/${apiRepository.repositoryName}:latest`,
      '',
      '# Create systemd service for Docker container',
      'cat > /etc/systemd/system/app-runner-api.service <<EOF',
      '[Unit]',
      'Description=App Runner API Container',
      'After=docker.service',
      'Requires=docker.service',
      '',
      '[Service]',
      'Type=simple',
      'Restart=always',
      'RestartSec=10',
      'ExecStartPre=-/usr/bin/docker stop app-runner-api',
      'ExecStartPre=-/usr/bin/docker rm app-runner-api',
      'ExecStart=/usr/bin/docker run --name app-runner-api \\',
      '  -p 3000:3000 \\',
      '  --restart unless-stopped \\',
      `  -e NODE_ENV=${env} \\`,
      '  -e PORT=3000 \\',
      '  -e DATABASE_URL="" \\',
      '  -e DB_SSL=false \\',
      `  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/${apiRepository.repositoryName}:latest`,
      'ExecStop=/usr/bin/docker stop app-runner-api',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '',
      '# Enable and start service',
      'systemctl daemon-reload',
      'systemctl enable app-runner-api',
      'systemctl start app-runner-api',
      '',
      '# Install CloudWatch agent (optional)',
      'wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm',
      'rpm -U ./amazon-cloudwatch-agent.rpm',
      '',
      '# Health check script',
      'cat > /usr/local/bin/health-check.sh <<EOF',
      '#!/bin/bash',
      'curl -f http://localhost:3000/api || exit 1',
      'EOF',
      'chmod +x /usr/local/bin/health-check.sh',
      '',
      'echo "EC2 instance setup complete"'
    );

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, `${env}-alb`, {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: `app-runner-api-${env}`,
    });

    const listener = alb.addListener('http', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // Launch Template for API instances
    const launchTemplate = new ec2.LaunchTemplate(this, `${env}-api-lt`, {
      instanceType: new ec2.InstanceType(config.apiInstanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      }),
      securityGroup: apiSecurityGroup,
      role: ec2Role,
      userData: userData,
      launchTemplateName: `app-runner-api-${env}`,
    });

    // Auto Scaling Group for API
    const asg = new autoscaling.AutoScalingGroup(this, `${env}-api-asg`, {
      vpc,
      launchTemplate: launchTemplate,
      minCapacity: config.apiInstanceCount,
      maxCapacity: config.apiInstanceCount * 2,
      desiredCapacity: config.apiInstanceCount,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.minutes(5),
      }),
      updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
        maxBatchSize: 1,
        minInstancesInService: config.apiInstanceCount - 1,
        pauseTime: cdk.Duration.minutes(2),
      }),
    });

    // Target Group for API
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, `${env}-api-tg`, {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: '/api',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200-499',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Attach ASG to Target Group
    asg.attachToApplicationTargetGroup(apiTargetGroup);

    // Add listener rule
    listener.addTargetGroups('default', {
      targetGroups: [apiTargetGroup],
    });

    // CloudWatch alarms for monitoring (if enabled)
    if (config.enableMonitoring) {
      asg.scaleOnCpuUtilization('cpu-scaling', {
        targetUtilizationPercent: 70,
      });

      asg.scaleOnRequestCount('request-scaling', {
        targetRequestsPerMinute: 1000,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'ALBDomain', {
      value: alb.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `app-runner-ec2-${env}-alb-domain`,
    });

    new cdk.CfnOutput(this, 'ALBURL', {
      value: `http://${alb.loadBalancerDnsName}/api`,
      description: 'API URL',
      exportName: `app-runner-ec2-${env}-api-url`,
    });

    new cdk.CfnOutput(this, 'AutoScalingGroupName', {
      value: asg.autoScalingGroupName,
      description: 'Auto Scaling Group Name',
      exportName: `app-runner-ec2-${env}-asg-name`,
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: apiSecurityGroup.securityGroupId,
      description: 'API Security Group ID',
      exportName: `app-runner-ec2-${env}-sg-id`,
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
      exportName: `app-runner-ec2-${env}-vpc-id`,
    });
  }
}

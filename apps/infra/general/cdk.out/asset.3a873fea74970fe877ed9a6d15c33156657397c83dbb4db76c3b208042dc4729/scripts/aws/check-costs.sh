#!/bin/bash
# AWS Cost and Resource Monitoring Script
# Checks running services, their costs, and identifies unused resources

set -e

PROFILE="${AWS_PROFILE:-default}"
REGION="${AWS_REGION:-ca-central-1}"

echo "=================================================="
echo "🔍 AWS Resource & Cost Monitoring Report"
echo "=================================================="
echo "Profile: $PROFILE"
echo "Region: $REGION"
echo "Date: $(date)"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section header
section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! aws sts get-caller-identity --profile "$PROFILE" &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured or invalid for profile: $PROFILE${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ AWS CLI configured${NC}"
    aws sts get-caller-identity --profile "$PROFILE" --query '[Account, UserId, Arn]' --output text
}

# EC2 Instances
check_ec2() {
    section "📦 EC2 Instances"
    
    local instances=$(aws ec2 describe-instances \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'Reservations[*].Instances[?State.Name!=`terminated`].[InstanceId,InstanceType,State.Name,Tags[?Key==`Name`].Value|[0],LaunchTime]' \
        --output text)
    
    if [ -z "$instances" ]; then
        echo -e "${GREEN}✅ No running EC2 instances${NC}"
    else
        echo -e "${YELLOW}⚠️ Running EC2 instances found:${NC}"
        echo "$instances" | while read -r line; do
            echo "  - $line"
        done
        
        # Calculate approximate cost
        local instance_count=$(echo "$instances" | wc -l | tr -d ' ')
        echo ""
        echo -e "${YELLOW}💰 Estimated cost: ~\$$(echo "$instance_count * 0.02 * 24 * 30" | bc) per month (rough estimate)${NC}"
    fi
}

# RDS Databases
check_rds() {
    section "🗄️ RDS Databases"
    
    local databases=$(aws rds describe-db-instances \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus,Engine,EngineVersion]' \
        --output text 2>/dev/null)
    
    if [ -z "$databases" ]; then
        echo -e "${GREEN}✅ No RDS databases${NC}"
    else
        echo -e "${YELLOW}⚠️ RDS databases found:${NC}"
        echo "$databases" | while read -r line; do
            echo "  - $line"
        done
    fi
}

# Lambda Functions
check_lambda() {
    section "⚡ Lambda Functions"
    
    local functions=$(aws lambda list-functions \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'Functions[*].[FunctionName,Runtime,MemorySize,LastModified]' \
        --output text)
    
    if [ -z "$functions" ]; then
        echo -e "${GREEN}✅ No Lambda functions${NC}"
    else
        local count=$(echo "$functions" | wc -l | tr -d ' ')
        echo -e "${GREEN}✅ Found $count Lambda function(s):${NC}"
        echo "$functions" | while read -r line; do
            echo "  - $line"
        done
        echo ""
        echo -e "💡 Lambda is mostly free tier (1M requests/month, 400k GB-seconds)"
    fi
}

# SQS Queues
check_sqs() {
    section "📮 SQS Queues"
    
    local queues=$(aws sqs list-queues \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'QueueUrls[]' \
        --output text 2>/dev/null)
    
    if [ -z "$queues" ]; then
        echo -e "${GREEN}✅ No SQS queues${NC}"
    else
        echo -e "${GREEN}✅ SQS Queues found:${NC}"
        for queue in $queues; do
            local queue_name=$(basename "$queue")
            local attrs=$(aws sqs get-queue-attributes \
                --profile "$PROFILE" \
                --region "$REGION" \
                --queue-url "$queue" \
                --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
                --output json)
            
            local visible=$(echo "$attrs" | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
            local inflight=$(echo "$attrs" | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // "0"')
            
            echo "  - $queue_name (Messages: $visible, In-flight: $inflight)"
        done
        echo ""
        echo -e "💡 SQS is low cost: \$0.40 per million requests"
    fi
}

# SNS Topics
check_sns() {
    section "📢 SNS Topics"
    
    local topics=$(aws sns list-topics \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'Topics[*].TopicArn' \
        --output text)
    
    if [ -z "$topics" ]; then
        echo -e "${GREEN}✅ No SNS topics${NC}"
    else
        local count=$(echo "$topics" | wc -l | tr -d ' ')
        echo -e "${GREEN}✅ Found $count SNS topic(s):${NC}"
        for topic in $topics; do
            local topic_name=$(basename "$topic")
            local sub_count=$(aws sns list-subscriptions-by-topic \
                --profile "$PROFILE" \
                --region "$REGION" \
                --topic-arn "$topic" \
                --query 'length(Subscriptions)' \
                --output text)
            echo "  - $topic_name (Subscriptions: $sub_count)"
        done
        echo ""
        echo -e "💡 SNS is low cost: \$0.50 per million notifications"
    fi
}

# S3 Buckets
check_s3() {
    section "🪣 S3 Buckets"
    
    local buckets=$(aws s3api list-buckets \
        --profile "$PROFILE" \
        --query 'Buckets[*].[Name,CreationDate]' \
        --output text)
    
    if [ -z "$buckets" ]; then
        echo -e "${GREEN}✅ No S3 buckets${NC}"
    else
        echo -e "${GREEN}✅ S3 Buckets:${NC}"
        echo "$buckets" | while read -r name date; do
            # Get bucket size (this can be slow for large buckets)
            local size=$(aws s3 ls s3://"$name" --recursive --summarize --profile "$PROFILE" 2>/dev/null | grep "Total Size" | awk '{print $3}' || echo "0")
            local size_mb=$(echo "scale=2; $size / 1024 / 1024" | bc 2>/dev/null || echo "0")
            echo "  - $name (Created: $date, Size: ~${size_mb}MB)"
        done
    fi
}

# CloudWatch Log Groups
check_logs() {
    section "📝 CloudWatch Log Groups"
    
    local log_groups=$(aws logs describe-log-groups \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'logGroups[*].[logGroupName,storedBytes]' \
        --output text 2>/dev/null | head -20)
    
    if [ -z "$log_groups" ]; then
        echo -e "${GREEN}✅ No log groups${NC}"
    else
        echo -e "${GREEN}✅ Recent log groups (top 20):${NC}"
        local total_bytes=0
        while read -r name bytes; do
            local size_mb=$(echo "scale=2; $bytes / 1024 / 1024" | bc 2>/dev/null || echo "0")
            echo "  - $name (${size_mb}MB)"
            total_bytes=$((total_bytes + bytes))
        done <<< "$log_groups"
        
        local total_gb=$(echo "scale=2; $total_bytes / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
        echo ""
        echo -e "💰 Approximate storage: ${total_gb}GB (\$0.03 per GB/month)"
    fi
}

# NAT Gateways (expensive!)
check_nat_gateways() {
    section "🌐 NAT Gateways ($$$ Expensive!)"
    
    local nat_gateways=$(aws ec2 describe-nat-gateways \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'NatGateways[?State==`available`].[NatGatewayId,VpcId,SubnetId,CreateTime]' \
        --output text)
    
    if [ -z "$nat_gateways" ]; then
        echo -e "${GREEN}✅ No NAT gateways (good for cost!)${NC}"
    else
        echo -e "${RED}⚠️ WARNING: NAT Gateways are expensive!${NC}"
        echo "$nat_gateways" | while read -r line; do
            echo "  - $line"
        done
        local nat_count=$(echo "$nat_gateways" | wc -l | tr -d ' ')
        echo ""
        echo -e "${RED}💰 Estimated cost: ~\$$(echo "$nat_count * 32 + $nat_count * 0.045 * 100" | bc) per month${NC}"
        echo -e "${YELLOW}   (\$32/month per NAT Gateway + \$0.045/GB data processed)${NC}"
    fi
}

# Elastic IPs (unused)
check_elastic_ips() {
    section "📍 Elastic IPs"
    
    local eips=$(aws ec2 describe-addresses \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'Addresses[*].[PublicIp,InstanceId,AllocationId]' \
        --output text)
    
    if [ -z "$eips" ]; then
        echo -e "${GREEN}✅ No Elastic IPs${NC}"
    else
        echo -e "${YELLOW}⚠️ Elastic IPs found:${NC}"
        local unattached=0
        echo "$eips" | while read -r ip instance_id alloc_id; do
            if [ "$instance_id" == "None" ] || [ -z "$instance_id" ]; then
                echo -e "  - ${RED}$ip (UNATTACHED - costs \$0.005/hour)${NC}"
                ((unattached++)) || true
            else
                echo -e "  - ${GREEN}$ip (attached to $instance_id)${NC}"
            fi
        done
        
        if [ $unattached -gt 0 ]; then
            echo ""
            echo -e "${RED}💰 Unattached EIPs cost: ~\$$(echo "$unattached * 0.005 * 24 * 30" | bc) per month${NC}"
        fi
    fi
}

# EBS Volumes
check_ebs_volumes() {
    section "💾 EBS Volumes"
    
    local volumes=$(aws ec2 describe-volumes \
        --profile "$PROFILE" \
        --region "$REGION" \
        --query 'Volumes[*].[VolumeId,Size,State,Attachments[0].InstanceId]' \
        --output text)
    
    if [ -z "$volumes" ]; then
        echo -e "${GREEN}✅ No EBS volumes${NC}"
    else
        local total_size=0
        local unattached_size=0
        echo -e "${GREEN}✅ EBS Volumes:${NC}"
        while read -r vol_id size state instance_id; do
            total_size=$((total_size + size))
            if [ "$instance_id" == "None" ] || [ -z "$instance_id" ]; then
                echo -e "  - ${YELLOW}$vol_id ${size}GB ($state) UNATTACHED${NC}"
                unattached_size=$((unattached_size + size))
            else
                echo "  - $vol_id ${size}GB ($state) attached to $instance_id"
            fi
        done <<< "$volumes"
        
        echo ""
        echo -e "💰 Total storage: ${total_size}GB (~\$$(echo "$total_size * 0.10" | bc) per month)"
        if [ $unattached_size -gt 0 ]; then
            echo -e "${YELLOW}⚠️ Unattached volumes: ${unattached_size}GB (consider deleting if unused)${NC}"
        fi
    fi
}

# Cost Explorer (last 30 days)
check_costs() {
    section "💰 AWS Cost Report (Last 30 Days)"
    
    local start_date=$(date -u -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)
    local end_date=$(date -u +%Y-%m-%d)
    
    local cost=$(aws ce get-cost-and-usage \
        --profile "$PROFILE" \
        --time-period Start="$start_date",End="$end_date" \
        --granularity MONTHLY \
        --metrics "UnblendedCost" \
        --query 'ResultsByTime[0].Total.UnblendedCost.[Amount,Unit]' \
        --output text 2>/dev/null)
    
    if [ -n "$cost" ]; then
        local amount=$(echo "$cost" | awk '{print $1}')
        local unit=$(echo "$cost" | awk '{print $2}')
        echo -e "${YELLOW}💵 Total cost (last 30 days): \$$(printf "%.2f" "$amount") $unit${NC}"
        
        # Cost by service
        echo ""
        echo "Cost breakdown by service:"
        aws ce get-cost-and-usage \
            --profile "$PROFILE" \
            --time-period Start="$start_date",End="$end_date" \
            --granularity MONTHLY \
            --metrics "UnblendedCost" \
            --group-by Type=DIMENSION,Key=SERVICE \
            --query 'ResultsByTime[0].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
            --output text 2>/dev/null | \
            sort -t$'\t' -k2 -rn | \
            head -10 | \
            while read -r service cost; do
                printf "  - %-40s \$%8.2f\n" "$service" "$cost"
            done
    else
        echo -e "${YELLOW}⚠️ Unable to fetch cost data (may need Cost Explorer API access)${NC}"
    fi
}

# Main execution
main() {
    check_aws_cli
    check_ec2
    check_rds
    check_nat_gateways  # Check this early as it's expensive
    check_elastic_ips
    check_ebs_volumes
    check_lambda
    check_sqs
    check_sns
    check_s3
    check_logs
    check_costs
    
    echo ""
    section "✅ Report Complete"
    echo ""
    echo "💡 Recommendations:"
    echo "  1. Stop unused EC2 instances"
    echo "  2. Delete unattached EBS volumes"
    echo "  3. Release unattached Elastic IPs"
    echo "  4. Delete unused NAT Gateways (very expensive!)"
    echo "  5. Clean up old CloudWatch logs"
    echo "  6. Review S3 bucket lifecycle policies"
    echo ""
}

main

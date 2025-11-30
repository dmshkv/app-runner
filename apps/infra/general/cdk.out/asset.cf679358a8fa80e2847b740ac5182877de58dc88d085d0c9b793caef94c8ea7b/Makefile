.PHONY: help aws-init aws-status aws-backup aws-logs build deploy-dev deploy-prod docker-build docker-push lint test cdk-build cdk-diff cdk-deploy cdk-destroy

# Color output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Available Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-30s$(NC) %s\n", $$1, $$2}'

# AWS Commands
aws-init: ## Initialize AWS environment variables (e.g., make aws-init ENV=dev)
	@./scripts/aws/init-env.sh $${AWS_PROFILE:-default} $(ENV)
	@echo "$(GREEN)✓ Environment initialized$(NC)"

aws-status: ## Show AWS infrastructure status
	@echo "$(BLUE)Database Status:$(NC)"
	@./scripts/aws/db-commands.sh status $${AWS_PROFILE:-default}
	@echo ""
	@echo "$(BLUE)AWS Account:$(NC)"
	@aws sts get-caller-identity --profile $${AWS_PROFILE:-default} --output table

aws-backup: ## Create RDS backup
	@./scripts/aws/db-commands.sh backup $${AWS_PROFILE:-default}
	@echo "$(GREEN)✓$(NC) Backup created"

aws-backups: ## List recent backups
	@./scripts/aws/db-commands.sh backups $${AWS_PROFILE:-default}

aws-info: ## Show detailed AWS info
	@./scripts/aws/db-commands.sh info $${AWS_PROFILE:-default}

aws-logs: ## Show database logs
	@./scripts/aws/db-commands.sh logs $${AWS_PROFILE:-default}

# Build & Test Commands
lint: ## Run ESLint on all apps
	@echo "$(BLUE)Running ESLint...$(NC)"
	@npx nx run-many -t lint

test: ## Run tests for all projects
	@echo "$(BLUE)Running Tests...$(NC)"
	@npx nx run-many -t test --passWithNoTests

build: ## Build all NX projects
	@echo "$(BLUE)Building projects...$(NC)"
	@npx nx run-many -t build

# Docker & ECR Commands
docker-build: ## Build Docker images locally
	@echo "$(BLUE)Building Docker image for API only...$(NC)"
	@docker build -f apps/api/general/Dockerfile -t app-runner-api:latest .
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-push-dev: ## Push images to ECR with dev tag
	@echo "$(BLUE)Pushing API to ECR (dev)...$(NC)"
	@./scripts/aws/ecr-push.sh api $${AWS_PROFILE:-default} dev
	@echo "$(GREEN)✓ API image pushed$(NC)"

docker-push-prod: ## Push images to ECR with prod tag
	@echo "$(BLUE)Pushing API to ECR (prod)...$(NC)"
	@./scripts/aws/ecr-push.sh api $${AWS_PROFILE:-default} latest
	@echo "$(GREEN)✓ API image pushed$(NC)"

# CDK Infrastructure Commands
cdk-build: ## Build CDK infrastructure code
	@echo "$(BLUE)Building CDK infrastructure...$(NC)"
	@cd apps/infra/general && npm run build
	@echo "$(GREEN)✓ CDK build complete$(NC)"

cdk-diff: ## Show CDK diff for environment (e.g., make cdk-diff ENV=dev)
	@echo "$(BLUE)CDK Diff for environment: $(ENV)$(NC)"
	@./scripts/aws/cdk-diff.sh $${ENV:-dev}

cdk-deploy: ## Deploy CDK stack for environment (e.g., make cdk-deploy ENV=dev)
	@echo "$(BLUE)Deploying CDK stack: $(ENV)$(NC)"
	@./scripts/aws/cdk-deploy.sh $${ENV:-dev}

cdk-destroy: ## Destroy CDK stack for environment (e.g., make cdk-destroy ENV=dev)
	@echo "$(YELLOW)Destroying CDK stack: $(ENV)$(NC)"
	@./scripts/aws/cdk-destroy.sh $${ENV:-dev}

# EC2 Infrastructure Commands
ec2-deploy: ## Deploy EC2 infrastructure (e.g., make ec2-deploy ENV=dev)
	@echo "$(BLUE)Deploying EC2 infrastructure: $(ENV)$(NC)"
	@./scripts/aws/cdk-deploy-ec2.sh $${ENV:-dev}

ec2-update: ## Update EC2 instances with new image (e.g., make ec2-update ENV=dev)
	@echo "$(BLUE)Updating EC2 instances: $(ENV)$(NC)"
	@./scripts/aws/ec2-update.sh $${ENV:-dev} rolling

ec2-update-fast: ## Update all EC2 instances at once (e.g., make ec2-update-fast ENV=dev)
	@echo "$(YELLOW)Updating all EC2 instances simultaneously: $(ENV)$(NC)"
	@./scripts/aws/ec2-update.sh $${ENV:-dev} all-at-once

ec2-health: ## Check EC2 deployment health (e.g., make ec2-health ENV=dev)
	@echo "$(BLUE)Checking EC2 health: $(ENV)$(NC)"
	@./scripts/aws/ec2-health.sh $${ENV:-dev}

ec2-full-deploy: build docker-push-dev ec2-deploy ec2-update ## Full EC2 deployment pipeline
	@echo "$(GREEN)✓ Full EC2 deployment complete!$(NC)"

# Deploy Commands
deploy-dev: build docker-push-dev ## Build and deploy to dev
	@echo "$(GREEN)✓ Dev API deployment artifacts ready$(NC)"

deploy-prod: build docker-push-prod ## Build and deploy to prod
	@echo "$(YELLOW)Prod deployment is currently disabled. Contact admin for instructions.$(NC)"
	@exit 1

# Local Development
dev: ## Start local development (docker-compose)
	@echo "$(BLUE)Starting local development environment...$(NC)"
	@docker compose up -d
	@echo "$(GREEN)✓ Services running$(NC)"
	@echo "   API:  http://localhost:3000/api"
	@echo "   Web:  http://localhost:3001"

dev-down: ## Stop local development services
	@echo "$(BLUE)Stopping services...$(NC)"
	@docker compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

dev-logs: ## Show local development logs
	@docker compose logs -f

# CI/CD Integration
ci-test: lint test ## Run all CI tests
	@echo "$(GREEN)✓ All CI tests passed$(NC)"

ci-build: build ## Build all projects for CI
	@echo "$(GREEN)✓ Build successful$(NC)"

# Cleanup
clean: ## Remove build artifacts and containers
	@echo "$(BLUE)Cleaning up...$(NC)"
	@rm -rf dist node_modules
	@docker compose down --volumes
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

# Utils
check-env: ## Validate environment setup
	@echo "$(BLUE)Checking environment...$(NC)"
	@command -v aws >/dev/null 2>&1 && echo "$(GREEN)✓$(NC) AWS CLI" || echo "$(YELLOW)✗$(NC) AWS CLI not found"
	@command -v docker >/dev/null 2>&1 && echo "$(GREEN)✓$(NC) Docker" || echo "$(YELLOW)✗$(NC) Docker not found"
	@command -v npx >/dev/null 2>&1 && echo "$(GREEN)✓$(NC) Node.js/npm" || echo "$(YELLOW)✗$(NC) Node.js not found"
	@aws sts get-caller-identity --profile $${AWS_PROFILE:-default} >/dev/null 2>&1 && echo "$(GREEN)✓$(NC) AWS credentials" || echo "$(YELLOW)✗$(NC) AWS credentials not found"

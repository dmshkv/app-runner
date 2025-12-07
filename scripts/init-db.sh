#!/bin/bash

# Database Initialization Script for Scraping System
# This script starts PostgreSQL in Docker and runs migrations

set -e

echo "🗄️  Initializing PostgreSQL Database..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database configuration
DB_CONTAINER_NAME="postgres-app-runner"
DB_NAME="app_runner"
DB_USER="username"
DB_PASSWORD="password"
DB_PORT="5432"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Checking for existing PostgreSQL container...${NC}"

# Check if container exists
if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER_NAME}$"; then
    echo -e "${YELLOW}Container ${DB_CONTAINER_NAME} exists.${NC}"
    
    # Check if it's running
    if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER_NAME}$"; then
        echo -e "${GREEN}✅ PostgreSQL is already running${NC}"
    else
        echo -e "${YELLOW}🚀 Starting existing PostgreSQL container...${NC}"
        docker start ${DB_CONTAINER_NAME}
        echo -e "${GREEN}✅ PostgreSQL started${NC}"
    fi
else
    echo -e "${YELLOW}🚀 Creating new PostgreSQL container...${NC}"
    docker run -d \
        --name ${DB_CONTAINER_NAME} \
        -e POSTGRES_USER=${DB_USER} \
        -e POSTGRES_PASSWORD=${DB_PASSWORD} \
        -e POSTGRES_DB=${DB_NAME} \
        -p ${DB_PORT}:5432 \
        -v postgres-app-runner-data:/var/lib/postgresql/data \
        postgres:15-alpine
    
    echo -e "${GREEN}✅ PostgreSQL container created${NC}"
fi

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
sleep 3

# Check if we can connect
MAX_RETRIES=30
RETRY_COUNT=0
until docker exec ${DB_CONTAINER_NAME} pg_isready -U ${DB_USER} > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}❌ PostgreSQL failed to start within expected time${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Waiting for PostgreSQL... (${RETRY_COUNT}/${MAX_RETRIES})${NC}"
    sleep 1
done

echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Run migrations
echo -e "${YELLOW}📝 Running database migrations...${NC}"

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Function to run a migration file
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file")
    
    echo -e "${YELLOW}  Running: ${migration_name}${NC}"
    
    if docker exec -i ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} < "$migration_file"; then
        echo -e "${GREEN}  ✅ ${migration_name} completed${NC}"
    else
        echo -e "${RED}  ❌ ${migration_name} failed${NC}"
        return 1
    fi
}

# Run migrations in order
for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        run_migration "$migration_file" || exit 1
    fi
done

echo -e "${GREEN}✅ All migrations completed successfully${NC}"

# Display connection information
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}PostgreSQL Database is ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Database:     ${GREEN}${DB_NAME}${NC}"
echo -e "User:         ${GREEN}${DB_USER}${NC}"
echo -e "Port:         ${GREEN}${DB_PORT}${NC}"
echo -e "Connection:   ${GREEN}${DATABASE_URL}${NC}"
echo ""
echo -e "${YELLOW}💡 Usage:${NC}"
echo -e "   Start app:     ${GREEN}cd apps/api/process && npm run start:dev${NC}"
echo -e "   View logs:     ${GREEN}docker logs -f ${DB_CONTAINER_NAME}${NC}"
echo -e "   Stop DB:       ${GREEN}docker stop ${DB_CONTAINER_NAME}${NC}"
echo -e "   Connect psql:  ${GREEN}docker exec -it ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME}${NC}"
echo ""
echo -e "${YELLOW}📊 Verify tables:${NC}"
echo -e "   ${GREEN}docker exec -it ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -c \"\\dt\"${NC}"
echo ""

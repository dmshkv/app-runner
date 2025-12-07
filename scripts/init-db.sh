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

# Check if database has existing data
echo -e "${YELLOW}🔍 Checking database state...${NC}"
TABLE_COUNT=$(docker exec ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

if [ ! -z "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Database already contains ${TABLE_COUNT} tables!${NC}"
    echo -e "${YELLOW}Tables found:${NC}"
    docker exec ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -c "\dt" 2>/dev/null | grep -E "^ public \|" || true
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  SAFETY CHECK: Existing data detected!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}Running migrations on an existing database may:${NC}"
    echo -e "  - Fail if tables already exist (safe)"
    echo -e "  - Modify existing data structures"
    echo -e "  - Potentially cause data loss if migrations conflict"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo -e "  1. Skip migrations (press 's' or just Enter)"
    echo -e "  2. Run migrations anyway (press 'r') - USE WITH CAUTION"
    echo -e "  3. Exit and review manually (press 'q')"
    echo ""
    read -p "Your choice [s/r/q]: " -n 1 -r MIGRATION_CHOICE
    echo ""
    
    case $MIGRATION_CHOICE in
        r|R)
            echo -e "${YELLOW}⚠️  Proceeding with migrations on existing database...${NC}"
            RUN_MIGRATIONS=true
            ;;
        q|Q)
            echo -e "${YELLOW}Exiting. Database is running but migrations were not applied.${NC}"
            exit 0
            ;;
        *)
            echo -e "${GREEN}✅ Skipping migrations. Database is ready to use.${NC}"
            RUN_MIGRATIONS=false
            ;;
    esac
else
    echo -e "${GREEN}✅ Fresh database detected (0 tables). Will run migrations.${NC}"
    RUN_MIGRATIONS=true
fi

# Run migrations if approved
if [ "$RUN_MIGRATIONS" = true ]; then
    echo -e "${YELLOW}📝 Running database migrations...${NC}"
    
    MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/migrations"
    
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        echo -e "${RED}❌ Migrations directory not found: $MIGRATIONS_DIR${NC}"
        exit 1
    fi
    
    # Create migration tracking table if it doesn't exist
    docker exec ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -c "
    CREATE TABLE IF NOT EXISTS _migration_history (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );" > /dev/null 2>&1
    
    # Function to check if migration was already applied
    migration_applied() {
        local migration_name=$1
        local count=$(docker exec ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM _migration_history WHERE migration_name = '${migration_name}';" 2>/dev/null | tr -d ' ')
        [ "$count" -gt 0 ]
    }
    
    # Function to run a migration file
    run_migration() {
        local migration_file=$1
        local migration_name=$(basename "$migration_file")
        
        if migration_applied "$migration_name"; then
            echo -e "${YELLOW}  ⏭️  Skipping: ${migration_name} (already applied)${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}  Running: ${migration_name}${NC}"
        
        if docker exec -i ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} < "$migration_file" 2>&1; then
            # Record successful migration
            docker exec ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -c "INSERT INTO _migration_history (migration_name) VALUES ('${migration_name}');" > /dev/null 2>&1
            echo -e "${GREEN}  ✅ ${migration_name} completed${NC}"
        else
            echo -e "${RED}  ❌ ${migration_name} failed${NC}"
            echo -e "${YELLOW}  Note: If error is 'relation already exists', this is likely safe.${NC}"
            return 1
        fi
    }
    
    # Run migrations in order
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            run_migration "$migration_file" || {
                echo -e "${YELLOW}Migration failed. Continue anyway? [y/N]: ${NC}"
                read -n 1 -r CONTINUE
                echo ""
                if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            }
        fi
    done
    
    echo -e "${GREEN}✅ All migrations completed successfully${NC}"
fi

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

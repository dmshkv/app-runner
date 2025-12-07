#!/bin/bash

# Test script for Process API
# Usage: ./test-api.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000/api}"

echo "🧪 Testing Process API"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Initiate Process
echo -e "${BLUE}Test 1: Initiate Process${NC}"
echo "POST $BASE_URL/process/initiate"

RESPONSE=$(curl -s -X POST "$BASE_URL/process/initiate" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://example.com",
        "selectors": {
          "title": "h1",
          "content": "article"
        },
        "options": {
          "screenshot": true,
          "waitForNetworkIdle": true
        }
      },
      {
        "url": "https://example.org",
        "selectors": {
          "title": ".page-title",
          "description": ".description"
        }
      }
    ],
    "metadata": {
      "source": "test-script",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }')

echo "$RESPONSE" | jq '.'
PROCESS_ID=$(echo "$RESPONSE" | jq -r '.processId')

if [ "$PROCESS_ID" != "null" ] && [ "$PROCESS_ID" != "" ]; then
  echo -e "${GREEN}✓ Process created: $PROCESS_ID${NC}"
else
  echo -e "${RED}✗ Failed to create process${NC}"
  exit 1
fi
echo ""

# Test 2: Get Process Status
echo -e "${BLUE}Test 2: Get Process Status${NC}"
echo "GET $BASE_URL/process/$PROCESS_ID"

sleep 1

RESPONSE=$(curl -s -X GET "$BASE_URL/process/$PROCESS_ID")
echo "$RESPONSE" | jq '.'

STATUS=$(echo "$RESPONSE" | jq -r '.status')
echo -e "Status: ${GREEN}$STATUS${NC}"
echo -e "Progress: $(echo "$RESPONSE" | jq -r '.progress.completed')/$(echo "$RESPONSE" | jq -r '.progress.total') ($(echo "$RESPONSE" | jq -r '.progress.percentage')%)"
echo ""

# Test 3: Poll for completion (max 10 times)
echo -e "${BLUE}Test 3: Poll for Completion${NC}"
for i in {1..10}; do
  RESPONSE=$(curl -s -X GET "$BASE_URL/process/$PROCESS_ID")
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  COMPLETED=$(echo "$RESPONSE" | jq -r '.progress.completed')
  TOTAL=$(echo "$RESPONSE" | jq -r '.progress.total')
  PERCENTAGE=$(echo "$RESPONSE" | jq -r '.progress.percentage')
  
  echo "Poll $i: Status=$STATUS, Progress=$COMPLETED/$TOTAL ($PERCENTAGE%)"
  
  if [ "$STATUS" == "completed" ] || [ "$STATUS" == "failed" ]; then
    echo -e "${GREEN}✓ Process finished${NC}"
    echo "$RESPONSE" | jq '.results[] | {url: .url, status: .status, hasData: (.data != null)}'
    break
  fi
  
  sleep 2
done
echo ""

# Test 4: List All Processes
echo -e "${BLUE}Test 4: List All Processes${NC}"
echo "GET $BASE_URL/process"

RESPONSE=$(curl -s -X GET "$BASE_URL/process")
echo "$RESPONSE" | jq '.[0:3]'
echo ""

# Test 5: Get Process Statistics
echo -e "${BLUE}Test 5: Get Process Statistics${NC}"
echo "GET $BASE_URL/process/stats/summary"

RESPONSE=$(curl -s -X GET "$BASE_URL/process/stats/summary")
echo "$RESPONSE" | jq '.'
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Process ID for reference: $PROCESS_ID"

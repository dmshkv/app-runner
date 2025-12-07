#!/bin/bash

# Strategy-Based Crawling Test Script
# Tests FULL_HTML and TEMPLATE strategies end-to-end

set -e

API_URL="${API_URL:-http://localhost:3000}"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}╔════════════════════════════════════════════════╗${COLOR_RESET}"
echo -e "${COLOR_BLUE}║   Strategy-Based Crawling Test Suite          ║${COLOR_RESET}"
echo -e "${COLOR_BLUE}╚════════════════════════════════════════════════╝${COLOR_RESET}"
echo ""
echo "API URL: $API_URL"
echo ""

# Function to print test results
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${COLOR_GREEN}✓ $2${COLOR_RESET}"
  else
    echo -e "${COLOR_RED}✗ $2${COLOR_RESET}"
    exit 1
  fi
}

# Function to wait for process completion
wait_for_completion() {
  local process_id=$1
  local max_wait=${2:-120}  # Default 2 minutes
  local waited=0
  
  echo -e "${COLOR_YELLOW}⏳ Waiting for process to complete...${COLOR_RESET}"
  
  while [ $waited -lt $max_wait ]; do
    response=$(curl -s "$API_URL/api/process/query/$process_id")
    status=$(echo "$response" | jq -r '.status')
    
    if [ "$status" = "COMPLETED" ] || [ "$status" = "FAILED" ]; then
      echo -e "${COLOR_GREEN}✓ Process $status after ${waited}s${COLOR_RESET}"
      echo "$response"
      return 0
    fi
    
    progress=$(echo "$response" | jq -r '.progress.percentage')
    echo -e "${COLOR_BLUE}  Progress: ${progress}%${COLOR_RESET}"
    
    sleep 5
    waited=$((waited + 5))
  done
  
  echo -e "${COLOR_RED}✗ Timeout waiting for process${COLOR_RESET}"
  return 1
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Submit URL with selectors (FULL_HTML → TEMPLATE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -X POST "$API_URL/api/process/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://example.com",
        "selectors": {
          "heading": "h1",
          "paragraphs": "p"
        },
        "options": {
          "timeout": 30000
        }
      }
    ]
  }')

process_id_1=$(echo "$response" | jq -r '.processId')
print_result $? "Process created with ID: $process_id_1"

# Wait and check results
wait_for_completion "$process_id_1" 120
final_response=$(curl -s "$API_URL/api/process/query/$process_id_1")

# Verify FULL_HTML strategy result exists
full_html_exists=$(echo "$final_response" | jq '.results[0].strategy.fullHtml.cleanedHtml' | grep -c "html")
print_result $full_html_exists "FULL_HTML result exists"

# Verify TEMPLATE strategy result exists
template_exists=$(echo "$final_response" | jq '.results[0].strategy.template.extracted' | grep -c "heading")
print_result $template_exists "TEMPLATE result exists"

# Verify both strategies completed
current_strategy=$(echo "$final_response" | jq -r '.results[0].strategy.current')
[ "$current_strategy" = "TEMPLATE" ]
print_result $? "Current strategy is TEMPLATE (both completed)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Submit URL without selectors (FULL_HTML only)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -X POST "$API_URL/api/process/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://example.com"
      }
    ]
  }')

process_id_2=$(echo "$response" | jq -r '.processId')
print_result $? "Process created with ID: $process_id_2"

# Wait and check results
wait_for_completion "$process_id_2" 120
final_response=$(curl -s "$API_URL/api/process/query/$process_id_2")

# Verify FULL_HTML strategy result exists
full_html_exists=$(echo "$final_response" | jq '.results[0].strategy.fullHtml.cleanedHtml' | grep -c "html")
print_result $full_html_exists "FULL_HTML result exists"

# Verify TEMPLATE strategy does NOT exist
template_not_exists=$(echo "$final_response" | jq '.results[0].strategy.template' | grep -c "null")
print_result $template_not_exists "TEMPLATE result does not exist (as expected)"

# Verify strategy is FULL_HTML (not TEMPLATE)
current_strategy=$(echo "$final_response" | jq -r '.results[0].strategy.current')
[ "$current_strategy" = "FULL_HTML" ]
print_result $? "Current strategy is FULL_HTML (completed)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Multiple URLs with mixed strategies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -X POST "$API_URL/api/process/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://example.com",
        "selectors": {
          "title": "h1"
        }
      },
      {
        "url": "https://example.org"
      },
      {
        "url": "https://example.net",
        "selectors": {
          "content": "p"
        }
      }
    ]
  }')

process_id_3=$(echo "$response" | jq -r '.processId')
total_urls=$(echo "$response" | jq -r '.totalUrls')
[ "$total_urls" = "3" ]
print_result $? "Process created with 3 URLs: $process_id_3"

# Wait and check results
wait_for_completion "$process_id_3" 180
final_response=$(curl -s "$API_URL/api/process/query/$process_id_3")

# Verify all URLs processed
completed=$(echo "$final_response" | jq -r '.progress.completed')
[ "$completed" = "3" ]
print_result $? "All 3 URLs completed"

# Verify first URL has both strategies (has selectors)
url1_template=$(echo "$final_response" | jq '.results[0].strategy.template')
[ "$url1_template" != "null" ]
print_result $? "URL 1 has TEMPLATE result"

# Verify second URL has only FULL_HTML (no selectors)
url2_template=$(echo "$final_response" | jq '.results[1].strategy.template')
[ "$url2_template" = "null" ]
print_result $? "URL 2 has no TEMPLATE result"

# Verify third URL has both strategies (has selectors)
url3_template=$(echo "$final_response" | jq '.results[2].strategy.template')
[ "$url3_template" != "null" ]
print_result $? "URL 3 has TEMPLATE result"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Verify HTML cleaning"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get cleaned HTML from previous test
cleaned_html=$(curl -s "$API_URL/api/process/query/$process_id_2" | jq -r '.results[0].strategy.fullHtml.cleanedHtml')

# Verify no <script> tags
script_count=$(echo "$cleaned_html" | grep -c "<script" || true)
[ "$script_count" = "0" ]
print_result $? "No <script> tags in cleaned HTML"

# Verify no <style> tags
style_count=$(echo "$cleaned_html" | grep -c "<style" || true)
[ "$style_count" = "0" ]
print_result $? "No <style> tags in cleaned HTML"

# Verify no inline styles
inline_style_count=$(echo "$cleaned_html" | grep -c 'style="' || true)
[ "$inline_style_count" = "0" ]
print_result $? "No inline style attributes in cleaned HTML"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Query process list"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s "$API_URL/api/process/list")
process_count=$(echo "$response" | jq '. | length')
[ "$process_count" -ge "3" ]
print_result $? "Process list shows at least 3 processes"

# Verify completed status
completed_count=$(echo "$response" | jq '[.[] | select(.status == "COMPLETED")] | length')
[ "$completed_count" -ge "2" ]
print_result $? "At least 2 processes are COMPLETED"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Get process statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s "$API_URL/api/process/stats")
total=$(echo "$response" | jq -r '.total')
completed=$(echo "$response" | jq -r '.completed')

[ "$total" -ge "3" ]
print_result $? "Total processes: $total"

[ "$completed" -ge "2" ]
print_result $? "Completed processes: $completed"

echo ""
echo -e "${COLOR_GREEN}╔════════════════════════════════════════════════╗${COLOR_RESET}"
echo -e "${COLOR_GREEN}║   All Tests Passed! ✓                          ║${COLOR_RESET}"
echo -e "${COLOR_GREEN}╚════════════════════════════════════════════════╝${COLOR_RESET}"
echo ""
echo "Test Summary:"
echo "  ✓ FULL_HTML → TEMPLATE workflow"
echo "  ✓ FULL_HTML only workflow"
echo "  ✓ Multiple URLs with mixed strategies"
echo "  ✓ HTML cleaning verification"
echo "  ✓ Process listing"
echo "  ✓ Process statistics"
echo ""
echo "Strategy-based crawling is working correctly!"

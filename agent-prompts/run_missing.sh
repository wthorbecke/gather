#!/bin/bash

# Run missing agents autonomously
# - Code-only agents run in parallel
# - Playwright agents run sequentially (to avoid MCP conflicts)
# - Uses --dangerously-skip-permissions for full autonomy

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_DIR/reports"
LOGS_DIR="$REPORTS_DIR/.logs"

mkdir -p "$LOGS_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

run_agent() {
    local num=$1
    local name=$2
    echo -e "${BLUE}[Agent $num] Starting: $name${NC}"
    (
        cd "$PROJECT_DIR"
        claude --dangerously-skip-permissions -p "$(cat "$SCRIPT_DIR/agent${num}_${name}.md")" 2>&1
    ) > "$LOGS_DIR/agent${num}.log"
    local code=$?
    if [[ $code -eq 0 ]]; then
        echo -e "${GREEN}[Agent $num] ✓ Done: $name${NC}"
    else
        echo -e "${RED}[Agent $num] ✗ Failed: $name${NC}"
    fi
    return $code
}

echo -e "${BLUE}=== Running Missing Agents ===${NC}"
echo ""

# Phase 1: Code-only agents (parallel)
echo -e "${YELLOW}Phase 1: Code analysis (parallel)${NC}"
run_agent "01" "info_architecture" &
PID1=$!
run_agent "07" "code_quality" &
PID7=$!

wait $PID1
wait $PID7
echo ""

# Phase 2: Playwright agents (sequential)
echo -e "${YELLOW}Phase 2: Browser agents (sequential)${NC}"
run_agent "05" "adhd_ux"
sleep 2
run_agent "08" "competitive_analysis"
sleep 2
run_agent "09" "first_time_experience"
sleep 2
run_agent "10" "delight_emotion"

echo ""
echo -e "${GREEN}=== Complete ===${NC}"
echo "Reports:"
ls -la "$REPORTS_DIR"/*.md 2>/dev/null

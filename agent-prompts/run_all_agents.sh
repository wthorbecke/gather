#!/bin/bash

# =============================================================================
# Gather App Analysis - Multi-Agent Runner
# =============================================================================
# This script runs 10 specialized agents in parallel to analyze every aspect
# of the app, then runs a synthesizer to consolidate findings.
#
# Prerequisites:
# - Claude Code CLI installed and authenticated
# - App running at localhost:3000
# - Chrome closed (for Playwright MCP)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROMPTS_DIR="$(dirname "$0")"
REPORTS_DIR="./reports"
MAX_PARALLEL=5  # Adjust based on your machine

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Gather App Multi-Agent Analysis${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI not found. Install it first.${NC}"
    exit 1
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ App running at localhost:3000${NC}"
else
    echo -e "${RED}✗ App not running at localhost:3000${NC}"
    echo -e "${YELLOW}  Start your app first: npm run dev${NC}"
    exit 1
fi

# Check if Chrome is running (Playwright conflict)
if pgrep -x "Google Chrome" > /dev/null; then
    echo -e "${YELLOW}⚠ Chrome is running. Playwright MCP may conflict.${NC}"
    echo -e "${YELLOW}  Consider closing Chrome for best results.${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create reports directory
mkdir -p "$REPORTS_DIR"
echo -e "${GREEN}✓ Reports directory: $REPORTS_DIR${NC}"
echo ""

# Function to run an agent
run_agent() {
    local agent_num=$1
    local agent_name=$2
    local prompt_file="${PROMPTS_DIR}/agent${agent_num}_${agent_name}.md"
    
    if [[ ! -f "$prompt_file" ]]; then
        echo -e "${RED}Error: Prompt file not found: $prompt_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Starting Agent $agent_num: $agent_name${NC}"
    
    # Run claude with the prompt
    claude --print "$(cat "$prompt_file")" > "${REPORTS_DIR}/.agent${agent_num}.log" 2>&1
    
    local exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}✓ Agent $agent_num ($agent_name) complete${NC}"
    else
        echo -e "${RED}✗ Agent $agent_num ($agent_name) failed${NC}"
    fi
    
    return $exit_code
}

# Agent definitions
declare -A AGENTS=(
    ["01"]="info_architecture"
    ["02"]="interaction_design"
    ["03"]="visual_design"
    ["04"]="animation_motion"
    ["05"]="adhd_ux"
    ["06"]="ai_integration"
    ["07"]="code_quality"
    ["08"]="competitive_analysis"
    ["09"]="first_time_experience"
    ["10"]="delight_emotion"
)

echo -e "${YELLOW}Starting ${#AGENTS[@]} agents...${NC}"
echo -e "${YELLOW}(Running up to $MAX_PARALLEL in parallel)${NC}"
echo ""

# Track PIDs and results
declare -A PIDS
declare -A RESULTS
RUNNING=0

# Start agents with parallelism control
for agent_num in $(echo "${!AGENTS[@]}" | tr ' ' '\n' | sort); do
    agent_name="${AGENTS[$agent_num]}"
    
    # Wait if we've hit max parallel
    while [[ $RUNNING -ge $MAX_PARALLEL ]]; do
        for pid in "${!PIDS[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                wait "$pid"
                RESULTS[${PIDS[$pid]}]=$?
                unset PIDS[$pid]
                ((RUNNING--))
            fi
        done
        sleep 1
    done
    
    # Start agent in background
    (
        claude --print "$(cat "${PROMPTS_DIR}/agent${agent_num}_${agent_name}.md")" \
            > "${REPORTS_DIR}/.agent${agent_num}.log" 2>&1
    ) &
    
    PIDS[$!]="$agent_num:$agent_name"
    ((RUNNING++))
    echo -e "${BLUE}▶ Started Agent $agent_num: $agent_name (PID: $!)${NC}"
done

# Wait for all remaining agents
echo ""
echo -e "${YELLOW}Waiting for all agents to complete...${NC}"

for pid in "${!PIDS[@]}"; do
    wait "$pid"
    RESULTS[${PIDS[$pid]}]=$?
done

# Report results
echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Agent Results${NC}"
echo -e "${BLUE}=========================================${NC}"

FAILED=0
for agent in $(echo "${!RESULTS[@]}" | tr ' ' '\n' | sort); do
    if [[ ${RESULTS[$agent]} -eq 0 ]]; then
        echo -e "${GREEN}✓ $agent${NC}"
    else
        echo -e "${RED}✗ $agent${NC}"
        ((FAILED++))
    fi
done

# Check for generated reports
echo ""
echo -e "${YELLOW}Generated reports:${NC}"
ls -la "$REPORTS_DIR"/*.md 2>/dev/null || echo "No reports generated yet"

if [[ $FAILED -gt 0 ]]; then
    echo ""
    echo -e "${RED}$FAILED agents failed. Check logs in $REPORTS_DIR/.agent*.log${NC}"
fi

# Run synthesizer
echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Running Synthesizer${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

read -p "Run synthesizer now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Running synthesizer...${NC}"
    claude --print "$(cat "${PROMPTS_DIR}/agent_synthesizer.md")"
    echo -e "${GREEN}✓ Synthesis complete${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Analysis Complete${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Reports saved to: $REPORTS_DIR/"
echo ""
echo "Key files:"
echo "  - Individual reports: ${REPORTS_DIR}/01_*.md through 10_*.md"
echo "  - Master synthesis: ${REPORTS_DIR}/MASTER_SYNTHESIS.md"
echo ""

#!/bin/bash

# =============================================================================
# Gather App Analysis - Sequential Runner (Simpler)
# =============================================================================
# Runs each agent one at a time. More reliable, easier to debug.
# =============================================================================

PROMPTS_DIR="$(dirname "$0")"
REPORTS_DIR="./reports"

mkdir -p "$REPORTS_DIR"

echo "========================================="
echo "  Gather App Analysis"
echo "========================================="
echo ""
echo "This will run 10 agents sequentially."
echo "Each agent takes 2-5 minutes."
echo "Total time: ~30-50 minutes"
echo ""
echo "Make sure:"
echo "  1. App is running at localhost:3000"
echo "  2. Chrome is closed (for Playwright)"
echo ""
read -p "Ready to start? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Run each agent
run_agent() {
    local num=$1
    local name=$2
    local file="${PROMPTS_DIR}/agent${num}_${name}.md"
    
    echo ""
    echo "========================================="
    echo "  Agent $num: $name"
    echo "========================================="
    
    if [[ ! -f "$file" ]]; then
        echo "ERROR: $file not found"
        return 1
    fi
    
    cd /path/to/your/gather/app  # CHANGE THIS
    claude "$(cat "$file")"
    
    echo ""
    echo "✓ Agent $num complete"
    echo "  Report: ${REPORTS_DIR}/${num}_${name//_/ }.md"
}

# Run all agents
run_agent "01" "info_architecture"
run_agent "02" "interaction_design"
run_agent "03" "visual_design"
run_agent "04" "animation_motion"
run_agent "05" "adhd_ux"
run_agent "06" "ai_integration"
run_agent "07" "code_quality"
run_agent "08" "competitive_analysis"
run_agent "09" "first_time_experience"
run_agent "10" "delight_emotion"

echo ""
echo "========================================="
echo "  All Agents Complete"
echo "========================================="
echo ""
echo "Now running synthesizer..."
echo ""

claude "$(cat "${PROMPTS_DIR}/agent_synthesizer.md")"

echo ""
echo "========================================="
echo "  DONE"
echo "========================================="
echo ""
echo "Reports in: $REPORTS_DIR/"
echo "Master synthesis: ${REPORTS_DIR}/MASTER_SYNTHESIS.md"

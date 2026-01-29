#!/bin/bash

# =============================================================================
# Gather App Analysis - Simple Parallel Runner
# =============================================================================
# Works with macOS default bash
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(pwd)"
REPORTS_DIR="${PROJECT_DIR}/reports"

mkdir -p "$REPORTS_DIR"

echo ""
echo "========================================="
echo "  GATHER MULTI-AGENT ANALYSIS"
echo "========================================="
echo ""

# Check app
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "ERROR: App not running at localhost:3000"
    exit 1
fi
echo "✓ App running"
echo ""
echo "Launching 10 agents in parallel..."
echo "Each agent will take 2-5 minutes."
echo ""

# Run all agents in background
cd "$PROJECT_DIR"

claude "$(cat "${SCRIPT_DIR}/agent01_info_architecture.md")" &
pid1=$!
echo "▶ Agent 01: Information Architecture (pid $pid1)"

claude "$(cat "${SCRIPT_DIR}/agent02_interaction_design.md")" &
pid2=$!
echo "▶ Agent 02: Interaction Design (pid $pid2)"

claude "$(cat "${SCRIPT_DIR}/agent03_visual_design.md")" &
pid3=$!
echo "▶ Agent 03: Visual Design (pid $pid3)"

claude "$(cat "${SCRIPT_DIR}/agent04_animation_motion.md")" &
pid4=$!
echo "▶ Agent 04: Animation & Motion (pid $pid4)"

claude "$(cat "${SCRIPT_DIR}/agent05_adhd_ux.md")" &
pid5=$!
echo "▶ Agent 05: ADHD UX (pid $pid5)"

claude "$(cat "${SCRIPT_DIR}/agent06_ai_integration.md")" &
pid6=$!
echo "▶ Agent 06: AI Integration (pid $pid6)"

claude "$(cat "${SCRIPT_DIR}/agent07_code_quality.md")" &
pid7=$!
echo "▶ Agent 07: Code Quality (pid $pid7)"

claude "$(cat "${SCRIPT_DIR}/agent08_competitive_analysis.md")" &
pid8=$!
echo "▶ Agent 08: Competitive Analysis (pid $pid8)"

claude "$(cat "${SCRIPT_DIR}/agent09_first_time_experience.md")" &
pid9=$!
echo "▶ Agent 09: First-Time Experience (pid $pid9)"

claude "$(cat "${SCRIPT_DIR}/agent10_delight_emotion.md")" &
pid10=$!
echo "▶ Agent 10: Delight & Emotion (pid $pid10)"

echo ""
echo "========================================="
echo "All agents launched!"
echo "========================================="
echo ""
echo "Waiting for all agents to complete..."
echo "(This will take 10-30 minutes)"
echo ""

# Wait for all
wait $pid1 && echo "✓ Agent 01 done" || echo "✗ Agent 01 failed"
wait $pid2 && echo "✓ Agent 02 done" || echo "✗ Agent 02 failed"
wait $pid3 && echo "✓ Agent 03 done" || echo "✗ Agent 03 failed"
wait $pid4 && echo "✓ Agent 04 done" || echo "✗ Agent 04 failed"
wait $pid5 && echo "✓ Agent 05 done" || echo "✗ Agent 05 failed"
wait $pid6 && echo "✓ Agent 06 done" || echo "✗ Agent 06 failed"
wait $pid7 && echo "✓ Agent 07 done" || echo "✗ Agent 07 failed"
wait $pid8 && echo "✓ Agent 08 done" || echo "✗ Agent 08 failed"
wait $pid9 && echo "✓ Agent 09 done" || echo "✗ Agent 09 failed"
wait $pid10 && echo "✓ Agent 10 done" || echo "✗ Agent 10 failed"

echo ""
echo "========================================="
echo "All agents complete!"
echo "========================================="
echo ""
echo "Reports:"
ls -la "$REPORTS_DIR"/*.md 2>/dev/null || echo "(no reports found)"
echo ""
echo "Run synthesizer now? (y/n)"
read -r answer

if [ "$answer" = "y" ]; then
    echo ""
    echo "Running synthesizer..."
    claude "$(cat "${SCRIPT_DIR}/agent_synthesizer.md")"
    echo ""
    echo "========================================="
    echo "DONE!"
    echo "========================================="
    echo ""
    echo "Start here: ${REPORTS_DIR}/MASTER_SYNTHESIS.md"
fi

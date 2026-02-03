#!/bin/bash

# gather-autonomous.sh
# Full product development loop - agent decides what to work on

MAX_ITERATIONS=100  # Higher limit for full product dev
ITERATION=0

echo "Starting autonomous product development loop..."
echo "Agent will research, audit, plan, build, and polish on its own"
echo "Will run until STATE.md contains PRODUCT_COMPLETE or $MAX_ITERATIONS iterations"
echo ""

# Create initial STATE.md hint if it doesn't exist
if [ ! -f "STATE.md" ]; then
    echo "# Product State" > STATE.md
    echo "" >> STATE.md
    echo "First session. Start by understanding what this is and what it needs." >> STATE.md
    echo "" >> STATE.md
    echo "Created: $(date)" >> STATE.md
fi

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo "=========================================="
    echo "SESSION $ITERATION / $MAX_ITERATIONS"
    echo "Started: $(date)"
    echo "=========================================="
    
    # Run Claude with the autonomous prompt
    cat PROMPT.md | claude --dangerously-skip-permissions --max-turns 50
    
    # Log session end
    echo "" >> STATE.md
    echo "---" >> STATE.md
    echo "Session $ITERATION ended: $(date)" >> STATE.md
    
    # Check for completion token
    if grep -q "PRODUCT_COMPLETE" STATE.md; then
        echo ""
        echo "=========================================="
        echo "PRODUCT COMPLETE after $ITERATION sessions"
        echo "=========================================="
        echo ""
        echo "Final STATE.md:"
        echo "=========================================="
        cat STATE.md
        exit 0
    fi
    
    echo ""
    echo "Session $ITERATION finished."
    echo "Continuing in 5 seconds... (Ctrl+C to stop)"
    sleep 5
done

echo ""
echo "=========================================="
echo "Hit max iterations ($MAX_ITERATIONS)"
echo "Check STATE.md for current status"
echo "=========================================="

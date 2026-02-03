#!/bin/bash
trap 'echo ""; echo "Stopped."; exit 0' INT TERM
MAX=100
i=0
echo "Starting loop... Ctrl+C to stop"
while [ $i -lt $MAX ]; do
    i=$((i + 1))
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║  SESSION $i — $(date '+%Y-%m-%d %H:%M')           ║"
    echo "╚════════════════════════════════════════╝"

    # Run Claude in background, show progress while waiting
    cat PROMPT.md | claude --dangerously-skip-permissions --max-turns 50 -p &
    CLAUDE_PID=$!

    # Show progress dots and git status while Claude works
    while kill -0 $CLAUDE_PID 2>/dev/null; do
        sleep 10
        echo -n "."
        # Show any new/modified files
        CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        if [ "$CHANGES" != "0" ]; then
            echo " (${CHANGES} files changed)"
        fi
    done

    wait $CLAUDE_PID
    echo ""
    echo "--- Session $i complete ---"

    # Show what was committed
    git log --oneline -1 2>/dev/null

    git push 2>/dev/null || true
    grep -q "^# SHIP_IT$" STATE.md 2>/dev/null && echo "🚀 DONE - Product shipped!" && exit 0
    echo "Next session in 3s..."
    sleep 3
done

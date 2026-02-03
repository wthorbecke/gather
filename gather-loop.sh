#!/bin/bash
trap 'echo ""; echo "Stopped."; exit 0' INT TERM
MAX=100
i=0
echo "Starting loop... Ctrl+C to stop"
while [ $i -lt $MAX ]; do
    i=$((i + 1))
    echo "=== SESSION $i — $(date '+%H:%M') ==="
    claude --dangerously-skip-permissions --max-turns 50 -p "$(cat PROMPT.md)"
    git push 2>/dev/null || true
    grep -q "PRODUCT_COMPLETE" STATE.md 2>/dev/null && echo "DONE" && exit 0
    echo "Next session in 3s..."
    sleep 3
done

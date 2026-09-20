#!/bin/bash
LOG_FILE="/tmp/review-completed-hook-debug.log"

input=$(cat)
echo "----- $(date -Iseconds) -----" >> "$LOG_FILE"
echo "RAW INPUT: $input" >> "$LOG_FILE"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
DECISIONS_FILE="$PROJECT_DIR/.claude/test-plans/decisions.json"

if [ ! -f "$DECISIONS_FILE" ]; then
  echo "ERROR: $DECISIONS_FILE not found" >> "$LOG_FILE"
  exit 0
fi

echo "Decisions received, contents:" >> "$LOG_FILE"
cat "$DECISIONS_FILE" >> "$LOG_FILE"

exit 0
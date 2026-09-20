#!/bin/bash
# Opens the interactive test-scenario review page in the default browser,
# starting the local decisions-server.py first (so review.html can save
# decisions.json silently, without an OS save dialog).
# Triggered by the SubagentStop hook when test-strategist finishes.

LOG_FILE="/tmp/subagent-hook-debug.log"
SERVER_LOG="/tmp/decisions-server.log"
SERVER_PORT=8765
SERVER_URL="http://127.0.0.1:${SERVER_PORT}/ping"

input=$(cat)
echo "----- $(date -Iseconds) -----" >> "$LOG_FILE"
echo "RAW INPUT: $input" >> "$LOG_FILE"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
FILE="$PROJECT_DIR/.claude/test-plans/review.html"
SERVER_SCRIPT="$PROJECT_DIR/.claude/hooks/decisions-server.py"

if [ ! -f "$FILE" ]; then
  echo "ERROR: review.html not found at $FILE" >> "$LOG_FILE"
  echo "review.html not found at $FILE — did test-strategist write it?"
  exit 0
fi

# Pick a python interpreter: python3 first (macOS/Linux), fall back to
# python (common on Windows installs that don't ship a python3 alias).
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

if [ -z "$PYTHON_BIN" ]; then
  echo "ERROR: no python3/python found in PATH — cannot start decisions-server.py" >> "$LOG_FILE"
else
  # Liveness check via HTTP ping instead of a PID file: PIDs captured by
  # bash's $! under Git Bash/MSYS on Windows don't reliably match the
  # actual Windows process, so kill -0 can give false negatives there.
  # curl is available in Git Bash and natively on Windows 10+.
  if curl -s -m 1 -o /dev/null -w "%{http_code}" "$SERVER_URL" 2>>"$LOG_FILE" | grep -q "200"; then
    echo "decisions-server.py already responding on port $SERVER_PORT" >> "$LOG_FILE"
  else
    echo "Starting decisions-server.py ($PYTHON_BIN) on port $SERVER_PORT" >> "$LOG_FILE"
    CLAUDE_PROJECT_DIR="$PROJECT_DIR" nohup "$PYTHON_BIN" "$SERVER_SCRIPT" >> "$SERVER_LOG" 2>&1 &
    disown 2>/dev/null || true
    sleep 0.5
    if curl -s -m 1 -o /dev/null -w "%{http_code}" "$SERVER_URL" 2>>"$LOG_FILE" | grep -q "200"; then
      echo "decisions-server.py started successfully" >> "$LOG_FILE"
    else
      echo "WARNING: decisions-server.py did not respond after start — check $SERVER_LOG" >> "$LOG_FILE"
    fi
  fi
fi

# Priority 1: VS Code CLI — works locally and in Remote/WSL/Devcontainer,
# since it forwards the request to the client machine over the remote protocol.
if command -v code >/dev/null 2>&1; then
  echo "Trying: code --open-external" >> "$LOG_FILE"
  if code --open-external "file://$FILE" >> "$LOG_FILE" 2>&1; then
    echo "SUCCESS via code --open-external" >> "$LOG_FILE"
    exit 0
  else
    echo "FAILED: code --open-external" >> "$LOG_FILE"
  fi
fi

# Priority 2: plain OS openers (for use outside VS Code).
echo "Falling back to OS opener, uname: $(uname -s)" >> "$LOG_FILE"
case "$(uname -s)" in
  Darwin)
    open "$FILE" >> "$LOG_FILE" 2>&1
    ;;
  Linux)
    (xdg-open "$FILE" 2>>"$LOG_FILE" || sensible-browser "$FILE" 2>>"$LOG_FILE")
    ;;
  MINGW*|MSYS*|CYGWIN*)
    cmd.exe /c start "" "$(cygpath -w "$FILE" 2>/dev/null || echo "$FILE")" >> "$LOG_FILE" 2>&1
    ;;
  *)
    echo "Unknown OS — open manually: $FILE" >> "$LOG_FILE"
    echo "Unknown OS — open manually: $FILE"
    ;;
esac

echo "DONE" >> "$LOG_FILE"
exit 0
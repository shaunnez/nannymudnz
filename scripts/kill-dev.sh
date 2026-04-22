#!/usr/bin/env bash
# Kill whatever is bound to the dev ports (5173=vite, 2567=colyseus).
# Works on Windows (git bash / WSL) and *nix. Run via `npm run kill`.

set -u

kill_port() {
  local port="$1"
  local pids=""

  if command -v netstat >/dev/null 2>&1 && netstat -ano 2>/dev/null | grep -q LISTENING; then
    # Windows netstat
    pids=$(netstat -ano | awk -v p=":$port" '$2 ~ p && $4 == "LISTENING" { print $5 }' | sort -u)
    for pid in $pids; do
      echo "[kill-dev] :$port -> PID $pid"
      taskkill //PID "$pid" //F >/dev/null 2>&1 || taskkill /PID "$pid" /F >/dev/null 2>&1 || true
    done
  elif command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    for pid in $pids; do
      echo "[kill-dev] :$port -> PID $pid"
      kill -9 "$pid" 2>/dev/null || true
    done
  fi

  if [ -z "$pids" ]; then
    echo "[kill-dev] :$port free"
  fi
}

kill_port 5173
kill_port 2567

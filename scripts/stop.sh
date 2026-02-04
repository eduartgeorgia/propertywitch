#!/bin/bash

# AIPA - Stop All Services
# Usage: ./scripts/stop.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🛑 Stopping AIPA Services..."

# Kill by PID files if they exist
if [ -f "$PROJECT_ROOT/.server.pid" ]; then
    while read -r pid; do
        kill "$pid" 2>/dev/null || true
    done < "$PROJECT_ROOT/.server.pid"
    rm -f "$PROJECT_ROOT/.server.pid"
fi

if [ -f "$PROJECT_ROOT/.web.pid" ]; then
    while read -r pid; do
        kill "$pid" 2>/dev/null || true
    done < "$PROJECT_ROOT/.web.pid"
    rm -f "$PROJECT_ROOT/.web.pid"
fi

# Also kill by port to be sure (safe for macOS)
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
}
kill_port 4000
kill_port 5173

echo "✅ All services stopped"

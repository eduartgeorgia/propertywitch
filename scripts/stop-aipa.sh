#!/bin/bash

# AIPA Stop Script
# Stops all AIPA services

echo "🛑 Stopping AIPA Services..."

# Kill processes on ports
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "Stopping process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null
    fi
}

kill_port 4000
kill_port 5173

# Also kill any npm dev processes for this project
pkill -f "aipa/server" 2>/dev/null
pkill -f "aipa/web" 2>/dev/null

echo "✓ AIPA services stopped"

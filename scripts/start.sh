#!/bin/bash

# AIPA - Start All Services
# Usage: ./scripts/start.sh

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting AIPA Services..."

# Ensure logs directory exists
mkdir -p "$PROJECT_ROOT/logs"

# Kill any existing processes on our ports (safe for macOS)
echo "📦 Cleaning up existing processes..."
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
}
kill_port 4000
kill_port 5173

# Check if Ollama is running
echo "🤖 Checking Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama not running. Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
fi

# Verify Ollama has models
MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name"' | wc -l | tr -d ' ')
if [ "$MODELS" -eq 0 ] 2>/dev/null; then
    echo "⚠️  No Ollama models found. Please run: ollama pull llama3.2"
fi

# Check and install server dependencies if needed
echo "📦 Checking server dependencies..."
cd "$PROJECT_ROOT/server"
if [ ! -d "node_modules" ]; then
    echo "   Installing server dependencies..."
    npm install
fi

# Start backend server
echo "🔧 Starting Backend Server (port 4000)..."
npm run dev > "$PROJECT_ROOT/logs/server.log" 2>&1 &

# Wait for backend to be FULLY ready (API responding properly)
echo "   Waiting for backend to start..."
for i in {1..30}; do
    # Check if server is responding with valid JSON
    if curl -s http://localhost:4000/ 2>/dev/null | grep -q "ok"; then
        echo "   ✓ Backend server is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠ Backend still starting - check logs/server.log"
    fi
    sleep 1
done

# Check and install web dependencies if needed
echo "📦 Checking web dependencies..."
cd "$PROJECT_ROOT/web"
if [ ! -d "node_modules" ]; then
    echo "   Installing web dependencies..."
    npm install
fi

# Start frontend
echo "🌐 Starting Frontend (port 5173)..."
npm run dev > "$PROJECT_ROOT/logs/web.log" 2>&1 &

# Wait for frontend to be ready
echo "   Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "   ✓ Frontend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠ Frontend still starting - check logs/web.log"
    fi
    sleep 1
done

# Save PIDs by port (more reliable than $!)
lsof -ti:4000 2>/dev/null > "$PROJECT_ROOT/.server.pid" || true
lsof -ti:5173 2>/dev/null > "$PROJECT_ROOT/.web.pid" || true

echo ""
echo "✅ Services Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Ollama AI:  http://localhost:11434"
echo "🔧 Backend:    http://localhost:4000"
echo "🌐 Frontend:   http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Logs: $PROJECT_ROOT/logs/"
echo "🛑 Stop: ./scripts/stop.sh"
echo ""

# Health check
if curl -s http://localhost:4000/api/ai/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend may still be starting - check logs/server.log"
fi

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "⚠️  Frontend may still be starting - check logs/web.log"
fi

#!/bin/bash

# AIPA - Development Mode (foreground with live output)
# Usage: ./scripts/dev.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    lsof -ti:4000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "🚀 AIPA Development Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any existing processes
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Check Ollama
echo "🤖 Checking Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    MODELS=$(curl -s http://localhost:11434/api/tags | grep -c '"name"')
    echo "✅ Ollama running with $MODELS model(s)"
else
    echo "❌ Ollama not running - start with: ollama serve"
fi

# Start backend
echo "🔧 Starting Backend..."
cd "$PROJECT_ROOT/server"
npm run dev &
SERVER_PID=$!

sleep 2

# Start frontend  
echo "🌐 Starting Frontend..."
cd "$PROJECT_ROOT/web"
npm run dev &
WEB_PID=$!

sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Ollama:   http://localhost:11434"
echo "🔧 Backend:  http://localhost:4000"
echo "🌐 Frontend: http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for either process to exit
wait

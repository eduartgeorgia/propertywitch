#!/bin/bash

# AIPA - Smooth Restart Script
# Usage: ./scripts/restart.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔄 Restarting AIPA Services..."

# Kill any existing processes on our ports gracefully
echo "🧹 Cleaning up existing processes..."

# Kill server on port 4000
if lsof -ti:4000 > /dev/null 2>&1; then
    echo "   Stopping server on port 4000..."
    lsof -ti:4000 | xargs kill -9 2>/dev/null
    sleep 1
fi

# Kill web dev server on port 5173
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "   Stopping web server on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 1
fi

# Kill any node processes related to this project
pkill -f "tsx.*aipa" 2>/dev/null
pkill -f "vite.*aipa" 2>/dev/null
sleep 1

# Verify ports are free
if lsof -ti:4000 > /dev/null 2>&1; then
    echo "❌ Port 4000 still in use. Force killing..."
    lsof -ti:4000 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "✅ Ports cleared"

# Start backend server
echo "🚀 Starting backend server..."
cd "$PROJECT_ROOT/server"
npm run dev > "$PROJECT_ROOT/logs/server.log" 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:4000/ > /dev/null 2>&1; then
        echo "✅ Backend server ready on http://localhost:4000"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Server failed to start. Check logs/server.log"
        cat "$PROJECT_ROOT/logs/server.log" | tail -20
        exit 1
    fi
    sleep 1
done

# Start frontend (optional - comment out if not needed)
echo "🌐 Starting frontend..."
cd "$PROJECT_ROOT/web"
npm run dev > "$PROJECT_ROOT/logs/web.log" 2>&1 &
WEB_PID=$!

# Wait for frontend
for i in {1..15}; do
    if curl -s http://localhost:5173/ > /dev/null 2>&1; then
        echo "✅ Frontend ready on http://localhost:5173"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Frontend may still be starting. Check logs/web.log"
    fi
    sleep 1
done

echo ""
echo "🎉 AIPA Services Started!"
echo "   Backend:  http://localhost:4000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "📋 Logs:"
echo "   Server: $PROJECT_ROOT/logs/server.log"
echo "   Web:    $PROJECT_ROOT/logs/web.log"
echo ""
echo "To stop: ./scripts/stop.sh"

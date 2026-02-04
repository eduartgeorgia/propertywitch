#!/bin/bash

# AIPA Launcher Script
# This script starts both the server and web frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🏠 AIPA - AI Property Assistant"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Function to check if API is truly ready (not just port open)
check_api_ready() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/ 2>/dev/null)
    [ "$response" = "200" ]
    return $?
}

# Function to check if Vite dev server is ready
check_vite_ready() {
    curl -s http://localhost:5173 > /dev/null 2>&1
    return $?
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}Stopping existing process on port $port...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Stop any existing instances
echo -e "${BLUE}Cleaning up existing processes...${NC}"
kill_port 4000
kill_port 5173

# Start the server
echo -e "${GREEN}Starting AIPA Server...${NC}"
cd "$PROJECT_DIR/server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing server dependencies...${NC}"
    npm install
fi

# Start server in background
npm run dev &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be FULLY ready (API responding, not just port open)
echo "Waiting for server to start..."
for i in {1..60}; do
    if check_api_ready; then
        echo -e "${GREEN}✓ Server is running on http://localhost:4000${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${YELLOW}⚠ Server taking longer than expected. Check logs.${NC}"
    fi
    sleep 1
done

# Start the web frontend
echo -e "${GREEN}Starting AIPA Web Frontend...${NC}"
cd "$PROJECT_DIR/web"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing web dependencies...${NC}"
    npm install
fi

# Start web in background
npm run dev &
WEB_PID=$!
echo "Web PID: $WEB_PID"

# Wait for web to be ready (checking actual response, not just port)
echo "Waiting for web frontend to start..."
for i in {1..60}; do
    if check_vite_ready; then
        echo -e "${GREEN}✓ Web frontend is running on http://localhost:5173${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${YELLOW}⚠ Frontend taking longer than expected. Check logs.${NC}"
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 AIPA is now running!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "Server:   ${BLUE}http://localhost:4000${NC}"
echo -e "Frontend: ${BLUE}http://localhost:5173${NC}"
echo ""

# Final health check before opening browser
echo -e "${BLUE}Running final health check...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:4000/api/ai/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend API is healthy${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${YELLOW}⚠ API health check taking longer - Ollama may still be initializing${NC}"
    fi
    sleep 1
done

# Open the browser
sleep 2
open "http://localhost:5173"

echo "Press Ctrl+C to stop all services..."
echo ""

# Trap to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down AIPA...${NC}"
    kill $SERVER_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    kill_port 4000
    kill_port 5173
    echo -e "${GREEN}Goodbye! 👋${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait

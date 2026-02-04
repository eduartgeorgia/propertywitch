#!/bin/bash
# Start both AIPA servers with proper health checking

cd "$(dirname "$0")/.."

# Create logs directory if it doesn't exist
mkdir -p logs

# Kill any existing processes
pkill -f "tsx watch" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend server
echo "Starting backend server..."
cd server
npm run dev > ../logs/server.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be healthy (up to 60 seconds)
echo "Waiting for backend to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0
BACKEND_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Check if the server responds with valid JSON containing "ok"
  if curl -s http://localhost:4000/ 2>/dev/null | grep -q "ok"; then
    BACKEND_READY=true
    echo "✓ Backend is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $((RETRY_COUNT % 10)) -eq 0 ]; then
    echo "  Waiting for backend... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  fi
  sleep 1
done

if [ "$BACKEND_READY" = false ]; then
  echo "⚠ Warning: Backend may not be ready. Check logs/server.log for errors."
fi

# Start frontend server  
echo "Starting frontend server..."
cd web
npm run dev > ../logs/web.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready (up to 30 seconds)
echo "Waiting for frontend to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
FRONTEND_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    FRONTEND_READY=true
    echo "✓ Frontend is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

if [ "$FRONTEND_READY" = false ]; then
  echo "⚠ Warning: Frontend may not be ready. Check logs/web.log for errors."
fi

echo ""
echo "==================================="
echo "AIPA Servers Started!"
echo "==================================="
echo "Backend:  http://localhost:4000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Logs:"
echo "  Backend:  logs/server.log"
echo "  Frontend: logs/web.log"
echo ""
echo "To stop: pkill -f 'tsx watch' && pkill -f 'vite'"

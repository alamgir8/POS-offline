#!/bin/bash

# Stop all Offline POS System services

echo "🛑 Stopping Offline POS System..."

# Kill processes by port
echo "🔍 Finding and stopping services..."

# Stop hub server (port 4001)
HUB_PID=$(lsof -ti:4001)
if [ ! -z "$HUB_PID" ]; then
    echo "🛑 Stopping Hub Server (PID: $HUB_PID)..."
    kill $HUB_PID
fi

# Stop web client (port 5173)
WEB_PID=$(lsof -ti:5173)
if [ ! -z "$WEB_PID" ]; then
    echo "🛑 Stopping Web Client (PID: $WEB_PID)..."
    kill $WEB_PID
fi

# Stop any remaining node processes for this project
pkill -f "offline-pos"

echo "✅ All services stopped successfully!"

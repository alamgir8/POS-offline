#!/bin/bash

# Stop all Offline POS System services

echo "🛑 Stopping Offline POS System..."

# Function to kill processes on a specific port
kill_port() {
    local port=$1
    local service_name=$2
    local pids=$(lsof -ti:$port)
    if [ ! -z "$pids" ]; then
        echo "🛑 Stopping $service_name (Port $port, PIDs: $pids)..."
        kill -9 $pids 2>/dev/null
        sleep 1
        echo "✅ $service_name stopped"
    else
        echo "ℹ️  $service_name not running on port $port"
    fi
}

# Function to stop service by PID file
stop_by_pid() {
    local service_name=$1
    local pid_file="logs/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "🛑 Stopping $service_name (PID: $pid)..."
            kill -9 $pid 2>/dev/null
            echo "✅ $service_name stopped"
        else
            echo "ℹ️  $service_name process (PID: $pid) not running"
        fi
        rm -f "$pid_file"
    else
        echo "ℹ️  No PID file found for $service_name"
    fi
}

echo "� Stopping services by PID files..."

# Stop services using PID files (preferred method)
stop_by_pid "hub-server"
stop_by_pid "web-client" 
stop_by_pid "native-app"

echo ""
echo "🔍 Stopping any remaining services by port..."

# Stop services by port (backup method)
kill_port 4001 "Hub Server"
kill_port 5173 "Web Client"
kill_port 8081 "Native App (Expo)"

# Stop any remaining node/expo processes for this project
echo ""
echo "🧹 Cleaning up any remaining processes..."

# Kill any remaining processes related to our project
pkill -f "offline-pos" 2>/dev/null && echo "✅ Cleaned up offline-pos processes"
pkill -f "expo start" 2>/dev/null && echo "✅ Cleaned up expo processes"

# Clean up log files (optional)
if [ -d "logs" ]; then
    echo "🧹 Cleaning up log files..."
    rm -f logs/*.pid
    echo "✅ PID files cleaned up"
fi

echo ""
echo "🎉 All Offline POS System services stopped successfully!"
echo ""
echo "💡 To start all services again, run: ./start.sh"

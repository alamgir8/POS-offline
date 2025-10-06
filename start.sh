#!/bin/bash

# Offline POS System Startup Script
# This script starts the Hub Server, Web Client, and Native App development servers

echo "🚀 Starting Offline POS System..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i:$1 >/dev/null 2>&1
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port)
    if [ ! -z "$pids" ]; then
        echo "🔄 Killing existing processes on port $port..."
        kill -9 $pids 2>/dev/null
        sleep 1
    fi
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

if ! command_exists npx; then
    echo "❌ npx is not installed. Please install npx first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Kill any existing processes on our ports
kill_port 4001  # Hub server
kill_port 5173  # Web client
kill_port 8081  # Expo dev server

# Create log directory
mkdir -p logs

# Function to start a service in background
start_service() {
    local name=$1
    local directory=$2
    local command=$3
    local port=$4
    local log_file="logs/${name}.log"
    
    echo "🔧 Starting $name..."
    echo "🏃 Starting $name on port $port..."
    
    cd "$directory"
    
    # Check if package.json exists and install dependencies if needed
    if [ -f "package.json" ]; then
        if [ ! -d "node_modules" ]; then
            echo "📦 Installing dependencies for $name..."
            npm install
        fi
    fi
    
    # Start the service in background
    nohup $command > "../$log_file" 2>&1 &
    local pid=$!
    
    echo "🔄 $name started with PID: $pid"
    echo $pid > "logs/${name}.pid"
    
    # Wait a moment for the service to start
    sleep 3
    
    # Check if the service is still running
    if kill -0 $pid 2>/dev/null; then
        echo "✅ $name is running successfully"
    else
        echo "❌ $name failed to start. Check logs/$name.log for details."
        exit 1
    fi
    
    cd ..
}

# Start Hub Server
start_service "hub-server" "hub" "npm run dev" "4001"

# Start Web Client
start_service "web-client" "web" "npm run dev" "5173"

# Start Native App (Expo)
echo "🔧 Starting Native App..."
echo "🏃 Starting native app on port 8081..."

cd native

# Check if package.json exists and install dependencies if needed
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies for native app..."
        npm install
    fi
fi

# Start Expo in background
nohup npx expo start > "../logs/native-app.log" 2>&1 &
native_pid=$!

echo "🔄 Native app started with PID: $native_pid"
echo $native_pid > "logs/native-app.pid"

cd ..

# Wait for all services to fully start
echo "⏳ Waiting for all services to start..."
sleep 10

# Display status
echo ""
echo "🎉 All services started successfully!"
echo ""
echo "📊 Service Status:"
echo "==================="

# Check Hub Server
if port_in_use 4001; then
    echo "✅ Hub Server: Running on http://localhost:4001"
else
    echo "❌ Hub Server: Failed to start"
fi

# Check Web Client
if port_in_use 5173; then
    echo "✅ Web Client: Running on http://localhost:5173"
else
    echo "❌ Web Client: Failed to start"
fi

# Check Expo Dev Server
if port_in_use 8081; then
    echo "✅ Native App: Expo dev server running on http://localhost:8081"
else
    echo "❌ Native App: Failed to start"
fi

echo ""
echo "📱 Usage Instructions:"
echo "======================"
echo "1. Open http://localhost:5173 in your browser for the Web Dashboard"
echo "2. Use Expo Go app to scan the QR code for the mobile app"
echo "3. Check logs/ directory for detailed service logs"
echo ""
echo "🛑 To stop all services, run: ./stop.sh"
echo ""
echo "📋 Process IDs saved in logs/ directory"
echo "   - Hub Server PID: $(cat logs/hub-server.pid 2>/dev/null || echo 'Not found')"
echo "   - Web Client PID: $(cat logs/web-client.pid 2>/dev/null || echo 'Not found')"
echo "   - Native App PID: $(cat logs/native-app.pid 2>/dev/null || echo 'Not found')"

echo ""
echo "🔍 Real-time logs:"
echo "=================="
echo "📝 Hub Server: tail -f logs/hub-server.log"
echo "📝 Web Client: tail -f logs/web-client.log"  
echo "📝 Native App: tail -f logs/native-app.log"

# Keep the script running to show live status
echo ""
echo "💡 Press Ctrl+C to exit this status monitor (services will keep running)"
echo "   Use ./stop.sh to actually stop all services"
echo ""

# Monitor services (optional - can be interrupted)
while true; do
    sleep 30
    echo "⏰ $(date): Services status check..."
    
    if ! port_in_use 4001; then
        echo "⚠️  Hub Server appears to be down!"
    fi
    
    if ! port_in_use 5173; then
        echo "⚠️  Web Client appears to be down!"
    fi
    
    if ! port_in_use 8081; then
        echo "⚠️  Native App appears to be down!"
    fi
done
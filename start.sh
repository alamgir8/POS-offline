#!/bin/bash

# Offline POS System Startup S[1m[7m%[27m[1m[0m                                                                                                                               [0m[27m[24m[Jalamgirhossain@Alamgirs-MacBook-Pro offline-pos % [K[?2004hrequisites
echo "🔍 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start Hub Server
echo "🔧 Starting Hub Server..."
cd "$SCRIPT_DIR/hub"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing hub dependencies..."
    npm install
fi

echo "🏃 Starting hub server on port 4001..."
npm run dev &
HUB_PID=$!

# Wait a moment for the hub to start
sleep 3

# Start Web Client
echo ""
echo "🌐 Starting Web Client..."
cd "$SCRIPT_DIR/web"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing web dependencies..."
    npm install
fi

echo "🏃 Starting web client on port 5173..."
npm run dev &
WEB_PID=$!

# Wait a moment for the web client to start
sleep 3

echo ""
echo "✅ All services started successfully!"
echo ""
echo "📱 Access your applications:"
echo "   🔗 Hub Server:   http://localhost:4001"
echo "   🌐 Web Client:   http://localhost:5173"
echo ""
echo "🔐 Demo Login Credentials:"
echo "   Restaurant Admin: admin@restaurant.demo / password123"
echo "   Retail Admin:     admin@retail.demo / password123"
echo "   Cashier:          cashier@restaurant.demo / cashier123"
echo ""
echo "📋 Instructions:"
echo "   1. Open the web client in multiple browser tabs/windows"
echo "   2. Log in with different accounts on different tabs"
echo "   3. Create orders on one tab and see them sync in real-time on others"
echo "   4. Test parking, re-parking, and payment features"
echo "   5. Try disconnecting from internet to test offline functionality"
echo ""
echo "🛑 To stop all services, press Ctrl+C or run: ./stop.sh"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $HUB_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup INT TERM

# Wait for user to stop the script
echo "✨ System is running! Press Ctrl+C to stop all services."
wait

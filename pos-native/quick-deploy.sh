#!/bin/bash

# 🚀 POS System Quick Deploy Script for Real Devices
# This script sets up your local server for production use

echo "🍴 POS System - Real Device Setup"
echo "================================="

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
SERVER_DIR="$SCRIPT_DIR/local-server"

# Check if we're in the right directory
if [ ! -d "$SERVER_DIR" ]; then
    echo "❌ Error: local-server directory not found!"
    echo "Please run this script from your POS project root directory"
    exit 1
fi

echo "📂 Found server directory: $SERVER_DIR"

# Navigate to server directory
cd "$SERVER_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ first:"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install --production
else
    echo "✅ Dependencies already installed"
fi

# Create systemd service file for auto-start (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔧 Creating systemd service for auto-start..."
    
    SERVICE_FILE="/etc/systemd/system/pos-server.service"
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=POS Local Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SERVER_DIR
ExecStart=$(which node) server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    echo "✅ Service file created at $SERVICE_FILE"
    
    # Enable and start service
    sudo systemctl daemon-reload
    sudo systemctl enable pos-server
    
    echo "🚀 Starting POS server service..."
    sudo systemctl start pos-server
    
    # Check status
    if sudo systemctl is-active --quiet pos-server; then
        echo "✅ POS server is running!"
        sudo systemctl status pos-server --no-pager -l
    else
        echo "❌ Failed to start service. Check logs:"
        sudo journalctl -u pos-server --no-pager -l
    fi
    
else
    # For macOS or manual start
    echo "🚀 Starting POS server manually..."
    echo "Note: For auto-start on boot, you'll need to configure this manually"
    
    # Start server in background
    nohup node server.js > pos-server.log 2>&1 &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if process is still running
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "✅ POS server started with PID: $SERVER_PID"
        echo "📄 Logs are being written to: pos-server.log"
    else
        echo "❌ Server failed to start. Check pos-server.log for details"
        exit 1
    fi
fi

# Get network information
echo ""
echo "🌐 Network Information:"
echo "======================"

# Try to detect server IP and port
sleep 2
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Check systemd service logs for IP
    SERVER_INFO=$(sudo journalctl -u pos-server --no-pager -l | grep -E "Server running|WiFi Sync Server" | tail -1)
else
    # Check manual log file
    if [ -f "pos-server.log" ]; then
        SERVER_INFO=$(grep -E "Server running|WiFi Sync Server" pos-server.log | tail -1)
    fi
fi

if [ -n "$SERVER_INFO" ]; then
    echo "$SERVER_INFO"
else
    # Fallback: show manual network detection
    echo "Server should be running on one of these addresses:"
    
    # Get local IP addresses
    if command -v ip &> /dev/null; then
        # Linux
        ip route get 1.1.1.1 | grep -oP 'src \K\S+' | head -1 | while read IP; do
            echo "  🌐 http://$IP:8080"
        done
    elif command -v ifconfig &> /dev/null; then
        # macOS
        ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | while read IP; do
            echo "  🌐 http://$IP:8080"
        done
    fi
fi

echo ""
echo "📱 Next Steps for Real Devices:"
echo "================================"
echo "1. 📲 Build your APK:"
echo "   cd $SCRIPT_DIR"
echo "   eas build --platform android"
echo ""
echo "2. 📱 Install APK on all devices (tablets, phones)"
echo ""
echo "3. 🌐 Connect all devices to the same WiFi network"
echo ""
echo "4. ✅ The apps will automatically discover the server!"
echo ""
echo "🔧 Server Management Commands:"
echo "============================="

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "📊 Check server status:     sudo systemctl status pos-server"
    echo "🔄 Restart server:          sudo systemctl restart pos-server"
    echo "🛑 Stop server:             sudo systemctl stop pos-server"
    echo "📜 View logs:               sudo journalctl -u pos-server -f"
else
    echo "📊 Check server:            ps aux | grep 'node server.js'"
    echo "🛑 Stop server:             pkill -f 'node server.js'"
    echo "🔄 Restart server:          ./quick-deploy.sh"
    echo "📜 View logs:               tail -f pos-server.log"
fi

echo ""
echo "🎯 Device Configuration Tips:"
echo "============================="
echo "• Main POS: Full ordering interface"
echo "• Kitchen Display: Shows orders for preparation"  
echo "• Bar Display: Shows drink orders only"
echo "• Manager: Full access to all features"
echo ""
echo "✅ Your POS system is ready for real devices!"
echo "The server will automatically handle all device connections and sync."

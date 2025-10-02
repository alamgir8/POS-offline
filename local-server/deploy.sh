#!/bin/bash

# Universal POS Server Production Deployment Script
echo "🚀 Deploying Universal POS WiFi Sync Server"
echo "============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Installing Node.js..."
    
    # Install Node.js based on OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "📱 macOS detected. Please install Node.js from https://nodejs.org"
        exit 1
    else
        echo "❌ Unsupported OS. Please install Node.js manually."
        exit 1
    fi
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Ask for deployment type
echo ""
echo "🔧 Choose deployment type:"
echo "1) Development (manual start/stop)"
echo "2) Production with PM2 (auto-restart)"
echo "3) System Service (Linux only, starts on boot)"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Starting development server..."
        npm start
        ;;
    2)
        echo "📦 Installing PM2..."
        npm run install-pm2
        
        echo "� Starting production server with PM2..."
        npm run pm2:start
        
        read -p "Set up auto-start on boot? (y/N): " autostart
        if [[ $autostart =~ ^[Yy]$ ]]; then
            npm run setup-autostart
            echo "✅ Auto-start configured"
        fi
        ;;
    3)
        if [[ "$OSTYPE" != "linux-gnu"* ]]; then
            echo "❌ System service is only supported on Linux"
            exit 1
        fi
        
        # Create pos user if it doesn't exist
        if ! id "pos" &>/dev/null; then
            echo "👤 Creating pos user..."
            sudo useradd -m -s /bin/bash pos
        fi
        
        # Copy files to pos user directory
        echo "📁 Setting up files..."
        sudo mkdir -p /home/pos/local-server
        sudo cp -r * /home/pos/local-server/
        sudo chown -R pos:pos /home/pos/local-server
        
        # Install systemd service
        echo "⚙️ Installing systemd service..."
        sudo cp pos-server.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable pos-server
        sudo systemctl start pos-server
        
        echo "✅ System service installed and started"
        echo "📝 Use 'sudo systemctl status pos-server' to check status"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🌐 Getting network information..."
echo "================================"

# Get local IP addresses
if command -v ifconfig &> /dev/null; then
    echo "📡 Server accessible on:"
    ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print "   📱 http://" $2 ":8080"}'
elif command -v ip &> /dev/null; then
    echo "📡 Server accessible on:"
    ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print "   📱 http://" $2 ":8080"}' | sed 's/\/.*:/:/g'
else
    echo "   📱 Configure your network and use: http://[YOUR_IP]:8080"
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo "🔍 Health check: http://[SERVER_IP]:8080/health"
echo "🔍 Discovery: http://[SERVER_IP]:8080/discover"
echo "🔍 Network info: http://[SERVER_IP]:8080/network-info"
echo ""
echo "📱 Update your POS app settings to use the IP address shown above"
echo "🔧 The server automatically detects network type and provides setup tips"
echo ""

# Show status based on deployment type
case $choice in
    1)
        echo "💡 Server is running. Press Ctrl+C to stop."
        ;;
    2)
        echo "💡 PM2 Commands:"
        echo "   📊 Status: pm2 status"
        echo "   📋 Logs: pm2 logs pos-server"
        echo "   🔄 Restart: pm2 restart pos-server"
        echo "   ⏹️ Stop: pm2 stop pos-server"
        ;;
    3)
        echo "� System Service Commands:"
        echo "   📊 Status: sudo systemctl status pos-server"
        echo "   📋 Logs: sudo journalctl -u pos-server -f"
        echo "   🔄 Restart: sudo systemctl restart pos-server"
        echo "   ⏹️ Stop: sudo systemctl stop pos-server"
        ;;
esac

echo "🎉 Your POS server is ready for production!"

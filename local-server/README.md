# POS WiFi Sync Server - Offline Production Guide

## 🌐 Yes, it works completely offline!

Your POS system is designed to run **without any internet connection**. The server only needs a local WiFi network to sync data between devices in real-time.

## 🚀 Production Deployment Options

### Option 1: Dedicated Device (Recommended)

**Best for:** Permanent installations, multiple POS terminals

**Hardware Options:**
- **Raspberry Pi 4** ($35-75) - Perfect for small businesses
- **Intel NUC** ($200-400) - More powerful for larger operations  
- **Mini PC** ($100-200) - Good balance of cost and performance
- **Old laptop/desktop** - Repurpose existing hardware

**Setup Steps:**
1. Copy the `local-server` folder to your device
2. Run the deployment script: `./deploy.sh`
3. Configure auto-start (script will help)
4. Set a static IP address for reliability

### Option 2: One POS Device as Server

**Best for:** Small setups, temporary operations

**Setup:**
1. Choose your main POS device to also run the server
2. Install Node.js on that device
3. Run the server alongside your POS app
4. Other devices connect to this device's IP

### Option 3: Router with Custom Firmware

**Best for:** Tech-savvy users, permanent installations

**Compatible Hardware:**
- OpenWrt compatible routers
- DD-WRT supported devices
- Some can run Node.js directly on the router

### Option 4: Mobile Hotspot Setup

**Best for:** Mobile vendors, temporary setups

**Setup:**
1. Use one device as WiFi hotspot
2. Run server on the hotspot device or another connected device
3. All POS devices connect to the hotspot network

## 📋 Quick Start Guide

### 1. Server Setup
```bash
cd local-server
./deploy.sh
```

### 2. Start Production Server
```bash
npm run production
```

### 3. Configure POS Devices
- Connect all devices to the same WiFi network
- Use server IP (shown in terminal) in your POS app settings
- Example: `192.168.1.100:8080`

## 🔧 Production Features

### ✅ Offline Capabilities
- **No internet required** - Works on isolated networks
- **Local WiFi only** - Perfect for security
- **Real-time sync** - Orders update instantly across devices
- **Auto-reconnection** - Devices reconnect automatically

### 🔒 Security & Reliability
- **Network isolation** - Can block external internet access
- **Auto-restart** - Server restarts on failure
- **Health monitoring** - Built-in status endpoints
- **Graceful shutdown** - Safe server restarts

### 📊 Monitoring Endpoints
- `http://[SERVER_IP]:8080/health` - Server status
- `http://[SERVER_IP]:8080/network-info` - Network details

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   POS Device 1  │    │   WiFi Server   │    │   POS Device 2  │
│                 │────│                 │────│                 │
│  Order Entry    │    │  Sync Hub       │    │  Order Display  │
│  Local Storage  │    │  No Internet    │    │  Local Storage  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   POS Device 3  │
                    │                 │
                    │  Kitchen Display│
                    │  Local Storage  │
                    └─────────────────┘
```

## 💾 Data Persistence Options

### Current: In-Memory
- **Fast** - All data in RAM
- **Temporary** - Data lost on server restart
- **Good for:** Development, testing

### Recommended: SQLite
- **Persistent** - Data survives restarts
- **No setup** - Single file database
- **Good for:** Production use

### Advanced: Network Storage
- **Shared** - Multiple servers can share data
- **Backup** - Built-in redundancy
- **Good for:** Large installations

## 🔋 Power Management

### Uninterruptible Power Supply (UPS)
- Protects against power outages
- Allows graceful shutdown
- Prevents data corruption

### Battery Backup
- For mobile setups
- USB power banks work for Raspberry Pi
- Consider solar panels for outdoor use

## 📱 Mobile Setup Example

Perfect for food trucks, outdoor events, or temporary locations:

1. **Device 1:** Mobile hotspot + Server (smartphone or tablet)
2. **Device 2-N:** POS terminals (tablets with your app)
3. **No internet needed** - Everything works offline
4. **Battery powered** - Can run for hours without power

## 🛠️ Troubleshooting

### Common Issues:

**Q: Devices can't connect to server**
- Check WiFi network (all devices on same network?)
- Verify server IP address
- Check firewall settings
- Try `http://[SERVER_IP]:8080/health`

**Q: Orders not syncing**
- Check WebSocket connection
- Verify real-time sync is enabled
- Check server logs
- Try restarting server

**Q: Server stops working**
- Use PM2 or systemd for auto-restart
- Check available disk space
- Monitor server resources
- Set up health checks

## 📞 Support

### Self-Diagnostics
1. Visit `http://[SERVER_IP]:8080/health`
2. Check server logs
3. Verify network connectivity
4. Test with single device first

### Production Checklist
- [ ] Server auto-starts on boot
- [ ] Static IP configured
- [ ] Firewall rules set
- [ ] Backup strategy planned
- [ ] UPS connected (if needed)
- [ ] All devices tested
- [ ] Staff trained on WiFi setup

## 💡 Pro Tips

1. **Use static IP** - Prevents connection issues after router restart
2. **Name your network** - Easy identification (e.g., "POS_Network")
3. **Backup regularly** - Export data when internet available
4. **Test scenarios** - Practice server restart, device reconnection
5. **Monitor resources** - Watch CPU, memory, disk space
6. **Keep it simple** - Fewer moving parts = more reliable

## 🔄 Updates

Since the system works offline, updates require:
1. Connect to internet temporarily
2. Download updates
3. Test on development server
4. Deploy to production server
5. Return to offline operation

---

**Remember:** This system is designed to work **completely offline**. You only need:
- Local WiFi network
- One device to run the server
- POS devices connected to the same network

No internet connection required for day-to-day operations!

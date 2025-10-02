# Offline POS System Setup Guide

## Overview
This system enables your MERN POS app to work completely offline with real-time sync between multiple devices on the same WiFi network. No internet required!

## Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │ React Native    │    │ React Native    │
│    (Tablet)     │    │   (Phone)       │    │   (Tablet)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              WiFi Network (no internet)     │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │    Local WiFi Server    │
                    │  (Raspberry Pi/Laptop)  │
                    │  - Node.js + WebSocket  │
                    │  - SQLite Database      │
                    │  - Prints to LAN printer│
                    └─────────────────────────┘
```

## Setup Steps

### 1. Setup Local WiFi Server

#### Option A: Using a Raspberry Pi (Recommended)
```bash
# On Raspberry Pi
cd /Users/alamgirhossain/Downloads/project/local-server
npm install
npm start

# Server will run on: http://[PI_IP]:8080
```

#### Option B: Using a Laptop/Desktop
```bash
# On any computer on the WiFi network
cd /Users/alamgirhossain/Downloads/project/local-server
npm install
npm start

# Find your IP address:
# Mac: ifconfig | grep "inet.*broadcast"
# Windows: ipconfig
# Server will run on: http://[YOUR_IP]:8080
```

### 2. Configure React Native Apps

1. **Find your server IP address**
   - On Mac: `ifconfig | grep "inet.*broadcast"`
   - On Windows: `ipconfig`
   - On Raspberry Pi: `hostname -I`

2. **Update the app to use your server IP**
   - The app will try to connect to `192.168.1.100` by default
   - You can change this in the app settings or code

### 3. Features That Work Offline

✅ **Real-time Order Sync**: Orders created on any device instantly appear on all others
✅ **Product Management**: Add/edit products syncs across devices  
✅ **Inventory Tracking**: Stock levels update in real-time
✅ **Receipt Printing**: Connect to WiFi printers (no internet needed)
✅ **Reports**: Generate sales reports from local data
✅ **Cash Drawer**: Control via connected receipt printer
✅ **Barcode Scanning**: Works with USB/Bluetooth scanners

### 4. Network Setup Requirements

#### WiFi Router Configuration:
- **Router**: Any standard WiFi router (internet not required)
- **IP Range**: Typically 192.168.1.x or 192.168.0.x
- **Devices**: All POS devices + server on same network

#### Hardware Recommendations:
- **Server**: Raspberry Pi 4 (4GB RAM) or any laptop/desktop
- **Storage**: 32GB+ SD card or SSD for Pi
- **Network**: WiFi 6 router for best performance
- **Printer**: Network-enabled receipt printer (ESC/POS compatible)

## How Real-time Sync Works

1. **Device connects** to local WiFi server via WebSocket
2. **Orders created** on any device are instantly broadcast to server
3. **Server relays** order to all other connected devices
4. **Local storage** on each device ensures data persists if WiFi disconnects
5. **Auto-reconnect** when WiFi connection is restored

## Troubleshooting

### Connection Issues
```bash
# Test if server is reachable
curl http://[SERVER_IP]:8080/api/orders

# Check WebSocket connection
# In browser console:
const ws = new WebSocket('ws://[SERVER_IP]:8080');
ws.onopen = () => console.log('Connected!');
```

### Common IP Addresses to Try
- `192.168.1.100` (default)
- `192.168.1.1` (router)
- `192.168.0.1` (alternative router)
- `10.0.0.1` (some routers)

### Server Discovery
The app includes automatic server discovery:
```typescript
// Automatically scan for POS servers on network
const servers = await wifiSyncService.discoverServer();
console.log('Found servers:', servers);
```

## Production Deployment

### Using Docker (Recommended)
```dockerfile
# Dockerfile for the server
FROM node:18-alpine
WORKDIR /app
COPY local-server/package*.json ./
RUN npm install --production
COPY local-server/ .
EXPOSE 8080
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t pos-server .
docker run -p 8080:8080 pos-server
```

### Using Raspberry Pi as Dedicated Server
1. Install Raspberry Pi OS Lite
2. Install Node.js: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`
3. Clone and setup server code
4. Create systemd service for auto-start
5. Connect to UPS for power protection

## Alternative Approaches

### If WebSocket doesn't work in your environment:

#### Option 1: HTTP Polling
```typescript
// Instead of WebSocket, poll server every 2 seconds
setInterval(async () => {
  const orders = await fetch('http://server:8080/api/orders');
  // Compare with local orders and sync differences
}, 2000);
```

#### Option 2: CouchDB + PouchDB (Most Robust)
```bash
# Install CouchDB on server
docker run -p 5984:5984 -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password couchdb

# In your React Native app
import PouchDB from 'pouchdb-react-native';
const localDB = new PouchDB('pos');
const remoteDB = new PouchDB('http://admin:password@server:5984/pos');
localDB.sync(remoteDB, { live: true, retry: true });
```

#### Option 3: Firebase + Local Network
- Use Firebase Firestore with offline persistence
- Data syncs when internet is available
- Works offline with local cache

## Benefits of This Approach

🚀 **Zero Internet Dependency**: Works completely offline
⚡ **Real-time Updates**: Sub-second sync between devices  
🔒 **Data Security**: All data stays on your local network
💰 **Cost Effective**: No monthly SaaS fees
🔧 **Full Control**: Customize everything to your needs
📱 **Cross Platform**: Works on web, iOS, Android
🖨️ **Hardware Integration**: Printers, scanners, cash drawers

This setup gives you enterprise-grade POS functionality without internet dependency!

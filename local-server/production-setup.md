# Production Deployment Guide for Offline POS System

## Option 1: Dedicated Device Server (Recommended)

### Hardware Options:
- **Raspberry Pi 4** - Low cost, low power consumption
- **Intel NUC** - More powerful, can handle many concurrent connections
- **Old laptop/desktop** - Repurpose existing hardware
- **Mini PC** - Compact dedicated server

### Setup Steps:
1. Install Node.js on the dedicated device
2. Copy the local-server folder to the device
3. Install dependencies: `npm install`
4. Set static IP address for the server device
5. Configure auto-start on boot

### Auto-start Configuration:

#### For Linux/Raspberry Pi (systemd):
Create file: `/etc/systemd/system/pos-server.service`
```
[Unit]
Description=POS WiFi Sync Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pos-server
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

Enable auto-start:
```bash
sudo systemctl enable pos-server
sudo systemctl start pos-server
```

#### For Windows:
Use Windows Service or Task Scheduler to auto-start

#### For macOS:
Create launchd plist file

## Option 2: Router with Custom Firmware
- **OpenWrt** compatible routers can run Node.js
- Flash custom firmware and install the server
- Router acts as both network and server

## Option 3: Mobile Hotspot + Server Device
- Use one device as WiFi hotspot
- Run server on the same or another device
- Perfect for mobile/temporary setups

## Option 4: Network Attached Storage (NAS)
- Synology, QNAP, or similar NAS devices
- Many support Docker or Node.js packages
- Always-on, low power consumption

## Network Configuration

### Static IP Setup:
```javascript
// Add to server.js for production
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

server.listen(PORT, HOST, () => {
  console.log(`POS Server running on ${HOST}:${PORT}`);
  console.log('Server accessible on local network without internet');
});
```

### Firewall Rules:
- Open port 8080 (or your chosen port)
- Allow local network access only
- Block external internet access for security

## Data Persistence

### Add SQLite for Production:
```bash
npm install sqlite3
```

Replace in-memory storage with SQLite database for data persistence across restarts.

## Backup Strategy
- Regular database backups
- Export to USB/external storage
- Sync to cloud when internet available (optional)

## Monitoring
- Health check endpoints
- Log file rotation
- Device connection monitoring
- Automatic restart on failure

## Security Considerations
- Change default ports
- Enable basic authentication if needed
- Network isolation from internet
- Regular security updates when internet available

## Power Management
- UPS (Uninterruptible Power Supply) for server device
- Battery backup for mobile setups
- Graceful shutdown procedures

## Testing
- Test server restart scenarios
- Verify auto-reconnection of POS devices
- Test with multiple concurrent devices
- Simulate network interruptions

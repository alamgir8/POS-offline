# CloudClever POS Offline Sync — Complete Documentation

**Version**: 1.0 • **Scope**: Retail + Restaurant (KDS/BDS) • **Stack**: MERN, Expo RN, Node Hub • **Mode**: Online + True Offline (LAN)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Quick Start Guide](#3-quick-start-guide)
4. [Local Development](#4-local-development)
5. [Production Deployment](#5-production-deployment)
6. [API Documentation](#6-api-documentation)
7. [Troubleshooting](#7-troubleshooting)
8. [Advanced Configuration](#8-advanced-configuration)

---

## 1. Project Overview

### What is CloudClever POS?

CloudClever POS is a modern, offline-first Point of Sale system designed for restaurants and retail stores. It enables **true offline operations** with real-time synchronization across multiple devices on the same local network, even when internet connectivity is unavailable.

### Key Features

- ✅ **Offline-First Architecture**: Full functionality without internet
- ✅ **Real-time Sync**: Multi-device updates < 500ms over LAN
- ✅ **Multi-tenant Support**: Secure tenant/store isolation
- ✅ **Event Sourcing**: Append-only event log with conflict resolution
- ✅ **Cross-Platform**: Web (React) + Mobile (React Native)
- ✅ **Auto-Discovery**: Devices automatically find hub via mDNS
- ✅ **Kitchen Display System (KDS)**: Real-time order management
- ✅ **Bar Display System (BDS)**: Beverage order tracking

### Use Cases

- **Restaurants**: POS terminals, kitchen displays, bar displays
- **Retail Stores**: Multiple checkout terminals, inventory management
- **Pop-up Shops**: Temporary locations with limited connectivity
- **Remote Locations**: Areas with unreliable internet

---

## 1) Goals & Non‑Goals

**Goals**

* Full functionality **without internet** (orders, park/re‑park, pay, KDS/BDS, printing).
* **Real‑time** updates across multiple devices on the **same Wi‑Fi**.
* **Safe conflict handling** (order lease locks + versioning; CRDT for inventory).
* **Multi‑tenant isolation** via `{tenantId, storeId}` realms and signed tokens.
* **Simple rollout & fleet updates** at scale.

**Non‑Goals**

* Global cross‑store sync without WAN (each store operates independently offline).
* Browser acting as a LAN server (not feasible for production mDNS/inbound sockets).

---

---

## 2. Architecture

### High-Level Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Native Client  │    │   KDS/BDS Tab   │
│  (React/Vite)   │    │ (React Native)  │    │   (React)       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │         Socket.IO over LAN/WiFi             │
          │                      │                      │
    ┌─────┴──────────────────────┴──────────────────────┴─────┐
    │                 Hub Server                             │
    │           (Node.js + Socket.IO)                        │
    │     • Event Store (SQLite)                             │
    │     • Real-time Relay                                  │
    │     • mDNS Advertisement                               │
    │     • Multi-tenant Isolation                           │
    └────────────────────┬───────────────────────────────────┘
                         │
                    (Optional)
                         │
    ┌────────────────────┴───────────────────────────────────┐
    │                Cloud Bridge                            │
    │     • Event Synchronization                            │
    │     • Backup & Recovery                                │
    │     • Cross-store Analytics                            │
    └────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Hub Server** (`/hub`)
- **Technology**: Node.js + Express + Socket.IO
- **Storage**: SQLite for event persistence
- **Role**: Central relay for real-time event distribution
- **Discovery**: Advertises via mDNS (`_cloudclever-pos._tcp`)
- **Port**: 4001 (configurable)

#### 2. **Web Client** (`/web`)
- **Technology**: React + Vite + Socket.IO Client
- **Storage**: RxDB with Dexie (IndexedDB)
- **Role**: POS interface for cashiers/managers
- **Features**: Order management, payments, reports

#### 3. **Native Client** (`/native`)
- **Technology**: React Native + Expo + Socket.IO Client
- **Storage**: SQLite via Expo
- **Role**: Mobile POS, kitchen displays
- **Features**: Touch-optimized interface, offline operation

#### 4. **Shared Types** (`/shared`)
- **Technology**: TypeScript definitions
- **Role**: Common interfaces and utilities
- **Contents**: EventBase, Order types, validation functions

---

## 3. Quick Start Guide

### Prerequisites

- **Node.js**: 18+ LTS
- **npm** or **yarn**
- **Git**
- **Expo CLI**: `npm install -g @expo/cli`
- **Development Device**: iOS Simulator, Android Emulator, or physical device

### 1. Clone Repository

```bash
git clone https://github.com/alamgir8/POS-offline.git
cd POS-offline
```

### 2. Start Hub Server

```bash
cd hub
npm install
npm run dev
```

The hub server will start on `http://localhost:4001` and advertise via mDNS.

### 3. Start Web Client

```bash
# Open new terminal
cd web
npm install
npm run dev
```

Access the web interface at `http://localhost:5173`

### 4. Start Native Client

```bash
# Open new terminal
cd native
npm install
npx expo start
```

Follow Expo CLI instructions to run on your device/simulator.

### 5. Test Offline Sync

1. **Create an order** on the web client
2. **Observe real-time update** on the native client
3. **Disconnect internet** (keep devices on same WiFi)
4. **Continue creating/updating orders** - sync still works!
5. **Reconnect internet** - all data synchronizes to cloud

---

## 3) Data & Event Model

**EventBase**

```ts
export type EventBase = {
  eventId: string;            // uuid v7 preferred (v4 ok)
  tenantId: string;           // multi-tenant boundary
  storeId: string;            // store/branch
  aggregateType: 'order' | 'kds' | 'bds' | 'inventory' | 'payment';
  aggregateId: string;        // orderId/ticketId
  version: number;            // monotonic per aggregate
  type: string;               // e.g. 'order.created' | 'order.parked' | 'order.paid'
  at: string;                 // ISO
  actor: { deviceId: string; userId?: string };
  clock: { lamport: number; deviceId: string };  // causal ordering
  payload: Record<string, any>;
};
```

**Critical event types**

* Orders: `order.created`, `order.parked`, `order.reparked`, `order.updated`, `order.paid`, `order.locked`, `order.lock.renew`, `order.lock.released`
* KDS/BDS: `kds.ticket.created`, `kds.ticket.ack`, `kds.ticket.done`, `bds.ticket.created`, `bds.ticket.done`
* Inventory: `inventory.adjusted` (CRDT PN‑counter)

**Conflict strategy**

* **Lease locks** (30–60s renewable) on order edit. Others read‑only until lock expires.
* **Optimistic concurrency** (reject stale ≤ version).
* **Lamport clock** tie‑break; then `eventId` lexicographic.
* **Inventory CRDT**: tolerate concurrent increments/decrements.

---

## 4) Repos & Package Layout

```
cloudclever-pos/
  hub/             # Node + Socket.io (LAN relay + event log cache)
  web/             # Vite + React + RxDB (Dexie storage)
  native/          # Expo React Native + SQLite
  docs/            # This document, diagrams, runbooks
```

---

## 4. Local Development

### Environment Setup

#### System Requirements

- **Node.js**: 18.x LTS or higher
- **npm**: 8.x or higher (or yarn 1.22+)
- **Git**: Latest version
- **Operating System**: macOS, Windows 10+, or Linux

#### Development Tools

```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Install development dependencies (optional)
npm install -g typescript ts-node nodemon
```

### Project Structure

```
offline-pos/
├── hub/                  # Node.js Hub Server
│   ├── src/
│   │   ├── index.ts     # Main server entry
│   │   ├── auth.ts      # Authentication logic
│   │   ├── eventStore.ts # Event persistence
│   │   └── types.ts     # TypeScript definitions
│   ├── package.json
│   └── tsconfig.json
├── web/                 # React Web Client
│   ├── src/
│   │   ├── App.tsx      # Main app component
│   │   ├── contexts/    # React contexts (Auth, Data)
│   │   ├── components/  # UI components
│   │   └── sync/        # Sync client logic
│   ├── package.json
│   └── vite.config.ts
├── native/              # React Native Client
│   ├── src/
│   │   ├── app/         # Expo Router pages
│   │   ├── contexts/    # React contexts (Auth, Sync)
│   │   ├── components/  # UI components
│   │   └── db/          # SQLite database
│   ├── package.json
│   └── app.json
├── shared/              # Shared TypeScript definitions
│   ├── types.ts         # Common interfaces
│   └── utils.ts         # Utility functions
└── README.md
```

### Detailed Setup Instructions

#### 1. Hub Server Setup

```bash
cd hub

# Install dependencies
npm install

# Start development server
npm run dev

# Or start with automatic restart on changes
npm run watch
```

**Environment Variables** (create `.env` file):

```env
PORT=4001
HOST=0.0.0.0
NODE_ENV=development
TENANT_ID=demo
STORE_ID=store_001
```

**Available Scripts:**

- `npm run dev` - Start development server with ts-node
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run watch` - Start with file watching (auto-restart)

#### 2. Web Client Setup

```bash
cd web

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

**Available Scripts:**

- `npm run dev` - Start Vite development server (http://localhost:5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run typecheck` - Run TypeScript type checking

**Configuration:**

The web client automatically discovers the hub server via:
1. mDNS discovery (when available)
2. Fallback to `localhost:4001`
3. Manual IP entry in settings

#### 3. Native Client Setup

```bash
cd native

# Install dependencies
npm install

# Start Expo development server
npx expo start

# Or run directly on specific platform
npx expo run:ios      # iOS Simulator
npx expo run:android  # Android Emulator
```

**Development Options:**

- **Expo Go App**: Scan QR code to run on physical device
- **iOS Simulator**: Press `i` in Expo CLI
- **Android Emulator**: Press `a` in Expo CLI
- **Web**: Press `w` in Expo CLI (limited functionality)

### Development Workflow

#### 1. Starting All Services

Use the provided scripts to start all services simultaneously:

```bash
# Root directory script (if available)
./start.sh

# Or manually start each service:
# Terminal 1: Hub
cd hub && npm run dev

# Terminal 2: Web
cd web && npm run dev

# Terminal 3: Native
cd native && npx expo start
```

#### 2. Testing Real-time Sync

1. **Start all services** as described above
2. **Access web client** at http://localhost:5173
3. **Open native client** on device/simulator
4. **Login with demo credentials**:
   - Email: `admin@restaurant.demo`
   - Password: `password123`
   - Tenant ID: `demo`

5. **Test sync**:
   - Create order on web → should appear on native instantly
   - Add items on native → should update on web
   - Test offline: disconnect internet, sync should still work over LAN

#### 3. Debug Mode

Enable debug logging in each client:

**Web Client** (browser console):
```javascript
localStorage.setItem('debug', 'pos:*');
```

**Native Client** (in app settings):
- Enable "Debug Mode" toggle
- View logs in Expo CLI or React Native Debugger

**Hub Server** (environment variable):
```bash
DEBUG=hub:* npm run dev
```

### Network Configuration

#### Finding Your Development IP

For testing across devices, you need your computer's IP address:

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```cmd
ipconfig | findstr "IPv4"
```

#### Updating Client Configuration

**Native Client:**
Update the IP in `/native/src/contexts/SyncContext.tsx`:

```typescript
const discoveredIP = '192.168.1.100'; // Your computer's IP
```

**Web Client:**
The web client will auto-discover, but you can force an IP in the settings panel.

### Troubleshooting Development Issues

#### Common Problems

1. **Port Already in Use**
   ```bash
   # Find process using port 4001
   lsof -ti:4001
   
   # Kill the process
   kill -9 <PID>
   ```

2. **mDNS Discovery Not Working**
   - Ensure all devices are on the same WiFi network
   - Check firewall settings
   - Use manual IP entry as fallback

3. **Expo Connection Issues**
   ```bash
   # Clear Expo cache
   npx expo start --clear
   
   # Reset Metro bundler cache
   npx expo start --reset-cache
   ```

4. **TypeScript Errors**
   ```bash
   # Check types in all projects
   npm run typecheck  # In each project directory
   ```

5. **Socket.IO Connection Failures**
   - Verify hub server is running
   - Check console for connection errors
   - Ensure correct IP/port configuration

#### Debug Tools

- **React Developer Tools**: Browser extension for React debugging
- **Flipper**: Mobile app debugging (React Native)
- **Postman**: Test hub server API endpoints
- **Browser DevTools**: Network tab for WebSocket connections

---
## 5. Production Deployment

### Overview

Production deployment involves setting up a dedicated hub server (typically a Raspberry Pi) in each store location, with automatic discovery and robust offline operation.

### Hardware Requirements

#### Recommended Setup
- **Hub Server**: Raspberry Pi 4 (4GB RAM) or Intel NUC
- **Storage**: 32GB+ microSD card (Class 10) or SSD
- **Network**: Wired Ethernet connection preferred
- **Power**: Uninterruptible Power Supply (UPS) recommended

#### Minimum Requirements
- **Hub Server**: Raspberry Pi 3B+ (2GB RAM)
- **Storage**: 16GB microSD card
- **Network**: WiFi connection acceptable
- **Power**: Standard power adapter

### Raspberry Pi Setup

#### 1. Operating System Installation

```bash
# Download Raspberry Pi OS Lite (64-bit)
# Flash to microSD card using Raspberry Pi Imager

# Enable SSH before first boot
touch /boot/ssh

# Configure WiFi (if needed)
# Edit /boot/wpa_supplicant.conf
```

#### 2. Initial Configuration

```bash
# SSH into Pi
ssh pi@raspberrypi.local

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git avahi-daemon docker.io docker-compose-plugin

# Add pi user to docker group
sudo usermod -aG docker pi

# Enable services
sudo systemctl enable avahi-daemon
sudo systemctl enable docker
```

#### 3. mDNS Service Configuration

Create `/etc/avahi/services/pos-hub.service`:

```xml
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">CloudClever POS Hub - %h</name>
  <service>
    <type>_cloudclever-pos._tcp</type>
    <port>4001</port>
    <txt-record>version=1.0.0</txt-record>
    <txt-record>tenantId=demo</txt-record>
    <txt-record>storeId=store_001</txt-record>
  </service>
</service-group>
```

```bash
# Restart Avahi daemon
sudo systemctl restart avahi-daemon
```

### Docker Deployment

#### 1. Create Deployment Directory

```bash
sudo mkdir -p /opt/pos-hub
cd /opt/pos-hub
```

#### 2. Environment Configuration

Create `/opt/pos-hub/.env`:

```env
# Store Configuration
TENANT_ID=your-tenant-id
STORE_ID=your-store-id
PORT=4001
HOST=0.0.0.0

# Security
JWT_SECRET=your-secure-jwt-secret
CLUSTER_PUBLIC_KEY_BASE64=your-public-key

# Cloud Bridge (optional)
CLOUD_BRIDGE_URL=https://api.yourcloud.com/events
CLOUD_BRIDGE_TOKEN=your-api-token

# Development
NODE_ENV=production
DEBUG=false
```

#### 3. Docker Compose Configuration

Create `/opt/pos-hub/docker-compose.yml`:

```yaml
version: '3.8'

services:
  hub:
    image: cloudclever/pos-hub:latest
    container_name: pos-hub
    restart: unless-stopped
    env_file: .env
    ports:
      - "${PORT}:${PORT}"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${PORT}/api/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 40s
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  # Auto-updater (optional)
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --label-enable --cleanup --interval 3600
    environment:
      - WATCHTOWER_NOTIFICATIONS=slack
      - WATCHTOWER_NOTIFICATION_SLACK_HOOK_URL=${SLACK_WEBHOOK_URL}
```

#### 4. Start Services

```bash
# Create data directory
sudo mkdir -p /opt/pos-hub/data /opt/pos-hub/logs

# Set permissions
sudo chown -R pi:pi /opt/pos-hub

# Start services
docker compose up -d

# Verify status
docker compose ps
docker compose logs hub
```

### Client Configuration

#### Web Client Deployment

For production web client deployment:

```bash
# Build optimized version
cd web
npm run build

# Deploy to web server (Nginx, Apache, etc.)
# Or use a CDN/static hosting service
```

**Nginx Configuration Example:**

```nginx
server {
    listen 80;
    server_name pos.yourstore.com;
    
    location / {
        root /var/www/pos-web;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy hub requests
    location /api/ {
        proxy_pass http://hub.local:4001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Native Client Distribution

**Option 1: Expo Application Services (EAS)**

```bash
cd native

# Install EAS CLI
npm install -g eas-cli

# Configure build
eas build:configure

# Build for production
eas build --platform all

# Submit to app stores
eas submit
```

**Option 2: Direct APK Distribution**

```bash
# Build standalone APK
npx expo build:android --type apk

# Distribute APK directly to devices
```

### Monitoring and Maintenance

#### System Monitoring

Create `/opt/pos-hub/monitor.sh`:

```bash
#!/bin/bash

# Check hub service health
if ! curl -f http://localhost:4001/api/health > /dev/null 2>&1; then
    echo "Hub service unhealthy, restarting..."
    docker compose restart hub
fi

# Check disk space
DISK_USAGE=$(df /opt/pos-hub | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "Disk usage high: ${DISK_USAGE}%"
    # Clean old logs
    find /opt/pos-hub/logs -name "*.log" -mtime +7 -delete
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", ($3/$2) * 100.0}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
    echo "Memory usage high: ${MEMORY_USAGE}%"
    docker compose restart hub
fi
```

Add to crontab:

```bash
# Edit crontab
crontab -e

# Add monitoring script (run every 5 minutes)
*/5 * * * * /opt/pos-hub/monitor.sh >> /opt/pos-hub/logs/monitor.log 2>&1
```

#### Log Management

```bash
# View real-time logs
docker compose logs -f hub

# Archive old logs
logrotate /opt/pos-hub/logs/*.log

# Send logs to cloud (when online)
rsync -av /opt/pos-hub/logs/ user@cloud-server:/backups/store-001/
```

#### Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/pos-hub/backups"

mkdir -p "$BACKUP_DIR"

# Backup database
cp /opt/pos-hub/data/events.sqlite "$BACKUP_DIR/events_$DATE.sqlite"

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" /opt/pos-hub/.env /opt/pos-hub/docker-compose.yml

# Clean old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.sqlite" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

### Security Considerations

#### Network Security

- **Firewall Configuration**: Only open necessary ports (4001)
- **VPN Access**: Use VPN for remote management
- **Network Segmentation**: Isolate POS network from guest WiFi

#### Application Security

- **JWT Tokens**: Use strong secrets and short expiration times
- **HTTPS**: Use TLS certificates for web clients
- **Access Control**: Implement role-based permissions

#### Physical Security

- **Device Lock**: Secure Raspberry Pi in locked enclosure
- **UPS**: Prevent data corruption from power loss
- **Tamper Detection**: Monitor for unauthorized access

---

### 6.4 Docker Compose (Hub + auto‑update)

`/opt/pos-hub/docker-compose.yml`

```yaml
services:
  hub:
    image: cloudclever/pos-hub:1.0.0   # pin semver
    restart: unless-stopped
    env_file: .env
    ports: ["${PORT}:${PORT}"]
    volumes: ["./data:/data"]
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:${PORT}/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --label-enable --cleanup --interval 3600
```

Bring up:

```bash
docker compose pull
docker compose up -d
```

### 6.5 Autostart

Systemd unit `/etc/systemd/system/pos-hub.service` to run `docker compose up -d` at boot.

### 6.6 Security

* **Cluster Token (JWT)** per `{tenantId, storeId}`. Devices must present a token; Hub verifies using `CLUSTER_PUBLIC_KEY_BASE64`.
* Tokens are short‑lived with refresh when WAN exists; include a long‑lived offline grace for known devices.
* Optional **TLS on LAN** using `mkcert` and a packaged root CA installed on clients.

### 6.7 Cloud Bridge

* Hub batches unsent events → `POST /events/ingest` (idempotent by `eventId`).
* Hub pulls cloud events since `cursor` → rebroadcasts to LAN.
* Use MessagePack or gzip to keep payloads small.

### 6.8 Printing & KDS/BDS

* KDS/BDS tabs connect to Hub just like POS clients.
* For ESC/POS printers, Hub holds TCP connections and prints on `kds.ticket.*` events (LAN‑only works offline).

---

## 7) Multi‑Tenancy & Realms

* Realm = `{tenantId, storeId}`.
* **One Hub per store**. If co‑locating multiple tenants on one mini‑PC, run **one container per realm** with separate ports and `.env` files.
* mDNS name includes realm data. Clients choose the matching realm via their Cluster Token.

---

## 8) Client Behavior (Prod)

* On launch: discover `_poshub._tcp` → validate TXT records → connect to matching realm.
* If discovery fails: fall back to last known IP/port or manual entry.
* **Local‑first**: apply event + persist, then emit to Hub.
* **Outbox**: queue unsent events when disconnected; flush on reconnect.
* **Locks**: acquire/renew lease events during edits; block conflicting writes.

---

## 9) Updates & Rollbacks at Scale

**Strategy A — Watchtower** (simple): label opt‑in, hourly check, auto‑pull semver tags.
**Strategy B — Tailscale + Ansible** (controlled): run targeted `docker compose pull && up -d` playbooks; verify `/healthz`; auto‑rollback on failure.
**Canary**: mark a subset of stores to follow the `canary` tag; promote to `stable` once metrics are clean.

---

## 10) Observability & Ops

* **Health**: `/healthz` (200 = ok), `/status` (peers, cursor, queue length, version).
* **Logs**: JSON logs to stdout; rotate via Docker; ship to cloud when WAN is back.
* **Metrics** (optional): Prometheus endpoint for event rate, latency, queue depth.
* **Backups**: use **Litestream** to replicate `/data/events.sqlite` to S3 when WAN returns.

---

## 11) QA & Acceptance Criteria

**Happy paths**

* Create → Park → Re‑Park → Pay flows propagate < 500ms across N devices on same LAN.
* KDS ticket appears within < 500ms; mark done → front‑of‑house updates.
* Internet down: same behavior; when WAN returns, cloud shows all events in order.

**Resilience**

* Kill Hub → restart in 10s → all clients catch up via `events.bulk` (no duplicates).
* Two devices edit same order: lock prevents conflict; if forced, higher Lamport wins.
* Power loss → Hub comes up; SQLite journal recovers; no data loss beyond last in‑flight ms.

**Multi‑tenant isolation**

* Device with wrong tenant token is rejected.
* Co‑hosted Hubs don’t leak events across realms.

---

## 12) Network & Capacity Planning

* Socket.io WS on port `4001` (configurable). ~0.5–2 KB per order event (MessagePack/gzip smaller).
* Raspberry Pi 4 (4GB) handles **hundreds of events/sec** easily; memory footprint < 200MB.
* Recommend wired Ethernet for Hub; Wi‑Fi AC for clients.

---

## 13) Migration from Current System

1. Identify all write endpoints → emit corresponding **events** (keep REST for now).
2. Add **event ingestion** API in cloud (idempotent by `eventId`).
3. Implement **read model updaters** in clients (already in demo).
4. Gradually route UI writes → local event bus → hub/cloud replication.
5. Turn on locks & outbox; ship Hub to pilot store.

---

## 14) API Contracts (Socket.io)

**Client → Hub**

* `hello` `{ deviceId, tenantId, storeId, cursor }`
* `events.append` `EventBase`
* `cursor.request` `{ fromLamport }`

**Hub → Client**

* `hello.ack` `{ leaderId, snapshotNeeded }`
* `events.bulk` `{ events: EventBase[] }`
* `events.relay` `EventBase`

**Cloud Bridge (HTTP)**

* `POST /events/ingest` — body: `EventBase[]` (idempotent)
* `GET /events?since=<lamport>` — returns `EventBase[]`

---

## 15) Security Checklist

* JWT Cluster Token with `aud: pos-hub`, `sub: deviceId`, `tenantId`, `storeId`, `exp`, `nbf`.
* Hub verifies signature offline; rejects mismatched realm.
* Rate‑limit per device; backoff on spam.
* Optional LAN TLS (mkcert) for PII protection on crowded networks.

---

## 16) Roadmap (post‑MVP hardening)

* **Auto‑discovery in clients** (mDNS + fallback cache)
* **Outbox** + exponential backoff
* **Order lock UI** (who’s editing)
* **Inventory CRDT** & stock reservations
* **KDS/BDS UIs**; printer spooling from Hub
* **Cloud reconciliation dashboard** (diffs, replays)

---

## 17) Runbooks (Ops)

* Restart Hub: `docker compose restart hub`
* Update Hub (watchtower): push new tag → watchtower pulls within 1h
* Manual update: `docker compose pull && docker compose up -d`
* Inspect status: `curl http://<hub-ip>:4001/status`
* Reset store data (danger): stop hub, remove `/opt/pos-hub/data/*`, start hub

---

## 18) Appendices

### A) Sample Orders Schema (RxDB)

```ts
const orders = {
  title: 'orders', version: 0, primaryKey: 'orderId', type: 'object',
  properties: {
    orderId: { type: 'string' },
    status: { type: 'string', enum: ['active','parked','paid'] },
    items: { type: 'array', items: { type: 'object' } },
    version: { type: 'number' },
    lamport: { type: 'number' }
  }, required: ['orderId','status','version','lamport']
} as const
```

### B) Example `.env` for Dev Hub

```env
TENANT_ID=t-demo
STORE_ID=s-001
PORT=4001
CLUSTER_PUBLIC_KEY_BASE64=BASE64_PEM_HERE
CLOUD_BRIDGE_URL=
CLOUD_BRIDGE_TOKEN=
```

### C) Notes on Storage Choices

* **Web**: RxDB + **Dexie** over IndexedDB (PouchDB storage deprecated/removed).
* **Native**: Expo **SQLite** (free) or RxDB Premium SQLite if you want identical APIs.

---

## 19) Acceptance — Definition of Done

* Pilot store runs with **one Pi Hub**, 2+ tills, 1 KDS, 1 BDS for 7 days with **zero WAN** and **no outages**.
* All core flows (orders, park/re‑park, pay, KDS tickets) are **< 500ms** and **lossless**.
* After WAN returns, **cloud reflects all events**; no duplicates; versions monotonic.
* Fleet update from `1.0.0` → `1.0.1` succeeds across canary stores; rollback path verified.

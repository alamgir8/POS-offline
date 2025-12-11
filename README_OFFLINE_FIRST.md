# Offline-First POS System

A complete offline-first Point of Sale system that works in both **Restaurant** and **Retail** modes. The system supports real-time synchronization across multiple devices on the same WiFi network, even without internet connectivity.

## 🌟 Key Features

### Offline-First Architecture
- **Works 100% Offline**: All operations work without internet
- **LAN Sync**: Real-time sync between devices on the same WiFi network
- **Event Sourcing**: All changes are tracked as events for reliable sync
- **Lamport Clocks**: Proper ordering of events across distributed devices

### Restaurant Mode Features
- **Park Orders**: Save orders for later (e.g., table waiting)
- **KDS (Kitchen Display System)**: Food items automatically sent to kitchen
- **BDS (Bar Display System)**: Beverage items automatically sent to bar
- **Table Service**: Track table numbers and guest counts
- **Order Locking**: Prevents same order from being opened on multiple devices

### Retail Mode Features
- **Quick Checkout**: Direct payment flow without parking
- **No KDS/BDS**: Retail items don't need kitchen/bar displays
- **Simple Workflow**: Optimized for fast transactions

### Multi-Device Support
- **Web Client**: React-based browser app
- **Native Mobile**: React Native app for iOS/Android
- **Automatic Hub Discovery**: Devices find each other via mDNS

## 📁 Project Structure

```
offline-pos/
├── hub/                    # Central sync hub server
│   └── src/
│       ├── index.ts        # Main server with WebSocket
│       ├── eventStore.ts   # Event storage & retrieval
│       ├── lockManager.ts  # Order locking system
│       ├── auth.ts         # Authentication
│       └── types.ts        # Shared types
├── web/                    # Web client (React + Vite)
│   └── src/
│       ├── contexts/
│       │   ├── AuthContext.tsx
│       │   ├── DataContext.tsx    # Enhanced data with sync
│       │   └── CartContext.tsx
│       ├── components/
│       │   ├── POSScreen.tsx
│       │   └── LoginScreen.tsx
│       └── sync/
│           └── client.ts   # Sync client
├── native/                 # Native mobile app (React Native + Expo)
│   └── src/
│       ├── contexts/
│       │   ├── AuthContext.tsx
│       │   ├── DataContext.tsx
│       │   ├── CartContext.tsx
│       │   └── SyncContext.tsx    # Enhanced sync
│       └── app/
│           └── (tabs)/     # Tab screens (POS, KDS, BDS, Orders)
└── shared/                 # Shared types and utilities
    ├── types.ts            # Common type definitions
    └── posService.ts       # Business logic
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- For native: Expo CLI

### 1. Start the Hub Server

```bash
cd hub
npm install
npm run dev
```

The hub server will start on port 4001 and advertise itself via mDNS.

### 2. Start the Web Client

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### 3. Start the Native App

```bash
cd native
npm install
npx expo start
```

Scan the QR code with Expo Go app.

## 🔐 Demo Accounts

| Mode | Email | Password |
|------|-------|----------|
| Restaurant Admin | admin@restaurant.demo | password123 |
| Retail Admin | admin@retail.demo | password123 |
| Cashier | cashier@restaurant.demo | cashier123 |

## 🔄 How Sync Works

### Event Flow

1. **Device A creates an order**
   - Order is saved locally (IndexedDB/AsyncStorage)
   - Event `order.created` is emitted to hub
   - Hub broadcasts event to all connected devices
   - All devices update their local state

2. **Device B parks the order**
   - Device B receives the order from sync
   - Device B parks the order
   - Event `order.parked` is emitted
   - Hub broadcasts to all devices

3. **Device C tries to open parked order**
   - Device C sends `order.lock.request`
   - Hub checks if lock is available
   - If locked by B, returns error with holder info
   - If available, grants lock to C

### Lamport Clocks

Events are ordered using Lamport logical clocks:
- Each event has a `lamport` timestamp
- When receiving an event, clock = max(local, received) + 1
- Ensures causal ordering across devices

### Offline Queue

When offline:
- Events are queued in memory and AsyncStorage
- When reconnected, queue is processed
- Hub handles duplicate detection (idempotent events)

## 📱 Restaurant Mode Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                       ORDER FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │  Create  │───▶│   Park   │───▶│  Unpark  │───┐           │
│  │  Order   │    │  Order   │    │  Order   │   │           │
│  └──────────┘    └──────────┘    └──────────┘   │           │
│       │                               │          │           │
│       │ (Food items)                  │          ▼           │
│       ▼                               │    ┌──────────┐      │
│  ┌──────────┐                         │    │   Pay    │      │
│  │   KDS    │                         │    │  Order   │      │
│  │  Ticket  │◀────────────────────────┘    └──────────┘      │
│  └──────────┘                                                │
│       │ (Beverage items)                                     │
│       ▼                                                      │
│  ┌──────────┐                                                │
│  │   BDS    │                                                │
│  │  Ticket  │                                                │
│  └──────────┘                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Order Locking

When a device opens a parked order:
1. Lock request sent to hub
2. Hub checks if order is already locked
3. If locked by another device → Error shown
4. If available → Lock granted for 5 minutes
5. Lock auto-renews every 2 minutes while open
6. Lock released on close, pay, or disconnect

## 🛒 Retail Mode Workflow

```
┌─────────────────────────────────────────┐
│            RETAIL FLOW                   │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────┐         ┌──────────┐      │
│  │  Create  │────────▶│   Pay    │      │
│  │  Order   │         │  Order   │      │
│  └──────────┘         └──────────┘      │
│                                          │
│  (No parking, no KDS/BDS)               │
│                                          │
└─────────────────────────────────────────┘
```

## 🔧 Configuration

### Hub Server Environment Variables

```env
PORT=4001              # Server port
HOST=0.0.0.0          # Bind address
JWT_SECRET=your-secret # JWT signing secret
```

### Web Client Environment Variables

```env
VITE_HUB_URL=http://localhost:4001
```

### Native App Configuration

Edit `native/src/contexts/SyncContext.tsx`:
```typescript
const discoveredIP = '192.168.0.143'; // Your hub server IP
```

## 📊 API Endpoints

### Hub Server REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/login` | POST | User login |
| `/api/stats` | GET | Server statistics |
| `/api/events` | GET | Get events (debug) |
| `/api/locks` | GET | Lock statistics |
| `/api/locks/:tenantId/:storeId` | GET | Active locks |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `hello` | Client→Hub | Connection handshake |
| `hello.ack` | Hub→Client | Handshake acknowledgment |
| `events.append` | Client→Hub | Send new event |
| `events.relay` | Hub→Client | Broadcast event |
| `events.bulk` | Hub→Client | Bulk sync events |
| `order.lock.request` | Client→Hub | Request order lock |
| `order.lock.response` | Hub→Client | Lock request result |
| `order.locked` | Hub→Client | Order locked notification |
| `order.lock.released` | Hub→Client | Lock released notification |

## 🧪 Testing Offline Mode

1. Start hub server and clients on same WiFi
2. Create orders on Device A
3. Verify orders appear on Device B
4. Disconnect from internet (turn off WiFi to router)
5. Devices should still see each other (LAN still works)
6. Create more orders - they should sync via LAN
7. Reconnect to internet - everything synced

## 🔒 Security Notes

- This is a demo system - use proper security in production
- JWT secrets should be environment variables
- CORS is open for LAN access
- Implement proper user management for production

## 📝 License

MIT License - See LICENSE file

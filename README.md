# Offline POS LAN-Sync Demo (Web + Expo + Hub)

A complete offline-first POS system with real-time multi-device synchronization on LAN. This implementation includes:

- **Hub Server**: Node.js + Socket.io for LAN-based event synchronization
- **Web Client**: React + Vite + RxDB/IndexedDB for offline-first UI
- **Native Client**: Expo React Native + SQLite for mobile offline support
- **Authentication**: Persistent multi-tenant authentication system
- **Restaurant & Retail Features**: Order parking, re-parking, KDS/BDS support

## Architecture Overview

### Event-Driven Design
- Uses event sourcing with proper versioning and conflict resolution
- Lamport timestamps for ordering distributed events
- Idempotent event processing for reliability

### Offline-First Strategy
- Local-first data storage (IndexedDB for web, SQLite for native)
- Real-time synchronization when devices are on same LAN
- Automatic conflict resolution using last-writer-wins with version checks

### Multi-Tenant Support
- Tenant isolation at data and network levels
- Device-specific authentication tokens
- Store-level permissions and data segregation

## Project Structure

```
offline-pos/
  hub/                    # LAN synchronization server
    src/
      index.ts           # Main server entry
      eventStore.ts      # In-memory event store
      auth.ts           # Authentication middleware
      types.ts          # Shared type definitions
  web/                   # React web client
    src/
      App.tsx           # Main application
      auth/             # Authentication components
      components/       # UI components
      db/               # RxDB setup and models
      sync/             # Real-time sync client
      types/            # Type definitions
  native/                # Expo React Native client
    src/
      App.tsx           # Main mobile app
      auth/             # Auth screens
      components/       # Native components
      db/               # SQLite database
      sync/             # Sync client
  shared/                # Shared utilities and types
    types.ts            # Common type definitions
    utils.ts            # Utility functions
```

## Quick Start

1. **Start the Hub Server**
   ```bash
   cd hub
   npm install
   npm run dev
   ```

2. **Start Web Client**
   ```bash
   cd web
   npm install
   npm run dev
   ```

3. **Start Native Client**
   ```bash
   cd native
   npm install
   npx expo start
   ```

## Features

### Core POS Functionality
- ✅ Multi-tenant authentication
- ✅ Order creation and management
- ✅ Order parking and re-parking
- ✅ Payment processing
- ✅ Real-time synchronization
- ✅ Offline-first operation

### Restaurant Features
- ✅ KDS (Kitchen Display System) integration
- ✅ BDS (Bar Display System) integration
- ✅ Order parking for later service
- ✅ Multiple re-parking of same order

### Retail Features
- ✅ Cart-based ordering
- ✅ Product catalog management
- ✅ Inventory tracking

### Technical Features
- ✅ Conflict resolution with Lamport timestamps
- ✅ Event sourcing architecture
- ✅ Local-first data storage
- ✅ Real-time LAN synchronization
- ✅ Automatic reconnection handling

## Configuration

The system automatically discovers the hub server on the local network. Manual configuration is available for custom setups.

Default hub URL: `http://localhost:4001`

## Security Considerations

- Tenant-based data isolation
- Device authentication tokens
- Local network-only operation (no internet required)
- Event-level access control

## Testing Offline Functionality

1. Start hub server and multiple clients
2. Disconnect from internet (keep local Wi-Fi active)
3. Create orders on any device
4. Verify real-time synchronization across all devices
5. Test order parking and re-parking flows
6. Verify conflict resolution with concurrent operations

## Future Enhancements

- mDNS auto-discovery for hub
- Cloud bridge for WAN synchronization
- Advanced KDS workflow management
- Inventory management integration
- Advanced reporting and analytics

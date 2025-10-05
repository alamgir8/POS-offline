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

## 5) Local Development Setup (Mac/Win/Linux)

### 5.1 Prerequisites

* Node 20 LTS, npm or pnpm
* Git, Docker Desktop (optional for running hub in container)
* Expo CLI (`npm i -g expo`), iOS Simulator / Android Emulator
* Same LAN for all devices when testing offline LAN behavior

### 5.2 Hub — Run locally (Node)

```bash
cd hub
npm i
npm run dev   # starts on :4001
```

* ENV (dev defaults): `PORT=4001`, `TENANT_ID=t-demo`, `STORE_ID=s-001`
* Endpoints: `/healthz`, Socket.io namespace `/` events `hello`, `events.append`, `events.bulk`.

### 5.3 Web — Vite + React + **RxDB Dexie**

**Install** (Dexie storage replaces removed PouchDB storage):

```bash
cd web
npm i
npm run dev
# open http://localhost:5173
```

Set **HUB URL** to `http://<your-laptop-ip>:4001` and test new/park/re‑park/pay flows.

**RxDB init example**

```ts
import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
export async function initDB() {
  const db = await createRxDatabase({ name: 'pos_web', storage: getRxStorageDexie() });
  await db.addCollections({ /* orders schema */ });
  return db as any;
}
```

### 5.4 Native — Expo + SQLite

```bash
cd native
npm i
npx expo start
```

Run on device/emulator. Enter **HUB URL** `http://<hub-ip>:4001`. Use built‑in buttons to create/park/re‑park/pay and observe cross‑device updates.

### 5.5 Local test checklist

* Create order on Web → appears on Native within ~100ms.
* Park on Native → Web updates instantly.
* Kill the Hub, keep clients running → clients queue outbox; when Hub restarts, they flush and converge.
* Turn off internet (keep LAN) → all flows still work.

---

## 6) Production Setup — Raspberry Pi per Store (Recommended)

### 6.1 Base image & packages

* **OS**: Raspberry Pi OS 64‑bit Lite
* Install: `avahi-daemon` (mDNS), Docker, Docker Compose plugin, `curl`, `jq`, `ca-certificates`.

### 6.2 Directory & environment

```
/opt/pos-hub/
  docker-compose.yml
  .env                # TENANT_ID, STORE_ID, PORT, CLUSTER_PUBLIC_KEY_BASE64, CLOUD_BRIDGE_*
  data/               # SQLite event log & cursors
```

**`.env` (per store)**

```bash
TENANT_ID=t-abc
STORE_ID=s-001
PORT=4001
CLUSTER_PUBLIC_KEY_BASE64=...    # for JWT verification offline
CLOUD_BRIDGE_URL=https://api.example.com/events/ingest
CLOUD_BRIDGE_TOKEN=...
```

### 6.3 mDNS advertisement

`/etc/avahi/services/poshub.service`

```xml
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">POS Hub - %h (${STORE_ID}/${TENANT_ID})</name>
  <service>
    <type>_poshub._tcp</type>
    <port>${PORT}</port>
    <txt-record>storeId=${STORE_ID}</txt-record>
    <txt-record>tenantId=${TENANT_ID}</txt-record>
    <txt-record>version=1</txt-record>
  </service>
</service-group>
```

`systemctl restart avahi-daemon`

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

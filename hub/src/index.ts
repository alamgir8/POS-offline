// Main hub server for LAN-based POS synchronization

import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import mdns from "mdns";
import { EventStore } from "./eventStore.js";
import { LockManager } from "./lockManager.js";
import { initializeAuth, authenticateUser, validateSession } from "./auth.js";
import type {
  EventBase,
  ConnectedClient,
  HelloMessage,
  HelloAckMessage,
  EventsBulkMessage,
  LoginRequest,
  HubStats,
} from "./types.js";

// Initialize Express app and HTTP server
const app = express();
const server = createServer(app);

// Configure CORS for local network access
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow all origins for LAN access
    methods: ["GET", "POST"],
    credentials: false,
  },
  transports: ["websocket", "polling"], // Support both transports
});

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Initialize stores
const eventStore = new EventStore();
const lockManager = new LockManager(5 * 60 * 1000); // 5 minute lock timeout
const connectedClients = new Map<string, ConnectedClient>();
const startTime = Date.now();

// Initialize demo authentication data
initializeAuth();

// Socket.io event handlers
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle client hello (connection handshake)
  socket.on("hello", async (msg: HelloMessage) => {
    try {
      console.log(
        `Hello from device: ${msg.deviceId} (tenant: ${msg.tenantId}, store: ${msg.storeId})`
      );

      // Validate tenant and store (in production, check against database)
      if (!msg.tenantId || !msg.storeId || !msg.deviceId) {
        socket.emit("error", {
          code: "INVALID_HELLO",
          message: "Missing required fields: tenantId, storeId, or deviceId",
        });
        return;
      }

      // Register client
      const client: ConnectedClient = {
        socketId: socket.id,
        deviceId: msg.deviceId,
        tenantId: msg.tenantId,
        storeId: msg.storeId,
        lastSeen: new Date(),
        cursor: msg.cursor || 0,
      };

      // Add authentication info if provided
      if (msg.auth?.sessionId) {
        const user = validateSession(msg.auth.sessionId);
        if (user) {
          client.userId = user.userId;
          client.userName = user.userName;
        }
      }

      connectedClients.set(socket.id, client);

      // Send hello acknowledgment
      const helloAck: HelloAckMessage = {
        leaderId: "hub",
        serverTime: new Date().toISOString(),
        snapshotNeeded: false,
      };

      socket.emit("hello.ack", helloAck);

      // Send any pending events since the client's cursor
      const pendingEvents = eventStore.getBulk(client.cursor);
      if (pendingEvents.length > 0) {
        const bulkMessage: EventsBulkMessage = {
          events: pendingEvents,
          fromLamport: client.cursor,
          toLamport: eventStore.getLastLamport(),
        };
        socket.emit("events.bulk", bulkMessage);
        console.log(
          `Sent ${pendingEvents.length} pending events to ${msg.deviceId}`
        );
      }

      // Join tenant/store room for targeted broadcasting
      const roomName = `${msg.tenantId}:${msg.storeId}`;
      socket.join(roomName);
    } catch (error) {
      console.error("Error handling hello:", error);
      socket.emit("error", {
        code: "HELLO_ERROR",
        message: "Failed to process hello message",
      });
    }
  });

  // Handle event append (new events from clients)
  socket.on("events.append", async (event: EventBase) => {
    try {
      const client = connectedClients.get(socket.id);
      if (!client) {
        socket.emit("error", {
          code: "NOT_AUTHENTICATED",
          message: "Client not properly connected",
        });
        return;
      }

      // Validate event belongs to client's tenant/store
      if (
        event.tenantId !== client.tenantId ||
        event.storeId !== client.storeId
      ) {
        socket.emit("error", {
          code: "UNAUTHORIZED",
          message: "Event does not belong to your tenant/store",
        });
        return;
      }

      // Store the event
      const stored = eventStore.append(event);
      if (stored) {
        // Update client cursor
        client.cursor = Math.max(client.cursor, event.clock.lamport);
        client.lastSeen = new Date();

        // Broadcast to all clients in the same tenant/store
        const roomName = `${event.tenantId}:${event.storeId}`;
        io.to(roomName).emit("events.relay", event);

        console.log(
          `Event broadcasted: ${event.type} from ${client.deviceId} to room ${roomName}`
        );
      }
    } catch (error) {
      console.error("Error handling event append:", error);
      socket.emit("error", {
        code: "APPEND_ERROR",
        message: "Failed to process event",
      });
    }
  });

  // Handle cursor request (client wants events from a specific point)
  socket.on("cursor.request", ({ fromLamport }: { fromLamport: number }) => {
    try {
      const client = connectedClients.get(socket.id);
      if (!client) {
        return;
      }

      const events = eventStore.getBulk(fromLamport);
      const bulkMessage: EventsBulkMessage = {
        events,
        fromLamport,
        toLamport: eventStore.getLastLamport(),
      };

      socket.emit("events.bulk", bulkMessage);
      console.log(
        `Sent ${events.length} events from cursor ${fromLamport} to ${client.deviceId}`
      );
    } catch (error) {
      console.error("Error handling cursor request:", error);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      console.log(
        `Client disconnected: ${client.deviceId} (${client.tenantId})`
      );

      // Release all locks held by this device and notify other clients
      const releasedLocks = lockManager.releaseDeviceLocks(client.deviceId);
      if (releasedLocks.length > 0) {
        const roomName = `${client.tenantId}:${client.storeId}`;
        releasedLocks.forEach((lock) => {
          io.to(roomName).emit("order.lock.released", {
            orderId: lock.orderId,
            deviceId: lock.deviceId,
            reason: "device_disconnected",
          });
        });
      }

      connectedClients.delete(socket.id);
    } else {
      console.log(`Unknown client disconnected: ${socket.id}`);
    }
  });

  // Handle order lock request
  socket.on(
    "order.lock.request",
    (data: { orderId: string; tenantId: string; storeId: string }) => {
      const client = connectedClients.get(socket.id);
      if (!client) {
        socket.emit("error", {
          code: "NOT_AUTHENTICATED",
          message: "Client not properly connected",
        });
        return;
      }

      const result = lockManager.acquireLock(
        data.orderId,
        client.deviceId,
        client.userId || "unknown",
        client.userName || "Unknown User",
        data.tenantId,
        data.storeId
      );

      socket.emit("order.lock.response", {
        orderId: data.orderId,
        ...result,
      });

      // If lock acquired, notify other clients
      if (result.success && result.lock) {
        const roomName = `${data.tenantId}:${data.storeId}`;
        socket.to(roomName).emit("order.locked", {
          orderId: data.orderId,
          deviceId: client.deviceId,
          userName: client.userName || "Unknown User",
          acquiredAt: result.lock.acquiredAt,
        });
      }
    }
  );

  // Handle lock renewal
  socket.on(
    "order.lock.renew",
    (data: { orderId: string; tenantId: string; storeId: string }) => {
      const client = connectedClients.get(socket.id);
      if (!client) return;

      const result = lockManager.renewLock(
        data.orderId,
        client.deviceId,
        data.tenantId,
        data.storeId
      );

      socket.emit("order.lock.renewed", {
        orderId: data.orderId,
        success: result.success,
        expiresAt: result.lock?.expiresAt,
      });
    }
  );

  // Handle lock release
  socket.on(
    "order.lock.release",
    (data: { orderId: string; tenantId: string; storeId: string }) => {
      const client = connectedClients.get(socket.id);
      if (!client) return;

      const result = lockManager.releaseLock(
        data.orderId,
        client.deviceId,
        data.tenantId,
        data.storeId
      );

      if (result.success) {
        const roomName = `${data.tenantId}:${data.storeId}`;
        io.to(roomName).emit("order.lock.released", {
          orderId: data.orderId,
          deviceId: client.deviceId,
          reason: "manual_release",
        });
      }
    }
  );

  // Handle lock status check
  socket.on(
    "order.lock.status",
    (data: { orderId: string; tenantId: string; storeId: string }) => {
      const lock = lockManager.getLockStatus(
        data.orderId,
        data.tenantId,
        data.storeId
      );

      socket.emit("order.lock.status.response", {
        orderId: data.orderId,
        isLocked: !!lock,
        lock: lock
          ? {
              deviceId: lock.deviceId,
              userName: lock.userName,
              acquiredAt: lock.acquiredAt,
              expiresAt: lock.expiresAt,
            }
          : null,
      });
    }
  );

  // Handle ping for keepalive
  socket.on("ping", () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.lastSeen = new Date();
      socket.emit("pong");
    }
  });
});

// REST API routes

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  });
});

// Kubernetes/ops friendly health endpoint alias
app.get("/healthz", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  });
});

// Lightweight status endpoint (peers, cursors, counts)
app.get("/status", (req, res) => {
  const clientList = Array.from(connectedClients.values());
  res.json({
    status: "ok",
    data: {
      peers: clientList.map((c) => ({
        deviceId: c.deviceId,
        tenantId: c.tenantId,
        storeId: c.storeId,
        cursor: c.cursor,
        lastSeen: c.lastSeen,
      })),
      totals: {
        connectedClients: connectedClients.size,
        totalEvents: eventStore.getStats().totalEvents,
        lastLamport: eventStore.getLastLamport(),
        uptimeMs: Date.now() - startTime,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Login endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const loginRequest: LoginRequest = req.body;
    const result = await authenticateUser(loginRequest);

    if (result.success) {
      res.json({
        success: true,
        data: {
          user: result.user,
          session: result.session,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint for service discovery
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "cloudclever-pos-hub",
    version: "1.0.0",
    status: "healthy",
    capabilities: [
      "real-time-sync",
      "offline-queue",
      "multi-tenant",
      "event-sourcing",
      "lamport-clocks",
    ],
    data: {
      uptime: Date.now() - startTime,
      connectedClients: connectedClients.size,
      totalEvents: eventStore.getStats().totalEvents,
    },
    timestamp: new Date().toISOString(),
  });
});

// Hub statistics
app.get("/api/stats", (req, res) => {
  const stats: HubStats = {
    connectedClients: connectedClients.size,
    totalEvents: eventStore.getStats().totalEvents,
    eventsPerTenant: eventStore.getStats().tenantCounts,
    uptime: Date.now() - startTime,
  };

  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  });
});

// Get lock statistics
app.get("/api/locks", (req, res) => {
  const lockStats = lockManager.getStats();
  res.json({
    success: true,
    data: lockStats,
    timestamp: new Date().toISOString(),
  });
});

// Get active locks for a tenant/store
app.get("/api/locks/:tenantId/:storeId", (req, res) => {
  const { tenantId, storeId } = req.params;
  const activeLocks = lockManager.getActiveLocks(tenantId, storeId);
  res.json({
    success: true,
    data: {
      locks: activeLocks,
      count: activeLocks.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// Get events (for debugging)
app.get("/api/events", (req, res) => {
  try {
    const { tenantId, storeId, fromLamport } = req.query;

    const filter: any = {};
    if (tenantId) filter.tenantId = tenantId as string;
    if (storeId) filter.storeId = storeId as string;
    if (fromLamport) filter.fromLamport = parseInt(fromLamport as string);

    const events = eventStore.getEvents(filter);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch events",
      timestamp: new Date().toISOString(),
    });
  }
});

// Start server
const PORT = parseInt(process.env.PORT || "4001");
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`🚀 Offline POS Hub Server started`);
  console.log(`📡 Listening on ${HOST}:${PORT}`);
  console.log(`🌐 WebSocket server ready for LAN connections`);
  console.log(`🔐 Demo authentication enabled`);
  console.log(`📊 REST API available at http://${HOST}:${PORT}/api`);

  // Advertise service via mDNS for automatic discovery
  try {
    const serviceType = mdns.tcp("cloudclever-pos");
    const serviceOptions = {
      name: "CloudClever POS Hub",
      port: PORT,
      txtRecord: {
        version: "1.0.0",
        protocol: "cloudclever-pos",
        features: "real-time-sync,offline-queue,multi-tenant",
      },
    };

    const advertisement = mdns.createAdvertisement(
      serviceType,
      PORT,
      serviceOptions
    );
    advertisement.start();

    console.log(
      `📻 mDNS service advertised as 'cloudclever-pos' on port ${PORT}`
    );
    console.log(`🔍 Devices can auto-discover this hub on the LAN`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️ mDNS advertisement failed (service will still work):`,
      errorMessage
    );
  }

  console.log("");
  console.log("Demo Accounts:");
  console.log("  Restaurant: admin@restaurant.demo / password123");
  console.log("  Retail: admin@retail.demo / password123");
  console.log("  Cashier: cashier@restaurant.demo / cashier123");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Gracefully shutting down hub server...");
  lockManager.shutdown();
  server.close(() => {
    console.log("✅ Hub server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down hub server...");
  lockManager.shutdown();
  server.close(() => {
    console.log("✅ Hub server closed");
    process.exit(0);
  });
});

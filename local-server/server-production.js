// Production server configuration
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces
const NODE_ENV = process.env.NODE_ENV || 'development';

// In-memory storage (replace with SQLite for production persistence)
let orders = [];
let products = [];
let devices = new Map();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: devices.size,
    orders: orders.length,
  });
});

// Network info endpoint
app.get('/network-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];

  Object.keys(networkInterfaces).forEach((name) => {
    networkInterfaces[name].forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          address: net.address,
          netmask: net.netmask,
        });
      }
    });
  });

  res.json({ addresses, port: PORT });
});

// REST API for initial data sync
app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/orders', (req, res) => {
  const order = { ...req.body, id: Date.now().toString() };
  orders.push(order);
  res.json(order);

  // Broadcast to all connected devices
  broadcastToAll({
    type: 'ORDER_UPDATED',
    data: order,
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log(`📱 New device connected from ${req.socket.remoteAddress}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received message:`, data.type);

      switch (data.type) {
        case 'DEVICE_DISCOVERY':
          devices.set(ws, {
            id: data.deviceId,
            connectedAt: new Date(),
            lastSeen: new Date(),
          });

          ws.send(
            JSON.stringify({
              type: 'DISCOVERY_RESPONSE',
              serverInfo: {
                timestamp: new Date().toISOString(),
                ordersCount: orders.length,
                connectedDevices: devices.size,
              },
            })
          );
          break;

        case 'NEW_ORDER':
          orders.push(data.data);
          console.log(`📝 New order received: ${data.data.order_number}`);

          // Broadcast to all other devices
          broadcastToOthers(ws, {
            type: 'ORDER_UPDATED',
            data: data.data,
          });
          break;

        case 'UPDATE_ORDER':
          const orderIndex = orders.findIndex((o) => o.id === data.data.id);
          if (orderIndex !== -1) {
            orders[orderIndex] = { ...orders[orderIndex], ...data.data };
            console.log(`📝 Order updated: ${data.data.order_number}`);

            // Broadcast to all other devices
            broadcastToOthers(ws, {
              type: 'ORDER_UPDATED',
              data: orders[orderIndex],
            });
          }
          break;

        case 'INITIAL_SYNC':
          ws.send(
            JSON.stringify({
              type: 'SYNC_DATA',
              data: {
                orders: orders,
                products: products,
              },
            })
          );
          break;
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  ws.on('close', () => {
    devices.delete(ws);
    console.log(`📱 Device disconnected. Active connections: ${devices.size}`);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    devices.delete(ws);
  });
});

// Helper functions
function broadcastToAll(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastToOthers(sender, message) {
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, HOST, () => {
  console.log('🚀 POS WiFi Sync Server Started');
  console.log('================================');
  console.log(`📍 Address: ${HOST}:${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(
    `💾 Storage: In-memory (${
      NODE_ENV === 'production' ? 'consider SQLite' : 'development'
    })`
  );
  console.log('🔌 Offline capable: YES');
  console.log('🌐 Internet required: NO');
  console.log('================================');

  // Display local network addresses
  const networkInterfaces = os.networkInterfaces();
  console.log('📡 Available on local network:');
  Object.keys(networkInterfaces).forEach((name) => {
    networkInterfaces[name].forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   http://${net.address}:${PORT}`);
      }
    });
  });
  console.log('================================');
});

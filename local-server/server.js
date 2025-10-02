// Universal POS WiFi Sync Server - Auto-detecting all network types
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

// Auto-detect network type and get addresses
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  let networkType = 'unknown';

  Object.keys(interfaces).forEach((name) => {
    interfaces[name].forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          address: net.address,
          netmask: net.netmask,
        });

        // Auto-detect network type based on IP range
        const ip = net.address;
        if (ip.startsWith('172.20.10.')) {
          networkType = 'iPhone-Hotspot';
        } else if (
          ip.startsWith('192.168.43.') ||
          ip.startsWith('192.168.137.')
        ) {
          networkType = 'Android-Hotspot';
        } else if (ip.startsWith('10.')) {
          networkType = 'Mobile-Hotspot';
        } else if (ip.startsWith('192.168.')) {
          networkType = 'WiFi-Router';
        } else if (ip.startsWith('169.254.')) {
          networkType = 'Ad-Hoc';
        } else {
          networkType = 'Corporate/Other';
        }
      }
    });
  });

  return { addresses, networkType };
}

// Health check endpoint
app.get('/health', (req, res) => {
  const { addresses, networkType } = getNetworkInfo();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: devices.size,
    orders: orders.length,
    networkType: networkType,
    addresses: addresses,
  });
});

// Network discovery endpoint
app.get('/discover', (req, res) => {
  const { addresses, networkType } = getNetworkInfo();
  res.json({
    server: 'POS WiFi Sync Server',
    version: '1.0.0',
    addresses: addresses,
    networkType: networkType,
    port: PORT,
    uptime: process.uptime(),
    features: ['offline-sync', 'real-time', 'auto-discovery'],
  });
});

// Network info endpoint
app.get('/network-info', (req, res) => {
  const { addresses, networkType } = getNetworkInfo();
  res.json({
    addresses: addresses,
    networkType: networkType,
    port: PORT,
    environment: NODE_ENV,
  });
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
  const clientIP = req.socket.remoteAddress;
  const { networkType } = getNetworkInfo();
  console.log(`📱 Device connected from ${clientIP} (${networkType})`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received: ${data.type} from ${clientIP}`);

      switch (data.type) {
        case 'DEVICE_DISCOVERY':
          devices.set(ws, {
            id: data.deviceId,
            ip: clientIP,
            connectedAt: new Date(),
            lastSeen: new Date(),
          });

          const { addresses, networkType } = getNetworkInfo();
          ws.send(
            JSON.stringify({
              type: 'DISCOVERY_RESPONSE',
              serverInfo: {
                timestamp: new Date().toISOString(),
                ordersCount: orders.length,
                connectedDevices: devices.size,
                networkType: networkType,
                addresses: addresses,
              },
            })
          );
          break;

        case 'NEW_ORDER':
          // Check for duplicates before adding
          const existingOrderIndex = orders.findIndex(
            (o) => o.id === data.data.id
          );
          if (existingOrderIndex === -1) {
            orders.push(data.data);
            console.log(`📝 New order: ${data.data.order_number}`);

            broadcastToOthers(ws, {
              type: 'NEW_ORDER',
              data: data.data,
            });
          } else {
            console.log(
              `⚠️ Duplicate order ignored: ${data.data.order_number}`
            );
          }
          break;

        case 'UPDATE_ORDER':
          const orderIndex = orders.findIndex((o) => o.id === data.data.id);
          if (orderIndex !== -1) {
            orders[orderIndex] = { ...orders[orderIndex], ...data.data };
            console.log(`📝 Order updated: ${data.data.order_number}`);

            broadcastToOthers(ws, {
              type: 'ORDER_UPDATED',
              data: orders[orderIndex],
            });
          } else {
            console.log(
              `⚠️ Order not found for update: ${data.data.order_number}`
            );
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
    console.log(`📱 Device disconnected. Active: ${devices.size}`);
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

// Start server with auto-detection
server.listen(PORT, HOST, () => {
  const { addresses, networkType } = getNetworkInfo();

  console.log('🚀 Universal POS WiFi Sync Server Started');
  console.log('==========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Host: ${HOST} (all interfaces)`);
  console.log(`🏢 Environment: ${NODE_ENV}`);
  console.log(`📡 Network Type: ${networkType}`);
  console.log('🔌 Offline capable: YES');
  console.log('🌐 Internet required: NO');
  console.log('==========================================');

  if (addresses.length > 0) {
    console.log('📱 Connect your POS devices to:');
    addresses.forEach((addr) => {
      console.log(`   📍 http://${addr.address}:${PORT}`);
      console.log(`   🔗 ws://${addr.address}:${PORT}`);
    });
  } else {
    console.log('⚠️  No network interfaces found. Check network connection.');
  }

  console.log('==========================================');
  console.log('🔍 Health check: http://[IP]:8080/health');
  console.log('🔍 Discovery: http://[IP]:8080/discover');
  console.log('🔍 Network info: http://[IP]:8080/network-info');
  console.log('==========================================');

  // Show network-specific tips
  if (networkType.includes('Hotspot')) {
    console.log('💡 Mobile Hotspot Tips:');
    console.log('   • Keep hotspot device plugged in');
    console.log('   • Use "Maximize Compatibility" mode');
    console.log('   • Disable client isolation if available');
  } else if (networkType === 'WiFi-Router') {
    console.log('💡 WiFi Router Tips:');
    console.log('   • Consider setting static IP');
    console.log('   • Configure port forwarding if needed');
  }
  console.log('==========================================');
});

// WebSocket for real-time sync
wss.on('connection', (ws, req) => {
  const deviceId = `device_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  devices.set(deviceId, ws);

  console.log(`Device connected: ${deviceId}`);

  // Send current data to new device
  ws.send(
    JSON.stringify({
      type: 'INITIAL_SYNC',
      data: { orders, products },
    })
  );

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(deviceId, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    devices.delete(deviceId);
    console.log(`Device disconnected: ${deviceId}`);
  });
});

function handleMessage(deviceId, message) {
  switch (message.type) {
    case 'NEW_ORDER':
      const order = { ...message.data, id: Date.now().toString() };
      orders.push(order);
      broadcast(
        {
          type: 'NEW_ORDER',
          data: order,
        },
        deviceId
      ); // Exclude sender
      break;

    case 'UPDATE_ORDER':
      const index = orders.findIndex((o) => o.id === message.data.id);
      if (index !== -1) {
        orders[index] = { ...orders[index], ...message.data };
        broadcast(
          {
            type: 'ORDER_UPDATED',
            data: orders[index],
          },
          deviceId
        );
      }
      break;
  }
}

function broadcast(message, excludeDevice = null) {
  devices.forEach((ws, deviceId) => {
    if (deviceId !== excludeDevice && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

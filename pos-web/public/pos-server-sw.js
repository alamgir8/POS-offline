// Enhanced POS Server Service Worker
// Provides local HTTP server functionality for master device

const CACHE_NAME = 'pos-server-v1';
const VERSION = '1.0.0';

// Server state
let serverRunning = false;
let connectedDevices = new Map();
let serverConfig = {
  port: 3001,
  host: '0.0.0.0',
  maxConnections: 50,
  syncInterval: 30000,
};

// Sample data
let products = [
  {
    id: 1,
    name: 'Burger',
    price: 12.99,
    category: 'Main',
    image: '🍔',
    stock: 50,
  },
  {
    id: 2,
    name: 'Pizza',
    price: 18.99,
    category: 'Main',
    image: '🍕',
    stock: 30,
  },
  {
    id: 3,
    name: 'Fries',
    price: 4.99,
    category: 'Sides',
    image: '🍟',
    stock: 100,
  },
  {
    id: 4,
    name: 'Salad',
    price: 8.99,
    category: 'Healthy',
    image: '🥗',
    stock: 25,
  },
  {
    id: 5,
    name: 'Soda',
    price: 2.99,
    category: 'Drinks',
    image: '🥤',
    stock: 200,
  },
  {
    id: 6,
    name: 'Coffee',
    price: 3.99,
    category: 'Drinks',
    image: '☕',
    stock: 150,
  },
  {
    id: 7,
    name: 'Ice Cream',
    price: 5.99,
    category: 'Dessert',
    image: '🍦',
    stock: 40,
  },
  {
    id: 8,
    name: 'Sandwich',
    price: 9.99,
    category: 'Main',
    image: '🥪',
    stock: 35,
  },
];

let orders = [];
let nextOrderId = 1;

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, config, device } = event.data;

  switch (type) {
    case 'START_SERVER':
      if (config) {
        serverConfig = { ...serverConfig, ...config };
      }
      startServer();
      break;

    case 'STOP_SERVER':
      stopServer();
      break;

    case 'SYNC_DEVICE':
      if (device) {
        syncWithDevice(device);
      }
      break;

    case 'GET_STATUS':
      sendMessage('SERVER_STATUS', {
        running: serverRunning,
        connectedDevices: connectedDevices.size,
        config: serverConfig,
      });
      break;
  }
});

function startServer() {
  serverRunning = true;
  console.log('🚀 POS Server started on service worker');

  sendMessage('SERVER_STATUS', {
    running: true,
    port: serverConfig.port,
    maxConnections: serverConfig.maxConnections,
  });

  // Start device discovery announcements
  startDeviceAnnouncements();
}

function stopServer() {
  serverRunning = false;
  connectedDevices.clear();
  console.log('⏹️ POS Server stopped');

  sendMessage('SERVER_STATUS', { running: false });
}

function startDeviceAnnouncements() {
  // Announce server availability every 5 seconds
  setInterval(() => {
    if (serverRunning) {
      broadcastServerAvailability();
    }
  }, 5000);
}

function broadcastServerAvailability() {
  const announcement = {
    type: 'SERVER_AVAILABLE',
    serverId: 'master-001',
    serverName: 'POS Master Hub',
    port: serverConfig.port,
    services: ['inventory', 'orders', 'sync', 'discovery'],
    timestamp: Date.now(),
  };

  // In a real implementation, this would broadcast to the local network
  console.log('📡 Broadcasting server availability:', announcement);
}

function syncWithDevice(device) {
  try {
    console.log(`🔄 Syncing with device: ${device.name}`);

    // Simulate sync operations
    const syncData = {
      products: products,
      orders: orders.slice(-10), // Last 10 orders
      timestamp: Date.now(),
    };

    // Update device last seen
    connectedDevices.set(device.id, {
      ...device,
      lastSync: new Date(),
      status: 'synced',
    });

    sendMessage('SYNC_COMPLETE', {
      device: device.id,
      recordsCount: syncData.products.length + syncData.orders.length,
    });
  } catch (error) {
    console.error('❌ Sync failed:', error);
    sendMessage('ERROR', { error: error.message, device: device.id });
  }
}

function sendMessage(type, data) {
  // Send message to all clients
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, data });
    });
  });
}

// Fetch event handler - Main API routing
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Pass through other requests
  event.respondWith(fetch(event.request));
});

async function handleApiRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  console.log(`📡 API Request: ${method} ${path}`);

  try {
    // Health check
    if (path === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          server: 'POS Service Worker',
          version: VERSION,
          running: serverRunning,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Server info
    if (path === '/api/server/info') {
      return new Response(
        JSON.stringify({
          name: 'POS Master Hub',
          version: VERSION,
          config: serverConfig,
          connectedDevices: connectedDevices.size,
          uptime: Date.now(), // Simplified uptime
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Device management
    if (path === '/api/devices') {
      if (method === 'GET') {
        return new Response(
          JSON.stringify(Array.from(connectedDevices.values())),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (method === 'POST') {
        const deviceData = await request.json();
        const deviceId = deviceData.id || `device-${Date.now()}`;

        connectedDevices.set(deviceId, {
          ...deviceData,
          id: deviceId,
          connectedAt: new Date(),
          lastSeen: new Date(),
        });

        sendMessage('DEVICE_CONNECTED', { device: deviceData });

        return new Response(
          JSON.stringify({
            success: true,
            deviceId,
            message: 'Device registered successfully',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 201,
          }
        );
      }
    }

    // Device heartbeat
    if (path.startsWith('/api/devices/') && path.endsWith('/heartbeat')) {
      const deviceId = path.split('/')[3];

      if (connectedDevices.has(deviceId)) {
        const device = connectedDevices.get(deviceId);
        device.lastSeen = new Date();
        connectedDevices.set(deviceId, device);

        return new Response(
          JSON.stringify({
            success: true,
            serverTime: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'Device not found',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Products API
    if (path === '/api/products') {
      if (method === 'GET') {
        return new Response(JSON.stringify(products), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'POST') {
        const productData = await request.json();
        const newProduct = {
          id: Math.max(...products.map((p) => p.id)) + 1,
          ...productData,
        };
        products.push(newProduct);

        return new Response(JSON.stringify(newProduct), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
    }

    // Single product
    if (path.startsWith('/api/products/')) {
      const productId = parseInt(path.split('/')[3]);
      const product = products.find((p) => p.id === productId);

      if (method === 'GET') {
        if (product) {
          return new Response(JSON.stringify(product), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      if (method === 'PUT') {
        if (product) {
          const updateData = await request.json();
          const updatedProduct = { ...product, ...updateData };
          const index = products.findIndex((p) => p.id === productId);
          products[index] = updatedProduct;

          return new Response(JSON.stringify(updatedProduct), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        });
      }
    }

    // Orders API
    if (path === '/api/orders') {
      if (method === 'GET') {
        return new Response(JSON.stringify(orders), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'POST') {
        const orderData = await request.json();
        const newOrder = {
          id: nextOrderId++,
          ...orderData,
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        orders.push(newOrder);

        // Notify all connected devices about new order
        sendMessage('NEW_ORDER', { order: newOrder });

        return new Response(JSON.stringify(newOrder), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
    }

    // Single order
    if (path.startsWith('/api/orders/')) {
      const orderId = parseInt(path.split('/')[3]);
      const order = orders.find((o) => o.id === orderId);

      if (method === 'GET') {
        if (order) {
          return new Response(JSON.stringify(order), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      if (method === 'PUT') {
        if (order) {
          const updateData = await request.json();
          const updatedOrder = {
            ...order,
            ...updateData,
            updatedAt: new Date().toISOString(),
          };
          const index = orders.findIndex((o) => o.id === orderId);
          orders[index] = updatedOrder;

          // Notify all connected devices about order update
          sendMessage('ORDER_UPDATED', { order: updatedOrder });

          return new Response(JSON.stringify(updatedOrder), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        });
      }
    }

    // Sync endpoint
    if (path === '/api/sync') {
      if (method === 'GET') {
        return new Response(
          JSON.stringify({
            products: products,
            orders: orders,
            lastSync: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Discovery endpoint
    if (path === '/api/discover') {
      return new Response(
        JSON.stringify({
          serverName: 'POS Master Hub',
          services: ['inventory', 'orders', 'sync'],
          version: VERSION,
          capabilities: ['multi-device', 'real-time-sync', 'offline-support'],
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Not found
    return new Response(
      JSON.stringify({
        error: 'Not found',
        path: path,
        method: method,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  } catch (error) {
    console.error('❌ API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}

// Installation and activation
self.addEventListener('install', (event) => {
  console.log('🔧 POS Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ POS Service Worker activated');
  event.waitUntil(self.clients.claim());
});

console.log('📡 POS Server Service Worker loaded successfully');

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    handleServerMessage(event.data);
  }
});

// Handle fetch requests (act as local server)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests to our local server paths
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/pos-server/')
  ) {
    event.respondWith(handleServerRequest(event.request));
  }
});

async function handleServerRequest(request) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  console.log(`🌐 Server request: ${method} ${path}`);

  try {
    // Health check endpoint
    if (path === '/api/health' || path === '/pos-server/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          server: 'pos-local-server',
          timestamp: new Date().toISOString(),
          devices: connectedDevices.size,
          orders: orders.length,
          products: products.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get products
    if (path === '/api/products' && method === 'GET') {
      return new Response(
        JSON.stringify({
          products,
          total: products.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update product stock
    if (path.startsWith('/api/products/') && method === 'PATCH') {
      const productId = path.split('/')[3];
      const updateData = await request.json();

      const productIndex = products.findIndex((p) => p.id === productId);
      if (productIndex !== -1) {
        products[productIndex] = { ...products[productIndex], ...updateData };

        // Broadcast to all devices
        broadcastToDevices({
          type: 'PRODUCT_UPDATED',
          product: products[productIndex],
        });

        return new Response(
          JSON.stringify({
            success: true,
            product: products[productIndex],
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Device discovery endpoint
    if (path === '/api/discover' || path === '/pos-server/discover') {
      return new Response(
        JSON.stringify({
          server: 'pos-local-server',
          type: 'master-device',
          capabilities: ['orders', 'sync', 'kds', 'bds'],
          version: '1.0.0',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Device registration
    if (path === '/api/devices/register' && method === 'POST') {
      const deviceData = await request.json();
      const deviceId = deviceData.deviceId || `device_${Date.now()}`;

      connectedDevices.set(deviceId, {
        ...deviceData,
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });

      // Notify main app about new device
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'DEVICE_CONNECTED',
            deviceId,
            deviceData,
          });
        });
      });

      return new Response(
        JSON.stringify({
          success: true,
          deviceId,
          message: 'Device registered successfully',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get orders
    if (path === '/api/orders' && method === 'GET') {
      return new Response(
        JSON.stringify({
          orders,
          total: orders.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create order
    if (path === '/api/orders' && method === 'POST') {
      const orderData = await request.json();
      const orderId = orderData.id || `order_${Date.now()}`;

      const newOrder = {
        ...orderData,
        id: orderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: orderData.status || 'pending',
      };

      orders.push(newOrder);

      // Broadcast to all connected devices
      broadcastToDevices({
        type: 'ORDER_CREATED',
        order: newOrder,
      });

      return new Response(
        JSON.stringify({
          success: true,
          order: newOrder,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update order
    if (path.startsWith('/api/orders/') && method === 'PUT') {
      const orderId = path.split('/').pop();
      const updateData = await request.json();

      const orderIndex = orders.findIndex((o) => o.id === orderId);
      if (orderIndex !== -1) {
        orders[orderIndex] = {
          ...orders[orderIndex],
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        // Broadcast update to all devices
        broadcastToDevices({
          type: 'ORDER_UPDATED',
          order: orders[orderIndex],
        });

        return new Response(
          JSON.stringify({
            success: true,
            order: orders[orderIndex],
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'Order not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // WebSocket simulation for real-time updates
    if (path === '/api/ws' || path === '/pos-server/ws') {
      // Return WebSocket-like response for real-time connection
      return new Response(
        JSON.stringify({
          type: 'websocket_info',
          message: 'WebSocket connection simulated via service worker',
          endpoints: ['/api/orders', '/api/devices'],
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Default response for unknown endpoints
    return new Response(
      JSON.stringify({
        error: 'Endpoint not found',
        available_endpoints: [
          '/api/health',
          '/api/discover',
          '/api/devices/register',
          '/api/orders',
          '/api/ws',
        ],
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Server request error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'SERVER_START':
      console.log('🚀 Local server started via service worker');
      break;

    case 'SERVER_STOP':
      console.log('🛑 Local server stopped');
      connectedDevices.clear();
      orders = [];
      orderItems = [];
      break;

    case 'BROADCAST_MESSAGE':
      broadcastToDevices(data.message);
      break;

    default:
      console.log('Unknown server message:', data);
  }
}

function broadcastToDevices(message) {
  // Send message to all connected clients (simulating WebSocket broadcast)
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'BROADCAST',
        message,
        timestamp: new Date().toISOString(),
      });
    });
  });
}

// Periodic cleanup of inactive devices
setInterval(() => {
  const now = new Date().getTime();
  const timeout = 5 * 60 * 1000; // 5 minutes

  connectedDevices.forEach((device, deviceId) => {
    const lastSeen = new Date(device.lastSeen).getTime();
    if (now - lastSeen > timeout) {
      console.log(`🧹 Removing inactive device: ${deviceId}`);
      connectedDevices.delete(deviceId);
    }
  });
}, 60000); // Check every minute

console.log('🔧 POS Local Server Service Worker installed');

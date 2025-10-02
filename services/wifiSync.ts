import { Order, OrderItem } from '../lib/supabase';
import { storageService } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WiFiSyncMessage {
  type:
    | 'NEW_ORDER'
    | 'UPDATE_ORDER'
    | 'ORDER_UPDATED'
    | 'INITIAL_SYNC'
    | 'SYNC_DATA'
    | 'DEVICE_DISCOVERY'
    | 'DISCOVERY_RESPONSE';
  data: any;
}

class WiFiSyncService {
  private deviceId: string;
  private websocket: WebSocket | null = null;
  private serverIP: string = '';
  private serverPort: number = 3001; // Updated to match server default
  private isConnected: boolean = false;
  private reconnectInterval?: any;
  private listeners: Set<(event: any) => void> = new Set();

  constructor() {
    this.deviceId = `device_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  async startSync(serverIP?: string) {
    if (serverIP) {
      this.serverIP = serverIP;
      await AsyncStorage.setItem('pos_server_ip', serverIP);
    } else {
      // Try to get saved server IP
      const savedIP = await AsyncStorage.getItem('pos_server_ip');
      if (savedIP) {
        this.serverIP = savedIP;
      } else {
        throw new Error('Server IP not provided and no saved IP found');
      }
    }

    console.log(`🚀 Starting WiFi sync to ${this.serverIP}:${this.serverPort}`);
    this.connectToServer();
  }

  private connectToServer() {
    try {
      const wsUrl = `ws://${this.serverIP}:${this.serverPort}`;
      console.log(`🔗 Connecting to ${wsUrl}`);

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('✅ Connected to local POS server');
        this.isConnected = true;
        this.clearReconnectInterval();

        // Request initial sync
        this.send({
          type: 'DEVICE_DISCOVERY',
          data: { deviceId: this.deviceId },
        });
      };

      this.websocket.onmessage = (event) => {
        try {
          const message: WiFiSyncMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('🔌 Disconnected from server');
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.tryAutoDiscovery();
      };
    } catch (error) {
      console.error('Failed to connect to server:', error);
      this.tryAutoDiscovery();
    }
  }

  private async tryAutoDiscovery() {
    console.log('🔍 Attempting auto-discovery...');

    // First, try the smart discovery endpoint
    const discoveredIP = await this.discoverServerOnNetwork();
    if (discoveredIP) {
      this.serverIP = discoveredIP;
      await this.saveServerConfig();
      this.connectToServer();
      return;
    }

    // Fallback to health check scanning
    const commonIPs = this.generateCommonIPs();

    for (const ip of commonIPs) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const response = await fetch(`http://${ip}:${this.serverPort}/health`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ Found server at ${ip}:${this.serverPort}`);
          this.serverIP = ip;
          await this.saveServerConfig();
          this.connectToServer();
          return;
        }
      } catch (error) {
        // Continue to next IP
      }
    }

    console.log('❌ Auto-discovery failed, scheduling reconnect...');
    this.scheduleReconnect();
  }

  private generateCommonIPs(): string[] {
    const ips = [
      // Current stored IP (try first)
      this.serverIP,

      // Current detected server IP from server output
      '192.168.0.243', // Current WiFi IP from server output
      '10.167.4.87', // Current mobile hotspot IP

      // Common router/gateway IPs
      '192.168.0.1',
      '192.168.1.1',
      '192.168.43.1', // Android hotspot
      '172.20.10.1', // iPhone hotspot
      '10.0.0.1',
      '10.167.4.1',

      // Scan current network range (192.168.0.x)
      '192.168.0.100',
      '192.168.0.101',
      '192.168.0.102',
      '192.168.0.200',
      '192.168.0.250',

      // Scan 192.168.1.x range
      '192.168.1.100',
      '192.168.1.101',
      '192.168.1.102',

      // Mobile hotspot ranges
      '172.20.10.2',
      '172.20.10.3',
      '192.168.43.2',
      '192.168.43.3',
    ];

    // Remove duplicates and filter out invalid IPs
    return [...new Set(ips)].filter((ip) => ip && ip !== '');
  }

  private async saveServerConfig() {
    try {
      await AsyncStorage.setItem('pos_server_ip', this.serverIP);
      await AsyncStorage.setItem('pos_server_port', this.serverPort.toString());
    } catch (error) {
      console.error('Failed to save server config:', error);
    }
  }

  private scheduleReconnect() {
    this.clearReconnectInterval();
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('🔄 Attempting to reconnect...');
        this.connectToServer();
      }
    }, 5000);
  }

  private clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
  }

  private async handleMessage(message: WiFiSyncMessage) {
    console.log(`📥 Received: ${message.type}`);

    switch (message.type) {
      case 'INITIAL_SYNC':
      case 'SYNC_DATA':
        await this.handleInitialSync(message.data);
        break;
      case 'NEW_ORDER':
        await this.handleNewOrder(message.data);
        break;
      case 'ORDER_UPDATED':
        await this.handleOrderUpdate(message.data);
        break;
    }
  }

  private async handleInitialSync(data: { orders: Order[]; products: any[] }) {
    try {
      console.log(`🔄 Syncing ${data.orders?.length || 0} orders from server`);

      // Clear existing orders to prevent duplicates during initial sync
      const existingOrders = await storageService.getOrders();

      // Sync orders with duplicate prevention
      for (const order of data.orders || []) {
        const exists = existingOrders.find(
          (o) => o.id === order.id || o.order_number === order.order_number
        );

        if (!exists) {
          const added = await storageService.addOrderWithDeduplication(order);
          if (added) {
            console.log(`✅ Added order from sync: ${order.order_number}`);
          }
        } else {
          console.log(`⚠️ Order already exists: ${order.order_number}`);
        }
      }

      this.notifyListeners({
        type: 'INITIAL_SYNC_COMPLETE',
        data,
      });
    } catch (error) {
      console.error('Error handling initial sync:', error);
    }
  }

  private async handleNewOrder(order: Order) {
    try {
      const added = await storageService.addOrderWithDeduplication(order);

      if (added) {
        console.log(`✅ Synced new order: ${order.order_number}`);
        this.notifyListeners({
          type: 'ORDER_SYNCED',
          order,
        });
      } else {
        console.log(`⚠️ Duplicate order ignored: ${order.order_number}`);
      }
    } catch (error) {
      console.error('Error handling new order:', error);
    }
  }

  private async handleOrderUpdate(order: Order) {
    try {
      // Check if order exists before updating
      const existingOrders = await storageService.getOrders();
      const existingOrder = existingOrders.find((o) => o.id === order.id);

      if (existingOrder) {
        await storageService.updateOrder(order.id, {
          status: order.status,
          total_amount: order.total_amount,
          updated_at: order.updated_at,
        });

        console.log(`✅ Synced order update: ${order.order_number}`);

        this.notifyListeners({
          type: 'ORDER_UPDATED',
          order,
        });
      } else {
        console.log(
          `⚠️ Order not found for update, adding as new: ${order.order_number}`
        );
        const added = await storageService.addOrderWithDeduplication(order);

        if (added) {
          this.notifyListeners({
            type: 'ORDER_SYNCED',
            order,
          });
        }
      }
    } catch (error) {
      console.error('Error handling order update:', error);
    }
  }

  private send(message: WiFiSyncMessage) {
    if (this.websocket && this.isConnected) {
      this.websocket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: not connected to server');
    }
  }

  // Public methods for broadcasting changes
  async broadcastNewOrder(order: Order, items: OrderItem[]) {
    const message: WiFiSyncMessage = {
      type: 'NEW_ORDER',
      data: { ...order, items },
    };

    this.send(message);
    console.log(`📤 Broadcasting new order: ${order.order_number}`);
  }

  async broadcastOrderUpdate(order: Order) {
    const message: WiFiSyncMessage = {
      type: 'UPDATE_ORDER',
      data: order,
    };

    this.send(message);
    console.log(`📤 Broadcasting order update: ${order.order_number}`);
  }

  async discoverServerOnNetwork(): Promise<string | null> {
    console.log('🔍 Scanning network for POS server...');

    const commonIPs = this.generateCommonIPs();

    for (const ip of commonIPs) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        const response = await fetch(
          `http://${ip}:${this.serverPort}/discover`,
          {
            method: 'GET',
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.server === 'POS WiFi Sync Server') {
            console.log(`✅ Found POS server at ${ip}:${this.serverPort}`);
            console.log(`📡 Network type: ${data.networkType}`);
            return ip;
          }
        }
      } catch (error) {
        // Continue scanning
      }
    }

    return null;
  }

  async updateServerConfig(ip: string, port: number = 3001) {
    this.serverIP = ip;
    this.serverPort = port;
    await this.saveServerConfig();

    // Disconnect current connection if any
    if (this.websocket) {
      this.websocket.close();
    }

    // Try to connect to new server
    this.connectToServer();

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeout);
          resolve(true);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  getCurrentServerConfig() {
    return {
      ip: this.serverIP,
      port: this.serverPort,
      connected: this.isConnected,
    };
  }

  // Listener management
  addListener(callback: (event: any) => void) {
    this.listeners.add(callback);
  }

  removeListener(callback: (event: any) => void) {
    this.listeners.delete(callback);
  }

  private notifyListeners(event: any) {
    this.listeners.forEach((callback) => callback(event));
  }

  // Status methods
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      serverIP: this.serverIP,
      deviceId: this.deviceId,
    };
  }

  // Server discovery (scan local network for POS server)
  async discoverServer(): Promise<string[]> {
    const possibleIPs: string[] = [];

    // Get local IP range (simplified - in production use network scanning)
    const baseIP = '192.168.1'; // Common router IP range
    const promises = [];

    for (let i = 1; i < 255; i++) {
      const ip = `${baseIP}.${i}`;
      promises.push(this.testServerConnection(ip));
    }

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        possibleIPs.push(`${baseIP}.${index + 1}`);
      }
    });

    return possibleIPs;
  }

  private async testServerConnection(ip: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(
        `http://${ip}:${this.serverPort}/api/orders`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Cleanup
  cleanup() {
    this.clearReconnectInterval();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.listeners.clear();
    console.log('🧹 WiFiSync cleanup completed');
  }
}

export const wifiSyncService = new WiFiSyncService();

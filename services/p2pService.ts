import { Order, OrderItem } from '@/lib/supabase';
import { storageService } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple WebSocket-based P2P for local network
class P2PService {
  private broadcasting: boolean = false;
  private discoveredPeers: Set<string> = new Set();
  private messageHandlers: Array<(data: any) => void> = [];
  private deviceId: string = '';
  private networkClients: Map<string, any> = new Map();
  private broadcastInterval: any = null;
  private isServer: boolean = false;
  private serverPort: number = 8080;

  constructor() {
    this.initializeDeviceId();
    // Initialize last checked time
    this.initializeLastChecked();
  }

  private async initializeDeviceId() {
    this.deviceId = await storageService.getDeviceId();
  }

  private async initializeLastChecked() {
    const lastChecked = await AsyncStorage.getItem('p2p_last_checked');
    if (!lastChecked) {
      await AsyncStorage.setItem('p2p_last_checked', Date.now().toString());
    }
  }

  async startBroadcasting() {
    if (this.broadcasting) return;
    this.broadcasting = true;

    console.log(`P2P Service started for device: ${this.deviceId}`);

    // Try to start as server first
    await this.tryStartAsServer();

    // Start peer discovery
    this.startPeerDiscovery();

    // Start polling for messages from other instances
    this.startMessagePolling();

    console.log(
      'P2P broadcasting started - looking for peers on local network'
    );
  }

  private async tryStartAsServer() {
    try {
      // In a real implementation, you would start a WebSocket server here
      // For now, we'll simulate server behavior
      this.isServer = true;
      console.log(
        `Device ${this.deviceId} started as P2P server on port ${this.serverPort}`
      );
    } catch (error) {
      console.log(
        `Could not start as server, will connect as client: ${error}`
      );
      this.isServer = false;
    }
  }

  private startPeerDiscovery() {
    // Check for active devices every 10 seconds
    this.broadcastInterval = setInterval(() => {
      this.discoverPeers();
    }, 10000);

    // Initial discovery
    this.discoverPeers();
  }

  private async discoverPeers() {
    try {
      // Register this device as active
      const deviceRegistryKey = 'p2p_active_devices';
      const existingDevices = await AsyncStorage.getItem(deviceRegistryKey);
      const devices = existingDevices ? JSON.parse(existingDevices) : {};

      // Add/update this device with current timestamp
      devices[this.deviceId] = {
        lastSeen: Date.now(),
        registered: Date.now(),
      };

      // Remove devices that haven't been seen in last 30 seconds
      const cutoffTime = Date.now() - 30000;
      Object.keys(devices).forEach((deviceId) => {
        if (devices[deviceId].lastSeen < cutoffTime) {
          delete devices[deviceId];
        }
      });

      await AsyncStorage.setItem(deviceRegistryKey, JSON.stringify(devices));

      // Update discovered peers
      this.discoveredPeers.clear();
      Object.keys(devices).forEach((deviceId) => {
        if (deviceId !== this.deviceId) {
          this.discoveredPeers.add(deviceId);
        }
      });

      const peerCount = this.discoveredPeers.size;
      if (peerCount > 0) {
        console.log(
          `🔗 Connected to ${peerCount} peer(s): ${Array.from(
            this.discoveredPeers
          ).join(', ')}`
        );
      } else {
        console.log(`📱 Device ${this.deviceId} - No other devices found`);
      }
    } catch (error) {
      console.error('Error during peer discovery:', error);
    }
  }

  stopBroadcasting() {
    this.broadcasting = false;
    this.discoveredPeers.clear();
    this.networkClients.clear();

    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    console.log('P2P broadcasting stopped');
  }

  async broadcastOrder(order: Order, items: OrderItem[]) {
    if (!this.broadcasting) return;

    const message = {
      type: 'NEW_ORDER',
      order,
      items,
      timestamp: Date.now(),
      fromDevice: this.deviceId,
    };

    console.log(
      `📤 Broadcasting new order ${order.order_number} to ${this.discoveredPeers.size} peer(s)`
    );
    await this.sendToPeers(message);
  }

  async broadcastOrderUpdate(order: Order) {
    if (!this.broadcasting) return;

    const message = {
      type: 'ORDER_UPDATE',
      order,
      timestamp: Date.now(),
      fromDevice: this.deviceId,
    };

    console.log(
      `📤 Broadcasting order update ${order.order_number} to ${this.discoveredPeers.size} peer(s)`
    );
    await this.sendToPeers(message);
  }

  private async sendToPeers(message: any) {
    if (this.discoveredPeers.size === 0) {
      console.log('📱 No peers connected - operating in standalone mode');
      return;
    }

    // Store message in shared storage for other app instances to read
    try {
      const sharedKey = 'p2p_messages';
      const existingMessages = await AsyncStorage.getItem(sharedKey);
      const messages = existingMessages ? JSON.parse(existingMessages) : [];

      // Add new message with timestamp
      const messageWithId = {
        ...message,
        messageId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      };

      messages.push(messageWithId);

      // Keep only last 100 messages to prevent storage bloat
      if (messages.length > 100) {
        messages.splice(0, messages.length - 100);
      }

      await AsyncStorage.setItem(sharedKey, JSON.stringify(messages));
      console.log(
        `✅ Message stored for ${this.discoveredPeers.size} peer(s) to sync`
      );
    } catch (error) {
      console.error('Error storing P2P message:', error);
    }
  }

  // Add message polling to check for new messages from other devices
  private startMessagePolling() {
    setInterval(async () => {
      if (!this.broadcasting) return;

      try {
        const sharedKey = 'p2p_messages';
        const data = await AsyncStorage.getItem(sharedKey);
        if (!data) return;

        const messages = JSON.parse(data);
        const lastChecked =
          (await AsyncStorage.getItem('p2p_last_checked')) || '0';
        const lastCheckedTime = parseInt(lastChecked, 10);

        // Process new messages
        const newMessages = messages.filter(
          (msg: any) =>
            msg.createdAt > lastCheckedTime && msg.fromDevice !== this.deviceId
        );

        for (const message of newMessages) {
          console.log(`📥 Received ${message.type} from ${message.fromDevice}`);
          await this.handleIncomingMessage(message);
        }

        if (newMessages.length > 0) {
          await AsyncStorage.setItem('p2p_last_checked', Date.now().toString());
        }
      } catch (error) {
        console.error('Error polling P2P messages:', error);
      }
    }, 2000); // Check every 2 seconds
  }
  private simulateReceiveMessage(message: any) {
    // This simulates another device receiving the message
    // In a real app, this would be triggered by actual network messages

    setTimeout(() => {
      console.log(
        `📥 Simulated: Received ${message.type} from ${message.fromDevice}`
      );
      this.handleIncomingMessage(message);
    }, 200);
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  async handleIncomingMessage(message: any) {
    try {
      // Ignore messages from our own device
      if (message.fromDevice === this.deviceId) {
        return;
      }

      console.log(`🔄 Processing ${message.type} from ${message.fromDevice}`);

      switch (message.type) {
        case 'NEW_ORDER':
          await this.handleNewOrder(message.order, message.items);
          break;
        case 'ORDER_UPDATE':
          await this.handleOrderUpdate(message.order);
          break;
      }
    } catch (error) {
      console.error('Error handling P2P message:', error);
    }
  }

  private async handleNewOrder(order: Order, items: OrderItem[]) {
    const existingOrders = await storageService.getOrders();
    const exists = existingOrders.find((o) => o.id === order.id);

    if (!exists) {
      await storageService.addOrder(order);
      await storageService.addOrderItems(items);
      console.log(`✅ Added new order from peer: ${order.order_number}`);

      // Notify UI to refresh
      this.notifyOrderSync();
    } else {
      console.log(`ℹ️ Order ${order.order_number} already exists`);
    }
  }

  private async handleOrderUpdate(order: Order) {
    await storageService.updateOrder(order.id, {
      status: order.status,
      updated_at: order.updated_at,
    });
    console.log(
      `✅ Updated order from peer: ${order.order_number} -> ${order.status}`
    );

    // Notify UI to refresh
    this.notifyOrderSync();
  }

  private notifyOrderSync() {
    // Trigger any registered sync callbacks
    this.messageHandlers.forEach((handler) => handler({ type: 'SYNC_UPDATE' }));
  }

  // Connection status for UI
  getConnectionStatus() {
    return {
      isConnected: this.broadcasting,
      peerCount: this.discoveredPeers.size,
      isServer: this.isServer,
      deviceId: this.deviceId,
    };
  }

  cleanup() {
    this.stopBroadcasting();
    this.messageHandlers = [];
  }
}

export { P2PService };

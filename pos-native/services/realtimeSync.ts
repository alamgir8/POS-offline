import { Order, OrderItem } from "../pos-native/lib/supabase";
import { storageService } from "./storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SyncMessage {
  type: "NEW_ORDER" | "ORDER_UPDATE" | "HEARTBEAT" | "DEVICE_DISCOVERY";
  deviceId: string;
  timestamp: number;
  data?: any;
}

interface Device {
  id: string;
  lastSeen: number;
  isOnline: boolean;
}

class RealtimeSyncService {
  private deviceId: string;
  private devices: Map<string, Device> = new Map();
  private listeners: Set<(event: any) => void> = new Set();
  private heartbeatInterval?: any;
  private syncInterval?: any;
  private isActive = false;

  // Use SharedStorage pattern for real-time cross-instance sync
  private readonly SYNC_CHANNEL = "realtime_sync_messages";
  private readonly DEVICES_CHANNEL = "realtime_active_devices";
  private readonly HEARTBEAT_CHANNEL = "realtime_heartbeat";
  private lastProcessedMessage = 0;

  constructor() {
    this.deviceId = `device_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  async startSync() {
    console.log(`🚀 Starting RealtimeSync for device: ${this.deviceId}`);

    // Clear old messages to start fresh
    await this.clearOldMessages();

    this.isActive = true; // Register this device
    await this.registerDevice();

    // Start message polling
    this.startMessagePolling();

    // Start heartbeat
    this.startHeartbeat();

    console.log(`✅ RealtimeSync started for device: ${this.deviceId}`);
  }

  private async registerDevice() {
    try {
      const deviceData = {
        id: this.deviceId,
        lastSeen: Date.now(),
        isOnline: true,
        registeredAt: Date.now(),
      };

      // Get existing devices
      const existingDevicesData = await AsyncStorage.getItem(
        this.DEVICES_CHANNEL
      );
      const existingDevices = existingDevicesData
        ? JSON.parse(existingDevicesData)
        : {};

      // Add/update this device
      existingDevices[this.deviceId] = deviceData;

      // Remove stale devices (older than 60 seconds)
      const staleTime = Date.now() - 60000;
      Object.keys(existingDevices).forEach((deviceId) => {
        if (existingDevices[deviceId].lastSeen < staleTime) {
          delete existingDevices[deviceId];
        }
      });

      await AsyncStorage.setItem(
        this.DEVICES_CHANNEL,
        JSON.stringify(existingDevices)
      );

      // Update local devices map
      this.devices.clear();
      Object.values(existingDevices).forEach((device: any) => {
        if (device.id !== this.deviceId) {
          this.devices.set(device.id, device);
        }
      });

      console.log(
        `� Registered device. Found ${this.devices.size} other device(s)`
      );
    } catch (error) {
      console.error("Error registering device:", error);
    }
  }

  private startMessagePolling() {
    this.syncInterval = setInterval(async () => {
      if (!this.isActive) return;

      try {
        // Check for new sync messages
        const messagesData = await AsyncStorage.getItem(this.SYNC_CHANNEL);
        if (!messagesData) return;

        const messages = JSON.parse(messagesData);

        // Process new messages
        const newMessages = messages.filter(
          (msg: any) =>
            msg.timestamp > this.lastProcessedMessage &&
            msg.deviceId !== this.deviceId
        );

        // Only log if there are new messages to process
        if (newMessages.length > 0) {
          console.log(`📨 Found ${newMessages.length} new messages to process`);
        }

        for (const message of newMessages) {
          // Only log for important message types
          if (message.type !== "HEARTBEAT") {
            console.log(
              `🔄 Processing message: ${message.type} from ${message.deviceId}`
            );
          }
          await this.handleMessage(message);
          this.lastProcessedMessage = Math.max(
            this.lastProcessedMessage,
            message.timestamp
          );
        }

        // Update last processed timestamp
        if (newMessages.length > 0) {
          await AsyncStorage.setItem(
            `${this.SYNC_CHANNEL}_last_${this.deviceId}`,
            this.lastProcessedMessage.toString()
          );
        }
      } catch (error) {
        console.error("Error polling messages:", error);
      }
    }, 2000); // Poll every 2 seconds instead of 1
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isActive) return;

      try {
        // Send heartbeat
        await this.sendHeartbeat();

        // Re-register device to update lastSeen
        await this.registerDevice();
      } catch (error) {
        console.error("Error sending heartbeat:", error);
      }
    }, 10000); // Send heartbeat every 10 seconds
  }

  private async sendHeartbeat() {
    // Don't send heartbeats to the sync channel - just update device registry
    // Heartbeats are only for device discovery, not for syncing data
    // They are handled through registerDevice() method
  }

  private async handleMessage(message: SyncMessage) {
    // Only log important messages, not heartbeats
    if (message.type !== "HEARTBEAT") {
      console.log(`📥 Processing ${message.type} from ${message.deviceId}`);
    }

    switch (message.type) {
      case "NEW_ORDER":
        await this.handleNewOrder(message.data.order, message.data.items);
        break;
      case "ORDER_UPDATE":
        await this.handleOrderUpdate(message.data.order);
        break;
      case "HEARTBEAT":
        // Heartbeats are now handled only through device registry
        break;
      case "DEVICE_DISCOVERY":
        console.log(`🔍 Device discovered: ${message.deviceId}`);
        break;
    }
  }

  private async handleNewOrder(order: Order, items: OrderItem[]) {
    try {
      const existingOrders = await storageService.getOrders();
      const exists = existingOrders.find((o) => o.id === order.id);

      if (!exists) {
        await storageService.addOrder(order);
        await storageService.addOrderItems(items);
        console.log(`✅ Synced new order: ${order.order_number}`);

        this.notifyListeners({
          type: "ORDER_SYNCED",
          order,
          items,
        });
      } else {
        console.log(`ℹ️ Order ${order.order_number} already exists`);
      }
    } catch (error) {
      console.error("Error handling new order:", error);
    }
  }

  private async handleOrderUpdate(order: Order) {
    try {
      await storageService.updateOrder(order.id, {
        status: order.status,
        total_amount: order.total_amount,
        updated_at: order.updated_at,
      });

      console.log(`✅ Synced order update: ${order.order_number}`);

      this.notifyListeners({
        type: "ORDER_UPDATED",
        order,
      });
    } catch (error) {
      console.error("Error handling order update:", error);
    }
  }

  private async broadcastMessage(message: SyncMessage) {
    try {
      console.log(`📡 Broadcasting ${message.type} message to shared storage`);

      // Get existing messages
      const existingData = await AsyncStorage.getItem(this.SYNC_CHANNEL);
      const messages = existingData ? JSON.parse(existingData) : [];

      // Add new message
      messages.push(message);
      console.log(
        `💾 Stored message in shared storage. Total messages: ${messages.length}`
      );

      // Keep only last 50 messages to prevent storage bloat
      if (messages.length > 50) {
        messages.splice(0, messages.length - 50);
      }

      await AsyncStorage.setItem(this.SYNC_CHANNEL, JSON.stringify(messages));
      console.log(`✅ Message ${message.type} successfully stored for sync`);
    } catch (error) {
      console.error("Error broadcasting message:", error);
    }
  }

  // Public methods for broadcasting changes
  async broadcastNewOrder(order: Order, items: OrderItem[]) {
    const message: SyncMessage = {
      type: "NEW_ORDER",
      deviceId: this.deviceId,
      timestamp: Date.now(),
      data: { order, items },
    };

    await this.broadcastMessage(message);
    console.log(
      `📤 Broadcasting new order: ${order.order_number} to ${this.devices.size} device(s)`
    );
  }

  async broadcastOrderUpdate(order: Order) {
    const message: SyncMessage = {
      type: "ORDER_UPDATE",
      deviceId: this.deviceId,
      timestamp: Date.now(),
      data: { order },
    };

    await this.broadcastMessage(message);
    console.log(
      `📤 Broadcasting order update: ${order.order_number} to ${this.devices.size} device(s)`
    );
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

  // Clear old messages to prevent message buildup
  private async clearOldMessages() {
    try {
      await AsyncStorage.removeItem(this.SYNC_CHANNEL);
      console.log("🧹 Cleared old sync messages");
    } catch (error) {
      console.error("Error clearing old messages:", error);
    }
  }

  // Status methods
  getConnectionStatus() {
    return {
      isActive: this.isActive,
      connectedDevices: this.devices.size,
      deviceId: this.deviceId,
      devices: Array.from(this.devices.keys()),
    };
  }

  // Cleanup
  cleanup() {
    this.isActive = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.listeners.clear();
    console.log("🧹 RealtimeSync cleanup completed");
  }
}

export const realtimeSyncService = new RealtimeSyncService();

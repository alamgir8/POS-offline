import {
  Order as SupabaseOrder,
  OrderItem as SupabaseOrderItem,
} from "../pos-native/lib/supabase";
import { Order, OrderItem, QueueItem } from "../pos-native/types";
import { storageService } from "./storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface HybridSyncConfig {
  cloudAPI: string;
  localServerIP: string;
  localServerPort: number;
  tenantId: string;
  deviceType: "main_pos" | "kds" | "bds" | "manager";
}

interface SyncQueueItem {
  id: string;
  type: "order" | "order_update" | "item_status";
  data: any;
  timestamp: number;
  retryCount: number;
  priority: "high" | "medium" | "low";
}

interface NetworkMode {
  type: "cloud_only" | "local_only" | "hybrid" | "standalone";
  cloudAvailable: boolean;
  localServerAvailable: boolean;
  localServerUrl?: string;
  lastCloudSync?: string;
}

class HybridSyncService {
  private config: HybridSyncConfig;
  private networkMode: NetworkMode = {
    type: "standalone",
    cloudAvailable: false,
    localServerAvailable: false,
  };
  private websocket: WebSocket | null = null;
  private isConnected: boolean = false;
  private syncQueue: SyncQueueItem[] = [];
  private listeners: Set<(event: any) => void> = new Set();
  private syncInterval?: any;
  private networkCheckInterval?: any;

  constructor() {
    this.config = {
      cloudAPI: "https://your-saas-api.com/api",
      localServerIP: "",
      localServerPort: 8080,
      tenantId: "",
      deviceType: "main_pos",
    };

    this.startNetworkMonitoring();
  }

  async initialize(config: Partial<HybridSyncConfig>) {
    this.config = { ...this.config, ...config };

    // Load saved configuration
    await this.loadSavedConfig();

    // Detect initial network mode
    await this.detectNetworkMode();

    // Start sync based on mode
    await this.startSync();

    console.log(`🚀 Hybrid sync initialized in ${this.networkMode} mode`);
  }

  private async loadSavedConfig() {
    try {
      const savedIP = await AsyncStorage.getItem("local_server_ip");
      const savedTenant = await AsyncStorage.getItem("tenant_id");
      const savedDeviceType = await AsyncStorage.getItem("device_type");

      if (savedIP) this.config.localServerIP = savedIP;
      if (savedTenant) this.config.tenantId = savedTenant;
      if (savedDeviceType) this.config.deviceType = savedDeviceType as any;
    } catch (error) {
      console.error("Failed to load saved config:", error);
    }
  }

  private startNetworkMonitoring() {
    // Periodic network check (simplified without NetInfo)
    this.networkCheckInterval = setInterval(() => {
      this.detectNetworkMode();
    }, 30000); // Check every 30 seconds
  }

  async detectNetworkMode(): Promise<NetworkMode> {
    console.log("🔍 Detecting network mode...");

    // 1. Check internet connectivity
    const hasInternet = await this.checkInternetConnection();

    // 2. Check local server availability
    const hasLocalServer = await this.checkLocalServer();

    // 3. Determine mode
    let newMode: NetworkMode;

    if (hasInternet && hasLocalServer) {
      newMode = "hybrid";
      console.log("🌐 HYBRID mode: Internet + Local server");
    } else if (hasInternet) {
      newMode = "online";
      console.log("☁️ ONLINE mode: Internet only");
    } else if (hasLocalServer) {
      newMode = "offline";
      console.log("📶 OFFLINE mode: Local server only");
    } else {
      newMode = "standalone";
      console.log("📱 STANDALONE mode: Device only");
    }

    // Handle mode change
    if (newMode !== this.networkMode) {
      await this.handleModeChange(this.networkMode, newMode);
      this.networkMode = newMode;
    }

    return newMode;
  }

  private async checkInternetConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.config.cloudAPI}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "X-Tenant-ID": this.config.tenantId,
        },
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkLocalServer(): Promise<boolean> {
    if (!this.config.localServerIP) {
      // Try to discover local server
      const discoveredIP = await this.discoverLocalServer();
      if (discoveredIP) {
        this.config.localServerIP = discoveredIP;
      }
    }

    if (!this.config.localServerIP) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(
        `http://${this.config.localServerIP}:${this.config.localServerPort}/health`,
        {
          method: "GET",
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async discoverLocalServer(): Promise<string | null> {
    const commonIPs = [
      "192.168.1.100",
      "192.168.1.1",
      "192.168.0.1",
      "192.168.43.1",
      "172.20.10.1",
      "10.0.0.1",
    ];

    for (const ip of commonIPs) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        const response = await fetch(
          `http://${ip}:${this.config.localServerPort}/discover`,
          {
            method: "GET",
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.server === "POS WiFi Sync Server") {
            await AsyncStorage.setItem("local_server_ip", ip);
            return ip;
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async handleModeChange(oldMode: NetworkMode, newMode: NetworkMode) {
    console.log(`🔄 Mode change: ${oldMode} → ${newMode}`);

    // Notify listeners of mode change
    this.notifyListeners({
      type: "MODE_CHANGE",
      oldMode,
      newMode,
      timestamp: new Date().toISOString(),
    });

    // Handle specific transitions
    if (newMode === "online" || newMode === "hybrid") {
      // We have internet now, try to sync pending data
      this.processSyncQueue();
    }

    if (newMode === "offline" || newMode === "hybrid") {
      // We have local server, connect WebSocket
      this.connectToLocalServer();
    }
  }

  private async startSync() {
    if (this.networkMode === "offline" || this.networkMode === "hybrid") {
      await this.connectToLocalServer();
    }

    // Start sync interval for queue processing
    this.syncInterval = setInterval(() => {
      if (this.networkMode === "online" || this.networkMode === "hybrid") {
        this.processSyncQueue();
      }
    }, 10000); // Process queue every 10 seconds
  }

  private async connectToLocalServer() {
    if (!this.config.localServerIP) return;

    try {
      const wsUrl = `ws://${this.config.localServerIP}:${this.config.localServerPort}`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log("✅ Connected to local server");
        this.isConnected = true;

        // Send device registration
        this.sendToLocal({
          type: "DEVICE_REGISTRATION",
          data: {
            deviceId: this.getDeviceId(),
            deviceType: this.config.deviceType,
            tenantId: this.config.tenantId,
          },
        });
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleLocalMessage(message);
        } catch (error) {
          console.error("Error parsing local message:", error);
        }
      };

      this.websocket.onclose = () => {
        console.log("🔌 Disconnected from local server");
        this.isConnected = false;
        setTimeout(() => this.connectToLocalServer(), 5000);
      };
    } catch (error) {
      console.error("Failed to connect to local server:", error);
    }
  }

  private handleLocalMessage(message: any) {
    console.log(`📥 Local message: ${message.type}`);

    switch (message.type) {
      case "NEW_ORDER":
        this.handleNewOrder(message.data);
        break;
      case "ORDER_UPDATED":
        this.handleOrderUpdate(message.data);
        break;
      case "ITEM_STATUS_UPDATED":
        this.handleItemStatusUpdate(message.data);
        break;
    }
  }

  // Public API Methods

  async createOrder(order: Order, items: OrderItem[]): Promise<void> {
    const orderWithItems = { ...order, items };

    // 1. Save locally first (always)
    await storageService.addOrderWithDeduplication(order);
    await storageService.addOrderItems(items);

    // 2. Broadcast to local devices if connected
    if (this.isConnected) {
      this.sendToLocal({
        type: "NEW_ORDER",
        data: orderWithItems,
      });
    }

    // 3. Queue for cloud sync
    await this.addToSyncQueue({
      id: `order_${order.id}`,
      type: "order",
      data: orderWithItems,
      timestamp: Date.now(),
      retryCount: 0,
      priority: "high",
    });

    // 4. Try immediate cloud sync if online
    if (this.networkMode === "online" || this.networkMode === "hybrid") {
      await this.processSyncQueue();
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: Order["status"]
  ): Promise<void> {
    // Update locally
    await storageService.updateOrder(orderId, {
      status,
      updated_at: new Date().toISOString(),
    });

    const order = await storageService
      .getOrders()
      .then((orders) => orders.find((o) => o.id === orderId));

    if (order) {
      // Broadcast to local devices
      if (this.isConnected) {
        this.sendToLocal({
          type: "ORDER_UPDATED",
          data: order,
        });
      }

      // Queue for cloud sync
      await this.addToSyncQueue({
        id: `order_update_${orderId}`,
        type: "order_update",
        data: { orderId, status },
        timestamp: Date.now(),
        retryCount: 0,
        priority: "medium",
      });
    }
  }

  async updateItemStatus(
    orderId: string,
    itemId: string,
    status: string
  ): Promise<void> {
    // This would update item status in local storage
    // Implementation depends on your storage structure

    const updateData = { orderId, itemId, status, timestamp: Date.now() };

    // Broadcast to local devices
    if (this.isConnected) {
      this.sendToLocal({
        type: "ITEM_STATUS_UPDATED",
        data: updateData,
      });
    }

    // Queue for cloud sync
    await this.addToSyncQueue({
      id: `item_${orderId}_${itemId}`,
      type: "item_status",
      data: updateData,
      timestamp: Date.now(),
      retryCount: 0,
      priority: "low",
    });
  }

  async manualSyncToCloud(): Promise<{
    synced: number;
    total: number;
    errors: string[];
  }> {
    if (this.networkMode === "standalone" || this.networkMode === "offline") {
      throw new Error("No internet connection available");
    }

    console.log("🔄 Starting manual sync to cloud...");

    const queue = await this.getSyncQueue();
    let synced = 0;
    const errors: string[] = [];

    for (const item of queue) {
      try {
        await this.syncItemToCloud(item);
        await this.removeFromSyncQueue(item.id);
        synced++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`${item.id}: ${errorMessage}`);
        item.retryCount++;
        if (item.retryCount >= 3) {
          await this.removeFromSyncQueue(item.id);
        }
      }
    }

    console.log(`✅ Manual sync complete: ${synced}/${queue.length} synced`);

    this.notifyListeners({
      type: "SYNC_COMPLETE",
      synced,
      total: queue.length,
      errors,
    });

    return { synced, total: queue.length, errors };
  }

  // Utility Methods

  private async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    this.syncQueue.push(item);
    await AsyncStorage.setItem(
      "hybrid_sync_queue",
      JSON.stringify(this.syncQueue)
    );
  }

  private async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem("hybrid_sync_queue");
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private async removeFromSyncQueue(itemId: string): Promise<void> {
    this.syncQueue = this.syncQueue.filter((item) => item.id !== itemId);
    await AsyncStorage.setItem(
      "hybrid_sync_queue",
      JSON.stringify(this.syncQueue)
    );
  }

  private async processSyncQueue(): Promise<void> {
    const queue = await this.getSyncQueue();
    const highPriorityItems = queue
      .filter((item) => item.priority === "high")
      .slice(0, 5);

    for (const item of highPriorityItems) {
      try {
        await this.syncItemToCloud(item);
        await this.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(`Sync failed for ${item.id}:`, error);
        item.retryCount++;
      }
    }
  }

  private async syncItemToCloud(item: SyncQueueItem): Promise<void> {
    const endpoint = this.getCloudEndpoint(item.type);
    const response = await fetch(`${this.config.cloudAPI}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": this.config.tenantId,
        "X-Device-ID": this.getDeviceId(),
      },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private getCloudEndpoint(type: string): string {
    switch (type) {
      case "order":
        return "/orders";
      case "order_update":
        return "/orders/update";
      case "item_status":
        return "/orders/items/status";
      default:
        return "/sync";
    }
  }

  private sendToLocal(message: any): void {
    if (this.websocket && this.isConnected) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  private getDeviceId(): string {
    // Implementation depends on how you generate device IDs
    return "device_" + Date.now();
  }

  private async handleNewOrder(order: Order): Promise<void> {
    await storageService.addOrderWithDeduplication(order);
    this.notifyListeners({ type: "ORDER_RECEIVED", order });
  }

  private async handleOrderUpdate(order: Order): Promise<void> {
    await storageService.updateOrder(order.id, order);
    this.notifyListeners({ type: "ORDER_UPDATED", order });
  }

  private async handleItemStatusUpdate(data: any): Promise<void> {
    // Handle item status updates
    this.notifyListeners({ type: "ITEM_STATUS_UPDATED", data });
  }

  // Listener management
  addListener(callback: (event: any) => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: (event: any) => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(event: any): void {
    this.listeners.forEach((callback) => callback(event));
  }

  // Kitchen/Bar Display System Methods
  async getActiveOrdersForStation(
    station: "kitchen" | "bar" | "all"
  ): Promise<Order[]> {
    try {
      const allOrders = await storageService.getOrders();

      // Filter orders that are active (not completed/cancelled)
      const activeOrders = allOrders.filter((order) =>
        ["pending", "preparing", "ready"].includes(order.status)
      );

      if (station === "all") {
        return activeOrders;
      }

      // Filter by station type
      return activeOrders.filter((order) => {
        return order.items.some((item: OrderItem) => {
          if (station === "kitchen") {
            // Kitchen items: food items, appetizers, mains, sides
            return (
              !item.category?.includes("drink") &&
              !item.category?.includes("beverage") &&
              !item.category?.includes("cocktail")
            );
          } else if (station === "bar") {
            // Bar items: drinks, cocktails, beverages
            return (
              item.category?.includes("drink") ||
              item.category?.includes("beverage") ||
              item.category?.includes("cocktail") ||
              item.category?.includes("beer") ||
              item.category?.includes("wine")
            );
          }
          return false;
        });
      });
    } catch (error) {
      console.error("Failed to get active orders for station:", error);
      return [];
    }
  }

  async updateOrderItemStatus(
    orderId: string,
    itemId: string,
    status: "pending" | "preparing" | "ready" | "served"
  ): Promise<void> {
    try {
      const orders = await storageService.getOrders();

      const orderIndex = orders.findIndex((o) => o.id === orderId);
      if (orderIndex === -1) {
        throw new Error("Order not found");
      }

      const order = orders[orderIndex];
      const itemIndex = order.items.findIndex(
        (i: OrderItem) => i.id === itemId
      );
      if (itemIndex === -1) {
        throw new Error("Item not found");
      }

      // Update item status
      order.items[itemIndex].status = status;
      order.updatedAt = new Date().toISOString();

      // Check if all items are ready/served to update order status
      const allItemsReady = order.items.every((item: OrderItem) =>
        ["ready", "served"].includes(item.status || "pending")
      );

      if (allItemsReady && order.status === "preparing") {
        order.status = "ready";
      } else if (order.status === "pending") {
        order.status = "preparing";
      }

      // Save updated order
      await storageService.updateOrder(orderId, order);

      // Emit event
      this.notifyListeners({
        type: "ITEM_STATUS_CHANGED",
        orderId,
        itemId,
        status,
      });

      // Queue for cloud sync if online
      if (this.networkMode.cloudAvailable) {
        this.addToSyncQueue({
          id: `update_item_${orderId}_${itemId}_${Date.now()}`,
          type: "update",
          data: { orderId, itemId, status, orderStatus: order.status },
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
        });
      }

      // Sync to local network
      this.syncToLocalServer({ type: "ORDER_UPDATED", order });
    } catch (error) {
      console.error("Failed to update item status:", error);
      throw error;
    }
  }

  async completeOrder(orderId: string): Promise<void> {
    try {
      const orders = await storageService.getOrders();

      const orderIndex = orders.findIndex((o) => o.id === orderId);
      if (orderIndex === -1) {
        throw new Error("Order not found");
      }

      const order = orders[orderIndex];

      // Mark all items as served
      order.items.forEach((item: OrderItem) => {
        item.status = "served";
      });

      order.status = "completed";
      order.updatedAt = new Date().toISOString();

      // Save updated order
      await storageService.updateOrder(orderId, order);

      // Emit event
      this.notifyListeners({
        type: "ORDER_UPDATED",
        orderId,
      });

      // Queue for cloud sync
      if (this.networkMode.cloudAvailable) {
        this.addToSyncQueue({
          id: `complete_${orderId}_${Date.now()}`,
          type: "update",
          data: order,
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
        });
      }

      // Sync to local network
      this.syncToLocalServer({ type: "ORDER_UPDATED", order });
    } catch (error) {
      console.error("Failed to complete order:", error);
      throw error;
    }
  }

  notifyItemStatusChange(
    orderId: string,
    itemId: string,
    status: string
  ): void {
    // Send real-time notification to POS systems
    if (this.localWs && this.localWs.readyState === WebSocket.OPEN) {
      this.localWs.send(
        JSON.stringify({
          type: "ITEM_STATUS_UPDATE",
          orderId,
          itemId,
          status,
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Emit local event
    this.notifyListeners({
      type: "ITEM_STATUS_CHANGED",
      orderId,
      itemId,
      status,
    });
  }

  // Status methods
  getNetworkMode(): NetworkMode {
    return this.networkMode;
  }

  getConnectionStatus() {
    return {
      networkMode: this.networkMode,
      localConnected: this.isConnected,
      cloudReachable:
        this.networkMode === "online" || this.networkMode === "hybrid",
      queueSize: this.syncQueue.length,
    };
  }

  // Cleanup
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
    }

    if (this.websocket) {
      this.websocket.close();
    }

    this.listeners.clear();
  }
}

export const hybridSyncService = new HybridSyncService();

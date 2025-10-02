import NetInfo from '@react-native-community/netinfo';
import { Order, OrderItem } from '@/lib/supabase';
import { storageService, SyncQueueItem } from './storage';
import { wifiSyncService } from './wifiSync';

// Demo mode - use WiFi sync instead of Supabase
const DEMO_MODE = true;

type SyncCallback = () => void;

class SyncService {
  private isOnline: boolean = false;
  private isSyncing: boolean = false;
  private syncCallbacks: SyncCallback[] = [];
  private realtimeChannel: any = null;

  constructor() {
    this.initNetworkListener();

    // In demo mode, start WiFi sync immediately
    if (DEMO_MODE) {
      setTimeout(() => {
        // Try to start with your local network IP (update this if needed)
        wifiSyncService.startSync('192.168.0.243').catch((err) => {
          console.log(
            'Could not connect to server IP. Please configure server IP in settings.'
          );
        });
      }, 1000);
    }
  }

  private initNetworkListener() {
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOnline !== this.isOnline) {
        console.log(
          `Network status changed: ${this.isOnline ? 'Online' : 'Offline'}`
        );
      }

      // In demo mode, always use WiFi sync regardless of internet connection
      if (DEMO_MODE) {
        if (!wifiSyncService.getConnectionStatus().isConnected) {
          // Try to reconnect to WiFi server
          console.log('Attempting to reconnect to WiFi sync server...');
        }
      }
    });

    // Set up WiFi sync message handling
    wifiSyncService.addListener((event: any) => {
      if (event.type === 'ORDER_SYNCED' || event.type === 'ORDER_UPDATED') {
        this.notifyCallbacks();
      }
    });
  }

  private initRealtimeSync() {
    if (DEMO_MODE) {
      console.log('Demo mode: Skipping Supabase realtime sync');
      return;
    }
    // Supabase realtime would go here in production mode
  }

  private async handleRemoteOrderUpdate(order: Order) {
    if (DEMO_MODE) return;

    await storageService.addOrder(order);
    // In production mode, would fetch order items from Supabase
    this.notifyCallbacks();
  }

  onSync(callback: SyncCallback) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyCallbacks() {
    this.syncCallbacks.forEach((cb) => cb());
  }

  async syncToServer(): Promise<boolean> {
    if (this.isSyncing) return false;

    if (DEMO_MODE) {
      console.log('Demo mode: Skipping server sync');
      this.notifyCallbacks();
      return true;
    }

    if (!this.isOnline) return false;

    this.isSyncing = true;
    try {
      const queue = await storageService.getSyncQueue();

      for (const item of queue) {
        try {
          await this.processSyncItem(item);
          await storageService.removeSyncQueueItem(item.id);
        } catch (error) {
          console.error('Error syncing item:', error);
          if (item.retryCount < 3) {
            item.retryCount++;
          }
        }
      }

      await this.syncFromServer();
      await storageService.updateLastSync();
      this.notifyCallbacks();
      return true;
    } catch (error) {
      console.error('Sync error:', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  private async processSyncItem(item: SyncQueueItem) {
    if (DEMO_MODE) {
      console.log('Demo mode: Skipping server sync for', item.type);
      return;
    }
    // In production mode, would sync to Supabase
  }

  async syncFromServer() {
    if (DEMO_MODE) {
      console.log('Demo mode: Using local products data');
      // Don't call notifyCallbacks here to avoid infinite recursion
      return;
    }

    // In production mode, would sync from Supabase
    try {
      this.notifyCallbacks();
    } catch (error) {
      console.error('Error syncing from server:', error);
    }
  }
  private mergeOrders(local: Order[], remote: Order[]): Order[] {
    const orderMap = new Map<string, Order>();

    local.forEach((order) => orderMap.set(order.id, order));

    remote.forEach((order) => {
      const existing = orderMap.get(order.id);
      if (
        !existing ||
        new Date(order.updated_at) > new Date(existing.updated_at)
      ) {
        orderMap.set(order.id, order);
      }
    });

    return Array.from(orderMap.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  private mergeOrderItems(
    local: OrderItem[],
    remote: OrderItem[]
  ): OrderItem[] {
    const itemMap = new Map<string, OrderItem>();

    local.forEach((item) => itemMap.set(item.id, item));
    remote.forEach((item) => itemMap.set(item.id, item));

    return Array.from(itemMap.values());
  }

  async createOrder(order: Order, items: OrderItem[]): Promise<void> {
    await storageService.addOrder(order);
    await storageService.addOrderItems(items);

    const syncItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random()}`,
      type: 'order',
      data: order,
      timestamp: Date.now(),
      retryCount: 0,
    };
    await storageService.addToSyncQueue(syncItem);

    for (const item of items) {
      const itemSyncItem: SyncQueueItem = {
        id: `sync_${Date.now()}_${Math.random()}`,
        type: 'order_item',
        data: item,
        timestamp: Date.now(),
        retryCount: 0,
      };
      await storageService.addToSyncQueue(itemSyncItem);
    }

    if (DEMO_MODE) {
      // In demo mode, always broadcast to WiFi sync
      await wifiSyncService.broadcastNewOrder(order, items);
    } else if (this.isOnline) {
      await this.syncToServer();
    } else {
      await wifiSyncService.broadcastNewOrder(order, items);
    }

    this.notifyCallbacks();
  }

  async updateOrderStatus(
    orderId: string,
    status: Order['status']
  ): Promise<void> {
    await storageService.updateOrder(orderId, { status });

    const syncItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random()}`,
      type: 'order_update',
      data: {
        orderId,
        updates: { status, updated_at: new Date().toISOString() },
      },
      timestamp: Date.now(),
      retryCount: 0,
    };
    await storageService.addToSyncQueue(syncItem);

    if (DEMO_MODE) {
      // In demo mode, always broadcast to WiFi sync
      const orders = await storageService.getOrders();
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        await wifiSyncService.broadcastOrderUpdate(order);
      }
    } else if (this.isOnline) {
      await this.syncToServer();
    } else {
      const orders = await storageService.getOrders();
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        await wifiSyncService.broadcastOrderUpdate(order);
      }
    }

    this.notifyCallbacks();
  }

  getIsOnline(): boolean {
    // In demo mode, always show as offline to demonstrate offline capabilities
    return DEMO_MODE ? false : this.isOnline;
  }

  getP2PStatus() {
    return wifiSyncService.getConnectionStatus();
  }

  cleanup() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
    wifiSyncService.cleanup();
  }
}

export const syncService = new SyncService();

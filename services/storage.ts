import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Order, OrderItem } from '@/lib/supabase';
import { DEMO_PRODUCTS } from './demoData';

const KEYS = {
  PRODUCTS: 'offline_products',
  ORDERS: 'offline_orders',
  ORDER_ITEMS: 'offline_order_items',
  PENDING_SYNC: 'pending_sync_queue',
  DEVICE_ID: 'device_id',
  LAST_SYNC: 'last_sync_timestamp',
};

export type SyncQueueItem = {
  id: string;
  type: 'order' | 'order_item' | 'order_update';
  data: any;
  timestamp: number;
  retryCount: number;
};

// uid function to generate unique id
const uniqueArrayOfObjects = (arr: Array<{ id: string }>) => {
  const map = new Map();
  arr?.forEach((obj) => map.set(obj?.id, obj));
  return Array.from(map?.values());
};

class StorageService {
  async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem(KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      await AsyncStorage.setItem(KEYS.DEVICE_ID, deviceId);
    }
    return deviceId;
  }

  async saveProducts(products: Product[]): Promise<void> {
    console.log('Saving products to storage:', products.length);
    await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
    console.log('Products saved successfully');
  }

  async getProducts(): Promise<Product[]> {
    const data = await AsyncStorage.getItem(KEYS.PRODUCTS);
    if (data) {
      const products = JSON.parse(data);
      console.log('Found existing products in storage:', products.length);
      // If we have an empty array, reinitialize with demo data
      if (products.length === 0) {
        console.log(
          'Empty products array found, reinitializing with demo data'
        );
        await this.saveProducts(DEMO_PRODUCTS);
        return DEMO_PRODUCTS;
      }
      return products;
    } else {
      // Initialize with demo products if none exist
      console.log(
        'No products found, initializing with demo data:',
        DEMO_PRODUCTS.length
      );
      console.log(
        'Demo products sample:',
        DEMO_PRODUCTS[0]?.name || 'No demo products!'
      );
      await this.saveProducts(DEMO_PRODUCTS);
      return DEMO_PRODUCTS;
    }
  }

  async saveOrders(orders: Order[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  }

  async getOrders(): Promise<Order[]> {
    const data = await AsyncStorage.getItem(KEYS.ORDERS);
    const result = data ? JSON.parse(data) : [];
    // Ensure uniqueness by _id
    return uniqueArrayOfObjects(result);
  }

  async addOrder(order: Order): Promise<void> {
    const orders = await this.getOrders();

    // Check for duplicates by ID and order_number
    const existingOrder = orders.find(
      (o) => o.id === order.id || o.order_number === order.order_number
    );

    if (existingOrder) {
      console.log(
        `⚠️ Duplicate order prevented: ${order.order_number} (ID: ${order.id})`
      );
      return;
    }

    orders.unshift(order);
    await this.saveOrders(orders);
    console.log(`✅ Order added to storage: ${order.order_number}`);
  }

  async addOrderWithDeduplication(order: Order): Promise<boolean> {
    const orders = await this.getOrders();

    // More thorough duplicate checking
    const existingOrder = orders.find(
      (o) =>
        o.id === order.id ||
        o.order_number === order.order_number ||
        (o.created_at === order.created_at &&
          Math.abs(o.total_amount - order.total_amount) < 0.01)
    );

    if (existingOrder) {
      console.log(
        `🔄 Duplicate order detected and prevented: ${order.order_number}`
      );
      return false;
    }

    orders.unshift(order);
    await this.saveOrders(orders);
    console.log(`✅ New order added: ${order.order_number}`);
    return true;
  }

  async deduplicateOrders(): Promise<number> {
    const orders = await this.getOrders();
    const seen = new Set<string>();
    const deduplicatedOrders: Order[] = [];

    for (const order of orders) {
      const key = `${order.id}-${order.order_number}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedOrders.push(order);
      }
    }

    const duplicatesRemoved = orders.length - deduplicatedOrders.length;
    if (duplicatesRemoved > 0) {
      await this.saveOrders(deduplicatedOrders);
      console.log(`🧹 Removed ${duplicatesRemoved} duplicate orders`);
    }

    return duplicatesRemoved;
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const orders = await this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      orders[index] = {
        ...orders[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.saveOrders(orders);
    }
  }

  async saveOrderItems(orderItems: OrderItem[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.ORDER_ITEMS, JSON.stringify(orderItems));
  }

  async getOrderItems(): Promise<OrderItem[]> {
    const data = await AsyncStorage.getItem(KEYS.ORDER_ITEMS);
    return data ? JSON.parse(data) : [];
  }

  async addOrderItems(items: OrderItem[]): Promise<void> {
    const existingItems = await this.getOrderItems();
    const updatedItems = [...existingItems, ...items];
    await this.saveOrderItems(updatedItems);
  }

  async getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    const allItems = await this.getOrderItems();
    return allItems.filter((item) => item.order_id === orderId);
  }

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const queue = await this.getSyncQueue();
    queue.push(item);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(queue));
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const data = await AsyncStorage.getItem(KEYS.PENDING_SYNC);
    return data ? JSON.parse(data) : [];
  }

  async clearSyncQueue(): Promise<void> {
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify([]));
  }

  async removeSyncQueueItem(itemId: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter((item) => item.id !== itemId);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(filtered));
  }

  async updateLastSync(): Promise<void> {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, Date.now().toString());
  }

  async getLastSync(): Promise<number> {
    const data = await AsyncStorage.getItem(KEYS.LAST_SYNC);
    return data ? parseInt(data, 10) : 0;
  }

  async clearAll(): Promise<void> {
    console.log('Clearing all storage...');
    await AsyncStorage.multiRemove([
      KEYS.PRODUCTS,
      KEYS.ORDERS,
      KEYS.ORDER_ITEMS,
      KEYS.PENDING_SYNC,
      KEYS.LAST_SYNC,
    ]);
  }
}

export const storageService = new StorageService();

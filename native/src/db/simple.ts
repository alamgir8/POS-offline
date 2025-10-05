// Simplified database for React Native using SQLite

export interface Order {
  orderId: string;
  tenantId: string;
  storeId: string;
  status: "draft" | "active" | "parked" | "paid" | "cancelled";
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  version: number;
  lamport: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    deviceId: string;
    userId?: string;
    userName?: string;
  };
  tableNumber?: string;
  guestCount?: number;
  parkedAt?: string;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface Product {
  sku: string;
  tenantId: string;
  storeId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isActive: boolean;
  version: number;
  lamport: number;
}

export interface EventBase {
  eventId: string;
  tenantId: string;
  storeId: string;
  aggregateType: "order" | "user" | "product";
  aggregateId: string;
  version: number;
  type: string;
  at: string;
  actor: {
    deviceId: string;
    userId?: string;
    userName?: string;
  };
  clock: {
    lamport: number;
    deviceId: string;
  };
  payload: Record<string, any>;
}

// Simple in-memory store for demo
class SimpleNativeDB {
  private orders: Map<string, Order> = new Map();
  private products: Map<string, Product> = new Map();
  private events: Map<string, EventBase> = new Map();

  async init(): Promise<void> {
    await this.seedDemoData();
    console.log("✅ Native database initialized");
  }

  // Orders
  async insertOrder(order: Order): Promise<void> {
    this.orders.set(order.orderId, order);
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const existing = this.orders.get(orderId);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.orders.set(orderId, updated);
    }
  }

  async findOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async findOrders(filter?: Partial<Order>): Promise<Order[]> {
    let orders = Array.from(this.orders.values());

    if (filter) {
      orders = orders.filter((order) => {
        return Object.entries(filter).every(([key, value]) => {
          if (value === undefined) return true;
          return (order as any)[key] === value;
        });
      });
    }

    return orders.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Products
  async insertProduct(product: Product): Promise<void> {
    this.products.set(product.sku, product);
  }

  async findProducts(filter?: Partial<Product>): Promise<Product[]> {
    let products = Array.from(this.products.values());

    if (filter) {
      products = products.filter((product) => {
        return Object.entries(filter).every(([key, value]) => {
          if (value === undefined) return true;
          return (product as any)[key] === value;
        });
      });
    }

    return products.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Events
  async insertEvent(event: EventBase): Promise<void> {
    this.events.set(event.eventId, event);
  }

  private async seedDemoData(): Promise<void> {
    const demoProducts: Product[] = [
      {
        sku: "burger-001",
        tenantId: "restaurant_demo",
        storeId: "store_001",
        name: "Classic Burger",
        description: "Juicy beef patty with lettuce, tomato, and special sauce",
        price: 12.99,
        category: "food",
        isActive: true,
        version: 1,
        lamport: 1,
      },
      {
        sku: "fries-001",
        tenantId: "restaurant_demo",
        storeId: "store_001",
        name: "French Fries",
        description: "Crispy golden fries",
        price: 4.99,
        category: "food",
        isActive: true,
        version: 1,
        lamport: 2,
      },
      {
        sku: "coke-001",
        tenantId: "restaurant_demo",
        storeId: "store_001",
        name: "Coca Cola",
        description: "Refreshing cola drink",
        price: 2.99,
        category: "beverage",
        isActive: true,
        version: 1,
        lamport: 3,
      },
      {
        sku: "pizza-001",
        tenantId: "restaurant_demo",
        storeId: "store_001",
        name: "Margherita Pizza",
        description: "Fresh mozzarella, tomato sauce, and basil",
        price: 16.99,
        category: "food",
        isActive: true,
        version: 1,
        lamport: 4,
      },
    ];

    for (const product of demoProducts) {
      await this.insertProduct(product);
    }
  }

  async clear(): Promise<void> {
    this.orders.clear();
    this.products.clear();
    this.events.clear();
  }
}

// Singleton instance
let dbInstance: SimpleNativeDB | null = null;

export async function initDatabase(): Promise<SimpleNativeDB> {
  if (!dbInstance) {
    dbInstance = new SimpleNativeDB();
    await dbInstance.init();
  }
  return dbInstance;
}

export function getDatabase(): SimpleNativeDB {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

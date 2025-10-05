// Simplified database layer using IndexedDB directly
// This will be replaced with RxDB once dependencies are installed

import type { Order, Product, EventBase } from "../types";

interface DBStore {
  orders: Map<string, Order>;
  products: Map<string, Product>;
  events: Map<string, EventBase>;
}

// Simple in-memory store with localStorage persistence
class SimpleDB {
  private stores: DBStore = {
    orders: new Map(),
    products: new Map(),
    events: new Map(),
  };

  async init(): Promise<void> {
    this.loadFromStorage();
    await this.seedDemoData();
  }

  // Orders
  async insertOrder(order: Order): Promise<void> {
    this.stores.orders.set(order.orderId, order);
    this.saveToStorage();
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const existing = this.stores.orders.get(orderId);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.stores.orders.set(orderId, updated);
      this.saveToStorage();
    }
  }

  async findOrder(orderId: string): Promise<Order | null> {
    return this.stores.orders.get(orderId) || null;
  }

  async findOrders(filter?: Partial<Order>): Promise<Order[]> {
    let orders = Array.from(this.stores.orders.values());

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
    this.stores.products.set(product.sku, product);
    this.saveToStorage();
  }

  async findProducts(filter?: Partial<Product>): Promise<Product[]> {
    let products = Array.from(this.stores.products.values());

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
    this.stores.events.set(event.eventId, event);
    this.saveToStorage();
  }

  async findEvents(filter?: {
    fromLamport?: number;
    tenantId?: string;
    storeId?: string;
  }): Promise<EventBase[]> {
    let events = Array.from(this.stores.events.values());

    if (filter) {
      if (filter.tenantId) {
        events = events.filter((e) => e.tenantId === filter.tenantId);
      }
      if (filter.storeId) {
        events = events.filter((e) => e.storeId === filter.storeId);
      }
      if (filter.fromLamport !== undefined) {
        events = events.filter((e) => e.clock.lamport > filter.fromLamport!);
      }
    }

    return events.sort((a, b) => a.clock.lamport - b.clock.lamport);
  }

  // Storage persistence
  private saveToStorage(): void {
    try {
      const data = {
        orders: Array.from(this.stores.orders.entries()),
        products: Array.from(this.stores.products.entries()),
        events: Array.from(this.stores.events.entries()),
      };
      localStorage.setItem("pos_db", JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem("pos_db");
      if (stored) {
        const data = JSON.parse(stored);
        this.stores.orders = new Map(data.orders || []);
        this.stores.products = new Map(data.products || []);
        this.stores.events = new Map(data.events || []);
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
  }

  private async seedDemoData(): Promise<void> {
    // Only seed if no products exist
    if (this.stores.products.size > 0) {
      return;
    }

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
        modifiers: [
          { id: "mod-1", name: "Extra Cheese", price: 1.5, required: false },
          { id: "mod-2", name: "Bacon", price: 2.0, required: false },
        ],
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
        modifiers: [],
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
        modifiers: [
          { id: "mod-3", name: "Large Size", price: 1.0, required: false },
        ],
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
        modifiers: [
          { id: "mod-4", name: "Extra Cheese", price: 2.0, required: false },
          { id: "mod-5", name: "Pepperoni", price: 3.0, required: false },
        ],
        version: 1,
        lamport: 4,
      },
      // Retail products
      {
        sku: "tshirt-001",
        tenantId: "retail_demo",
        storeId: "store_001",
        name: "Cotton T-Shirt",
        description: "Comfortable cotton t-shirt",
        price: 19.99,
        category: "clothing",
        isActive: true,
        modifiers: [
          {
            id: "mod-6",
            name: "Size M",
            price: 0,
            required: true,
            options: ["S", "M", "L", "XL"],
          },
          {
            id: "mod-7",
            name: "Color",
            price: 0,
            required: true,
            options: ["White", "Black", "Blue"],
          },
        ],
        version: 1,
        lamport: 5,
      },
      {
        sku: "jeans-001",
        tenantId: "retail_demo",
        storeId: "store_001",
        name: "Blue Jeans",
        description: "Classic blue denim jeans",
        price: 49.99,
        category: "clothing",
        isActive: true,
        modifiers: [
          {
            id: "mod-8",
            name: "Size 32",
            price: 0,
            required: true,
            options: ["28", "30", "32", "34", "36"],
          },
        ],
        version: 1,
        lamport: 6,
      },
    ];

    for (const product of demoProducts) {
      await this.insertProduct(product);
    }

    console.log("✅ Demo data seeded successfully");
  }

  async clear(): Promise<void> {
    this.stores.orders.clear();
    this.stores.products.clear();
    this.stores.events.clear();
    localStorage.removeItem("pos_db");
  }
}

// Singleton instance
let dbInstance: SimpleDB | null = null;

export async function initDatabase(): Promise<SimpleDB> {
  if (!dbInstance) {
    dbInstance = new SimpleDB();
    await dbInstance.init();
    console.log("✅ Simple database initialized");
  }
  return dbInstance;
}

export function getDatabase(): SimpleDB {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  dbInstance = null;
  console.log("✅ Database closed");
}

// Database setup and management using RxDB with IndexedDB

import { createRxDatabase, addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import type { OrderDoc, ProductDoc, EventDoc } from "../types";

// Add plugins
if (process.env.NODE_ENV === "development") {
  addRxPlugin(RxDBDevModePlugin);
}

// Database instance
let dbInstance: any = null;

// Schema definitions
const orderSchema = {
  title: "Order schema",
  version: 0,
  primaryKey: "orderId",
  type: "object",
  properties: {
    orderId: {
      type: "string",
      maxLength: 100,
    },
    tenantId: {
      type: "string",
      maxLength: 100,
    },
    storeId: {
      type: "string",
      maxLength: 100,
    },
    status: {
      type: "string",
      enum: ["draft", "active", "parked", "paid", "cancelled"],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          sku: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          quantity: { type: "number" },
          modifiers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                price: { type: "number" },
              },
            },
          },
          notes: { type: "string" },
          category: { type: "string" },
        },
        required: ["id", "sku", "name", "price", "quantity"],
      },
    },
    subtotal: { type: "number" },
    tax: { type: "number" },
    total: { type: "number" },
    version: { type: "number" },
    lamport: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    createdBy: {
      type: "object",
      properties: {
        deviceId: { type: "string" },
        userId: { type: "string" },
        userName: { type: "string" },
      },
      required: ["deviceId"],
    },
    tableNumber: { type: "string" },
    guestCount: { type: "number" },
    parkedAt: { type: "string" },
    customerId: { type: "string" },
    customerName: { type: "string" },
  },
  required: [
    "orderId",
    "tenantId",
    "storeId",
    "status",
    "items",
    "subtotal",
    "tax",
    "total",
    "version",
    "lamport",
    "createdAt",
    "updatedAt",
    "createdBy",
  ],
  indexes: ["status", "createdAt", "lamport", "tenantId"],
} as const;

const productSchema = {
  title: "Product schema",
  version: 0,
  primaryKey: "sku",
  type: "object",
  properties: {
    sku: {
      type: "string",
      maxLength: 100,
    },
    tenantId: {
      type: "string",
      maxLength: 100,
    },
    storeId: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
      maxLength: 200,
    },
    description: {
      type: "string",
      maxLength: 1000,
    },
    price: {
      type: "number",
      minimum: 0,
    },
    category: {
      type: "string",
      maxLength: 100,
    },
    isActive: {
      type: "boolean",
    },
    modifiers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          required: { type: "boolean" },
          options: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["id", "name", "price", "required"],
      },
    },
    version: { type: "number" },
    lamport: { type: "number" },
  },
  required: [
    "sku",
    "tenantId",
    "storeId",
    "name",
    "price",
    "category",
    "isActive",
    "version",
    "lamport",
  ],
  indexes: ["category", "isActive", "tenantId"],
} as const;

const eventSchema = {
  title: "Event schema",
  version: 0,
  primaryKey: "eventId",
  type: "object",
  properties: {
    eventId: {
      type: "string",
      maxLength: 100,
    },
    tenantId: {
      type: "string",
      maxLength: 100,
    },
    storeId: {
      type: "string",
      maxLength: 100,
    },
    aggregateType: {
      type: "string",
      enum: ["order", "user", "product", "kds", "bds"],
    },
    aggregateId: {
      type: "string",
      maxLength: 100,
    },
    version: {
      type: "number",
      minimum: 1,
    },
    type: {
      type: "string",
      maxLength: 100,
    },
    at: {
      type: "string",
      format: "date-time",
    },
    actor: {
      type: "object",
      properties: {
        deviceId: { type: "string" },
        userId: { type: "string" },
        userName: { type: "string" },
      },
      required: ["deviceId"],
    },
    clock: {
      type: "object",
      properties: {
        lamport: { type: "number" },
        deviceId: { type: "string" },
      },
      required: ["lamport", "deviceId"],
    },
    payload: {
      type: "object",
    },
  },
  required: [
    "eventId",
    "tenantId",
    "storeId",
    "aggregateType",
    "aggregateId",
    "version",
    "type",
    "at",
    "actor",
    "clock",
    "payload",
  ],
  indexes: ["lamport", "at", "aggregateId", "tenantId"],
} as const;

/**
 * Initialize the RxDB database
 */
export async function initDatabase(
  dbName: string = "offline_pos_web"
): Promise<any> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Create database
    const db = await createRxDatabase({
      name: dbName,
      storage: getRxStorageDexie(),
      eventReduce: true,
      cleanupPolicy: {
        minimumDeletedTime: 1000 * 60 * 60 * 24 * 7, // Keep deleted docs for 7 days
        minimumCollectionAge: 1000 * 60 * 60 * 24 * 30, // Keep collections for 30 days
        runEach: 1000 * 60 * 60 * 24, // Run cleanup every day
        awaitReplicationsInSync: true,
        waitForLeadership: true,
      },
    });

    // Add collections
    await db.addCollections({
      orders: {
        schema: orderSchema,
        methods: {
          // Instance methods for order documents
          getFormattedTotal(this: OrderDoc) {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(this.total);
          },

          isParked(this: OrderDoc) {
            return this.status === "parked";
          },

          canBePaid(this: OrderDoc) {
            return this.status === "active" || this.status === "parked";
          },
        },
      },

      products: {
        schema: productSchema,
        methods: {
          // Instance methods for product documents
          getFormattedPrice(this: ProductDoc) {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(this.price);
          },

          isAvailable(this: ProductDoc) {
            return this.isActive;
          },
        },
      },

      events: {
        schema: eventSchema,
        methods: {
          // Instance methods for event documents
          isOrderEvent(this: EventDoc) {
            return this.aggregateType === "order";
          },

          getFormattedTime(this: EventDoc) {
            return new Date(this.at).toLocaleString();
          },
        },
      },
    });

    dbInstance = db;
    console.log("✅ RxDB database initialized successfully");

    // Add some demo data if the database is empty
    await seedDemoData(db);

    return db;
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Get the current database instance
 */
export function getDatabase(): any {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
    console.log("✅ Database closed successfully");
  }
}

/**
 * Seed demo data for testing
 */
async function seedDemoData(db: any): Promise<void> {
  try {
    // Check if we already have products
    const existingProducts = await db.products.find().exec();
    if (existingProducts.length > 0) {
      return; // Demo data already exists
    }

    // Demo products for restaurant
    const demoProducts = [
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
      // Simple demo products for "demo" tenant
      {
        sku: "coffee-001",
        tenantId: "demo",
        storeId: "store_001",
        name: "Coffee",
        description: "Hot brewed coffee",
        price: 3.99,
        category: "beverage",
        isActive: true,
        modifiers: [],
        version: 1,
        lamport: 5,
      },
      {
        sku: "sandwich-001",
        tenantId: "demo",
        storeId: "store_001",
        name: "Club Sandwich",
        description: "Triple layer sandwich with turkey, bacon, and veggies",
        price: 8.99,
        category: "food",
        isActive: true,
        modifiers: [],
        version: 1,
        lamport: 6,
      },
      {
        sku: "salad-001",
        tenantId: "demo",
        storeId: "store_001",
        name: "Caesar Salad",
        description: "Fresh romaine lettuce with caesar dressing",
        price: 7.99,
        category: "food",
        isActive: true,
        modifiers: [],
        version: 1,
        lamport: 7,
      },
      {
        sku: "juice-001",
        tenantId: "demo",
        storeId: "store_001",
        name: "Orange Juice",
        description: "Fresh squeezed orange juice",
        price: 4.99,
        category: "beverage",
        isActive: true,
        modifiers: [],
        version: 1,
        lamport: 8,
      },
    ];

    // Insert demo products
    for (const product of demoProducts) {
      await db.products.insert(product);
    }

    console.log("✅ Demo data seeded successfully");
  } catch (error) {
    console.error("❌ Failed to seed demo data:", error);
  }
}

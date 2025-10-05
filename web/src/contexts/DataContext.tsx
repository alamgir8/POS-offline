// Data management context with demo products (simplified)
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { saveToLocalStorage, loadFromLocalStorage } from "../utils";
import { useAuth } from "./AuthContext";

// Product interface to match native
interface Product {
  id: string;
  name: string;
  price: number;
  category: "food" | "other";
  available: boolean;
  description?: string;
}

// Order interface
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: "food" | "other";
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  total: number;
  tax: number;
  subtotal: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  tableNumber?: string;
  customerName?: string;
  createdAt: string;
  updatedAt: string;
}

interface DataContextType {
  // Products
  products: Product[];
  isLoading: boolean;
  loadProducts: () => Promise<void>;

  // Orders
  orders: Order[];
  loadOrders: () => Promise<void>;
  addOrder: (
    order: Omit<Order, "id" | "createdAt" | "updatedAt">
  ) => Promise<Order>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;

  // KDS/BDS Orders (derived from main orders)
  kdsOrders: Order[];
  bdsOrders: Order[];

  // Real-time sync status
  isConnected: boolean;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Demo products data (same as native)
const demoProducts: Product[] = [
  // Food items
  {
    id: "1",
    name: "Burger",
    price: 12.99,
    category: "food",
    available: true,
    description: "Juicy beef burger with fresh toppings",
  },
  {
    id: "2",
    name: "Pizza",
    price: 18.99,
    category: "food",
    available: true,
    description: "Margherita pizza with fresh basil",
  },
  {
    id: "3",
    name: "Pasta",
    price: 14.99,
    category: "food",
    available: true,
    description: "Creamy alfredo pasta",
  },
  {
    id: "4",
    name: "Salad",
    price: 9.99,
    category: "food",
    available: true,
    description: "Fresh garden salad",
  },
  {
    id: "5",
    name: "Sandwich",
    price: 8.99,
    category: "food",
    available: true,
    description: "Club sandwich with turkey and bacon",
  },
  {
    id: "6",
    name: "Steak",
    price: 24.99,
    category: "food",
    available: true,
    description: "Grilled ribeye steak",
  },

  // Other items (drinks, etc.)
  {
    id: "7",
    name: "Coffee",
    price: 3.99,
    category: "other",
    available: true,
    description: "Hot brewed coffee",
  },
  {
    id: "8",
    name: "Tea",
    price: 2.99,
    category: "other",
    available: true,
    description: "Earl grey tea",
  },
  {
    id: "9",
    name: "Soda",
    price: 2.49,
    category: "other",
    available: true,
    description: "Refreshing cola",
  },
  {
    id: "10",
    name: "Beer",
    price: 5.99,
    category: "other",
    available: true,
    description: "Cold draft beer",
  },
  {
    id: "11",
    name: "Wine",
    price: 8.99,
    category: "other",
    available: true,
    description: "House red wine",
  },
  {
    id: "12",
    name: "Juice",
    price: 3.49,
    category: "other",
    available: true,
    description: "Fresh orange juice",
  },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Real-time sync state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<any[]>([]);

  // Hub discovery function for web
  const discoverHubs = async (): Promise<string[]> => {
    const commonPorts = [4001, 4000, 3001, 8001];
    const discoveries: string[] = [];

    const candidateHosts = ["localhost", "127.0.0.1", "192.168.0.143"];

    const promises = candidateHosts.flatMap((host) =>
      commonPorts.map(async (port) => {
        try {
          const url = `http://${host}:${port}/api/health`;
          const response = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.service === "cloudclever-pos-hub") {
              return `http://${host}:${port}`;
            }
          }
        } catch (error) {
          // Ignore failed connections
        }
        return null;
      })
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        discoveries.push(result.value);
      }
    }

    return discoveries;
  };

  // Initialize real-time connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const connectToHub = async () => {
      console.log("🔌 Discovering and connecting to hub server...");
      setConnectionStatus("connecting");

      try {
        // First try to discover hubs on the LAN
        const availableHubs = await discoverHubs();
        let hubUrl = "http://localhost:4001"; // fallback

        if (availableHubs.length > 0) {
          hubUrl = availableHubs[0];
          console.log("🎯 Found hub server:", hubUrl);
        } else {
          console.log("🔍 No hubs discovered, using localhost fallback");
        }

        const socket = io(hubUrl, {
          transports: ["websocket", "polling"],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 10000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("✅ Connected to hub server:", hubUrl);
          setIsConnected(true);
          setConnectionStatus("connected");

          // Send hello message to join tenant/store room
          socket.emit("hello", {
            deviceId: `web-${Date.now()}`,
            tenantId: user.tenantId || "demo-tenant",
            storeId: user.storeId || "demo-store",
            auth: {
              sessionId: "demo-session",
              userId: user.userId,
            },
          });

          // Process offline queue when reconnected
          if (offlineQueueRef.current.length > 0) {
            console.log(
              `📤 Processing ${offlineQueueRef.current.length} offline events`
            );
            offlineQueueRef.current.forEach((event) => {
              socket.emit("events.append", event);
            });
            offlineQueueRef.current = [];
          }
        });

        socket.on("disconnect", (reason) => {
          console.log("❌ Disconnected from hub server, reason:", reason);
          setIsConnected(false);
          setConnectionStatus("disconnected");

          // Auto-reconnect for unexpected disconnections
          if (reason !== "io client disconnect") {
            console.log("🔄 Setting up auto-reconnect...");
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              connectToHub();
            }, 3000);
          }
        });

        socket.on("connect_error", (error) => {
          console.error("❌ Connection error:", error);
          setConnectionStatus("error");

          // Try to reconnect with different hub after error
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connectToHub();
          }, 5000);
        });

        // Listen for real-time order events
        socket.on("events.relay", (event: any) => {
          console.log("📨 Received real-time event:", event);

          if (event.aggregateType === "order") {
            handleOrderEvent(event);
          }
        });

        socket.on("hello.ack", (ack: any) => {
          console.log("✅ Hello acknowledged by hub server:", ack);
        });
      } catch (error) {
        console.error("Error setting up real-time connection:", error);
        setConnectionStatus("error");
      }
    };

    // Start the connection process
    connectToHub();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  // Handle incoming order events
  const handleOrderEvent = (event: any) => {
    try {
      switch (event.type) {
        case "order.created":
          // Add new order if not already exists
          setOrders((prevOrders) => {
            const exists = prevOrders.find((o) => o.id === event.aggregateId);
            if (!exists && event.payload.order) {
              const newOrders = [event.payload.order, ...prevOrders];
              saveToLocalStorage("web_orders", newOrders);
              return newOrders;
            }
            return prevOrders;
          });
          break;

        case "order.updated":
          // Update existing order
          setOrders((prevOrders) => {
            const updatedOrders = prevOrders.map((order) =>
              order.id === event.aggregateId
                ? { ...order, ...event.payload.updates, updatedAt: event.at }
                : order
            );
            saveToLocalStorage("web_orders", updatedOrders);
            return updatedOrders;
          });
          break;
      }
    } catch (error) {
      console.error("Error handling order event:", error);
    }
  };

  // Emit order event to hub
  const emitOrderEvent = (
    eventType: string,
    aggregateId: string,
    payload: any
  ) => {
    const event = {
      eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "order",
      aggregateId,
      version: 1,
      type: eventType,
      at: new Date().toISOString(),
      actor: {
        deviceId: `web-${Date.now()}`,
        userId: user?.userId,
        userName: user?.userName,
      },
      clock: {
        lamport: Date.now(),
        deviceId: `web-${Date.now()}`,
      },
      payload,
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit("events.append", event);
    } else {
      // Queue for when reconnected
      offlineQueueRef.current.push(event);
      console.log("📝 Queued event for offline sync:", eventType);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      loadInitialData();
    }
  }, [isAuthenticated, user]);

  const loadInitialData = async () => {
    console.log("🚀 Loading initial data...");
    await Promise.all([loadProducts(), loadOrders()]);
    console.log("✅ Initial data loading complete");
    setIsLoading(false);
  };

  const loadProducts = async () => {
    try {
      console.log("🛒 Loading products...");
      // Try to load from storage first
      const storedProducts = loadFromLocalStorage<Product[]>("web_products");
      console.log("📦 Raw stored products:", storedProducts);

      if (storedProducts && storedProducts.length > 0) {
        console.log(
          "📦 Loaded products from storage:",
          storedProducts.length,
          "items"
        );
        setProducts(storedProducts);
      } else {
        // Use demo data and save to storage
        console.log(
          "📦 No stored products, using demo data:",
          demoProducts.length,
          "items"
        );
        setProducts(demoProducts);
        saveToLocalStorage("web_products", demoProducts);
        console.log("💾 Demo products saved to storage");
      }
    } catch (error) {
      console.error("❌ Error loading products:", error);
      console.log(
        "📦 Fallback to demo products:",
        demoProducts.length,
        "items"
      );
      setProducts(demoProducts); // Fallback to demo data
    }
  };

  const loadOrders = async () => {
    try {
      const storedOrders = loadFromLocalStorage<Order[]>("web_orders");
      if (storedOrders) {
        setOrders(storedOrders);
        console.log(
          "📋 Loaded orders from storage:",
          storedOrders.length,
          "items"
        );
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  const addOrder = async (
    orderData: Omit<Order, "id" | "createdAt" | "updatedAt">
  ): Promise<Order> => {
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      saveToLocalStorage("web_orders", updatedOrders);

      // Emit real-time event
      emitOrderEvent("order.created", newOrder.id, { order: newOrder });

      console.log("✅ Order created:", newOrder.id);
      return newOrder;
    } catch (error) {
      console.error("Error adding order:", error);
      throw error;
    }
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      const updatedOrders = orders.map((order) =>
        order.id === orderId
          ? { ...order, ...updates, updatedAt: new Date().toISOString() }
          : order
      );
      setOrders(updatedOrders);
      saveToLocalStorage("web_orders", updatedOrders);

      // Emit real-time event
      emitOrderEvent("order.updated", orderId, { updates });

      console.log("✅ Order updated:", orderId, updates);
    } catch (error) {
      console.error("Error updating order:", error);
      throw error;
    }
  };

  // Filter orders for KDS (kitchen) and BDS (bar)
  const kdsOrders: Order[] = orders.filter(
    (order) =>
      order.items.some((item) => item.category === "food") &&
      order.status !== "completed" &&
      order.status !== "cancelled"
  );

  const bdsOrders: Order[] = orders.filter(
    (order) =>
      order.items.some((item) => item.category === "other") &&
      order.status !== "completed" &&
      order.status !== "cancelled"
  );

  return (
    <DataContext.Provider
      value={{
        products,
        isLoading,
        loadProducts,
        orders,
        loadOrders,
        addOrder,
        updateOrder,
        kdsOrders,
        bdsOrders,
        isConnected,
        connectionStatus,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

// Enhanced Data management context with offline-first support
// Supports restaurant and retail modes with park orders, KDS/BDS tickets, and order locking

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { saveToLocalStorage, loadFromLocalStorage } from "../utils";
import { useAuth } from "./AuthContext";

// ============================================================
// TYPES
// ============================================================

type TenantType = "restaurant" | "retail";
type ProductCategory = "food" | "beverage" | "retail" | "other";
type OrderStatus =
  | "draft"
  | "active"
  | "parked"
  | "preparing"
  | "ready"
  | "paid"
  | "completed"
  | "cancelled";
type TicketStatus = "pending" | "started" | "completed" | "cancelled";
type SyncStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

interface Product {
  id: string;
  sku?: string;
  name: string;
  price: number;
  category: ProductCategory;
  available: boolean;
  description?: string;
}

interface OrderItem {
  id: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  category: ProductCategory;
  notes?: string;
  status?: "pending" | "preparing" | "ready" | "served";
  modifiers?: { id: string; name: string; price: number }[];
}

interface Order {
  id: string;
  orderNumber: string;
  tenantId: string;
  storeId: string;
  items: OrderItem[];
  total: number;
  tax: number;
  subtotal: number;
  status: OrderStatus;
  tableNumber?: string;
  customerName?: string;
  guestCount?: number;
  isParked?: boolean;
  parkedAt?: string;
  parkedBy?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  deviceId: string;
  version: number;
  lamport: number;
  syncStatus?: "pending" | "synced" | "error";
  // Lock tracking
  isLocked?: boolean;
  lockedBy?: {
    deviceId: string;
    userName: string;
    acquiredAt: string;
  };
}

interface KDSTicket {
  ticketId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
  storeId: string;
  type: "kds";
  items: OrderItem[];
  status: TicketStatus;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  version: number;
  lamport: number;
}

interface BDSTicket {
  ticketId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
  storeId: string;
  type: "bds";
  items: OrderItem[];
  status: TicketStatus;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  version: number;
  lamport: number;
}

interface OrderLockInfo {
  orderId: string;
  deviceId: string;
  userName: string;
  acquiredAt: string;
  expiresAt?: string;
}

interface DataContextType {
  // Configuration
  tenantType: TenantType;
  isRestaurantMode: boolean;
  isRetailMode: boolean;

  // Products
  products: Product[];
  isLoading: boolean;
  loadProducts: () => Promise<void>;

  // Orders
  orders: Order[];
  parkedOrders: Order[];
  activeOrders: Order[];
  loadOrders: () => Promise<void>;
  createOrder: (
    orderData: Omit<
      Order,
      "id" | "orderNumber" | "createdAt" | "updatedAt" | "version" | "lamport"
    >
  ) => Promise<Order>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;
  parkOrder: (orderId: string) => Promise<void>;
  unparkOrder: (orderId: string) => Promise<Order | null>;
  payOrder: (
    orderId: string,
    paymentMethod: "cash" | "card" | "digital"
  ) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;

  // Order Locking (for park orders)
  acquireLock: (
    orderId: string
  ) => Promise<{ success: boolean; error?: string; holder?: OrderLockInfo }>;
  releaseLock: (orderId: string) => Promise<void>;
  getLockStatus: (orderId: string) => OrderLockInfo | null;
  orderLocks: Map<string, OrderLockInfo>;

  // KDS/BDS Tickets
  kdsTickets: KDSTicket[];
  bdsTickets: BDSTicket[];
  pendingKdsTickets: KDSTicket[];
  pendingBdsTickets: BDSTicket[];
  completeKdsTicket: (ticketId: string) => Promise<void>;
  completeBdsTicket: (ticketId: string) => Promise<void>;

  // Real-time sync status
  isConnected: boolean;
  connectionStatus: SyncStatus;
  hubUrl: string | null;
  deviceId: string;
  lamportClock: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// ============================================================
// DEMO DATA
// ============================================================

const demoProducts: Product[] = [
  // Food items (go to KDS)
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
  // Beverage items (go to BDS)
  {
    id: "7",
    name: "Coffee",
    price: 3.99,
    category: "beverage",
    available: true,
    description: "Hot brewed coffee",
  },
  {
    id: "8",
    name: "Tea",
    price: 2.99,
    category: "beverage",
    available: true,
    description: "Earl grey tea",
  },
  {
    id: "9",
    name: "Soda",
    price: 2.49,
    category: "beverage",
    available: true,
    description: "Refreshing cola",
  },
  {
    id: "10",
    name: "Beer",
    price: 5.99,
    category: "beverage",
    available: true,
    description: "Cold draft beer",
  },
  {
    id: "11",
    name: "Wine",
    price: 8.99,
    category: "beverage",
    available: true,
    description: "House red wine",
  },
  {
    id: "12",
    name: "Juice",
    price: 3.49,
    category: "beverage",
    available: true,
    description: "Fresh orange juice",
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateId(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = String(now.getTime()).slice(-4);
  return `ORD-${datePart}-${timePart}`;
}

function filterItemsByCategory(
  items: OrderItem[],
  categories: ProductCategory[]
): OrderItem[] {
  return items.filter((item) => categories.includes(item.category));
}

// ============================================================
// PROVIDER COMPONENT
// ============================================================

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  // Core state
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kdsTickets, setKdsTickets] = useState<KDSTicket[]>([]);
  const [bdsTickets, setBdsTickets] = useState<BDSTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderLocks, setOrderLocks] = useState<Map<string, OrderLockInfo>>(
    new Map()
  );

  // Sync state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<SyncStatus>("disconnected");
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  const [lamportClock, setLamportClock] = useState(Date.now());

  // Device ID (persisted)
  const [deviceId] = useState(() => {
    const stored = loadFromLocalStorage<string>("pos_device_id");
    if (stored) return stored;
    const newId = generateId("web");
    saveToLocalStorage("pos_device_id", newId);
    return newId;
  });

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<any[]>([]);
  const lockRenewalIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Tenant type from user
  const tenantType: TenantType = user?.tenantId?.includes("restaurant")
    ? "restaurant"
    : user?.tenantId?.includes("retail")
    ? "retail"
    : "restaurant";
  const isRestaurantMode = tenantType === "restaurant";
  const isRetailMode = tenantType === "retail";

  // ============================================================
  // LAMPORT CLOCK
  // ============================================================

  const incrementClock = useCallback((): number => {
    setLamportClock((prev) => prev + 1);
    return lamportClock + 1;
  }, [lamportClock]);

  const updateClock = useCallback((receivedClock: number): void => {
    setLamportClock((prev) => Math.max(prev, receivedClock) + 1);
  }, []);

  // ============================================================
  // HUB DISCOVERY
  // ============================================================

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
        } catch {
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

  // ============================================================
  // SOCKET CONNECTION
  // ============================================================

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const connectToHub = async () => {
      console.log("🔌 Discovering and connecting to hub server...");
      setConnectionStatus("connecting");

      try {
        const availableHubs = await discoverHubs();
        let selectedHubUrl = "http://localhost:4001";

        if (availableHubs.length > 0) {
          selectedHubUrl = availableHubs[0];
          console.log("🎯 Found hub server:", selectedHubUrl);
        } else {
          console.log("🔍 No hubs discovered, using localhost fallback");
        }

        setHubUrl(selectedHubUrl);

        const socket = io(selectedHubUrl, {
          transports: ["websocket", "polling"],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 10000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("✅ Connected to hub server:", selectedHubUrl);
          setIsConnected(true);
          setConnectionStatus("connected");

          // Send hello message
          socket.emit("hello", {
            deviceId,
            tenantId: user.tenantId || "demo-tenant",
            storeId: user.storeId || "demo-store",
            cursor: lamportClock,
            auth: {
              sessionId: "demo-session",
              userId: user.userId,
            },
          });

          // Process offline queue
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
          console.log("❌ Disconnected from hub server:", reason);
          setIsConnected(false);
          setConnectionStatus("disconnected");

          if (reason !== "io client disconnect") {
            reconnectTimeoutRef.current = setTimeout(connectToHub, 3000);
          }
        });

        socket.on("connect_error", (error) => {
          console.error("❌ Connection error:", error);
          setConnectionStatus("error");
          reconnectTimeoutRef.current = setTimeout(connectToHub, 5000);
        });

        // Event handlers
        socket.on("events.relay", handleEventRelay);
        socket.on("events.bulk", handleBulkEvents);
        socket.on("hello.ack", (ack) =>
          console.log("✅ Hello acknowledged:", ack)
        );

        // Lock event handlers
        socket.on("order.locked", handleOrderLocked);
        socket.on("order.lock.released", handleOrderLockReleased);
        socket.on("order.lock.response", handleLockResponse);
      } catch (error) {
        console.error("Error setting up connection:", error);
        setConnectionStatus("error");
      }
    };

    connectToHub();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // Clear lock renewal intervals
      lockRenewalIntervals.current.forEach((interval) =>
        clearInterval(interval)
      );
      lockRenewalIntervals.current.clear();
    };
  }, [isAuthenticated, user]);

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  const handleEventRelay = useCallback(
    (event: any) => {
      console.log("📨 Received event:", event.type);
      updateClock(event.clock?.lamport || 0);

      switch (event.aggregateType) {
        case "order":
          handleOrderEvent(event);
          break;
        case "kds":
          handleKdsEvent(event);
          break;
        case "bds":
          handleBdsEvent(event);
          break;
      }
    },
    [updateClock]
  );

  const handleBulkEvents = useCallback(
    (bulk: { events: any[]; fromLamport: number; toLamport: number }) => {
      console.log(`📦 Received ${bulk.events.length} bulk events`);
      setConnectionStatus("syncing");

      bulk.events.forEach((event) => {
        handleEventRelay(event);
      });

      setConnectionStatus("connected");
    },
    [handleEventRelay]
  );

  const handleOrderEvent = (event: any) => {
    const { type, payload, aggregateId } = event;

    setOrders((prev) => {
      switch (type) {
        case "order.created":
          if (payload.order && !prev.find((o) => o.id === payload.order.id)) {
            const newOrders = [payload.order, ...prev];
            saveToLocalStorage("web_orders", newOrders);
            return newOrders;
          }
          return prev;

        case "order.updated":
        case "order.parked":
        case "order.unparked":
        case "order.paid":
        case "order.completed":
        case "order.cancelled":
          const updated = prev.map((order) =>
            order.id === aggregateId
              ? {
                  ...order,
                  ...(payload.updates || payload),
                  updatedAt: event.at,
                }
              : order
          );
          saveToLocalStorage("web_orders", updated);
          return updated;

        default:
          return prev;
      }
    });
  };

  const handleKdsEvent = (event: any) => {
    const { type, payload, aggregateId } = event;

    setKdsTickets((prev) => {
      switch (type) {
        case "kds.ticket.created":
          if (
            payload.ticket &&
            !prev.find((t) => t.ticketId === payload.ticket.ticketId)
          ) {
            return [payload.ticket, ...prev];
          }
          return prev;

        case "kds.ticket.completed":
        case "kds.ticket.started":
          return prev.map((ticket) =>
            ticket.ticketId === aggregateId
              ? {
                  ...ticket,
                  ...payload,
                  status: type.includes("completed") ? "completed" : "started",
                }
              : ticket
          );

        default:
          return prev;
      }
    });
  };

  const handleBdsEvent = (event: any) => {
    const { type, payload, aggregateId } = event;

    setBdsTickets((prev) => {
      switch (type) {
        case "bds.ticket.created":
          if (
            payload.ticket &&
            !prev.find((t) => t.ticketId === payload.ticket.ticketId)
          ) {
            return [payload.ticket, ...prev];
          }
          return prev;

        case "bds.ticket.completed":
        case "bds.ticket.started":
          return prev.map((ticket) =>
            ticket.ticketId === aggregateId
              ? {
                  ...ticket,
                  ...payload,
                  status: type.includes("completed") ? "completed" : "started",
                }
              : ticket
          );

        default:
          return prev;
      }
    });
  };

  // ============================================================
  // LOCK HANDLERS
  // ============================================================

  const handleOrderLocked = useCallback(
    (data: {
      orderId: string;
      deviceId: string;
      userName: string;
      acquiredAt: string;
    }) => {
      console.log("🔒 Order locked by another device:", data);
      setOrderLocks((prev) => {
        const newLocks = new Map(prev);
        newLocks.set(data.orderId, {
          orderId: data.orderId,
          deviceId: data.deviceId,
          userName: data.userName,
          acquiredAt: data.acquiredAt,
        });
        return newLocks;
      });
    },
    []
  );

  const handleOrderLockReleased = useCallback(
    (data: { orderId: string; deviceId: string; reason: string }) => {
      console.log("🔓 Order lock released:", data);
      setOrderLocks((prev) => {
        const newLocks = new Map(prev);
        newLocks.delete(data.orderId);
        return newLocks;
      });
    },
    []
  );

  const handleLockResponse = useCallback((response: any) => {
    console.log("🔐 Lock response:", response);
  }, []);

  // ============================================================
  // EVENT EMISSION
  // ============================================================

  const emitEvent = useCallback(
    (event: any) => {
      const eventWithClock = {
        ...event,
        clock: {
          lamport: incrementClock(),
          deviceId,
        },
      };

      if (socketRef.current?.connected) {
        socketRef.current.emit("events.append", eventWithClock);
      } else {
        offlineQueueRef.current.push(eventWithClock);
        console.log("📝 Queued event for offline sync:", event.type);
      }
    },
    [deviceId, incrementClock]
  );

  // ============================================================
  // ORDER OPERATIONS
  // ============================================================

  const createOrder = async (
    orderData: Omit<
      Order,
      "id" | "orderNumber" | "createdAt" | "updatedAt" | "version" | "lamport"
    >
  ): Promise<Order> => {
    const now = new Date().toISOString();
    const orderId = generateId("order");
    const newLamport = incrementClock();

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      orderNumber: generateOrderNumber(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      lamport: newLamport,
      deviceId,
      syncStatus: "pending",
    };

    // Update local state
    setOrders((prev) => {
      const updated = [newOrder, ...prev];
      saveToLocalStorage("web_orders", updated);
      return updated;
    });

    // Emit event
    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "order",
      aggregateId: orderId,
      version: 1,
      type: "order.created",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { order: newOrder },
    });

    // Create KDS/BDS tickets for restaurant mode
    if (isRestaurantMode) {
      const foodItems = filterItemsByCategory(newOrder.items, ["food"]);
      const beverageItems = filterItemsByCategory(newOrder.items, [
        "beverage",
        "other",
      ]);

      if (foodItems.length > 0) {
        const kdsTicket: KDSTicket = {
          ticketId: generateId("kds"),
          orderId,
          orderNumber: newOrder.orderNumber,
          tenantId: newOrder.tenantId,
          storeId: newOrder.storeId,
          type: "kds",
          items: foodItems,
          status: "pending",
          tableNumber: newOrder.tableNumber,
          createdAt: now,
          version: 1,
          lamport: incrementClock(),
        };

        setKdsTickets((prev) => [kdsTicket, ...prev]);

        emitEvent({
          eventId: generateId("evt"),
          tenantId: newOrder.tenantId,
          storeId: newOrder.storeId,
          aggregateType: "kds",
          aggregateId: kdsTicket.ticketId,
          version: 1,
          type: "kds.ticket.created",
          at: now,
          actor: { deviceId, userId: user?.userId, userName: user?.userName },
          payload: { ticket: kdsTicket },
        });
      }

      if (beverageItems.length > 0) {
        const bdsTicket: BDSTicket = {
          ticketId: generateId("bds"),
          orderId,
          orderNumber: newOrder.orderNumber,
          tenantId: newOrder.tenantId,
          storeId: newOrder.storeId,
          type: "bds",
          items: beverageItems,
          status: "pending",
          tableNumber: newOrder.tableNumber,
          createdAt: now,
          version: 1,
          lamport: incrementClock(),
        };

        setBdsTickets((prev) => [bdsTicket, ...prev]);

        emitEvent({
          eventId: generateId("evt"),
          tenantId: newOrder.tenantId,
          storeId: newOrder.storeId,
          aggregateType: "bds",
          aggregateId: bdsTicket.ticketId,
          version: 1,
          type: "bds.ticket.created",
          at: now,
          actor: { deviceId, userId: user?.userId, userName: user?.userName },
          payload: { ticket: bdsTicket },
        });
      }
    }

    return newOrder;
  };

  const updateOrder = async (
    orderId: string,
    updates: Partial<Order>
  ): Promise<void> => {
    const now = new Date().toISOString();

    setOrders((prev) => {
      const updated = prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              ...updates,
              updatedAt: now,
              version: order.version + 1,
              lamport: incrementClock(),
            }
          : order
      );
      saveToLocalStorage("web_orders", updated);
      return updated;
    });

    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "order",
      aggregateId: orderId,
      version: 1,
      type: "order.updated",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { updates },
    });
  };

  const parkOrder = async (orderId: string): Promise<void> => {
    const now = new Date().toISOString();

    await updateOrder(orderId, {
      status: "parked",
      isParked: true,
      parkedAt: now,
      parkedBy: user?.userName || user?.userId || deviceId,
    });

    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "order",
      aggregateId: orderId,
      version: 1,
      type: "order.parked",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { parkedAt: now },
    });
  };

  const unparkOrder = async (orderId: string): Promise<Order | null> => {
    // First acquire lock
    const lockResult = await acquireLock(orderId);
    if (!lockResult.success) {
      console.error(
        "Cannot unpark order - locked by another device:",
        lockResult.holder
      );
      return null;
    }

    const now = new Date().toISOString();

    let unparkedOrder: Order | null = null;

    setOrders((prev) => {
      const updated = prev.map((order) => {
        if (order.id === orderId) {
          unparkedOrder = {
            ...order,
            status: "active",
            isParked: false,
            updatedAt: now,
            version: order.version + 1,
            lamport: incrementClock(),
          };
          return unparkedOrder;
        }
        return order;
      });
      saveToLocalStorage("web_orders", updated);
      return updated;
    });

    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "order",
      aggregateId: orderId,
      version: 1,
      type: "order.unparked",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { unparkedAt: now },
    });

    return unparkedOrder;
  };

  const payOrder = async (
    orderId: string,
    paymentMethod: "cash" | "card" | "digital"
  ): Promise<void> => {
    const now = new Date().toISOString();

    await updateOrder(orderId, {
      status: "paid",
      isParked: false,
      paidAt: now,
    });

    // Release lock if held
    await releaseLock(orderId);

    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "order",
      aggregateId: orderId,
      version: 1,
      type: "order.paid",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { paidAt: now, paymentMethod },
    });
  };

  const cancelOrder = async (orderId: string): Promise<void> => {
    await updateOrder(orderId, { status: "cancelled" });
    await releaseLock(orderId);
  };

  // ============================================================
  // LOCK OPERATIONS
  // ============================================================

  const acquireLock = async (
    orderId: string
  ): Promise<{ success: boolean; error?: string; holder?: OrderLockInfo }> => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) {
        // In offline mode, allow local lock
        const existingLock = orderLocks.get(orderId);
        if (existingLock && existingLock.deviceId !== deviceId) {
          resolve({
            success: false,
            error: "ORDER_LOCKED",
            holder: existingLock,
          });
          return;
        }

        const lock: OrderLockInfo = {
          orderId,
          deviceId,
          userName: user?.userName || "Unknown",
          acquiredAt: new Date().toISOString(),
        };
        setOrderLocks((prev) => new Map(prev).set(orderId, lock));
        resolve({ success: true });
        return;
      }

      const handleResponse = (response: any) => {
        socketRef.current?.off("order.lock.response", handleResponse);

        if (response.orderId !== orderId) return;

        if (response.success) {
          setOrderLocks((prev) => {
            const newLocks = new Map(prev);
            newLocks.set(orderId, {
              orderId,
              deviceId,
              userName: user?.userName || "Unknown",
              acquiredAt: new Date().toISOString(),
              expiresAt: response.lock?.expiresAt,
            });
            return newLocks;
          });

          // Set up lock renewal
          const renewalInterval = setInterval(() => {
            socketRef.current?.emit("order.lock.renew", {
              orderId,
              tenantId: user?.tenantId || "demo-tenant",
              storeId: user?.storeId || "demo-store",
            });
          }, 2 * 60 * 1000); // Renew every 2 minutes

          lockRenewalIntervals.current.set(orderId, renewalInterval);

          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: response.error,
            holder: response.currentHolder,
          });
        }
      };

      socketRef.current.on("order.lock.response", handleResponse);
      socketRef.current.emit("order.lock.request", {
        orderId,
        tenantId: user?.tenantId || "demo-tenant",
        storeId: user?.storeId || "demo-store",
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socketRef.current?.off("order.lock.response", handleResponse);
        resolve({ success: false, error: "LOCK_TIMEOUT" });
      }, 5000);
    });
  };

  const releaseLock = async (orderId: string): Promise<void> => {
    // Clear renewal interval
    const interval = lockRenewalIntervals.current.get(orderId);
    if (interval) {
      clearInterval(interval);
      lockRenewalIntervals.current.delete(orderId);
    }

    // Remove from local state
    setOrderLocks((prev) => {
      const newLocks = new Map(prev);
      newLocks.delete(orderId);
      return newLocks;
    });

    // Notify hub
    if (socketRef.current?.connected) {
      socketRef.current.emit("order.lock.release", {
        orderId,
        tenantId: user?.tenantId || "demo-tenant",
        storeId: user?.storeId || "demo-store",
      });
    }
  };

  const getLockStatus = (orderId: string): OrderLockInfo | null => {
    return orderLocks.get(orderId) || null;
  };

  // ============================================================
  // TICKET OPERATIONS
  // ============================================================

  const completeKdsTicket = async (ticketId: string): Promise<void> => {
    const now = new Date().toISOString();

    setKdsTickets((prev) =>
      prev.map((ticket) =>
        ticket.ticketId === ticketId
          ? { ...ticket, status: "completed", completedAt: now }
          : ticket
      )
    );

    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "kds",
      aggregateId: ticketId,
      version: 1,
      type: "kds.ticket.completed",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { completedAt: now },
    });
  };

  const completeBdsTicket = async (ticketId: string): Promise<void> => {
    const now = new Date().toISOString();

    setBdsTickets((prev) =>
      prev.map((ticket) =>
        ticket.ticketId === ticketId
          ? { ...ticket, status: "completed", completedAt: now }
          : ticket
      )
    );

    emitEvent({
      eventId: generateId("evt"),
      tenantId: user?.tenantId || "demo-tenant",
      storeId: user?.storeId || "demo-store",
      aggregateType: "bds",
      aggregateId: ticketId,
      version: 1,
      type: "bds.ticket.completed",
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      payload: { completedAt: now },
    });
  };

  // ============================================================
  // DATA LOADING
  // ============================================================

  useEffect(() => {
    if (isAuthenticated && user) {
      loadInitialData();
    }
  }, [isAuthenticated, user]);

  const loadInitialData = async () => {
    console.log("🚀 Loading initial data...");
    await Promise.all([loadProducts(), loadOrders()]);
    setIsLoading(false);
  };

  const loadProducts = async () => {
    try {
      const storedProducts = loadFromLocalStorage<Product[]>("web_products");
      if (storedProducts && storedProducts.length > 0) {
        setProducts(storedProducts);
      } else {
        setProducts(demoProducts);
        saveToLocalStorage("web_products", demoProducts);
      }
    } catch (error) {
      console.error("Error loading products:", error);
      setProducts(demoProducts);
    }
  };

  const loadOrders = async () => {
    try {
      const storedOrders = loadFromLocalStorage<Order[]>("web_orders");
      if (storedOrders) {
        setOrders(storedOrders);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const parkedOrders = orders.filter(
    (o) => o.status === "parked" || o.isParked
  );
  const activeOrders = orders.filter(
    (o) =>
      o.status === "active" || o.status === "preparing" || o.status === "ready"
  );
  const pendingKdsTickets = kdsTickets.filter(
    (t) => t.status === "pending" || t.status === "started"
  );
  const pendingBdsTickets = bdsTickets.filter(
    (t) => t.status === "pending" || t.status === "started"
  );

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  return (
    <DataContext.Provider
      value={{
        tenantType,
        isRestaurantMode,
        isRetailMode,
        products,
        isLoading,
        loadProducts,
        orders,
        parkedOrders,
        activeOrders,
        loadOrders,
        createOrder,
        updateOrder,
        parkOrder,
        unparkOrder,
        payOrder,
        cancelOrder,
        acquireLock,
        releaseLock,
        getLockStatus,
        orderLocks,
        kdsTickets,
        bdsTickets,
        pendingKdsTickets,
        pendingBdsTickets,
        completeKdsTicket,
        completeBdsTicket,
        isConnected,
        connectionStatus,
        hubUrl,
        deviceId,
        lamportClock,
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

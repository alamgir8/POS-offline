// Complete type definitions for the web client

// Base event structure for event sourcing
export interface EventBase {
  eventId: string; // Unique event identifier (UUID v7 preferred)
  tenantId: string; // Multi-tenant isolation
  storeId: string; // Store-level isolation
  aggregateType:
    | "order"
    | "user"
    | "product"
    | "kds"
    | "bds"
    | "inventory"
    | "payment";
  aggregateId: string; // Entity ID (orderId, userId, etc.)
  version: number; // Monotonic version per aggregate
  type: EventType; // Specific event type
  at: string; // ISO timestamp
  actor: {
    // Who performed the action
    deviceId: string;
    userId?: string;
    userName?: string;
  };
  clock: {
    // Logical clock for ordering
    lamport: number;
    deviceId: string;
  };
  payload: Record<string, any>; // Event-specific data
}

// Event types for different domains
export type EventType =
  // Order events
  | "order.created"
  | "order.updated"
  | "order.parked"
  | "order.reparked"
  | "order.paid"
  | "order.locked"
  | "order.lock.renew"
  | "order.lock.released"
  | "order.cancelled"
  | "order.item.added"
  | "order.item.removed"
  | "order.item.updated"
  // KDS events
  | "kds.ticket.created"
  | "kds.ticket.ack"
  | "kds.ticket.done"
  // BDS events
  | "bds.ticket.created"
  | "bds.ticket.done"
  // Inventory events
  | "inventory.adjusted"
  // User events
  | "user.created"
  | "user.updated"
  | "user.login"
  | "user.logout"
  // Product events
  | "product.created"
  | "product.updated"
  | "product.deleted";

// Order status types
export type OrderStatus = "draft" | "active" | "parked" | "paid" | "cancelled";

// Order item structure
export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: OrderModifier[];
  notes?: string;
  category?: "food" | "beverage" | "retail";
}

export interface OrderModifier {
  id: string;
  name: string;
  price: number;
}

// Complete order structure
export interface Order {
  orderId: string;
  tenantId: string;
  storeId: string;
  status: OrderStatus;
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
  // Restaurant specific
  tableNumber?: string;
  guestCount?: number;
  parkedAt?: string;
  // Retail specific
  customerId?: string;
  customerName?: string;
}

// Authentication structures
export interface AuthUser {
  userId: string;
  userName: string;
  email: string;
  tenantId: string;
  storeId: string;
  role: "admin" | "manager" | "cashier" | "server" | "kitchen" | "bar";
  permissions: string[];
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  tenantId: string;
  storeId: string;
  expiresAt: string;
  createdAt: string;
}

// Device registration
export interface Device {
  deviceId: string;
  deviceName: string;
  deviceType: "web" | "mobile" | "tablet" | "kds" | "bds";
  tenantId: string;
  storeId: string;
  lastSeen: string;
  isOnline: boolean;
}

// Tenant and store configuration
export interface Tenant {
  tenantId: string;
  name: string;
  type: "restaurant" | "retail";
  settings: {
    currency: string;
    taxRate: number;
    timezone: string;
  };
}

export interface Store {
  storeId: string;
  tenantId: string;
  name: string;
  address: string;
  settings: {
    enableKDS: boolean;
    enableBDS: boolean;
    enableTableService: boolean;
    maxParkedOrders: number;
  };
}

// Product catalog
export interface Product {
  sku: string;
  tenantId: string;
  storeId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isActive: boolean;
  modifiers?: ProductModifier[];
  version: number;
  lamport: number;
}

export interface ProductModifier {
  id: string;
  name: string;
  price: number;
  required: boolean;
  options?: string[];
}

// KDS/BDS ticket structures
export interface KDSTicket {
  ticketId: string;
  orderId: string;
  tenantId: string;
  storeId: string;
  items: OrderItem[];
  status: "pending" | "started" | "completed" | "cancelled";
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  version: number;
  lamport: number;
}

export interface BDSTicket {
  ticketId: string;
  orderId: string;
  tenantId: string;
  storeId: string;
  items: OrderItem[];
  status: "pending" | "started" | "completed" | "cancelled";
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  version: number;
  lamport: number;
}

// Network sync structures
export interface SyncMessage {
  type:
    | "hello"
    | "hello.ack"
    | "events.append"
    | "events.bulk"
    | "events.relay"
    | "cursor.request";
  payload: any;
}

export interface HelloMessage {
  deviceId: string;
  tenantId: string;
  storeId: string;
  cursor?: number;
  auth?: {
    sessionId: string;
    userId: string;
  };
}

export interface HelloAckMessage {
  leaderId: string;
  serverTime: string;
  snapshotNeeded: boolean;
}

export interface EventsBulkMessage {
  events: EventBase[];
  fromLamport: number;
  toLamport: number;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId: string;
  deviceId: string;
  deviceName: string;
}

export interface LoginResponse {
  user: AuthUser;
  session: AuthSession;
  tenant: Tenant;
  store: Store;
}

// Error types
export interface PosError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Configuration types
export interface ClientConfig {
  hubUrl: string;
  apiUrl: string;
  tenantId: string;
  storeId: string;
  deviceId: string;
  syncEnabled: boolean;
  offlineMode: boolean;
  retryAttempts: number;
  retryDelay: number;
}

// Web-specific component prop types
export interface OrderCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onPark: (order: Order) => void;
  onPay: (order: Order) => void;
  onCancel: (order: Order) => void;
}

export interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  selected?: boolean;
  disabled?: boolean;
}

export interface ProductSelectorProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

// RxDB collection types
export interface OrderDoc extends Order {
  _id: string;
  _rev?: string;
}

export interface ProductDoc extends Product {
  _id: string;
  _rev?: string;
}

export interface EventDoc extends EventBase {
  _id: string;
  _rev?: string;
}

// Database schema types
export interface DatabaseSchema {
  orders: Order;
  products: Product;
  kdsTickets: KDSTicket;
  bdsTickets: BDSTicket;
  events: EventBase;
  sessions: AuthSession;
  devices: Device;
}

// Export utility type for deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Theme and UI types
export type Theme = "light" | "dark" | "system";

export interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  loading: boolean;
  error: string | null;
}

// Cart types for POS interface
export interface CartItem extends OrderItem {
  tempId: string; // For local cart management
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerId?: string;
  customerName?: string;
  tableNumber?: string;
  notes?: string;
}

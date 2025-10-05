// Local type definitions for the web client

// Re-export commonly used types from shared
export interface EventBase {
  eventId: string;
  tenantId: string;
  storeId: string;
  aggregateType:
    | "order"
    | "user"
    | "product"
    | "kds"
    | "bds"
    | "inventory"
    | "payment";
  aggregateId: string;
  version: number;
  type: EventType;
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

export type EventType =
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
  | "kds.ticket.created"
  | "kds.ticket.ack"
  | "kds.ticket.done"
  | "bds.ticket.created"
  | "bds.ticket.done"
  | "inventory.adjusted"
  | "user.created"
  | "user.updated"
  | "user.login"
  | "user.logout"
  | "product.created"
  | "product.updated"
  | "product.deleted";

export type OrderStatus = "draft" | "active" | "parked" | "paid" | "cancelled";

export type SyncStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

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
  tableNumber?: string;
  guestCount?: number;
  parkedAt?: string;
  customerId?: string;
  customerName?: string;
}

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

// Network sync structures
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

// API types
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
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Application state types
export interface AppState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  orders: Order[];
  products: Product[];
  isOnline: boolean;
  syncStatus: SyncStatus;
  hubUrl: string;
  deviceId: string;
  lamport: number;
}

// Component props types
export interface OrderFormProps {
  onOrderCreate: (order: Partial<Order>) => void;
  products: Product[];
  isLoading?: boolean;
}

export interface OrderListProps {
  orders: Order[];
  onOrderUpdate: (orderId: string, status: OrderStatus) => void;
  onOrderPark: (orderId: string) => void;
  onOrderRepark: (orderId: string) => void;
  onOrderPay: (orderId: string) => void;
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

// Error types
export interface PosError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Configuration
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

// Complete type definitions for the native app

// Base event structure for event sourcing
export interface EventBase {
  eventId: string;
  tenantId: string;
  storeId: string;
  aggregateType:
    | 'order'
    | 'user'
    | 'product'
    | 'kds'
    | 'bds'
    | 'inventory'
    | 'payment';
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
  | 'order.created'
  | 'order.updated'
  | 'order.parked'
  | 'order.reparked'
  | 'order.paid'
  | 'order.locked'
  | 'order.lock.renew'
  | 'order.lock.released'
  | 'order.cancelled'
  | 'order.item.added'
  | 'order.item.removed'
  | 'order.item.updated'
  | 'kds.ticket.created'
  | 'kds.ticket.ack'
  | 'kds.ticket.done'
  | 'bds.ticket.created'
  | 'bds.ticket.done'
  | 'inventory.adjusted'
  | 'user.created'
  | 'user.updated'
  | 'user.login'
  | 'user.logout'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted';

export interface OrderItem {
  id: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  notes?: string;
  status?: 'pending' | 'preparing' | 'ready' | 'served';
  modifiers?: {
    id: string;
    name: string;
    price: number;
  }[];
}

export interface Order {
  id: string;
  orderId?: string;
  orderNumber: string;
  tenantId?: string;
  storeId?: string;
  tableNumber?: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  tax: number;
  subtotal: number;
  status:
    | 'pending'
    | 'preparing'
    | 'ready'
    | 'completed'
    | 'cancelled'
    | 'parked';
  createdAt: string;
  updatedAt: string;
  paymentMethod?: 'cash' | 'card' | 'digital';
  notes?: string;
  isParked?: boolean;
  deviceId?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  localId?: string;
  cloudId?: string;
  version?: number;
  lamport?: number;
  createdBy?: {
    deviceId: string;
    userId?: string;
    userName?: string;
  };
  guestCount?: number;
  parkedAt?: string;
  customerId?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  available: boolean;
}

export interface ProductModifier {
  id: string;
  name: string;
  price: number;
  required: boolean;
  options?: string[];
}

export interface Restaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  settings: {
    currency: string;
    taxRate: number;
    timezone: string;
    enableKDS: boolean;
    enableBDS: boolean;
    enableTableService: boolean;
    maxParkedOrders: number;
  };
}

export interface Device {
  deviceId: string;
  deviceName: string;
  deviceType: 'web' | 'mobile' | 'tablet' | 'kds' | 'bds';
  tenantId: string;
  storeId: string;
  lastSeen: string;
  isOnline: boolean;
}

export interface SyncEvent {
  type:
    | 'ORDER_ADDED'
    | 'ORDER_UPDATED'
    | 'ORDER_DELETED'
    | 'MODE_CHANGE'
    | 'SYNC_COMPLETE'
    | 'ITEM_STATUS_CHANGED';
  orderId?: string;
  itemId?: string;
  status?: string;
  newMode?: string;
  synced?: number;
  total?: number;
  data?: any;
}

export interface NetworkMode {
  type: 'cloud_only' | 'local_only' | 'hybrid';
  cloudAvailable: boolean;
  localServerAvailable: boolean;
  localServerUrl?: string;
  lastCloudSync?: string;
}

export interface QueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastAttempt?: string;
}

export interface AuthUser {
  userId: string;
  userName: string;
  email: string;
  tenantId: string;
  storeId: string;
  tenantType?: 'restaurant' | 'retail';
  role: 'admin' | 'manager' | 'cashier' | 'server' | 'kitchen' | 'bar';
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

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  POS: undefined;
  KDS: undefined;
  BDS: undefined;
  Orders: undefined;
  Settings: undefined;
};

export type TabParamList = {
  POS: undefined;
  Orders: undefined;
  KDS: undefined;
  BDS: undefined;
};

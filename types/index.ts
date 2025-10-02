export interface OrderItem {
  id: string;
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
  orderNumber: string;
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
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  available: boolean;
  modifiers?: {
    id: string;
    name: string;
    price: number;
    required?: boolean;
  }[];
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  settings: {
    currency: string;
    taxRate: number;
    serviceCharge?: number;
    timezone: string;
  };
}

export interface Device {
  id: string;
  name: string;
  type: 'main_pos' | 'kds' | 'bds' | 'secondary_pos';
  restaurantId: string;
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

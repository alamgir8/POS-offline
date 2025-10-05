// Hub-specific types and re-exports of shared types

// Base event structure for event sourcing
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

// Event types for different domains
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

// Hub-specific types
export interface ConnectedClient {
  socketId: string;
  deviceId: string;
  tenantId: string;
  storeId: string;
  userId?: string;
  userName?: string;
  lastSeen: Date;
  cursor: number; // Last Lamport timestamp received
}

export interface HubStats {
  connectedClients: number;
  totalEvents: number;
  eventsPerTenant: Record<string, number>;
  uptime: number;
}

export interface AuthenticationResult {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: string;
}

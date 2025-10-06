// Utility functions for the hub server

import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import type { EventBase, OrderItem, OrderModifier } from "./types.js";

// UUID generation utilities
export function generateEventId(): string {
  // Use UUID v7 for better time-based ordering
  try {
    return uuidv7();
  } catch {
    // Fallback to UUID v4 if v7 is not available
    return uuidv4();
  }
}

export function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateDeviceId(): string {
  return `device_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Lamport clock utilities
let localLamportClock = 0;

export function nextLamport(peerLamport?: number): number {
  localLamportClock = Math.max(localLamportClock, peerLamport || 0) + 1;
  return localLamportClock;
}

export function getCurrentLamport(): number {
  return localLamportClock;
}

export function updateLamportClock(peerLamport: number): void {
  localLamportClock = Math.max(localLamportClock, peerLamport);
}

// Event creation utilities
export function createEvent(
  tenantId: string,
  storeId: string,
  aggregateType: EventBase["aggregateType"],
  aggregateId: string,
  type: EventBase["type"],
  version: number,
  payload: Record<string, any>,
  actor: EventBase["actor"]
): EventBase {
  return {
    eventId: generateEventId(),
    tenantId,
    storeId,
    aggregateType,
    aggregateId,
    version,
    type,
    at: new Date().toISOString(),
    actor,
    clock: {
      lamport: nextLamport(),
      deviceId: actor.deviceId,
    },
    payload,
  };
}

// Order calculation utilities
export function calculateOrderTotals(
  items: OrderItem[],
  taxRate: number = 0.08
): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const modifierTotal =
      (item.modifiers || []).reduce((modSum, mod) => modSum + mod.price, 0) *
      item.quantity;
    return sum + itemTotal + modifierTotal;
  }, 0);

  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    total,
  };
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateTenantId(tenantId: string): boolean {
  return (
    /^[a-zA-Z0-9_-]+$/.test(tenantId) &&
    tenantId.length >= 3 &&
    tenantId.length <= 50
  );
}

export function validateStoreId(storeId: string): boolean {
  return (
    /^[a-zA-Z0-9_-]+$/.test(storeId) &&
    storeId.length >= 3 &&
    storeId.length <= 50
  );
}

// Date utilities
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString();
}

export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

// Async utilities
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

// Retry utility
export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        await delay(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError!;
}

// Deep clone utility
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

// Event comparison and ordering
export function compareEvents(a: EventBase, b: EventBase): number {
  // Primary sort by Lamport timestamp
  if (a.clock.lamport !== b.clock.lamport) {
    return a.clock.lamport - b.clock.lamport;
  }

  // Secondary sort by device ID for deterministic ordering
  return a.clock.deviceId.localeCompare(b.clock.deviceId);
}

export function isEventOlderThan(
  event: EventBase,
  otherEvent: EventBase
): boolean {
  return compareEvents(event, otherEvent) < 0;
}

// Conflict resolution utilities
export function resolveConflict<T extends { version: number; lamport: number }>(
  local: T,
  remote: T
): T {
  // Use version-based conflict resolution with Lamport timestamp as tiebreaker
  if (remote.version > local.version) {
    return remote;
  } else if (remote.version === local.version) {
    // Same version, use Lamport timestamp
    return remote.lamport > local.lamport ? remote : local;
  } else {
    return local;
  }
}

// Error handling
export class PosError extends Error {
  public code: string;
  public details?: Record<string, any>;
  public timestamp: string;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = "PosError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Common error codes
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  AUTHORIZATION_FAILED: "AUTHORIZATION_FAILED",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  STORE_NOT_FOUND: "STORE_NOT_FOUND",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  SYNC_ERROR: "SYNC_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// Server-specific utilities
export function sanitizeDeviceId(deviceId: string): string {
  return deviceId.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50);
}

export function generateHubId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `hub_${timestamp}_${random}`;
}

// IP address validation
export function isValidIPAddress(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}

  public isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  public reset(key: string): void {
    this.requests.delete(key);
  }
}

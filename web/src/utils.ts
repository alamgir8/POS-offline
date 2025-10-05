// Utility functions for the web client

import { v4 as uuidv4 } from "uuid";
import type { EventBase, Order, OrderItem } from "./types";

// Lamport clock management
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

// ID generation
export function generateEventId(): string {
  return uuidv4();
}

export function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateDeviceId(): string {
  const stored = localStorage.getItem("pos_device_id");
  if (stored) {
    return stored;
  }

  const deviceId = `web_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("pos_device_id", deviceId);
  return deviceId;
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

export function validateOrderItem(item: OrderItem): boolean {
  return !!(item.id && item.name && item.price >= 0 && item.quantity > 0);
}

export function validateOrder(order: Partial<Order>): boolean {
  return !!(
    order.items &&
    order.items.length > 0 &&
    order.items.every(validateOrderItem) &&
    order.total &&
    order.total > 0
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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Storage utilities
export function saveToLocalStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return null;
  }
}

export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to remove from localStorage:", error);
  }
}

// Network utilities
export function getLocalIPAddress(): Promise<string> {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({
      iceServers: [],
    });

    pc.createDataChannel("");
    pc.createOffer().then((offer) => pc.setLocalDescription(offer));

    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(
          ice.candidate.candidate
        )?.[1];
        if (myIP) {
          resolve(myIP);
          pc.close();
        }
      }
    };

    setTimeout(() => {
      pc.close();
      reject(new Error("Could not determine local IP"));
    }, 1000);
  });
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

// Device detection
export function getDeviceType(): "web" | "mobile" | "tablet" {
  const userAgent = window.navigator.userAgent;

  if (
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  ) {
    if (/iPad/i.test(userAgent) || window.screen.width >= 768) {
      return "tablet";
    }
    return "mobile";
  }

  return "web";
}

// Theme utilities
export function getStoredTheme(): "light" | "dark" | "system" {
  return (
    (localStorage.getItem("pos_theme") as "light" | "dark" | "system") ||
    "system"
  );
}

export function setStoredTheme(theme: "light" | "dark" | "system"): void {
  localStorage.setItem("pos_theme", theme);
}

export function applyTheme(theme: "light" | "dark" | "system"): void {
  const root = document.documentElement;

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.toggle("dark", systemTheme === "dark");
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

// Category utilities for products
export function getProductCategories(products: any[]): string[] {
  const categories = new Set<string>();
  products.forEach((product) => {
    if (product.category) {
      categories.add(product.category);
    }
  });
  return Array.from(categories).sort();
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
  NETWORK_ERROR: "NETWORK_ERROR",
  SYNC_ERROR: "SYNC_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
} as const;

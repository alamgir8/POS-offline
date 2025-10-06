// Utility functions for the web client

import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
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

export function formatCurrency(
  amount: number,
  currency: string = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
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

// Device detection
export function getDeviceType(): "web" | "mobile" | "tablet" {
  if (typeof window === "undefined") {
    return "web";
  }

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
    (loadFromLocalStorage("theme") as "light" | "dark" | "system") || "system"
  );
}

export function setStoredTheme(theme: "light" | "dark" | "system"): void {
  saveToLocalStorage("theme", theme);
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

export function getEffectiveTheme(): "light" | "dark" {
  const stored = getStoredTheme();
  if (stored === "system") {
    return getSystemTheme();
  }
  return stored;
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

// Web-specific utilities
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Cart utilities
export function addToCart(
  cart: OrderItem[],
  product: { sku: string; name: string; price: number },
  quantity: number = 1
): OrderItem[] {
  const existingItem = cart.find((item) => item.sku === product.sku);

  if (existingItem) {
    return cart.map((item) =>
      item.sku === product.sku
        ? { ...item, quantity: item.quantity + quantity }
        : item
    );
  } else {
    return [
      ...cart,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sku: product.sku,
        name: product.name,
        price: product.price,
        quantity,
        modifiers: [],
      },
    ];
  }
}

export function removeFromCart(cart: OrderItem[], itemId: string): OrderItem[] {
  return cart.filter((item) => item.id !== itemId);
}

export function updateCartItemQuantity(
  cart: OrderItem[],
  itemId: string,
  quantity: number
): OrderItem[] {
  if (quantity <= 0) {
    return removeFromCart(cart, itemId);
  }

  return cart.map((item) =>
    item.id === itemId ? { ...item, quantity } : item
  );
}

// Network status
export function getNetworkStatus(): {
  online: boolean;
  type?: string;
} {
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    return {
      online: navigator.onLine,
      type: (navigator as any).connection?.effectiveType,
    };
  }
  return { online: true };
}

// Print utilities
export function printReceipt(order: Order): void {
  const printContent = `
    <div style="font-family: monospace; max-width: 300px;">
      <h2 style="text-align: center;">Receipt</h2>
      <p>Order #: ${order.orderId}</p>
      <p>Date: ${formatDateTime(order.createdAt)}</p>
      <hr>
      ${order.items
        .map(
          (item) => `
        <div style="display: flex; justify-content: space-between;">
          <span>${item.name} x${item.quantity}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      `
        )
        .join("")}
      <hr>
      <div style="display: flex; justify-content: space-between;">
        <strong>Subtotal:</strong>
        <strong>${formatCurrency(order.subtotal)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <strong>Tax:</strong>
        <strong>${formatCurrency(order.tax)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <strong>Total:</strong>
        <strong>${formatCurrency(order.total)}</strong>
      </div>
    </div>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  }
}

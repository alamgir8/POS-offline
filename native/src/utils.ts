// Utility functions for the native app

import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { Dimensions, Appearance } from 'react-native';

// Define types locally to avoid circular dependency
interface EventBase {
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
  type: string;
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

interface OrderItem {
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

interface Order {
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
  return `mobile_${Math.random().toString(36).slice(2, 10)}`;
}

// Event creation utilities
export function createEvent(
  tenantId: string,
  storeId: string,
  aggregateType: EventBase['aggregateType'],
  aggregateId: string,
  type: EventBase['type'],
  version: number,
  payload: Record<string, any>,
  actor: EventBase['actor']
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
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString();
}

export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

// AsyncStorage utilities (React Native equivalent of localStorage)
export async function saveToStorage<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to AsyncStorage:', error);
  }
}

export async function loadFromStorage<T>(key: string): Promise<T | null> {
  try {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Failed to load from AsyncStorage:', error);
    return null;
  }
}

export async function removeFromStorage(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove from AsyncStorage:', error);
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
      setTimeout(() => reject(new Error('Timeout')), ms)
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
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
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
export function getDeviceType(): 'mobile' | 'tablet' {
  const { width, height } = Dimensions.get('window');
  const aspectRatio = height / width;

  // Simple heuristic: if the screen is relatively square, it's likely a tablet
  if (Math.min(width, height) >= 600 || aspectRatio < 1.6) {
    return 'tablet';
  }
  return 'mobile';
}

// Error handling
export class PosError extends Error {
  public code: string;
  public details?: Record<string, any>;
  public timestamp: string;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'PosError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Common error codes
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  SYNC_ERROR: 'SYNC_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// Native-specific utilities
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: any;
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
  product: { sku?: string; name: string; price: number },
  quantity: number = 1
): OrderItem[] {
  const existingItem = cart.find((item) =>
    product.sku ? item.sku === product.sku : item.name === product.name
  );

  if (existingItem) {
    return cart.map((item) =>
      (product.sku ? item.sku === product.sku : item.name === product.name)
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

// Network status (React Native specific)
export async function getNetworkStatus(): Promise<{
  online: boolean;
  type?: string;
}> {
  try {
    const state = await NetInfo.fetch();
    return {
      online: state.isConnected ?? false,
      type: state.type,
    };
  } catch (error) {
    console.error('Error getting network status:', error);
    return { online: false };
  }
}

// Haptic feedback (React Native)
export function hapticFeedback(
  type: 'light' | 'medium' | 'heavy' = 'light'
): void {
  try {
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
    }
  } catch (error) {
    // Haptics might not be available on all devices
    console.warn('Haptic feedback not available:', error);
  }
}

// Theme utilities
export async function getStoredTheme(): Promise<'light' | 'dark' | 'system'> {
  const theme = await loadFromStorage<'light' | 'dark' | 'system'>('theme');
  return theme || 'system';
}

export async function setStoredTheme(
  theme: 'light' | 'dark' | 'system'
): Promise<void> {
  await saveToStorage('theme', theme);
}

export function getSystemTheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export async function getEffectiveTheme(): Promise<'light' | 'dark'> {
  const stored = await getStoredTheme();
  if (stored === 'system') {
    return getSystemTheme();
  }
  return stored;
}

// Receipt formatting for mobile printing
export function formatReceiptText(order: Order): string {
  const width = 32; // Standard receipt width
  const line = '='.repeat(width);

  let receipt = '';
  receipt += 'RECEIPT\n';
  receipt += line + '\n';
  receipt += `Order #: ${order.orderNumber}\n`;
  receipt += `Date: ${formatDateTime(order.createdAt)}\n`;
  receipt += line + '\n';

  order.items.forEach((item) => {
    receipt += `${item.name}\n`;
    receipt += `  ${item.quantity} x ${formatCurrency(
      item.price
    )} = ${formatCurrency(item.price * item.quantity)}\n`;
    if (item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach((mod) => {
        receipt += `  + ${mod.name} ${formatCurrency(mod.price)}\n`;
      });
    }
  });

  receipt += line + '\n';
  receipt += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
  receipt += `Tax: ${formatCurrency(order.tax)}\n`;
  receipt += `Total: ${formatCurrency(order.total)}\n`;
  receipt += line + '\n';
  receipt += 'Thank you!\n';

  return receipt;
}

// Order status helpers
export function getOrderStatusColor(status: Order['status']): string {
  switch (status) {
    case 'pending':
      return '#FFA500'; // Orange
    case 'preparing':
      return '#FF6B6B'; // Red
    case 'ready':
      return '#4ECDC4'; // Teal
    case 'completed':
      return '#45B7D1'; // Blue
    case 'cancelled':
      return '#96CEB4'; // Light green
    case 'parked':
      return '#FECA57'; // Yellow
    default:
      return '#BDC3C7'; // Gray
  }
}

export function getOrderStatusLabel(status: Order['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'parked':
      return 'Parked';
    default:
      return 'Unknown';
  }
}

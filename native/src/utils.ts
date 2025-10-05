// Utilities for React Native client

export function generateDeviceId(): string {
  return `mobile_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateEventId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Lamport clock management
let localLamportClock = 0;

export function nextLamport(peerLamport?: number): number {
  localLamportClock = Math.max(localLamportClock, peerLamport || 0) + 1;
  return localLamportClock;
}

export function updateLamportClock(peerLamport: number): void {
  localLamportClock = Math.max(localLamportClock, peerLamport);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
}

export function calculateOrderTotals(
  items: any[],
  taxRate: number = 0.08
): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    total,
  };
}

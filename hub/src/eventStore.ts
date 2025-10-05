// Event store for managing distributed events across the POS system

import type { EventBase } from "./types.js";

export interface EventFilter {
  tenantId?: string;
  storeId?: string;
  aggregateType?: string;
  aggregateId?: string;
  fromLamport?: number;
  toLamport?: number;
  fromTime?: string;
  toTime?: string;
}

export class EventStore {
  private events: Map<string, EventBase> = new Map(); // eventId -> event
  private eventsByAggregate: Map<string, EventBase[]> = new Map(); // aggregateId -> events[]
  private eventsByLamport: Map<number, EventBase[]> = new Map(); // lamport -> events[]
  private lastLamport = 0;
  private maxEvents = 10000; // Configurable limit to prevent memory issues

  /**
   * Append a new event to the store (idempotent)
   */
  append(event: EventBase): boolean {
    // Idempotency check
    if (this.events.has(event.eventId)) {
      return false; // Event already exists
    }

    // Validate event structure
    if (!this.validateEvent(event)) {
      throw new Error(`Invalid event structure: ${event.eventId}`);
    }

    // Store the event
    this.events.set(event.eventId, event);

    // Update aggregate index
    const aggregateKey = `${event.tenantId}:${event.storeId}:${event.aggregateId}`;
    if (!this.eventsByAggregate.has(aggregateKey)) {
      this.eventsByAggregate.set(aggregateKey, []);
    }
    this.eventsByAggregate.get(aggregateKey)!.push(event);

    // Update Lamport index
    if (!this.eventsByLamport.has(event.clock.lamport)) {
      this.eventsByLamport.set(event.clock.lamport, []);
    }
    this.eventsByLamport.get(event.clock.lamport)!.push(event);

    // Update last Lamport clock
    this.lastLamport = Math.max(this.lastLamport, event.clock.lamport);

    // Cleanup old events if we exceed the limit
    this.cleanup();

    console.log(
      `Event stored: ${event.type} for ${event.aggregateId} (Lamport: ${event.clock.lamport})`
    );
    return true;
  }

  /**
   * Get events in bulk from a Lamport timestamp
   */
  getBulk(fromLamport: number, limit = 100): EventBase[] {
    const results: EventBase[] = [];
    const sortedLamports = Array.from(this.eventsByLamport.keys())
      .filter((l) => l > fromLamport)
      .sort((a, b) => a - b);

    for (const lamport of sortedLamports) {
      const events = this.eventsByLamport.get(lamport)!;
      for (const event of events) {
        results.push(event);
        if (results.length >= limit) {
          return results;
        }
      }
    }

    return results;
  }

  /**
   * Get events for a specific aggregate
   */
  getAggregateEvents(
    tenantId: string,
    storeId: string,
    aggregateId: string
  ): EventBase[] {
    const aggregateKey = `${tenantId}:${storeId}:${aggregateId}`;
    const events = this.eventsByAggregate.get(aggregateKey) || [];
    return events.sort((a, b) => a.version - b.version);
  }

  /**
   * Get events with filters
   */
  getEvents(filter: EventFilter): EventBase[] {
    let results: EventBase[] = [];

    if (filter.aggregateId && filter.tenantId && filter.storeId) {
      // Optimized path for specific aggregate
      results = this.getAggregateEvents(
        filter.tenantId,
        filter.storeId,
        filter.aggregateId
      );
    } else {
      // General filter - iterate through all events
      results = Array.from(this.events.values());
    }

    // Apply filters
    if (filter.tenantId) {
      results = results.filter((e) => e.tenantId === filter.tenantId);
    }
    if (filter.storeId) {
      results = results.filter((e) => e.storeId === filter.storeId);
    }
    if (filter.aggregateType) {
      results = results.filter((e) => e.aggregateType === filter.aggregateType);
    }
    if (filter.fromLamport !== undefined) {
      results = results.filter((e) => e.clock.lamport > filter.fromLamport!);
    }
    if (filter.toLamport !== undefined) {
      results = results.filter((e) => e.clock.lamport <= filter.toLamport!);
    }
    if (filter.fromTime) {
      results = results.filter((e) => e.at >= filter.fromTime!);
    }
    if (filter.toTime) {
      results = results.filter((e) => e.at <= filter.toTime!);
    }

    // Sort by Lamport clock, then by device ID for deterministic ordering
    return results.sort((a, b) => {
      if (a.clock.lamport !== b.clock.lamport) {
        return a.clock.lamport - b.clock.lamport;
      }
      return a.clock.deviceId.localeCompare(b.clock.deviceId);
    });
  }

  /**
   * Get the latest Lamport timestamp
   */
  getLastLamport(): number {
    return this.lastLamport;
  }

  /**
   * Get event count statistics
   */
  getStats(): {
    totalEvents: number;
    lastLamport: number;
    tenantCounts: Record<string, number>;
    typeCounts: Record<string, number>;
  } {
    const tenantCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    for (const event of this.events.values()) {
      tenantCounts[event.tenantId] = (tenantCounts[event.tenantId] || 0) + 1;
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.events.size,
      lastLamport: this.lastLamport,
      tenantCounts,
      typeCounts,
    };
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.eventsByAggregate.clear();
    this.eventsByLamport.clear();
    this.lastLamport = 0;
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: EventBase): boolean {
    if (!event.eventId || !event.tenantId || !event.storeId) {
      return false;
    }
    if (!event.aggregateType || !event.aggregateId) {
      return false;
    }
    if (typeof event.version !== "number" || event.version < 1) {
      return false;
    }
    if (!event.type || !event.at) {
      return false;
    }
    if (!event.actor?.deviceId) {
      return false;
    }
    if (!event.clock?.deviceId || typeof event.clock.lamport !== "number") {
      return false;
    }
    return true;
  }

  /**
   * Cleanup old events to prevent memory issues
   */
  private cleanup(): void {
    if (this.events.size <= this.maxEvents) {
      return;
    }

    // Remove oldest events (by Lamport timestamp)
    const sortedEvents = Array.from(this.events.values()).sort(
      (a, b) => a.clock.lamport - b.clock.lamport
    );

    const toRemove = this.events.size - this.maxEvents;
    const eventsToRemove = sortedEvents.slice(0, toRemove);

    for (const event of eventsToRemove) {
      this.removeEvent(event);
    }

    console.log(`Cleaned up ${toRemove} old events`);
  }

  /**
   * Remove a specific event from all indexes
   */
  private removeEvent(event: EventBase): void {
    this.events.delete(event.eventId);

    // Remove from aggregate index
    const aggregateKey = `${event.tenantId}:${event.storeId}:${event.aggregateId}`;
    const aggregateEvents = this.eventsByAggregate.get(aggregateKey);
    if (aggregateEvents) {
      const index = aggregateEvents.findIndex(
        (e) => e.eventId === event.eventId
      );
      if (index !== -1) {
        aggregateEvents.splice(index, 1);
        if (aggregateEvents.length === 0) {
          this.eventsByAggregate.delete(aggregateKey);
        }
      }
    }

    // Remove from Lamport index
    const lamportEvents = this.eventsByLamport.get(event.clock.lamport);
    if (lamportEvents) {
      const index = lamportEvents.findIndex((e) => e.eventId === event.eventId);
      if (index !== -1) {
        lamportEvents.splice(index, 1);
        if (lamportEvents.length === 0) {
          this.eventsByLamport.delete(event.clock.lamport);
        }
      }
    }
  }
}

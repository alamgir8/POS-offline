// Real-time synchronization client using Socket.io

import { io, Socket } from "socket.io-client";
import type {
  EventBase,
  HelloMessage,
  HelloAckMessage,
  EventsBulkMessage,
} from "../types";

export interface SyncClientConfig {
  hubUrl: string;
  deviceId: string;
  tenantId: string;
  storeId: string;
  auth?: {
    sessionId: string;
    userId: string;
  };
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export type SyncStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

export interface SyncEvents {
  statusChanged: (status: SyncStatus) => void;
  eventReceived: (event: EventBase) => void;
  bulkEventsReceived: (events: EventBase[]) => void;
  error: (error: Error) => void;
}

export class SyncClient {
  private socket: Socket | null = null;
  private config: SyncClientConfig;
  private status: SyncStatus = "disconnected";
  private eventHandlers: Partial<SyncEvents> = {};
  private cursor = 0;
  private lamportClock = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * Discover CloudClever POS hubs on the local network
   * Note: In browser environment, we need to use HTTP discovery instead of mDNS
   */
  static async discoverHubs(): Promise<string[]> {
    // In a browser environment, we can't use mDNS directly
    // Instead, we'll try common LAN addresses or use a discovery endpoint
    const commonPorts = [4001, 4000, 3001, 8001];
    const discoveries: string[] = [];

    // Get the current network range (simple approach)
    const currentUrl = new URL(window.location.href);
    const baseIP = currentUrl.hostname;

    // For development, try localhost and current IP with common ports
    const candidateHosts = ["localhost", "127.0.0.1"];

    // Try to detect local network IP range (simplified)
    if (baseIP !== "localhost" && baseIP !== "127.0.0.1") {
      candidateHosts.push(baseIP);
      // Add some common local network IPs
      const ipParts = baseIP.split(".");
      if (ipParts.length === 4) {
        for (let i = 1; i <= 254; i++) {
          candidateHosts.push(`${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${i}`);
        }
      }
    }

    const promises = candidateHosts.slice(0, 10).flatMap(
      (
        host // Limit to avoid too many requests
      ) =>
        commonPorts.map(async (port) => {
          try {
            const url = `http://${host}:${port}/api/health`;
            const response = await fetch(url, {
              method: "GET",
              signal: AbortSignal.timeout(2000),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.service === "cloudclever-pos-hub") {
                return `http://${host}:${port}`;
              }
            }
          } catch (error) {
            // Ignore failed connections
          }
          return null;
        })
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        discoveries.push(result.value);
      }
    }

    return discoveries;
  }

  constructor(config: SyncClientConfig) {
    this.config = config;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.lamportClock = Date.now(); // Initialize with current timestamp
  }

  /**
   * Increment and return the Lamport clock
   */
  private incrementClock(): number {
    this.lamportClock += 1;
    return this.lamportClock;
  }

  /**
   * Update the Lamport clock with received timestamp (causal ordering)
   */
  private updateClock(receivedClock: number): void {
    this.lamportClock = Math.max(this.lamportClock, receivedClock) + 1;
  }

  /**
   * Get the current Lamport clock value
   */
  getLamportClock(): number {
    return this.lamportClock;
  }

  /**
   * Connect to the hub server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    this.setStatus("connecting");

    try {
      this.socket = io(this.config.hubUrl, {
        transports: ["websocket", "polling"],
        timeout: 10000,
        retries: 3,
        autoConnect: false,
      });

      this.setupSocketEventHandlers();
      this.socket.connect();
    } catch (error) {
      this.handleError(new Error(`Failed to connect: ${error}`));
    }
  }

  /**
   * Disconnect from the hub server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.setStatus("disconnected");
    this.reconnectAttempts = 0;
  }

  /**
   * Send an event to the hub
   */
  async sendEvent(event: EventBase): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to hub");
    }

    // Update event with current Lamport clock
    const currentClock = this.incrementClock();
    event.clock = {
      lamport: currentClock,
      deviceId: this.config.deviceId,
    };

    this.socket.emit("events.append", event);
    this.cursor = Math.max(this.cursor, currentClock);
  }

  /**
   * Request events from a specific cursor position
   */
  requestEvents(fromLamport: number): void {
    if (!this.socket?.connected) {
      throw new Error("Not connected to hub");
    }

    this.socket.emit("cursor.request", { fromLamport });
  }

  /**
   * Register event handlers
   */
  on<K extends keyof SyncEvents>(event: K, handler: SyncEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Remove event handlers
   */
  off<K extends keyof SyncEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get current cursor position
   */
  getCursor(): number {
    return this.cursor;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      console.log("🔗 Connected to hub server");
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      this.sendHello();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected from hub:", reason);
      this.setStatus("disconnected");

      if (
        this.config.autoReconnect !== false &&
        reason !== "io client disconnect"
      ) {
        this.scheduleReconnect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      this.handleError(new Error(`Connection error: ${error.message}`));

      if (this.config.autoReconnect !== false) {
        this.scheduleReconnect();
      }
    });

    // Protocol events
    this.socket.on("hello.ack", (ack: HelloAckMessage) => {
      console.log("👋 Hello acknowledged by hub:", ack.leaderId);
    });

    this.socket.on("events.relay", (event: EventBase) => {
      this.handleIncomingEvent(event);
    });

    this.socket.on("events.bulk", (bulk: EventsBulkMessage) => {
      this.handleBulkEvents(bulk);
    });

    this.socket.on("error", (error: any) => {
      console.error("🚨 Socket error:", error);
      this.handleError(new Error(error.message || "Socket error"));
    });

    // Keepalive
    this.socket.on("pong", () => {
      // Hub responded to ping
    });

    // Start keepalive ping
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("ping");
      }
    }, 30000); // Ping every 30 seconds
  }

  private sendHello(): void {
    if (!this.socket?.connected) return;

    const helloMessage: HelloMessage = {
      deviceId: this.config.deviceId,
      tenantId: this.config.tenantId,
      storeId: this.config.storeId,
      cursor: this.cursor,
      auth: this.config.auth,
    };

    this.socket.emit("hello", helloMessage);
  }

  private handleIncomingEvent(event: EventBase): void {
    console.log(`📨 Received event: ${event.type} for ${event.aggregateId}`);

    // Update our Lamport clock with received event (causal ordering)
    this.updateClock(event.clock.lamport);
    this.cursor = Math.max(this.cursor, event.clock.lamport);

    // Notify listeners
    this.eventHandlers.eventReceived?.(event);
  }

  private handleBulkEvents(bulk: EventsBulkMessage): void {
    console.log(`📦 Received ${bulk.events.length} bulk events`);

    if (bulk.events.length === 0) return;

    this.setStatus("syncing");

    // Sort events by Lamport timestamp
    const sortedEvents = bulk.events.sort(
      (a, b) => a.clock.lamport - b.clock.lamport
    );

    // Update cursor and Lamport clock with the highest received clock
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    this.updateClock(lastEvent.clock.lamport);
    this.cursor = Math.max(this.cursor, lastEvent.clock.lamport);

    // Emit to registered handlers
    this.eventHandlers.bulkEventsReceived?.(sortedEvents);

    this.setStatus("connected");
  }

  private setStatus(status: SyncStatus): void {
    if (this.status !== status) {
      this.status = status;
      console.log(`🔄 Sync status changed: ${status}`);
      this.eventHandlers.statusChanged?.(status);
    }
  }

  private handleError(error: Error): void {
    this.setStatus("error");
    console.error("🚨 Sync error:", error);
    this.eventHandlers.error?.(error);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("❌ Max reconnection attempts reached");
      this.setStatus("error");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      30000
    ); // Exponential backoff, max 30s

    console.log(
      `🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.config.autoReconnect !== false) {
        this.connect();
      }
    }, delay);
  }
}

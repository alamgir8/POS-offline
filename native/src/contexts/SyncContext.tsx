import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { Order, OrderItem } from '../types';
import { useAuth } from './AuthContext';

// ============================================================
// TYPES
// ============================================================

interface EventBase {
  eventId: string;
  tenantId: string;
  storeId: string;
  aggregateType: 'order' | 'kds' | 'bds' | 'inventory' | 'payment';
  aggregateId: string;
  version: number;
  type: string;
  at: string;
  actor: { deviceId: string; userId?: string; userName?: string };
  clock: { lamport: number; deviceId: string };
  payload: Record<string, any>;
}

interface HubInfo {
  host: string;
  port: number;
  tenantId: string;
  storeId: string;
  version: string;
}

interface OrderLockInfo {
  orderId: string;
  deviceId: string;
  userName: string;
  acquiredAt: string;
  expiresAt?: string;
}

interface LockResult {
  success: boolean;
  error?: string;
  holder?: OrderLockInfo;
}

interface KDSTicket {
  ticketId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
  storeId: string;
  type: 'kds';
  items: OrderItem[];
  status: 'pending' | 'started' | 'completed' | 'cancelled';
  tableNumber?: string;
  createdAt: string;
  completedAt?: string;
  version: number;
  lamport: number;
}

interface BDSTicket {
  ticketId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
  storeId: string;
  type: 'bds';
  items: OrderItem[];
  status: 'pending' | 'started' | 'completed' | 'cancelled';
  tableNumber?: string;
  createdAt: string;
  completedAt?: string;
  version: number;
  lamport: number;
}

interface SyncContextType {
  // Connection state
  isOnline: boolean;
  isConnectedToServer: boolean;
  serverIP: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  lamportClock: number;
  deviceId: string;

  // Connection management
  connectToServer: (ip?: string) => Promise<boolean>;
  discoverHubs: () => Promise<HubInfo[]>;
  syncData: () => Promise<void>;

  // Order operations
  sendOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  parkOrder: (order: Order) => Promise<void>;
  unparkOrder: (orderId: string) => Promise<void>;
  payOrder: (orderId: string, paymentMethod: string) => Promise<void>;

  // Order locking (for park orders)
  acquireLock: (orderId: string) => Promise<LockResult>;
  releaseLock: (orderId: string) => Promise<void>;
  getLockStatus: (orderId: string) => OrderLockInfo | null;
  orderLocks: Map<string, OrderLockInfo>;

  // KDS/BDS tickets
  kdsTickets: KDSTicket[];
  bdsTickets: BDSTicket[];
  completeKdsTicket: (ticketId: string) => Promise<void>;
  completeBdsTicket: (ticketId: string) => Promise<void>;

  // Callbacks
  onOrderReceived: (callback: (order: Order) => void) => void;
  onOrderStatusUpdated: (
    callback: (orderId: string, status: string) => void
  ) => void;
  onSyncDataReceived: (callback: (data: any) => void) => void;
  onKdsTicketReceived: (callback: (ticket: KDSTicket) => void) => void;
  onBdsTicketReceived: (callback: (ticket: BDSTicket) => void) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateId(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

// ============================================================
// PROVIDER
// ============================================================

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();

  // Connection state
  const [isOnline, setIsOnline] = useState(false);
  const [isConnectedToServer, setIsConnectedToServer] = useState(false);
  const [serverIP, setServerIP] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>(
    'idle'
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [lamportClock, setLamportClock] = useState(Date.now());

  // Tickets
  const [kdsTickets, setKdsTickets] = useState<KDSTicket[]>([]);
  const [bdsTickets, setBdsTickets] = useState<BDSTicket[]>([]);

  // Order locks
  const [orderLocks, setOrderLocks] = useState<Map<string, OrderLockInfo>>(
    new Map()
  );

  // Device ID
  const [deviceId, setDeviceId] = useState<string>('');

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const offlineQueueRef = useRef<EventBase[]>([]);
  const lockRenewalIntervals = useRef<
    Map<string, ReturnType<typeof setInterval>>
  >(new Map());

  // Retry management
  const retryCountRef = useRef<number>(0);
  const maxRetries = 10;
  const lastConnectionAttemptRef = useRef<number>(0);
  const currentNetworkTypeRef = useRef<string | null>(null);

  // Callbacks
  const orderReceivedCallback = useRef<((order: Order) => void) | null>(null);
  const orderStatusUpdateCallback = useRef<
    ((orderId: string, status: string) => void) | null
  >(null);
  const syncDataCallback = useRef<((data: any) => void) | null>(null);
  const kdsTicketCallback = useRef<((ticket: KDSTicket) => void) | null>(null);
  const bdsTicketCallback = useRef<((ticket: BDSTicket) => void) | null>(null);

  // ============================================================
  // LAMPORT CLOCK
  // ============================================================

  const incrementClock = useCallback(
    (receivedClock?: number): number => {
      const newClock = Math.max(lamportClock, receivedClock || 0) + 1;
      setLamportClock(newClock);
      return newClock;
    },
    [lamportClock]
  );

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    // Initialize device ID
    const initDeviceId = async () => {
      let storedDeviceId = await AsyncStorage.getItem('pos_device_id');
      if (!storedDeviceId) {
        storedDeviceId = generateId('mobile');
        await AsyncStorage.setItem('pos_device_id', storedDeviceId);
      }
      setDeviceId(storedDeviceId);
    };

    initDeviceId();
    loadServerIP();
    loadOfflineData();
    loadTickets();
  }, [user]);

  // ============================================================
  // NETWORK MONITORING
  // ============================================================

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      currentNetworkTypeRef.current = state.type;
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setIsOnline(connected);

      if (state.type !== currentNetworkTypeRef.current) {
        currentNetworkTypeRef.current = state.type;
        retryCountRef.current = 0;
      }

      const hasLocalNetwork =
        state.type === 'wifi' ||
        state.type === 'ethernet' ||
        (state.type === 'cellular' && connected);

      if (hasLocalNetwork && serverIP && user && !isConnectedToServer) {
        connectToServer(serverIP);
      } else if (!hasLocalNetwork) {
        setIsConnectedToServer(false);
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      lockRenewalIntervals.current.forEach((interval) =>
        clearInterval(interval)
      );
      lockRenewalIntervals.current.clear();
    };
  }, [serverIP, user]);

  // Auto-connect when ready
  useEffect(() => {
    if (serverIP && !isConnectedToServer && user && !isConnecting && deviceId) {
      connectToServer(serverIP);
    } else if (!user && isConnectedToServer) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnectedToServer(false);
    }
  }, [serverIP, isConnectedToServer, user, isConnecting, deviceId]);

  // ============================================================
  // HUB DISCOVERY
  // ============================================================

  const discoverHubs = async (): Promise<HubInfo[]> => {
    try {
      const defaultHub: HubInfo = {
        host: '192.168.0.143',
        port: 4001,
        tenantId: user?.tenantId || 'demo',
        storeId: user?.storeId || 'store_001',
        version: '1.0.0',
      };
      return [defaultHub];
    } catch (error) {
      console.error('❌ Error discovering hubs:', error);
      return [];
    }
  };

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadServerIP = async () => {
    try {
      await AsyncStorage.removeItem('serverIP');
      const discoveredIP = '192.168.0.143';
      setServerIP(discoveredIP);
      await AsyncStorage.setItem('serverIP', discoveredIP);

      if (user && deviceId) {
        connectToServer(discoveredIP);
      }
    } catch (error) {
      console.error('Error loading server IP:', error);
    }
  };

  const loadOfflineData = async () => {
    try {
      const pendingData = await AsyncStorage.getItem('pendingSync');
      const pendingItems = pendingData ? JSON.parse(pendingData) : [];

      if (
        pendingItems.length > 0 &&
        isConnectedToServer &&
        socketRef.current?.connected
      ) {
        await processOfflineQueue();
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  };

  const loadTickets = async () => {
    try {
      const kdsData = await AsyncStorage.getItem('kdsTickets');
      const bdsData = await AsyncStorage.getItem('bdsTickets');

      if (kdsData) setKdsTickets(JSON.parse(kdsData));
      if (bdsData) setBdsTickets(JSON.parse(bdsData));
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const saveTickets = async (kds: KDSTicket[], bds: BDSTicket[]) => {
    try {
      await AsyncStorage.setItem('kdsTickets', JSON.stringify(kds));
      await AsyncStorage.setItem('bdsTickets', JSON.stringify(bds));
    } catch (error) {
      console.error('Error saving tickets:', error);
    }
  };

  // ============================================================
  // CONNECTION
  // ============================================================

  const connectToServer = async (ip?: string): Promise<boolean> => {
    const targetIP = ip || serverIP || 'localhost';
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionAttemptRef.current;

    if (
      isConnecting ||
      (timeSinceLastAttempt < 1000 && timeSinceLastAttempt > 0)
    ) {
      return false;
    }
    lastConnectionAttemptRef.current = now;

    if (
      !isOnline ||
      isConnecting ||
      isConnectedToServer ||
      !user ||
      !deviceId
    ) {
      return false;
    }

    try {
      setIsConnecting(true);

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const socketUrl = `http://${targetIP}:4001`;
      console.log('🔌 Connecting to hub server:', socketUrl);

      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: false,
        timeout: 15000,
        forceNew: true,
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          setIsConnecting(false);
          resolve(false);
        }, 15000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Connected to hub server:', targetIP);
          socketRef.current = socket;
          setIsConnectedToServer(true);
          setIsConnecting(false);
          setServerIP(targetIP);
          retryCountRef.current = 0;

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          AsyncStorage.setItem('serverIP', targetIP);

          // Send hello
          socket.emit('hello', {
            deviceId,
            tenantId: user?.tenantId || 'demo',
            storeId: user?.storeId || 'store_001',
            cursor: lamportClock,
            auth: {
              sessionId: session?.sessionId || 'demo-session',
              userId: user?.userId || 'demo-user',
            },
          });

          processOfflineQueue();
          resolve(true);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ Connection error:', error);
          setIsConnecting(false);
          retryCountRef.current += 1;

          if (
            !reconnectTimeoutRef.current &&
            retryCountRef.current < maxRetries
          ) {
            const backoffDelay = Math.min(
              1000 * Math.pow(2, retryCountRef.current - 1),
              30000
            );
            reconnectTimeoutRef.current = setTimeout(async () => {
              reconnectTimeoutRef.current = null;
              if (!isConnectedToServer && !isConnecting && targetIP && user) {
                await connectToServer(targetIP);
              }
            }, backoffDelay);
          }
          resolve(false);
        });

        socket.on('disconnect', (reason) => {
          console.log('❌ Disconnected:', reason);
          setIsConnectedToServer(false);

          if (reason !== 'io client disconnect' && serverIP && user) {
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null;
                if (!isConnectedToServer) {
                  connectToServer(serverIP);
                }
              }, 3000);
            }
          }
        });

        // Event handlers
        socket.on('events.relay', handleEventRelay);
        socket.on('events.bulk', handleBulkEvents);
        socket.on('hello.ack', (ack) =>
          console.log('✅ Hello acknowledged:', ack)
        );

        // Lock handlers
        socket.on('order.locked', handleOrderLocked);
        socket.on('order.lock.released', handleOrderLockReleased);
        socket.on('order.lock.response', handleLockResponse);
      });
    } catch (error) {
      console.error('❌ Error connecting:', error);
      setIsConnectedToServer(false);
      setIsConnecting(false);
      return false;
    }
  };

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  const handleEventRelay = useCallback(
    (event: EventBase) => {
      console.log('📨 Received event:', event.type);
      incrementClock(event.clock?.lamport);

      switch (event.aggregateType) {
        case 'order':
          handleOrderEvent(event);
          break;
        case 'kds':
          handleKdsEvent(event);
          break;
        case 'bds':
          handleBdsEvent(event);
          break;
      }
    },
    [incrementClock]
  );

  const handleBulkEvents = useCallback(
    (bulk: { events: EventBase[]; fromLamport: number; toLamport: number }) => {
      console.log(`📦 Received ${bulk.events.length} bulk events`);
      setSyncStatus('syncing');
      bulk.events.forEach(handleEventRelay);
      setSyncStatus('idle');
    },
    [handleEventRelay]
  );

  const handleOrderEvent = (event: EventBase) => {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case 'order.created':
        if (payload.order && orderReceivedCallback.current) {
          orderReceivedCallback.current(payload.order);
        }
        break;

      case 'order.updated':
      case 'order.parked':
      case 'order.unparked':
      case 'order.paid':
        if (payload.updates?.status && orderStatusUpdateCallback.current) {
          orderStatusUpdateCallback.current(
            aggregateId,
            payload.updates.status
          );
        } else if (orderReceivedCallback.current) {
          orderReceivedCallback.current({
            id: aggregateId,
            ...(payload.updates || payload),
          } as Order);
        }
        break;
    }
  };

  const handleKdsEvent = (event: EventBase) => {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case 'kds.ticket.created':
        if (payload.ticket) {
          setKdsTickets((prev) => {
            if (!prev.find((t) => t.ticketId === payload.ticket.ticketId)) {
              const updated = [payload.ticket, ...prev];
              saveTickets(updated, bdsTickets);
              if (kdsTicketCallback.current) {
                kdsTicketCallback.current(payload.ticket);
              }
              return updated;
            }
            return prev;
          });
        }
        break;

      case 'kds.ticket.completed':
        setKdsTickets((prev) => {
          const updated = prev.map((t) =>
            t.ticketId === aggregateId
              ? { ...t, status: 'completed' as const, completedAt: event.at }
              : t
          );
          saveTickets(updated, bdsTickets);
          return updated;
        });
        break;
    }
  };

  const handleBdsEvent = (event: EventBase) => {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case 'bds.ticket.created':
        if (payload.ticket) {
          setBdsTickets((prev) => {
            if (!prev.find((t) => t.ticketId === payload.ticket.ticketId)) {
              const updated = [payload.ticket, ...prev];
              saveTickets(kdsTickets, updated);
              if (bdsTicketCallback.current) {
                bdsTicketCallback.current(payload.ticket);
              }
              return updated;
            }
            return prev;
          });
        }
        break;

      case 'bds.ticket.completed':
        setBdsTickets((prev) => {
          const updated = prev.map((t) =>
            t.ticketId === aggregateId
              ? { ...t, status: 'completed' as const, completedAt: event.at }
              : t
          );
          saveTickets(kdsTickets, updated);
          return updated;
        });
        break;
    }
  };

  // ============================================================
  // LOCK HANDLERS
  // ============================================================

  const handleOrderLocked = useCallback(
    (data: {
      orderId: string;
      deviceId: string;
      userName: string;
      acquiredAt: string;
    }) => {
      console.log('🔒 Order locked by another device:', data);
      setOrderLocks((prev) => {
        const newLocks = new Map(prev);
        newLocks.set(data.orderId, {
          orderId: data.orderId,
          deviceId: data.deviceId,
          userName: data.userName,
          acquiredAt: data.acquiredAt,
        });
        return newLocks;
      });
    },
    []
  );

  const handleOrderLockReleased = useCallback(
    (data: { orderId: string; deviceId: string; reason: string }) => {
      console.log('🔓 Order lock released:', data);
      setOrderLocks((prev) => {
        const newLocks = new Map(prev);
        newLocks.delete(data.orderId);
        return newLocks;
      });
    },
    []
  );

  const handleLockResponse = useCallback((response: any) => {
    console.log('🔐 Lock response:', response);
  }, []);

  // ============================================================
  // OFFLINE QUEUE
  // ============================================================

  const processOfflineQueue = async () => {
    try {
      const pendingData = await AsyncStorage.getItem('pendingSync');
      const persistentQueue = pendingData ? JSON.parse(pendingData) : [];
      const allOfflineItems = [...offlineQueueRef.current, ...persistentQueue];

      if (allOfflineItems.length > 0) {
        console.log(`📤 Processing ${allOfflineItems.length} offline items`);

        allOfflineItems.forEach((item) => {
          if (item.eventId) {
            socketRef.current?.emit('events.append', item);
          } else if (item.type === 'order') {
            emitEvent('order.created', item.data.id, { order: item.data });
          } else if (item.type === 'orderUpdate') {
            emitEvent('order.updated', item.data.orderId, {
              updates: { status: item.data.status },
            });
          }
        });

        offlineQueueRef.current = [];
        await AsyncStorage.removeItem('pendingSync');
        console.log('✅ Offline queue processed');
      }
    } catch (error) {
      console.error('❌ Error processing offline queue:', error);
    }
  };

  // ============================================================
  // EVENT EMISSION
  // ============================================================

  const emitEvent = useCallback(
    (eventType: string, aggregateId: string, payload: any): EventBase => {
      const currentClock = incrementClock();
      const event: EventBase = {
        eventId: generateId('evt'),
        tenantId: user?.tenantId || 'demo',
        storeId: user?.storeId || 'store_001',
        aggregateType: 'order',
        aggregateId,
        version: 1,
        type: eventType,
        at: new Date().toISOString(),
        actor: {
          deviceId,
          userId: user?.userId,
          userName: user?.userName,
        },
        clock: {
          lamport: currentClock,
          deviceId,
        },
        payload,
      };

      if (socketRef.current?.connected) {
        socketRef.current.emit('events.append', event);
      } else {
        offlineQueueRef.current.push(event);
        console.log('📝 Queued event for offline sync:', eventType);
      }

      return event;
    },
    [deviceId, user, incrementClock]
  );

  const storeForLaterSync = async (type: string, data: any) => {
    try {
      const pending = (await AsyncStorage.getItem('pendingSync')) || '[]';
      const pendingItems = JSON.parse(pending);
      pendingItems.push({ type, data, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem('pendingSync', JSON.stringify(pendingItems));
    } catch (error) {
      console.error('Error storing for later sync:', error);
    }
  };

  // ============================================================
  // ORDER OPERATIONS
  // ============================================================

  const sendOrder = async (order: Order) => {
    try {
      if (isConnectedToServer && socketRef.current?.connected) {
        emitEvent('order.created', order.id, { order });
        console.log('✅ Order sent:', order.id);
      } else {
        await storeForLaterSync('order', order);
        emitEvent('order.created', order.id, { order });
      }
    } catch (error) {
      console.error('❌ Error sending order:', error);
      await storeForLaterSync('order', order);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      if (isConnectedToServer && socketRef.current?.connected) {
        emitEvent('order.updated', orderId, {
          updates: { status, updatedAt: new Date().toISOString() },
        });
      } else {
        await storeForLaterSync('orderUpdate', { orderId, status });
        emitEvent('order.updated', orderId, {
          updates: { status, updatedAt: new Date().toISOString() },
        });
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      await storeForLaterSync('orderUpdate', { orderId, status });
    }
  };

  const parkOrder = async (order: Order) => {
    const now = new Date().toISOString();
    emitEvent('order.parked', order.id, {
      parkedAt: now,
      parkedBy: user?.userName || deviceId,
    });
  };

  const unparkOrder = async (orderId: string) => {
    // First try to acquire lock
    const lockResult = await acquireLock(orderId);
    if (!lockResult.success) {
      throw new Error(
        `Cannot unpark order - ${lockResult.error}: ${lockResult.holder?.userName}`
      );
    }

    emitEvent('order.unparked', orderId, {
      unparkedAt: new Date().toISOString(),
      unparkedBy: user?.userName || deviceId,
    });
  };

  const payOrder = async (orderId: string, paymentMethod: string) => {
    const now = new Date().toISOString();
    emitEvent('order.paid', orderId, {
      paidAt: now,
      paymentMethod,
    });

    // Release lock after payment
    await releaseLock(orderId);
  };

  // ============================================================
  // LOCK OPERATIONS
  // ============================================================

  const acquireLock = async (orderId: string): Promise<LockResult> => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) {
        // Offline mode - allow local lock if not held by others
        const existingLock = orderLocks.get(orderId);
        if (existingLock && existingLock.deviceId !== deviceId) {
          resolve({
            success: false,
            error: 'ORDER_LOCKED',
            holder: existingLock,
          });
          return;
        }

        const lock: OrderLockInfo = {
          orderId,
          deviceId,
          userName: user?.userName || 'Unknown',
          acquiredAt: new Date().toISOString(),
        };
        setOrderLocks((prev) => new Map(prev).set(orderId, lock));
        resolve({ success: true });
        return;
      }

      const handleResponse = (response: any) => {
        socketRef.current?.off('order.lock.response', handleResponse);

        if (response.orderId !== orderId) return;

        if (response.success) {
          setOrderLocks((prev) => {
            const newLocks = new Map(prev);
            newLocks.set(orderId, {
              orderId,
              deviceId,
              userName: user?.userName || 'Unknown',
              acquiredAt: new Date().toISOString(),
              expiresAt: response.lock?.expiresAt,
            });
            return newLocks;
          });

          // Set up renewal
          const renewalInterval = setInterval(() => {
            socketRef.current?.emit('order.lock.renew', {
              orderId,
              tenantId: user?.tenantId || 'demo',
              storeId: user?.storeId || 'store_001',
            });
          }, 2 * 60 * 1000);

          lockRenewalIntervals.current.set(orderId, renewalInterval);

          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: response.error,
            holder: response.currentHolder,
          });
        }
      };

      socketRef.current.on('order.lock.response', handleResponse);
      socketRef.current.emit('order.lock.request', {
        orderId,
        tenantId: user?.tenantId || 'demo',
        storeId: user?.storeId || 'store_001',
      });

      setTimeout(() => {
        socketRef.current?.off('order.lock.response', handleResponse);
        resolve({ success: false, error: 'LOCK_TIMEOUT' });
      }, 5000);
    });
  };

  const releaseLock = async (orderId: string): Promise<void> => {
    const interval = lockRenewalIntervals.current.get(orderId);
    if (interval) {
      clearInterval(interval);
      lockRenewalIntervals.current.delete(orderId);
    }

    setOrderLocks((prev) => {
      const newLocks = new Map(prev);
      newLocks.delete(orderId);
      return newLocks;
    });

    if (socketRef.current?.connected) {
      socketRef.current.emit('order.lock.release', {
        orderId,
        tenantId: user?.tenantId || 'demo',
        storeId: user?.storeId || 'store_001',
      });
    }
  };

  const getLockStatus = (orderId: string): OrderLockInfo | null => {
    return orderLocks.get(orderId) || null;
  };

  // ============================================================
  // TICKET OPERATIONS
  // ============================================================

  const completeKdsTicket = async (ticketId: string): Promise<void> => {
    const now = new Date().toISOString();

    setKdsTickets((prev) => {
      const updated = prev.map((t) =>
        t.ticketId === ticketId
          ? { ...t, status: 'completed' as const, completedAt: now }
          : t
      );
      saveTickets(updated, bdsTickets);
      return updated;
    });

    const event: EventBase = {
      eventId: generateId('evt'),
      tenantId: user?.tenantId || 'demo',
      storeId: user?.storeId || 'store_001',
      aggregateType: 'kds',
      aggregateId: ticketId,
      version: 1,
      type: 'kds.ticket.completed',
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      clock: { lamport: incrementClock(), deviceId },
      payload: { completedAt: now },
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('events.append', event);
    } else {
      offlineQueueRef.current.push(event);
    }
  };

  const completeBdsTicket = async (ticketId: string): Promise<void> => {
    const now = new Date().toISOString();

    setBdsTickets((prev) => {
      const updated = prev.map((t) =>
        t.ticketId === ticketId
          ? { ...t, status: 'completed' as const, completedAt: now }
          : t
      );
      saveTickets(kdsTickets, updated);
      return updated;
    });

    const event: EventBase = {
      eventId: generateId('evt'),
      tenantId: user?.tenantId || 'demo',
      storeId: user?.storeId || 'store_001',
      aggregateType: 'bds',
      aggregateId: ticketId,
      version: 1,
      type: 'bds.ticket.completed',
      at: now,
      actor: { deviceId, userId: user?.userId, userName: user?.userName },
      clock: { lamport: incrementClock(), deviceId },
      payload: { completedAt: now },
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('events.append', event);
    } else {
      offlineQueueRef.current.push(event);
    }
  };

  // ============================================================
  // SYNC
  // ============================================================

  const syncData = async () => {
    if (
      !isConnectedToServer ||
      !socketRef.current ||
      syncStatus === 'syncing'
    ) {
      return;
    }

    setSyncStatus('syncing');

    try {
      socketRef.current.emit('cursor.request', { fromLamport: 0 });
      setTimeout(() => setSyncStatus('idle'), 10000);
    } catch (error) {
      console.error('❌ Sync error:', error);
      setSyncStatus('error');
    }
  };

  // ============================================================
  // CALLBACKS
  // ============================================================

  const onOrderReceived = (callback: (order: Order) => void) => {
    orderReceivedCallback.current = callback;
  };

  const onOrderStatusUpdated = (
    callback: (orderId: string, status: string) => void
  ) => {
    orderStatusUpdateCallback.current = callback;
  };

  const onSyncDataReceived = (callback: (data: any) => void) => {
    syncDataCallback.current = callback;
  };

  const onKdsTicketReceived = (callback: (ticket: KDSTicket) => void) => {
    kdsTicketCallback.current = callback;
  };

  const onBdsTicketReceived = (callback: (ticket: BDSTicket) => void) => {
    bdsTicketCallback.current = callback;
  };

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isConnectedToServer,
        serverIP,
        syncStatus,
        lamportClock,
        deviceId,
        connectToServer,
        discoverHubs,
        syncData,
        sendOrder,
        updateOrderStatus,
        parkOrder,
        unparkOrder,
        payOrder,
        acquireLock,
        releaseLock,
        getLockStatus,
        orderLocks,
        kdsTickets,
        bdsTickets,
        completeKdsTicket,
        completeBdsTicket,
        onOrderReceived,
        onOrderStatusUpdated,
        onSyncDataReceived,
        onKdsTicketReceived,
        onBdsTicketReceived,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

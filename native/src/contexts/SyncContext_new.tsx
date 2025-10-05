import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { Order } from '../types';

interface SyncContextType {
  isOnline: boolean;
  isConnectedToServer: boolean;
  serverIP: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  connectToServer: (ip?: string) => Promise<boolean>;
  syncData: () => Promise<void>;
  sendOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  // Real-time callbacks for order updates
  onOrderReceived: (callback: (order: Order) => void) => void;
  onOrderStatusUpdated: (
    callback: (orderId: string, status: string) => void
  ) => void;
  onSyncDataReceived: (callback: (data: any) => void) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(false);
  const [isConnectedToServer, setIsConnectedToServer] = useState(false);
  const [serverIP, setServerIP] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>(
    'idle'
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const offlineQueueRef = useRef<any[]>([]);

  // Callback refs for real-time updates
  const orderReceivedCallback = useRef<((order: Order) => void) | null>(null);
  const orderStatusUpdateCallback = useRef<
    ((orderId: string, status: string) => void) | null
  >(null);
  const syncDataCallback = useRef<((data: any) => void) | null>(null);

  useEffect(() => {
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);

      if (state.isConnected && serverIP) {
        connectToServer(serverIP);
      } else {
        setIsConnectedToServer(false);
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      }
    });

    // Try to load saved server IP or auto-discover
    loadServerIP();

    return () => {
      unsubscribe();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        console.log('🔌 Closing Socket.IO connection on unmount');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const loadServerIP = async () => {
    try {
      const savedIP = await AsyncStorage.getItem('serverIP');
      if (savedIP) {
        setServerIP(savedIP);
        // Auto-connect if we have a saved IP and we're online
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          connectToServer(savedIP);
        }
      } else {
        // Try to auto-discover server IP (localhost for development)
        const discoveredIP = 'localhost';
        setServerIP(discoveredIP);
        await AsyncStorage.setItem('serverIP', discoveredIP);
        console.log('✅ Using localhost for development');

        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          connectToServer(discoveredIP);
        }
      }
    } catch (error) {
      console.error('Error loading server IP:', error);
    }
  };

  const connectToServer = async (ip?: string): Promise<boolean> => {
    const targetIP = ip || serverIP || 'localhost';
    if (!isOnline || isConnecting || isConnectedToServer) {
      console.log('Cannot connect:', {
        targetIP,
        isOnline,
        isConnecting,
        isConnectedToServer,
      });
      return false;
    }

    try {
      setIsConnecting(true);

      // Close existing connection
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const socketUrl = `http://${targetIP}:4001`;
      console.log('🔌 Connecting to hub server:', socketUrl);

      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          setIsConnecting(false);
          resolve(false);
        }, 10000); // 10 second timeout

        socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Connected to hub server:', targetIP);
          socketRef.current = socket;
          setIsConnectedToServer(true);
          setIsConnecting(false);
          setServerIP(targetIP);

          // Save successful IP
          AsyncStorage.setItem('serverIP', targetIP);

          // Send hello message to join tenant/store room
          socket.emit('hello', {
            deviceId: `mobile-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`,
            tenantId: 'demo-tenant',
            storeId: 'demo-store',
            auth: {
              sessionId: 'demo-session',
              userId: 'demo-user',
            },
          });

          // Process offline queue when reconnected
          if (offlineQueueRef.current.length > 0) {
            console.log(
              `📤 Processing ${offlineQueueRef.current.length} offline events`
            );
            offlineQueueRef.current.forEach((event) => {
              socket.emit('events.append', event);
            });
            offlineQueueRef.current = [];
          }

          resolve(true);
        });

        socket.on('connect_error', (error: any) => {
          clearTimeout(timeout);
          console.error('❌ Connection error:', error);
          setIsConnecting(false);
          resolve(false);
        });

        socket.on('disconnect', () => {
          console.log('❌ Disconnected from hub server');
          setIsConnectedToServer(false);
        });

        // Listen for real-time order events
        socket.on('events.relay', (event: any) => {
          console.log('📨 Received real-time event:', event);

          if (event.aggregateType === 'order') {
            handleOrderEvent(event);
          }
        });

        socket.on('hello.ack', (ack: any) => {
          console.log('✅ Hello acknowledged by hub server:', ack);
        });
      });
    } catch (error) {
      console.error('❌ Error connecting to server:', error);
      setIsConnectedToServer(false);
      setIsConnecting(false);
      return false;
    }
  };

  // Handle incoming order events from hub server
  const handleOrderEvent = (event: any) => {
    try {
      switch (event.type) {
        case 'order.created':
          // Handle new order from other devices
          console.log('📱 New order received:', event.payload.order);
          if (orderReceivedCallback.current && event.payload.order) {
            orderReceivedCallback.current(event.payload.order);
          }
          break;

        case 'order.updated':
          // Handle order status updates
          console.log(
            '🔄 Order updated:',
            event.aggregateId,
            event.payload.updates
          );
          if (
            event.payload.updates?.status &&
            orderStatusUpdateCallback.current
          ) {
            orderStatusUpdateCallback.current(
              event.aggregateId,
              event.payload.updates.status
            );
          } else if (orderReceivedCallback.current) {
            // Treat as full order update - we'd need to reconstruct the order
            const updatedOrder = {
              id: event.aggregateId,
              ...event.payload.updates,
            };
            orderReceivedCallback.current(updatedOrder);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling order event:', error);
    }
  };

  // Emit order event to hub server
  const emitOrderEvent = (
    eventType: string,
    aggregateId: string,
    payload: any
  ) => {
    const event = {
      eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: 'demo-tenant',
      storeId: 'demo-store',
      aggregateType: 'order',
      aggregateId,
      version: 1,
      type: eventType,
      at: new Date().toISOString(),
      actor: {
        deviceId: `mobile-${Date.now()}`,
        userId: 'demo-user',
      },
      clock: {
        lamport: Date.now(),
        deviceId: `mobile-${Date.now()}`,
      },
      payload,
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('events.append', event);
    } else {
      // Queue for when reconnected
      offlineQueueRef.current.push(event);
      console.log('📝 Queued event for offline sync:', eventType);
    }
  };

  const syncData = async () => {
    if (
      !isConnectedToServer ||
      !socketRef.current ||
      syncStatus === 'syncing'
    ) {
      console.log('Cannot sync:', {
        isConnectedToServer,
        hasSocket: !!socketRef.current,
        syncStatus,
      });
      return;
    }

    setSyncStatus('syncing');
    console.log('🔄 Requesting initial sync from hub server...');

    try {
      // Request events from the hub server
      socketRef.current.emit('cursor.request', { fromLamport: 0 });

      // Set a timeout to reset sync status if no response
      setTimeout(() => {
        setSyncStatus('idle');
      }, 10000);
    } catch (error) {
      console.error('❌ Sync error:', error);
      setSyncStatus('error');
    }
  };

  const sendOrder = async (order: Order) => {
    if (!isConnectedToServer || !socketRef.current) {
      // Store for later sync
      console.log(
        '⚠️ No server connection, storing order for later sync:',
        order.id
      );
      await storeForLaterSync('order', order);
      return;
    }

    try {
      console.log('📤 Sending order to hub server:', order.id);
      emitOrderEvent('order.created', order.id, { order });
      console.log('✅ Order sent successfully:', order.id);
    } catch (error) {
      console.error('❌ Error sending order:', error);
      await storeForLaterSync('order', order);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!isConnectedToServer || !socketRef.current) {
      // Store for later sync
      console.log(
        '⚠️ No server connection, storing order status update for later sync:',
        orderId,
        status
      );
      await storeForLaterSync('orderUpdate', { orderId, status });
      return;
    }

    try {
      console.log(
        '📤 Sending order status update to hub server:',
        orderId,
        status
      );
      emitOrderEvent('order.updated', orderId, {
        updates: { status, updatedAt: new Date().toISOString() },
      });
      console.log('✅ Order status update sent successfully:', orderId, status);
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      await storeForLaterSync('orderUpdate', { orderId, status });
    }
  };

  const storeForLaterSync = async (type: string, data: any) => {
    try {
      const pending = (await AsyncStorage.getItem('pendingSync')) || '[]';
      const pendingItems = JSON.parse(pending);
      pendingItems.push({
        type,
        data,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem('pendingSync', JSON.stringify(pendingItems));
      console.log('📝 Stored for later sync:', type, data);
    } catch (error) {
      console.error('Error storing for later sync:', error);
    }
  };

  // Callback registration functions
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

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isConnectedToServer,
        serverIP,
        syncStatus,
        connectToServer,
        syncData,
        sendOrder,
        updateOrderStatus,
        onOrderReceived,
        onOrderStatusUpdated,
        onSyncDataReceived,
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

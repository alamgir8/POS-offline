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
import { useAuth } from './AuthContext';

// Enhanced EventBase interface matching the doc
interface EventBase {
  eventId: string;
  tenantId: string;
  storeId: string;
  aggregateType: 'order' | 'kds' | 'bds' | 'inventory' | 'payment';
  aggregateId: string;
  version: number;
  type: string;
  at: string;
  actor: { deviceId: string; userId?: string };
  clock: { lamport: number; deviceId: string };
  payload: Record<string, any>;
}

// Hub discovery interface
interface HubInfo {
  host: string;
  port: number;
  tenantId: string;
  storeId: string;
  version: string;
}

interface SyncContextType {
  isOnline: boolean;
  isConnectedToServer: boolean;
  serverIP: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  lamportClock: number;
  connectToServer: (ip?: string) => Promise<boolean>;
  discoverHubs: () => Promise<HubInfo[]>;
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
  const { user, session } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [isConnectedToServer, setIsConnectedToServer] = useState(false);
  const [serverIP, setServerIP] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>(
    'idle'
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [lamportClock, setLamportClock] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const offlineQueueRef = useRef<EventBase[]>([]);

  // Android-specific refs for preventing infinite loops
  const retryCountRef = useRef<number>(0);
  const maxRetries = 10;
  const lastConnectionAttemptRef = useRef<number>(0);
  const currentNetworkTypeRef = useRef<string | null>(null);

  // Callback refs for real-time updates
  const orderReceivedCallback = useRef<((order: Order) => void) | null>(null);
  const orderStatusUpdateCallback = useRef<
    ((orderId: string, status: string) => void) | null
  >(null);
  const syncDataCallback = useRef<((data: any) => void) | null>(null);

  // Lamport clock management
  const incrementClock = (receivedClock?: number): number => {
    const newClock = Math.max(lamportClock, receivedClock || 0) + 1;
    setLamportClock(newClock);
    return newClock;
  };

  // Hub discovery via mDNS (simplified for development)
  const discoverHubs = async (): Promise<HubInfo[]> => {
    try {
      // TODO: Implement proper mDNS discovery
      // For now, return the development hub
      const defaultHub: HubInfo = {
        host: '192.168.0.143',
        port: 4001,
        tenantId: user?.tenantId || 'demo',
        storeId: user?.storeId || 'store_001',
        version: '1.0.0',
      };

      console.log('🔍 Discovered hubs:', [defaultHub]);
      return [defaultHub];
    } catch (error) {
      console.error('❌ Error discovering hubs:', error);
      return [];
    }
  };

  useEffect(() => {
    // Initialize network type tracking
    NetInfo.fetch().then((state) => {
      currentNetworkTypeRef.current = state.type;
      console.log('🌐 Initial network type:', state.type);
    });

    // Try to load saved server IP or auto-discover first
    loadServerIP();
    // Also load any pending offline data
    loadOfflineData();
  }, [user]); // Re-run when user changes

  useEffect(() => {
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      console.log('🌐 Network state changed:', {
        isConnected: connected,
        type: state.type,
        details: state.details,
      });
      console.log('🌐 Setting isOnline to:', connected);
      setIsOnline(connected);

      // Track network type changes for Android
      if (state.type !== currentNetworkTypeRef.current) {
        console.log(
          `🌐 Network type changed from ${currentNetworkTypeRef.current} to ${state.type}`
        );
        currentNetworkTypeRef.current = state.type;
        // Reset retry count when network changes
        retryCountRef.current = 0;
      }

      // For LAN sync, we need to differentiate between no network at all vs no internet
      // WiFi/Ethernet connection is enough for LAN sync even without internet
      const hasLocalNetwork =
        state.type === 'wifi' ||
        state.type === 'ethernet' ||
        (state.type === 'cellular' && connected);

      if (hasLocalNetwork && serverIP && user && !isConnectedToServer) {
        console.log(
          '🌐 Local network available, attempting LAN connection to server:',
          serverIP,
          'for user:',
          user.email
        );
        connectToServer(serverIP);
      } else if (!hasLocalNetwork) {
        console.log('🌐 No local network, disconnecting from server...', {
          networkType: state.type,
          connected,
          serverIP,
          hasUser: !!user,
        });
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
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        console.log('🔌 Closing Socket.IO connection on unmount');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // Android-specific cleanup
      retryCountRef.current = 0;
      lastConnectionAttemptRef.current = 0;
      setIsConnecting(false);
    };
  }, [serverIP, user]); // Re-run when serverIP or user changes

  useEffect(() => {
    // Auto-connect when serverIP is available AND user is authenticated
    // Don't require internet connection for LAN sync
    if (serverIP && !isConnectedToServer && user && !isConnecting) {
      console.log(
        '🔄 Auto-connecting due to serverIP/user state change (LAN mode)'
      );
      connectToServer(serverIP);
    } else if (!user && isConnectedToServer) {
      // Disconnect if user logged out
      console.log('🚪 User logged out, disconnecting from server');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnectedToServer(false);
    }
  }, [serverIP, isConnectedToServer, user, isConnecting]); // Removed isOnline dependency

  const loadServerIP = async () => {
    try {
      // Clear any old saved IP that might have wrong port
      await AsyncStorage.removeItem('serverIP');

      // Use computer's IP for development (localhost won't work on physical device)
      const discoveredIP = '192.168.0.143'; // This is the IP shown in the Metro bundler logs
      console.log('📱 Setting server IP to computer IP:', discoveredIP);
      setServerIP(discoveredIP);
      await AsyncStorage.setItem('serverIP', discoveredIP);

      const netInfo = await NetInfo.fetch();
      console.log('📱 Network state at startup:', {
        isConnected: netInfo.isConnected,
        type: netInfo.type,
        details: netInfo.details,
      });

      // Always try to connect if user is authenticated, even in offline mode
      // LAN connections should work without internet
      if (user) {
        console.log('📱 Auto-connecting to LAN server (works offline)...');
        connectToServer(discoveredIP);
      } else {
        console.log('📱 Skipping auto-connect: no authenticated user');
      }
    } catch (error) {
      console.error('Error loading server IP:', error);
    }
  };

  const loadOfflineData = async () => {
    try {
      const pendingData = await AsyncStorage.getItem('pendingSync');
      const pendingItems = pendingData ? JSON.parse(pendingData) : [];

      if (pendingItems.length > 0) {
        console.log(`📦 Found ${pendingItems.length} pending offline items`);
        // Try to process them immediately if we're already connected
        if (isConnectedToServer && socketRef.current?.connected) {
          await processOfflineQueue();
        }
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  };

  const connectToServer = async (ip?: string): Promise<boolean> => {
    const targetIP = ip || serverIP || 'localhost';

    // Android-specific: Smart debounce to prevent rapid successive calls
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionAttemptRef.current;

    // Only debounce if we're already connecting or just attempted very recently (< 1 second)
    if (
      isConnecting ||
      (timeSinceLastAttempt < 1000 && timeSinceLastAttempt > 0)
    ) {
      console.log(
        '� Connection attempt too soon or already connecting, debouncing...'
      );
      return false;
    }
    lastConnectionAttemptRef.current = now;

    console.log('�🔌 [CONNECT] Connection attempt details:', {
      targetIP,
      providedIP: ip,
      serverIP,
      isOnline,
      isConnecting,
      isConnectedToServer,
      hasUser: !!user,
      userTenantId: user?.tenantId,
      retryCount: retryCountRef.current,
    });

    if (!isOnline || isConnecting || isConnectedToServer || !user) {
      console.log('Cannot connect:', {
        targetIP,
        isOnline,
        isConnecting,
        isConnectedToServer,
        hasUser: !!user,
        reason: !user ? 'No authenticated user' : 'Other conditions not met',
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
      console.log('🔌 [NEW SYNCCONTEXT] Connecting to hub server:', socketUrl);
      console.log('🔌 [NEW SYNCCONTEXT] Target IP:', targetIP);
      console.log('🔌 [NEW SYNCCONTEXT] Full URL:', socketUrl);

      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: false, // Disable automatic reconnection to prevent loops
        timeout: 15000, // Increased timeout for Android
        forceNew: true, // Force new connection each time
        upgrade: true,
        rememberUpgrade: false,
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Connection timeout reached');
          socket.disconnect();
          setIsConnecting(false);
          resolve(false);
        }, 15000); // Longer timeout for Android

        socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Connected to hub server:', targetIP);
          socketRef.current = socket;
          setIsConnectedToServer(true);
          setIsConnecting(false);
          setServerIP(targetIP);

          // Reset retry count on successful connection
          retryCountRef.current = 0;

          // Clear any pending reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          // Save successful IP
          AsyncStorage.setItem('serverIP', targetIP);

          // Send hello message to join tenant/store room
          socket.emit('hello', {
            deviceId:
              session?.deviceId ||
              `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tenantId: user?.tenantId || 'demo',
            storeId: user?.storeId || 'store_001',
            auth: {
              sessionId: session?.sessionId || 'demo-session',
              userId: user?.userId || 'demo-user',
            },
          });

          // Process offline queue when reconnected
          processOfflineQueue();

          resolve(true);
        });

        socket.on('connect_error', (error: any) => {
          clearTimeout(timeout);
          console.error('❌ Connection error:', error);
          setIsConnecting(false);

          // Increment retry count
          retryCountRef.current += 1;
          console.log(
            `🔄 Connection attempt ${retryCountRef.current}/${maxRetries} failed`
          );

          // Prevent multiple rapid retries (Android-specific fix)
          if (reconnectTimeoutRef.current) {
            console.log('🔄 Retry already scheduled, skipping duplicate retry');
            resolve(false);
            return;
          }

          // Check if we should retry
          if (retryCountRef.current < maxRetries) {
            console.log('🔄 Will retry connection automatically...');

            // Set up automatic retry with exponential backoff
            const backoffDelay = Math.min(
              1000 * Math.pow(2, retryCountRef.current - 1),
              30000
            );
            console.log(`⏰ Retrying in ${backoffDelay}ms...`);

            reconnectTimeoutRef.current = setTimeout(async () => {
              reconnectTimeoutRef.current = null;

              // Check if network type changed (Android network changes are more frequent)
              const netInfo = await NetInfo.fetch();
              if (netInfo.type !== currentNetworkTypeRef.current) {
                console.log(
                  `🌐 Network changed from ${currentNetworkTypeRef.current} to ${netInfo.type}, discovering new server...`
                );
                currentNetworkTypeRef.current = netInfo.type;
                retryCountRef.current = 0; // Reset retries for new network
                console.log('🔍 Will rediscover server IP for new network...');
                resolve(false);
                return;
              }

              // Double-check we're not already connected (Android race condition fix)
              if (isConnectedToServer || isConnecting) {
                console.log(
                  '🔄 Already connected or connecting, skipping retry'
                );
                resolve(false);
                return;
              }

              if (targetIP && user) {
                console.log('🔄 Retrying connection after error...');
                const success = await connectToServer(targetIP);
                resolve(success);
              } else {
                resolve(false);
              }
            }, backoffDelay);
          } else {
            console.log(
              '❌ Maximum retry attempts reached, stopping automatic retries'
            );
            console.log(
              '💡 Try switching networks or manually refresh the connection'
            );
            retryCountRef.current = 0; // Reset for future attempts
            resolve(false);
          }
        });

        socket.on('disconnect', (reason: string) => {
          console.log('❌ Disconnected from hub server, reason:', reason);
          setIsConnectedToServer(false);

          // Auto-reconnect for unexpected disconnections
          if (reason !== 'io client disconnect' && serverIP && user) {
            console.log('🔄 Setting up auto-reconnect...');
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null;
                if (!isConnectedToServer) {
                  console.log('🔄 Auto-reconnecting...');
                  connectToServer(serverIP);
                }
              }, 3000); // Reconnect after 3 seconds
            }
          }
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

  // Process offline queue from both memory and persistent storage
  const processOfflineQueue = async () => {
    try {
      // Load persistent offline data
      const pendingData = await AsyncStorage.getItem('pendingSync');
      const persistentQueue = pendingData ? JSON.parse(pendingData) : [];

      // Combine memory queue and persistent queue
      const allOfflineItems = [...offlineQueueRef.current, ...persistentQueue];

      if (allOfflineItems.length > 0) {
        console.log(
          `📤 Processing ${allOfflineItems.length} offline items (${offlineQueueRef.current.length} from memory, ${persistentQueue.length} from storage)`
        );

        allOfflineItems.forEach((item) => {
          if (item.type === 'order') {
            emitOrderEvent('order.created', item.data.id, { order: item.data });
          } else if (item.type === 'orderUpdate') {
            emitOrderEvent('order.updated', item.data.orderId, {
              updates: {
                status: item.data.status,
                updatedAt: new Date().toISOString(),
              },
            });
          } else if (item.eventId) {
            // Direct event from memory queue
            socketRef.current?.emit('events.append', item);
          }
        });

        // Clear both queues after successful processing
        offlineQueueRef.current = [];
        await AsyncStorage.removeItem('pendingSync');
        console.log('✅ Offline queue processed and cleared');
      }
    } catch (error) {
      console.error('❌ Error processing offline queue:', error);
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

  // Emit order event to hub server with proper event structure
  const emitOrderEvent = (
    eventType: string,
    aggregateId: string,
    payload: any
  ): EventBase => {
    const currentClock = incrementClock();
    const event: EventBase = {
      eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: user?.tenantId || 'demo',
      storeId: user?.storeId || 'store_001',
      aggregateType: 'order' as const,
      aggregateId,
      version: 1, // TODO: Implement proper versioning
      type: eventType,
      at: new Date().toISOString(),
      actor: {
        deviceId: session?.deviceId || `mobile-${Date.now()}`,
        userId: user?.userId || 'demo-user',
      },
      clock: {
        lamport: currentClock,
        deviceId: session?.deviceId || `mobile-${Date.now()}`,
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

    return event;
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
    try {
      if (isConnectedToServer && socketRef.current?.connected) {
        console.log('📤 Sending order to hub server (online):', order.id);
        emitOrderEvent('order.created', order.id, { order });
        console.log('✅ Order sent successfully:', order.id);
      } else {
        console.log('⚠️ Offline mode: storing order for later sync:', order.id);
        await storeForLaterSync('order', order);
        // Also add to event queue for immediate retry when connection restored
        const queuedEvent = emitOrderEvent('order.created', order.id, order);
        console.log(
          '📝 Queued order event for offline sync:',
          queuedEvent.eventId
        );
      }
    } catch (error) {
      console.error('❌ Error sending order:', error);
      await storeForLaterSync('order', order);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      if (isConnectedToServer && socketRef.current?.connected) {
        console.log(
          '📤 Sending order status update (online):',
          orderId,
          status
        );
        emitOrderEvent('order.updated', orderId, {
          updates: { status, updatedAt: new Date().toISOString() },
        });
        console.log(
          '✅ Order status update sent successfully:',
          orderId,
          status
        );
      } else {
        console.log(
          '⚠️ Offline mode: storing order status update for later sync:',
          orderId,
          status
        );
        await storeForLaterSync('orderUpdate', { orderId, status });
        // Also add to event queue for immediate retry when connection restored
        const queuedEvent = emitOrderEvent('order.updated', orderId, {
          orderId,
          status,
          updatedAt: new Date().toISOString(),
        });
        console.log(
          '📝 Queued order update event for offline sync:',
          queuedEvent.eventId
        );
      }
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
        lamportClock,
        discoverHubs,
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

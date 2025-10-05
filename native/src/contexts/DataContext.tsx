import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem, Order, OrderItem } from '../types';
import { useSync } from './SyncContext';

interface DataContextType {
  products: MenuItem[];
  orders: Order[];
  kdsOrders: Order[];
  bdsOrders: Order[];
  isLoading: boolean;
  loadProducts: () => Promise<void>;
  loadOrders: () => Promise<void>;
  requestSync: () => Promise<void>;
  addOrder: (
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Order>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Demo products data
const demoProducts: MenuItem[] = [
  // Food items
  { id: '1', name: 'Burger', price: 12.99, category: 'food', available: true },
  { id: '2', name: 'Pizza', price: 18.99, category: 'food', available: true },
  { id: '3', name: 'Pasta', price: 14.99, category: 'food', available: true },
  { id: '4', name: 'Salad', price: 9.99, category: 'food', available: true },
  { id: '5', name: 'Sandwich', price: 8.99, category: 'food', available: true },
  { id: '6', name: 'Steak', price: 24.99, category: 'food', available: true },

  // Other items (drinks, etc.)
  { id: '7', name: 'Coffee', price: 3.99, category: 'other', available: true },
  { id: '8', name: 'Tea', price: 2.99, category: 'other', available: true },
  { id: '9', name: 'Soda', price: 2.49, category: 'other', available: true },
  { id: '10', name: 'Beer', price: 5.99, category: 'other', available: true },
  { id: '11', name: 'Wine', price: 8.99, category: 'other', available: true },
  { id: '12', name: 'Juice', price: 3.49, category: 'other', available: true },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localOrderIds, setLocalOrderIds] = useState<Set<string>>(new Set());
  const [processedOrderIds, setProcessedOrderIds] = useState<Set<string>>(
    new Set()
  ); // Track all processed orders

  // Get sync context to register real-time callbacks
  const {
    onOrderReceived,
    onOrderStatusUpdated,
    onSyncDataReceived,
    sendOrder,
    updateOrderStatus,
    syncData,
  } = useSync();

  useEffect(() => {
    loadInitialData();

    // Register callbacks for real-time order updates only once
    console.log('🔗 Registering real-time sync callbacks...');
    onOrderReceived(handleOrderReceived);
    onOrderStatusUpdated(handleOrderStatusUpdated);
    onSyncDataReceived(handleSyncDataReceived);
    console.log('✅ Real-time sync callbacks registered');
  }, []); // Empty dependency array since callbacks are stable with useCallback

  // Handle real-time order updates from other devices
  const handleOrderReceived = useCallback(
    (order: Order) => {
      console.log('📨 Real-time order received:', order.id);

      // Check if this order has already been processed to prevent duplicates
      if (processedOrderIds.has(order.id)) {
        console.log('⚠️ Order already processed, ignoring:', order.id);
        return;
      }

      // Check if this is an order created locally (to avoid duplicates when server broadcasts back)
      if (localOrderIds.has(order.id)) {
        console.log('⚠️ Ignoring own order received from server:', order.id);
        return;
      }

      // Mark this order as processed
      setProcessedOrderIds((prev) => new Set(prev).add(order.id));

      setOrders((prevOrders) => {
        // Check if order already exists to avoid duplicates
        const existingIndex = prevOrders.findIndex((o) => o.id === order.id);
        if (existingIndex >= 0) {
          // Update existing order with newer data
          const updatedOrders = [...prevOrders];
          updatedOrders[existingIndex] = {
            ...updatedOrders[existingIndex],
            ...order,
            updatedAt: new Date().toISOString(), // Ensure we have the latest timestamp
          };
          // Save the updated orders
          saveOrdersToStorage(updatedOrders);
          console.log('🔄 Updated existing order:', order.id);
          return updatedOrders;
        } else {
          // Add new order
          const newOrders = [order, ...prevOrders]; // Add to beginning for latest first
          // Save the new orders
          saveOrdersToStorage(newOrders);
          console.log('✅ Added new order:', order.id);
          return newOrders;
        }
      });
    },
    [localOrderIds, processedOrderIds]
  );

  // Handle real-time order status updates
  const handleOrderStatusUpdated = useCallback(
    (orderId: string, status: string) => {
      console.log('📋 Real-time order status update:', orderId, '→', status);
      setOrders((prevOrders) => {
        const orderIndex = prevOrders.findIndex(
          (order) => order.id === orderId
        );

        if (orderIndex === -1) {
          console.log('⚠️ Order not found for status update:', orderId);
          return prevOrders;
        }

        const updatedOrders = [...prevOrders];
        updatedOrders[orderIndex] = {
          ...updatedOrders[orderIndex],
          status: status as Order['status'],
          updatedAt: new Date().toISOString(),
        };

        saveOrdersToStorage(updatedOrders);
        console.log('✅ Order status updated:', orderId, '→', status);
        return updatedOrders;
      });
    },
    []
  );

  // Handle initial sync data
  const handleSyncDataReceived = useCallback((data: any) => {
    console.log('Sync data received:', data);
    if (data.orders) {
      // Merge server orders with local orders, giving priority to more recent updates
      setOrders((prevOrders) => {
        const mergedOrders = [...data.orders];

        // Add any local orders that aren't in the server data
        prevOrders.forEach((localOrder) => {
          const existsInServerData = mergedOrders.find(
            (serverOrder) => serverOrder.id === localOrder.id
          );
          if (!existsInServerData) {
            mergedOrders.push(localOrder);
          } else {
            // If order exists in both, use the one with the latest updatedAt timestamp
            const serverOrder = mergedOrders.find(
              (serverOrder) => serverOrder.id === localOrder.id
            );
            if (
              serverOrder &&
              new Date(localOrder.updatedAt) > new Date(serverOrder.updatedAt)
            ) {
              const index = mergedOrders.findIndex(
                (order) => order.id === localOrder.id
              );
              mergedOrders[index] = localOrder;
            }
          }
        });

        saveOrdersToStorage(mergedOrders);
        return mergedOrders;
      });
    }
    if (data.products) {
      setProducts(data.products);
      AsyncStorage.setItem('products', JSON.stringify(data.products));
    }
  }, []);

  const saveOrdersToStorage = async (ordersToSave: Order[]) => {
    try {
      await AsyncStorage.setItem('orders', JSON.stringify(ordersToSave));
    } catch (error) {
      console.error('Error saving orders to storage:', error);
    }
  };

  const loadInitialData = async () => {
    console.log('🚀 Loading initial data...');
    await Promise.all([loadProducts(), loadOrders()]);
    console.log('✅ Initial data loading complete');
    setIsLoading(false);
  };

  const loadProducts = async () => {
    try {
      console.log('🛒 Loading products...');
      // Try to load from storage first
      const storedProducts = await AsyncStorage.getItem('products');
      console.log('📦 Raw stored products:', storedProducts);

      if (storedProducts) {
        const parsedProducts = JSON.parse(storedProducts);
        console.log(
          '📦 Loaded products from storage:',
          parsedProducts.length,
          'items'
        );

        // Check if we actually have products, not just an empty array
        if (parsedProducts.length > 0) {
          setProducts(parsedProducts);
        } else {
          console.log('📦 Storage has empty array, using demo data instead');
          setProducts(demoProducts);
          await AsyncStorage.setItem('products', JSON.stringify(demoProducts));
          console.log('💾 Demo products saved to storage');
        }
      } else {
        // Use demo data and save to storage
        console.log(
          '📦 No stored products, using demo data:',
          demoProducts.length,
          'items'
        );
        setProducts(demoProducts);
        await AsyncStorage.setItem('products', JSON.stringify(demoProducts));
        console.log('💾 Demo products saved to storage');
      }
    } catch (error) {
      console.error('❌ Error loading products:', error);
      console.log(
        '📦 Fallback to demo products:',
        demoProducts.length,
        'items'
      );
      setProducts(demoProducts); // Fallback to demo data
    }
  };

  const loadOrders = async () => {
    try {
      const storedOrders = await AsyncStorage.getItem('orders');
      if (storedOrders) {
        const parsedOrders = JSON.parse(storedOrders);
        setOrders(parsedOrders);

        // Also load the local order IDs and processed IDs to prevent duplicates
        const localIds = parsedOrders
          .filter((order: Order) => order.createdAt) // Only locally created orders
          .map((order: Order) => order.id);
        setLocalOrderIds(new Set(localIds));

        // Mark all loaded orders as processed
        const allOrderIds = parsedOrders.map((order: Order) => order.id);
        setProcessedOrderIds(new Set(allOrderIds));
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };
  const addOrder = async (
    orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Order> => {
    const newOrder: Order = {
      ...orderData,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Mark this order as locally created and processed
      setLocalOrderIds((prev) => new Set(prev).add(newOrder.id));
      setProcessedOrderIds((prev) => new Set(prev).add(newOrder.id));

      const updatedOrders = [...orders, newOrder];
      setOrders(updatedOrders);
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));

      // Send order to other devices via WebSocket
      if (sendOrder) {
        sendOrder(newOrder);
        console.log('Order sent to other devices:', newOrder.id);
      }

      return newOrder;
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      const updatedOrders = orders.map((order) =>
        order.id === orderId
          ? { ...order, ...updates, updatedAt: new Date().toISOString() }
          : order
      );
      setOrders(updatedOrders);
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));

      // Send status update to other devices via WebSocket if status changed
      if (updates.status && updateOrderStatus) {
        updateOrderStatus(orderId, updates.status);
        console.log(
          'Order status update sent to other devices:',
          orderId,
          updates.status
        );
      }
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  };

  // Request sync from server instead of loading from local storage
  const requestSync = async () => {
    if (syncData) {
      await syncData();
    }
  };

  // Filter orders for KDS (kitchen) and BDS (bar) - simplified approach
  const kdsOrders: Order[] = orders.filter(
    (order) =>
      order.items.some((item) => item.category === 'food') &&
      order.status !== 'completed' &&
      order.status !== 'cancelled'
  );

  const bdsOrders: Order[] = orders.filter(
    (order) =>
      order.items.some((item) => item.category === 'other') &&
      order.status !== 'completed' &&
      order.status !== 'cancelled'
  );

  return (
    <DataContext.Provider
      value={{
        products,
        orders,
        kdsOrders,
        bdsOrders,
        isLoading,
        loadProducts,
        loadOrders,
        requestSync,
        addOrder,
        updateOrder,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

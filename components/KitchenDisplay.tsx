import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { storageService } from '../services/storage';

interface KitchenDisplayProps {
  station?: 'kitchen' | 'bar' | 'all';
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({
  station = 'kitchen',
}) => {
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  useEffect(() => {
    loadActiveOrders();

    // Refresh every 30 seconds
    const interval = setInterval(loadActiveOrders, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [station]);

  const loadActiveOrders = async () => {
    try {
      const orders = await storageService.getOrders();

      // Filter orders that are active (not completed/cancelled)
      const activeOrders = orders.filter(
        (order: any) => order.status === 'pending'
      );

      setActiveOrders(activeOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: 'pending' | 'completed'
  ) => {
    try {
      await storageService.updateOrder(orderId, { status });
      loadActiveOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-red-500';
      case 'completed':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getTimeSinceOrder = (orderTime: string) => {
    const orderDate = new Date(orderTime);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - orderDate.getTime()) / (1000 * 60)
    );

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-blue-600 p-4 flex-row justify-between items-center">
        <Text className="text-white text-xl font-bold">
          {station === 'kitchen'
            ? 'Kitchen Display'
            : station === 'bar'
            ? 'Bar Display'
            : 'All Orders'}
        </Text>
        <View className="flex-row space-x-2">
          <View className="bg-white rounded px-2 py-1">
            <Text className="text-blue-600 font-semibold">
              {activeOrders.length} Orders
            </Text>
          </View>
          <TouchableOpacity
            onPress={loadActiveOrders}
            className="bg-blue-700 rounded px-3 py-1"
          >
            <Text className="text-white">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="flex-row flex-wrap">
          {activeOrders.map((order) => (
            <View
              key={order.id}
              className={`bg-white rounded-lg shadow-md m-2 p-4 min-w-80 ${
                selectedOrder === order.id ? 'border-2 border-blue-500' : ''
              }`}
            >
              {/* Order Header */}
              <TouchableOpacity
                onPress={() =>
                  setSelectedOrder(selectedOrder === order.id ? null : order.id)
                }
                className="border-b border-gray-200 pb-2 mb-3"
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-lg font-bold">
                    Order #{order.order_number || order.id}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {getTimeSinceOrder(order.created_at)}
                  </Text>
                </View>
                <Text className="text-sm text-gray-600">
                  Total: ${(order.total_amount || 0).toFixed(2)}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View
                    className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(
                      order.status
                    )}`}
                  />
                  <Text className="text-sm text-gray-600 capitalize">
                    {order.status.replace('_', ' ')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Order Items */}
              <View className="mb-3">
                <Text className="font-semibold text-gray-800 mb-2">Items</Text>
                {order.items?.map((item: any, index: number) => (
                  <View key={index} className="mb-2 p-2 bg-gray-50 rounded">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <Text className="font-medium">
                          {item.product_name || item.name}
                        </Text>
                        <Text className="text-sm text-gray-600">
                          Qty: {item.quantity}
                        </Text>
                        <Text className="text-sm text-gray-600">
                          ${(item.unit_price || item.price || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )) || (
                  <Text className="text-gray-500 italic">
                    No items available
                  </Text>
                )}
              </View>

              {/* Order Actions */}
              {selectedOrder === order.id && (
                <View className="mt-3 pt-3 border-t border-gray-200">
                  <View className="flex-row space-x-2">
                    {order.status === 'pending' && (
                      <TouchableOpacity
                        onPress={() => updateOrderStatus(order.id, 'completed')}
                        className="flex-1 bg-green-600 rounded py-2"
                      >
                        <Text className="text-white text-center font-semibold">
                          Mark Ready
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setSelectedOrder(null)}
                      className="px-4 bg-gray-500 rounded py-2"
                    >
                      <Text className="text-white text-center">Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {activeOrders.length === 0 && (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-gray-500 text-lg">No active orders</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Orders will appear here when placed
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default KitchenDisplay;

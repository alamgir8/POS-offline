import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../contexts/DataContext';
import { useSync } from '../../contexts/SyncContext';
import { useAuth } from '../../contexts/AuthContext';

export default function OrdersScreen() {
  const { orders, isLoading, requestSync, updateOrder } = useData();
  const { isOnline, isConnectedToServer } = useSync();
  const { logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Use requestSync to get latest data from server instead of overwriting with local storage
    if (requestSync) {
      await requestSync();
    }
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'preparing':
        return '#3b82f6';
      case 'ready':
        return '#10b981';
      case 'completed':
        return '#6b7280';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'preparing':
        return 'restaurant-outline';
      case 'ready':
        return 'checkmark-circle-outline';
      case 'completed':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await updateOrder(orderId, { status: newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Filter out completed and cancelled orders and sort by creation date
  const activeOrders = orders.filter(
    (order) => order.status !== 'completed' && order.status !== 'cancelled'
  );
  const sortedOrders = activeOrders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <Text className="text-xl font-bold text-gray-900">Orders</Text>
        <View className="flex-row items-center space-x-3">
          <View className="flex-row items-center px-3 py-1.5 bg-gray-100 rounded-xl">
            <View
              className="w-1.5 h-1.5 rounded-full mr-1.5"
              style={{
                backgroundColor: isOnline ? '#10b981' : '#ef4444',
              }}
            />
            <Text className="text-xs text-gray-700 font-medium">
              {isConnectedToServer
                ? 'Server Connected'
                : isOnline
                ? 'Online'
                : 'Offline'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="p-2 bg-red-50 rounded-lg"
          >
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row bg-white py-4 border-b border-gray-200">
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-gray-900">
            {orders.filter((o) => o.status === 'pending').length}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">Pending</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-gray-900">
            {orders.filter((o) => o.status === 'preparing').length}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">Preparing</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-gray-900">
            {orders.filter((o) => o.status === 'ready').length}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">Ready</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-gray-900">
            {orders.filter((o) => o.status === 'completed').length}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">Completed</Text>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView
        className="flex-1 px-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {sortedOrders.length === 0 ? (
          <View className="flex-1 items-center justify-center py-15">
            <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
            <Text className="text-lg font-semibold text-gray-400 mt-4">
              No orders yet
            </Text>
            <Text className="text-sm text-gray-300 mt-2">
              Orders will appear here when created
            </Text>
          </View>
        ) : (
          sortedOrders.map((order) => (
            <View
              key={order.id}
              className="bg-white rounded-xl p-4 my-2 shadow-sm border border-gray-100"
            >
              {/* Order Header */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-gray-900">
                    {order.orderNumber}
                  </Text>
                  <Text className="text-sm text-gray-600 mt-0.5">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
                <View
                  className="flex-row items-center px-2 py-1 rounded-xl"
                  style={{
                    backgroundColor: getStatusColor(order.status),
                  }}
                >
                  <Ionicons
                    name={getStatusIcon(order.status)}
                    size={16}
                    color="#ffffff"
                  />
                  <Text className="text-xs text-white font-medium ml-1">
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Customer Info */}
              {(order.customerName || order.tableNumber) && (
                <View className="flex-row mb-3">
                  {order.customerName && (
                    <Text className="text-sm text-gray-700 mr-4">
                      👤 {order.customerName}
                    </Text>
                  )}
                  {order.tableNumber && (
                    <Text className="text-sm text-gray-700">
                      🪑 Table {order.tableNumber}
                    </Text>
                  )}
                </View>
              )}

              {/* Order Items */}
              <View className="mb-3">
                {order.items.map((item, index) => (
                  <View
                    key={index}
                    className="flex-row items-center justify-between py-1"
                  >
                    <Text className="text-sm text-gray-800 flex-1">
                      {item.quantity}x {item.name}
                    </Text>
                    <Text className="text-sm font-medium text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Order Total */}
              <View className="flex-row items-center justify-between border-t border-gray-200 pt-3 mb-3">
                <Text className="text-base font-semibold text-gray-900">
                  Total:
                </Text>
                <Text className="text-lg font-bold text-blue-600">
                  ${order.total.toFixed(2)}
                </Text>
              </View>

              {/* Action Buttons */}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <View className="flex-row gap-2">
                  {order.status === 'pending' && (
                    <TouchableOpacity
                      className="flex-1 py-2 rounded-md items-center"
                      style={{ backgroundColor: '#3b82f6' }}
                      onPress={() => handleStatusUpdate(order.id, 'preparing')}
                    >
                      <Text className="text-white text-sm font-medium">
                        Start Preparing
                      </Text>
                    </TouchableOpacity>
                  )}

                  {order.status === 'preparing' && (
                    <TouchableOpacity
                      className="flex-1 py-2 rounded-md items-center"
                      style={{ backgroundColor: '#10b981' }}
                      onPress={() => handleStatusUpdate(order.id, 'ready')}
                    >
                      <Text className="text-white text-sm font-medium">
                        Mark Ready
                      </Text>
                    </TouchableOpacity>
                  )}

                  {order.status === 'ready' && (
                    <TouchableOpacity
                      className="flex-1 py-2 rounded-md items-center"
                      style={{ backgroundColor: '#6b7280' }}
                      onPress={() => handleStatusUpdate(order.id, 'completed')}
                    >
                      <Text className="text-white text-sm font-medium">
                        Complete Order
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    className="flex-1 py-2 rounded-md items-center"
                    style={{ backgroundColor: '#ef4444' }}
                    onPress={() => handleStatusUpdate(order.id, 'cancelled')}
                  >
                    <Text className="text-white text-sm font-medium">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

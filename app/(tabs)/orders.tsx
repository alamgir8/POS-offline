import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { ClipboardList, ChevronRight, X } from 'lucide-react-native';
import { Order, OrderItem } from '@/lib/supabase';
import { storageService } from '@/services/storage';
import { syncService } from '@/services/syncService';
import { Toast, useToast } from '@/components/Toast';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    loadOrders();
    const unsubscribe = syncService.onSync(() => {
      loadOrders();
      showToast('Orders synced between devices', 'sync');
    });
    return unsubscribe;
  }, []);

  const loadOrders = async () => {
    try {
      // Clean up any existing duplicates first
      await storageService.deduplicateOrders();

      const data = await storageService.getOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncService.syncFromServer();
    await loadOrders();
  };

  const handleOrderPress = async (order: Order) => {
    const items = await storageService.getOrderItemsByOrderId(order.id);
    setOrderItems(items);
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const handleStatusChange = async (
    order: Order,
    newStatus: Order['status']
  ) => {
    await syncService.updateOrderStatus(order.id, newStatus);
    await loadOrders();
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...order, status: newStatus });
    }
    showToast(`Order ${order.order_number} updated to ${newStatus}`, 'success');
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
      onPress={() => handleOrderPress(item)}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 mb-1">
            {item.order_number}
          </Text>
          <Text className="text-sm text-gray-500">
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>
        <ChevronRight size={20} color="#94a3b8" />
      </View>

      <View className="flex-row justify-between items-center mt-3">
        <View>
          <Text className="text-2xl font-bold text-primary-600">
            ${item.total_amount.toFixed(2)}
          </Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${getStatusColor(item.status)}`}
        >
          <Text className="text-sm font-semibold capitalize">
            {item.status}
          </Text>
        </View>
      </View>

      {!item.synced && (
        <View className="mt-2 bg-orange-50 px-2 py-1 rounded">
          <Text className="text-xs text-orange-600">Pending sync</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />

      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Orders</Text>
        <Text className="text-gray-500 mt-1">{orders.length} total orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <ClipboardList size={48} color="#cbd5e1" />
            <Text className="text-gray-500 mt-4">No orders yet</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            <View className="flex-row justify-between items-center p-6 border-b border-gray-200">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  {selectedOrder?.order_number}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {selectedOrder &&
                    new Date(selectedOrder.created_at).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                className="bg-gray-100 rounded-full p-2"
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <View className="px-6 py-4">
              <Text className="text-sm font-semibold text-gray-700 mb-3">
                Order Items
              </Text>
              {orderItems.map((item) => (
                <View
                  key={item.id}
                  className="flex-row justify-between mb-3 pb-3 border-b border-gray-100"
                >
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {item.product_name}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Qty: {item.quantity}
                    </Text>
                  </View>
                  <Text className="text-base font-bold text-gray-900">
                    ${item.total_price.toFixed(2)}
                  </Text>
                </View>
              ))}

              <View className="border-t-2 border-gray-200 pt-4 mt-2">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-600">Subtotal</Text>
                  <Text className="text-gray-900 font-semibold">
                    $
                    {(
                      (selectedOrder?.total_amount || 0) -
                      (selectedOrder?.tax_amount || 0)
                    ).toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-600">Tax</Text>
                  <Text className="text-gray-900 font-semibold">
                    ${selectedOrder?.tax_amount.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-gray-200">
                  <Text className="text-lg font-bold text-gray-900">Total</Text>
                  <Text className="text-lg font-bold text-primary-600">
                    ${selectedOrder?.total_amount.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View className="mt-6">
                <Text className="text-sm font-semibold text-gray-700 mb-3">
                  Update Status
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(
                    ['pending', 'completed', 'cancelled', 'refunded'] as const
                  ).map((status) => (
                    <TouchableOpacity
                      key={status}
                      className={`px-4 py-2 rounded-lg ${
                        selectedOrder?.status === status
                          ? 'bg-primary-500'
                          : 'bg-gray-100'
                      }`}
                      onPress={() =>
                        selectedOrder &&
                        handleStatusChange(selectedOrder, status)
                      }
                    >
                      <Text
                        className={`font-semibold capitalize ${
                          selectedOrder?.status === status
                            ? 'text-white'
                            : 'text-gray-700'
                        }`}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

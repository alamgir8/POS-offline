import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { storageService } from "../pos-native/services/storage";

const ParkedOrdersManager: React.FC = () => {
  const [parkedOrders, setParkedOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");

  useEffect(() => {
    loadParkedOrders();

    // Refresh every 30 seconds
    const interval = setInterval(loadParkedOrders, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadParkedOrders = async () => {
    try {
      const orders = await storageService.getOrders();

      // Filter orders that are parked (using cancelled status)
      const parkedOrders = orders.filter(
        (order: any) => order.status === "cancelled"
      );

      setParkedOrders(parkedOrders);
    } catch (error) {
      console.error("Failed to load parked orders:", error);
    }
  };

  const parkOrder = async (orderId: string) => {
    try {
      await storageService.updateOrder(orderId, {
        status: "cancelled",
      });
      loadParkedOrders();
    } catch (error) {
      console.error("Failed to park order:", error);
      Alert.alert("Error", "Failed to park order");
    }
  };

  const unparkOrder = async (orderId: string) => {
    try {
      await storageService.updateOrder(orderId, {
        status: "pending",
      });
      loadParkedOrders();
    } catch (error) {
      console.error("Failed to unpark order:", error);
      Alert.alert("Error", "Failed to unpark order");
    }
  };

  const addItemToOrder = async () => {
    if (!selectedOrder || !newItemName || !newItemPrice) {
      Alert.alert("Error", "Please fill in all item details");
      return;
    }

    try {
      const price = parseFloat(newItemPrice);
      const quantity = parseInt(newItemQuantity);

      if (isNaN(price) || isNaN(quantity) || quantity < 1) {
        Alert.alert("Error", "Please enter valid price and quantity");
        return;
      }

      // Create new item
      const newItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: selectedOrder.id,
        product_id: "custom_item",
        product_name: newItemName,
        unit_price: price,
        quantity: quantity,
        total_price: price * quantity,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add the new item
      await storageService.addOrderItems([newItem]);

      // Update order total
      const newTotal = (selectedOrder.total_amount || 0) + price * quantity;
      await storageService.updateOrder(selectedOrder.id, {
        total_amount: newTotal,
      });

      // Reset form
      setNewItemName("");
      setNewItemPrice("");
      setNewItemQuantity("1");
      setShowAddItemModal(false);

      // Refresh data
      loadParkedOrders();

      Alert.alert("Success", "Item added to order");
    } catch (error) {
      console.error("Failed to add item:", error);
      Alert.alert("Error", "Failed to add item to order");
    }
  };

  const getTimeSinceParked = (orderTime: string) => {
    const orderDate = new Date(orderTime);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - orderDate.getTime()) / (1000 * 60)
    );

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m ago`;
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-purple-600 p-4 flex-row justify-between items-center">
        <Text className="text-white text-xl font-bold">Parked Orders</Text>
        <View className="flex-row space-x-2">
          <View className="bg-white rounded px-2 py-1">
            <Text className="text-purple-600 font-semibold">
              {parkedOrders.length} Parked
            </Text>
          </View>
          <TouchableOpacity
            onPress={loadParkedOrders}
            className="bg-purple-700 rounded px-3 py-1"
          >
            <Text className="text-white">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="flex-row flex-wrap">
          {parkedOrders.map((order) => (
            <View
              key={order.id}
              className={`bg-white rounded-lg shadow-md m-2 p-4 min-w-80 border-l-4 border-purple-500 ${
                selectedOrder?.id === order.id
                  ? "border-2 border-purple-600"
                  : ""
              }`}
            >
              {/* Order Header */}
              <TouchableOpacity
                onPress={() =>
                  setSelectedOrder(
                    selectedOrder?.id === order.id ? null : order
                  )
                }
                className="border-b border-gray-200 pb-2 mb-3"
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-lg font-bold">
                    Order #{order.order_number || order.id}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {getTimeSinceParked(order.updated_at || order.created_at)}
                  </Text>
                </View>
                <Text className="text-sm text-gray-600">
                  Total: ${(order.total_amount || 0).toFixed(2)}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View className="w-3 h-3 rounded-full mr-2 bg-purple-500" />
                  <Text className="text-sm text-purple-600 font-semibold">
                    PARKED
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
              {selectedOrder?.id === order.id && (
                <View className="mt-3 pt-3 border-t border-gray-200">
                  <View className="flex-row flex-wrap gap-2">
                    <TouchableOpacity
                      onPress={() => unparkOrder(order.id)}
                      className="flex-1 bg-green-600 rounded py-2 min-w-32"
                    >
                      <Text className="text-white text-center font-semibold">
                        Unpark Order
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowAddItemModal(true)}
                      className="flex-1 bg-blue-600 rounded py-2 min-w-32"
                    >
                      <Text className="text-white text-center font-semibold">
                        Add Item
                      </Text>
                    </TouchableOpacity>
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

        {parkedOrders.length === 0 && (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-gray-500 text-lg">No parked orders</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Parked orders will appear here
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-6 w-80 max-w-full">
            <Text className="text-xl font-bold mb-4">Add Item to Order</Text>

            <View className="mb-4">
              <Text className="text-gray-700 mb-2">Item Name</Text>
              <TextInput
                value={newItemName}
                onChangeText={setNewItemName}
                className="border border-gray-300 rounded px-3 py-2"
                placeholder="Enter item name"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 mb-2">Price</Text>
              <TextInput
                value={newItemPrice}
                onChangeText={setNewItemPrice}
                className="border border-gray-300 rounded px-3 py-2"
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 mb-2">Quantity</Text>
              <TextInput
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                className="border border-gray-300 rounded px-3 py-2"
                placeholder="1"
                keyboardType="number-pad"
              />
            </View>

            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={addItemToOrder}
                className="flex-1 bg-blue-600 rounded py-3"
              >
                <Text className="text-white text-center font-semibold">
                  Add Item
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowAddItemModal(false)}
                className="flex-1 bg-gray-500 rounded py-3"
              >
                <Text className="text-white text-center font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ParkedOrdersManager;

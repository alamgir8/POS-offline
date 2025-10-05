import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  TextInput,
  Modal,
  StyleSheet,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../contexts/DataContext';
import { useCart } from '../../contexts/CartContext';
import { useSync } from '../../contexts/SyncContext';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MenuItem } from '../../types';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 60) / 2; // 2 columns with padding

export default function POSScreen() {
  const { products, isLoading, addOrder } = useData();
  const { items, total, addItem, removeItem, updateQuantity, clearCart } =
    useCart();
  const { isOnline, isConnectedToServer, sendOrder } = useSync();
  const { logout, user } = useAuth();
  const router = useRouter();

  console.log(
    '🛒 POS Screen - Products:',
    products.length,
    'items, Loading:',
    isLoading,
    'user',
    user
  );

  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'food' | 'other'
  >('all');
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');

  const filteredProducts = products.filter(
    (product) =>
      selectedCategory === 'all' || product.category === selectedCategory
  );

  console.log(
    '🔍 Filtered Products:',
    filteredProducts.length,
    'items for category:',
    selectedCategory
  );

  const foodItems = items.filter((item) => item.product.category === 'food');
  const otherItems = items.filter((item) => item.product.category !== 'food');

  const handleAddToCart = (product: MenuItem) => {
    addItem(product);
  };

  const handleCreateOrder = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Please add items to cart before creating order');
      return;
    }

    try {
      const order = {
        orderNumber: `ORD-${Date.now()}`,
        tableNumber: tableNumber || undefined,
        customerName: customerName || undefined,
        items: items.map((item) => ({
          id: `${item.product.id}_${Date.now()}`,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          category: item.product.category,
          notes: item.notes,
        })),
        total,
        tax: total * 0.1, // 10% tax
        subtotal: total - total * 0.1,
        status: 'pending' as const,
      };

      // Create order via DataContext - this now also sends via WebSocket
      const createdOrder = await addOrder(order);

      Alert.alert(
        'Order Created!',
        `Order ${order.orderNumber} has been created successfully.\n\n` +
          `Food items: ${
            foodItems.length > 0 ? 'Sent to Kitchen Display' : 'None'
          }\n` +
          `Drinks: ${otherItems.length > 0 ? 'Sent to Bar Display' : 'None'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              clearCart();
              setCustomerName('');
              setTableNumber('');
              setShowCart(false);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create order. Please try again.');
      console.error('Order creation error:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">POS System</Text>
          {user && (
            <Text className="text-sm text-gray-600">
              {user.userName} • {user.tenantId}
            </Text>
          )}
        </View>

        <View className="flex-row items-center">
          {/* Connection Status */}
          <View className="flex-row items-center mr-4">
            <View
              className="w-3 h-3 rounded-full mr-2"
              style={{
                backgroundColor: isOnline ? '#10b981' : '#ef4444',
              }}
            />
            <Text className="text-sm text-gray-600">
              {isConnectedToServer
                ? 'Server Connected'
                : isOnline
                ? 'Online'
                : 'Offline'}
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            className="p-2 rounded-lg bg-gray-100 mr-3"
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#6b7280" />
          </TouchableOpacity>

          {/* Cart Button */}
          <TouchableOpacity
            className={`p-3 rounded-lg ${
              items.length > 0 ? 'bg-blue-600' : 'bg-gray-100'
            }`}
            onPress={() => setShowCart(true)}
          >
            <Ionicons
              name="cart"
              size={24}
              color={items.length > 0 ? '#ffffff' : '#6b7280'}
            />
            {items.length > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-xs text-white font-bold">
                  {items.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter */}
      {/* Category Filter */}
      <View className="flex-row px-5 py-3">
        <TouchableOpacity
          className={`px-4 py-2 rounded-lg mr-3 ${
            selectedCategory === 'all' ? 'bg-blue-600' : 'bg-gray-100'
          }`}
          onPress={() => setSelectedCategory('all')}
        >
          <Text
            className={`font-medium ${
              selectedCategory === 'all' ? 'text-white' : 'text-gray-700'
            }`}
          >
            All Items
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-4 py-2 rounded-lg mr-3 ${
            selectedCategory === 'food' ? 'bg-blue-600' : 'bg-gray-100'
          }`}
          onPress={() => setSelectedCategory('food')}
        >
          <Text
            className={`font-medium ${
              selectedCategory === 'food' ? 'text-white' : 'text-gray-700'
            }`}
          >
            Food
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-4 py-2 rounded-lg ${
            selectedCategory === 'other' ? 'bg-blue-600' : 'bg-gray-100'
          }`}
          onPress={() => setSelectedCategory('other')}
        >
          <Text
            className={`font-medium ${
              selectedCategory === 'other' ? 'text-white' : 'text-gray-700'
            }`}
          >
            Drinks & Other
          </Text>
        </TouchableOpacity>
      </View>

      {/* Products Grid */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <View className="flex-row flex-wrap justify-between">
          {filteredProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              className="w-[48%] bg-white rounded-xl shadow-sm border border-gray-100 mb-4"
              onPress={() => handleAddToCart(product)}
              disabled={!product.available}
            >
              <View
                className="h-32 rounded-t-xl items-center justify-center"
                style={{
                  backgroundColor:
                    product.category === 'food' ? '#fef3c7' : '#dbeafe',
                }}
              >
                <Ionicons
                  name={product.category === 'food' ? 'restaurant' : 'wine'}
                  size={32}
                  color={product.category === 'food' ? '#f59e0b' : '#3b82f6'}
                />
              </View>
              <View className="p-3">
                <Text
                  className="text-sm font-medium text-gray-900 text-center"
                  numberOfLines={2}
                >
                  {product.name}
                </Text>
                <Text className="text-lg font-bold text-blue-600 text-center mt-1">
                  ${product.price.toFixed(2)}
                </Text>
                {!product.available && (
                  <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 rounded-xl items-center justify-center">
                    <Text className="text-white font-bold">Unavailable</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Cart Modal */}
      <Modal
        visible={showCart}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">
              Shopping Cart
            </Text>
            <TouchableOpacity onPress={() => setShowCart(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="cart-outline" size={64} color="#d1d5db" />
              <Text className="text-base text-gray-400 mt-4">
                Your cart is empty
              </Text>
            </View>
          ) : (
            <>
              <ScrollView className="flex-1 px-5">
                {/* Food Items Section */}
                {foodItems.length > 0 && (
                  <>
                    <Text className="text-lg font-bold text-gray-900 mt-5 mb-3">
                      🍽️ Kitchen Orders
                    </Text>
                    {foodItems.map((item) => (
                      <View
                        key={item.product.id}
                        className="flex-row items-center py-3 border-b border-gray-100"
                      >
                        <View className="flex-1">
                          <Text className="text-base font-medium text-gray-900">
                            {item.product.name}
                          </Text>
                          <Text className="text-sm text-gray-600 mt-1">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <TouchableOpacity
                            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() =>
                              updateQuantity(item.product.id, item.quantity - 1)
                            }
                          >
                            <Ionicons name="remove" size={16} color="#6b7280" />
                          </TouchableOpacity>
                          <Text className="text-base font-medium mx-4 min-w-[20px] text-center">
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() =>
                              updateQuantity(item.product.id, item.quantity + 1)
                            }
                          >
                            <Ionicons name="add" size={16} color="#6b7280" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* Other Items Section */}
                {otherItems.length > 0 && (
                  <>
                    <Text className="text-lg font-bold text-gray-900 mt-5 mb-3">
                      🍺 Bar Orders
                    </Text>
                    {otherItems.map((item) => (
                      <View
                        key={item.product.id}
                        className="flex-row items-center py-3 border-b border-gray-100"
                      >
                        <View className="flex-1">
                          <Text className="text-base font-medium text-gray-900">
                            {item.product.name}
                          </Text>
                          <Text className="text-sm text-gray-600 mt-1">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <TouchableOpacity
                            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() =>
                              updateQuantity(item.product.id, item.quantity - 1)
                            }
                          >
                            <Ionicons name="remove" size={16} color="#6b7280" />
                          </TouchableOpacity>
                          <Text className="text-base font-medium mx-4 min-w-[20px] text-center">
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() =>
                              updateQuantity(item.product.id, item.quantity + 1)
                            }
                          >
                            <Ionicons name="add" size={16} color="#6b7280" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* Order Details */}
                <View className="mt-5">
                  <Text className="text-lg font-bold text-gray-900 mb-3">
                    Order Details
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-base mb-3"
                    placeholder="Customer Name (Optional)"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-base mb-3"
                    placeholder="Table Number (Optional)"
                    value={tableNumber}
                    onChangeText={setTableNumber}
                  />
                </View>
              </ScrollView>

              <View className="px-5 py-4 border-t border-gray-200">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-semibold text-gray-900">
                    Total:
                  </Text>
                  <Text className="text-2xl font-bold text-blue-600">
                    ${total.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  className="bg-blue-600 rounded-lg py-4 items-center"
                  onPress={handleCreateOrder}
                >
                  <Text className="text-white text-base font-semibold">
                    Create Order
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

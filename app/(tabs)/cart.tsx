import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { syncService } from '@/services/syncService';
import { storageService } from '@/services/storage';
import { Order, OrderItem } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';

export default function CartScreen() {
  const { items, removeFromCart, updateQuantity, clearCart, totalAmount, totalItems } =
    useCart();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const TAX_RATE = 0.08;
  const taxAmount = totalAmount * TAX_RATE;
  const finalTotal = totalAmount + taxAmount;

  const handleCreateOrder = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before creating an order');
      return;
    }

    setCreating(true);
    try {
      const deviceId = await storageService.getDeviceId();
      const orderNumber = `ORD-${Date.now()}`;

      const order: Order = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_number: orderNumber,
        user_id: user?.id || null,
        total_amount: finalTotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        status: 'pending',
        payment_method: 'cash',
        device_id: deviceId,
        synced: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const orderItems: OrderItem[] = items.map((item) => ({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        created_at: new Date().toISOString(),
      }));

      await syncService.createOrder(order, orderItems);
      clearCart();

      Alert.alert('Success', `Order ${orderNumber} created successfully!`, [
        { text: 'View Orders', onPress: () => router.push('/(tabs)/orders') },
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to create order. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderCartItem = ({ item }: { item: typeof items[0] }) => (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100 flex-row">
      <Image
        source={{ uri: item.product.image_url }}
        className="w-20 h-20 rounded-lg"
        resizeMode="cover"
      />
      <View className="flex-1 ml-3">
        <Text className="text-base font-bold text-gray-900 mb-1">{item.product.name}</Text>
        <Text className="text-lg font-bold text-primary-600 mb-2">
          ${item.product.price.toFixed(2)}
        </Text>
        <View className="flex-row items-center">
          <TouchableOpacity
            className="bg-gray-100 rounded-lg p-2 active:bg-gray-200"
            onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
          >
            <Minus size={16} color="#374151" />
          </TouchableOpacity>
          <Text className="mx-4 text-base font-semibold text-gray-900">{item.quantity}</Text>
          <TouchableOpacity
            className="bg-gray-100 rounded-lg p-2 active:bg-gray-200"
            onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
          >
            <Plus size={16} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>
      <View className="items-end justify-between">
        <TouchableOpacity
          className="bg-red-50 rounded-lg p-2 active:bg-red-100"
          onPress={() => removeFromCart(item.product.id)}
        >
          <Trash2 size={18} color="#ef4444" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-gray-900">
          ${(item.product.price * item.quantity).toFixed(2)}
        </Text>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-8">
        <ShoppingBag size={64} color="#cbd5e1" />
        <Text className="text-xl font-bold text-gray-900 mt-4">Your cart is empty</Text>
        <Text className="text-gray-500 text-center mt-2">
          Add products from the Products tab to get started
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Shopping Cart</Text>
        <Text className="text-gray-500 mt-1">{totalItems} items</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        renderItem={renderCartItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
      />

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <View className="mb-3">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Subtotal</Text>
            <Text className="text-gray-900 font-semibold">${totalAmount.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Tax (8%)</Text>
            <Text className="text-gray-900 font-semibold">${taxAmount.toFixed(2)}</Text>
          </View>
          <View className="border-t border-gray-200 pt-2 mt-2">
            <View className="flex-row justify-between">
              <Text className="text-lg font-bold text-gray-900">Total</Text>
              <Text className="text-lg font-bold text-primary-600">
                ${finalTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="bg-primary-500 rounded-lg py-4 active:bg-primary-600"
          onPress={handleCreateOrder}
          disabled={creating}
        >
          <Text className="text-white text-center font-bold text-base">
            {creating ? 'Creating Order...' : 'Create Order'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

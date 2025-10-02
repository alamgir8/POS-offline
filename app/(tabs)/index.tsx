import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Search, Plus, Wifi, WifiOff, Package } from 'lucide-react-native';
import { Product } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { storageService } from '@/services/storage';
import { syncService } from '@/services/syncService';

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [p2pStatus, setP2pStatus] = useState<any>({});
  const { addToCart } = useCart();

  useEffect(() => {
    loadProducts();
    const unsubscribe = syncService.onSync(() => {
      loadProducts();
    });

    const checkOnline = setInterval(() => {
      setIsOnline(syncService.getIsOnline());
      setP2pStatus(syncService.getP2PStatus());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkOnline);
    };
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  const loadProducts = async () => {
    try {
      // In demo mode, directly get products from storage
      // In production mode, sync from server first
      await syncService.syncFromServer();
      const data = await storageService.getProducts();
      setProducts(data);
      console.log('Loaded products:', data.length);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
  };

  const filterProducts = () => {
    let filtered = products;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const categories = [
    'All',
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
      <Image
        source={{ uri: item.image_url }}
        className="w-full h-40 rounded-lg mb-3"
        resizeMode="cover"
      />
      <Text className="text-lg font-bold text-gray-900 mb-1">{item.name}</Text>
      <Text className="text-sm text-gray-500 mb-2" numberOfLines={2}>
        {item.description}
      </Text>
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-primary-600">
            ${item.price.toFixed(2)}
          </Text>
          <Text className="text-xs text-gray-500">Stock: {item.stock}</Text>
        </View>
        <TouchableOpacity
          className="bg-primary-500 rounded-lg px-4 py-3 flex-row items-center active:bg-primary-600"
          onPress={() => handleAddToCart(item)}
          disabled={item.stock === 0}
        >
          <Plus size={18} color="white" />
          <Text className="text-white font-semibold ml-1">Add</Text>
        </TouchableOpacity>
      </View>
    </View>
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
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">Products</Text>
          <View className="items-end">
            <View className="flex-row items-center mb-1">
              {isOnline ? (
                <>
                  <Wifi size={18} color="#10b981" />
                  <Text className="text-xs text-green-600 ml-1">Online</Text>
                </>
              ) : (
                <>
                  <WifiOff size={18} color="#f59e0b" />
                  <Text className="text-xs text-orange-600 ml-1">Offline</Text>
                </>
              )}
            </View>
            {p2pStatus.isConnected && (
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                <Text className="text-xs text-green-600">
                  {p2pStatus.peerCount} device(s) connected
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="bg-gray-100 rounded-lg px-4 py-3 flex-row items-center mb-4">
          <Search size={20} color="#64748b" />
          <TextInput
            className="flex-1 ml-2 text-gray-900"
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
        </View>

        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`mr-2 px-4 py-2 rounded-lg ${
                selectedCategory === item ? 'bg-primary-500' : 'bg-gray-100'
              }`}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                className={`font-semibold ${
                  selectedCategory === item ? 'text-white' : 'text-gray-700'
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <Package size={48} color="#cbd5e1" />
            <Text className="text-gray-500 mt-4">No products found</Text>
          </View>
        }
      />
    </View>
  );
}

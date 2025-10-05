import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CartProvider } from '../../contexts/CartContext';

interface TabBarIconProps {
  color: string;
  size: number;
}

function TabsNavigator() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
      }}
    >
      <Tabs.Screen
        name="pos"
        options={{
          title: 'POS',
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Ionicons name="storefront" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kds"
        options={{
          title: 'Kitchen',
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bds"
        options={{
          title: 'Bar',
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Ionicons name="wine" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <CartProvider>
      <TabsNavigator />
    </CartProvider>
  );
}

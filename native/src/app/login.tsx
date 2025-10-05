import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('admin@restaurant.demo');
  const [password, setPassword] = useState('password123');
  const [tenantId, setTenantId] = useState('restaurant_demo');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { isOnline, isConnectedToServer, serverIP } = useSync();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password || !tenantId) {
      Alert.alert('Error', 'Please enter email, password, and tenant ID');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, tenantId);
      router.replace('/(tabs)/pos');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Login failed. Try: demo/demo/demo'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center">
          {/* Header */}
          <View className="items-center mb-10">
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              POS System
            </Text>
            <Text className="text-base text-gray-600">Point of Sale</Text>
          </View>

          {/* Connection Status */}
          <View className="flex-row items-center justify-center mb-8 px-4 py-2 bg-gray-50 rounded-lg">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{
                backgroundColor: isOnline ? '#10b981' : '#ef4444',
              }}
            />
            <Text className="text-sm text-gray-700 font-medium">
              {isOnline ? 'Online' : 'Offline'}
              {isConnectedToServer && ` • Server: ${serverIP}`}
            </Text>
          </View>

          {/* Login Form */}
          <View className="mb-10">
            <View className="mb-5">
              <Text className="text-base font-medium text-gray-800 mb-2">
                Email
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
            </View>

            <View className="mb-5">
              <Text className="text-base font-medium text-gray-800 mb-2">
                Password
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry
                autoComplete="current-password"
              />
            </View>

            <View className="mb-5">
              <Text className="text-base font-medium text-gray-800 mb-2">
                Tenant ID
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                value={tenantId}
                onChangeText={setTenantId}
                placeholder="Enter tenant ID"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              className={`rounded-lg py-4 items-center mt-2 ${
                isLoading ? 'bg-gray-400' : 'bg-blue-600'
              }`}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text className="text-white text-base font-semibold">
                {isLoading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Demo Info */}
          <View className="bg-yellow-100 rounded-lg p-4 mb-8">
            <Text className="text-sm font-semibold text-yellow-800 mb-2">
              Demo Credentials
            </Text>
            <Text className="text-sm text-yellow-800 font-mono">
              Email: demo | Password: demo | Tenant: demo
            </Text>
            <Text className="text-sm text-yellow-800 font-mono">
              Or: admin@restaurant.demo / password123 / restaurant_demo
            </Text>
          </View>

          {/* Footer */}
          <Text className="text-center text-xs text-gray-400 leading-4">
            Offline POS System v1.0{'\n'}
            Works with or without internet
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

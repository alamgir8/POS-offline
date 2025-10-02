import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import {
  User,
  LogOut,
  Database,
  RefreshCw,
  Wifi,
  Users,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { syncService } from '@/services/syncService';
import { storageService } from '@/services/storage';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [p2pStatus, setP2pStatus] = useState<any>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setP2pStatus(syncService.getP2PStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: signOut, style: 'destructive' },
    ]);
  };

  const handleSyncNow = async () => {
    Alert.alert('Syncing', 'Synchronizing data with server...');
    const success = await syncService.syncToServer();
    if (success) {
      Alert.alert('Success', 'Data synchronized successfully');
    } else {
      Alert.alert('Offline', 'Cannot sync while offline');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all local data and reinitialize with demo products.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await storageService.clearAll();
            Alert.alert(
              'Success',
              'Cache cleared successfully. Restart the app to see demo products.'
            );
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pt-12 pb-6 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      <View className="p-4">
        <View className="bg-white rounded-xl p-6 mb-4 border border-gray-100">
          <View className="items-center mb-4">
            <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-3">
              <User size={40} color="#0ea5e9" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              {user?.full_name}
            </Text>
            <Text className="text-gray-500 mt-1">{user?.email}</Text>
            <View className="mt-2 bg-blue-50 px-3 py-1 rounded-full">
              <Text className="text-blue-700 font-semibold capitalize">
                {user?.role}
              </Text>
            </View>
          </View>
        </View>

        {/* P2P Network Status */}
        <View className="bg-white rounded-xl p-6 mb-4 border border-gray-100">
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 bg-blue-100 rounded-lg items-center justify-center mr-3">
              <Wifi size={20} color="#0ea5e9" />
            </View>
            <Text className="text-lg font-bold text-gray-900">
              Network Status
            </Text>
          </View>

          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-600">P2P Connection</Text>
              <View className="flex-row items-center">
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${
                    p2pStatus.isConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <Text className="text-sm font-semibold text-gray-900">
                  {p2pStatus.isConnected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-gray-600">Connected Devices</Text>
              <View className="flex-row items-center">
                <Users size={14} color="#64748b" />
                <Text className="text-sm font-semibold text-gray-900 ml-1">
                  {p2pStatus.peerCount || 0}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-gray-600">Device Role</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {p2pStatus.isServer ? 'Server' : 'Client'}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-gray-600">Device ID</Text>
              <Text className="text-xs font-mono text-gray-500">
                {p2pStatus.deviceId?.substring(0, 12)}...
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <TouchableOpacity
            className="flex-row items-center p-4 border-b border-gray-100 active:bg-gray-50"
            onPress={handleSyncNow}
          >
            <View className="w-10 h-10 bg-green-100 rounded-lg items-center justify-center">
              <RefreshCw size={20} color="#10b981" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-base font-semibold text-gray-900">
                Sync Now
              </Text>
              <Text className="text-sm text-gray-500">
                Sync data with server
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center p-4 active:bg-gray-50"
            onPress={handleClearCache}
          >
            <View className="w-10 h-10 bg-orange-100 rounded-lg items-center justify-center">
              <Database size={20} color="#f59e0b" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-base font-semibold text-gray-900">
                Clear Cache
              </Text>
              <Text className="text-sm text-gray-500">Clear local storage</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="bg-red-500 rounded-xl p-4 flex-row items-center justify-center active:bg-red-600"
          onPress={handleSignOut}
        >
          <LogOut size={20} color="white" />
          <Text className="text-white font-bold text-base ml-2">Sign Out</Text>
        </TouchableOpacity>

        <View className="mt-6 bg-blue-50 rounded-xl p-4">
          <Text className="text-sm font-semibold text-blue-900 mb-2">
            About P2P Sync
          </Text>
          <Text className="text-xs text-blue-700 leading-5">
            This POS system features real-time peer-to-peer synchronization.
            Orders and status updates are instantly shared between all connected
            devices on the same local network, even without internet
            connectivity. Perfect for restaurants, retail stores, and markets.
          </Text>
        </View>
      </View>
    </View>
  );
}

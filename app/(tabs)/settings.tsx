import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wifiSyncService } from '@/services/wifiSync';

interface NetworkSettings {
  serverIP: string;
  serverPort: number;
  autoDiscover: boolean;
}

export default function NetworkSettingsScreen() {
  const [settings, setSettings] = useState<NetworkSettings>({
    serverIP: '192.168.0.243',
    serverPort: 8080,
    autoDiscover: true,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Not connected');
  const [discoveredServers, setDiscoveredServers] = useState<string[]>([]);

  useEffect(() => {
    loadSettings();
    checkConnectionStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const savedIP = await AsyncStorage.getItem('pos_server_ip');
      const savedPort = await AsyncStorage.getItem('pos_server_port');

      if (savedIP) {
        setSettings((prev) => ({
          ...prev,
          serverIP: savedIP,
          serverPort: savedPort ? parseInt(savedPort) : 8080,
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('pos_server_ip', settings.serverIP);
      await AsyncStorage.setItem(
        'pos_server_port',
        settings.serverPort.toString()
      );
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const connectToServer = async () => {
    setIsConnecting(true);
    try {
      await wifiSyncService.startSync(settings.serverIP);
      setConnectionStatus('Connected');
      Alert.alert('Success', 'Connected to POS server!');
    } catch (error) {
      setConnectionStatus('Connection failed');
      Alert.alert(
        'Error',
        'Failed to connect to server. Please check IP address and ensure server is running.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const checkConnectionStatus = () => {
    const status = wifiSyncService.getConnectionStatus();
    setConnectionStatus(status.isConnected ? 'Connected' : 'Not connected');
  };

  const discoverServers = async () => {
    setIsConnecting(true);
    try {
      Alert.alert('Info', 'Scanning for POS servers on your network...');

      // Use the new discovery method
      const foundIP = await wifiSyncService.discoverServerOnNetwork();

      if (foundIP) {
        setSettings((prev) => ({ ...prev, serverIP: foundIP }));
        setDiscoveredServers([foundIP]);

        Alert.alert('Server Found!', `Found POS server at: ${foundIP}:8080`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use This Server',
            onPress: async () => {
              setSettings((prev) => ({ ...prev, serverIP: foundIP }));
              // Save the new IP
              await AsyncStorage.setItem('pos_server_ip', foundIP);
              await AsyncStorage.setItem('pos_server_port', '8080');
              checkConnectionStatus();
              Alert.alert(
                'Settings Updated',
                `Server IP updated to ${foundIP}`
              );
            },
          },
        ]);
      } else {
        Alert.alert(
          'No Servers Found',
          'No POS servers found on your network. Make sure the server is running and you are connected to the same WiFi network.'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to scan for servers');
    } finally {
      setIsConnecting(false);
    }
  };

  const getLocalIP = () => {
    // Show common IP ranges to help user
    return [
      '192.168.1.x (Common router range)',
      '192.168.0.x (Common router range)',
      '10.0.0.x (Some routers)',
      '172.16.x.x (Corporate networks)',
    ];
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <View className="bg-white rounded-lg p-6 mb-4 shadow-sm">
        <Text className="text-xl font-bold text-gray-800 mb-4">
          WiFi Sync Settings
        </Text>

        {/* Connection Status */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Connection Status
          </Text>
          <View
            className={`p-3 rounded-lg ${
              connectionStatus === 'Connected' ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <Text
              className={`font-medium ${
                connectionStatus === 'Connected'
                  ? 'text-green-800'
                  : 'text-red-800'
              }`}
            >
              {connectionStatus}
            </Text>
          </View>
        </View>

        {/* Server IP */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Server IP Address
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
            value={settings.serverIP}
            onChangeText={(text) =>
              setSettings((prev) => ({ ...prev, serverIP: text }))
            }
            placeholder="192.168.0.243"
            keyboardType="numeric"
          />
        </View>

        {/* Server Port */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Server Port
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
            value={settings.serverPort.toString()}
            onChangeText={(text) =>
              setSettings((prev) => ({
                ...prev,
                serverPort: parseInt(text) || 8080,
              }))
            }
            placeholder="8080"
            keyboardType="numeric"
          />
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            className={`bg-blue-500 p-3 rounded-lg ${
              isConnecting ? 'opacity-50' : ''
            }`}
            onPress={connectToServer}
            disabled={isConnecting}
          >
            <Text className="text-white font-medium text-center">
              {isConnecting ? 'Connecting...' : 'Connect to Server'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-green-500 p-3 rounded-lg"
            onPress={saveSettings}
          >
            <Text className="text-white font-medium text-center">
              Save Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`bg-purple-500 p-3 rounded-lg ${
              isConnecting ? 'opacity-50' : ''
            }`}
            onPress={discoverServers}
            disabled={isConnecting}
          >
            <Text className="text-white font-medium text-center">
              {isConnecting ? 'Scanning...' : 'Auto-Discover Servers'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Help Section */}
      <View className="bg-white rounded-lg p-6 shadow-sm">
        <Text className="text-lg font-bold text-gray-800 mb-3">Setup Help</Text>

        <Text className="text-sm text-gray-600 mb-3">
          <Text className="font-medium">1. Start the local server:</Text>
          {'\n'}
          Run the server on your computer/laptop that's connected to the same
          WiFi network.
        </Text>

        <Text className="text-sm text-gray-600 mb-3">
          <Text className="font-medium">2. Find your server IP:</Text>
          {'\n'}
          Common IP ranges on local networks:
        </Text>

        {getLocalIP().map((range, index) => (
          <Text key={index} className="text-xs text-gray-500 ml-4 mb-1">
            • {range}
          </Text>
        ))}

        <Text className="text-sm text-gray-600 mb-3 mt-3">
          <Text className="font-medium">3. Test connection:</Text>
          {'\n'}
          Use the "Auto-Discover" button to scan for servers, or enter the IP
          manually.
        </Text>

        {discoveredServers.length > 0 && (
          <View className="mt-4">
            <Text className="text-sm font-medium text-gray-600 mb-2">
              Discovered Servers:
            </Text>
            {discoveredServers.map((server, index) => (
              <TouchableOpacity
                key={index}
                className="bg-blue-50 p-2 rounded mb-2"
                onPress={() =>
                  setSettings((prev) => ({ ...prev, serverIP: server }))
                }
              >
                <Text className="text-blue-700">{server}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

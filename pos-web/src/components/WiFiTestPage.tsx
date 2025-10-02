import React, { useState, useEffect, useCallback } from 'react';
import {
  wifiDiscoveryService,
  type NetworkDevice,
} from '../services/wifiDiscoveryService';
import { webMasterDeviceManager } from '../services/webMasterDeviceManager';

const WiFiTestPage: React.FC = () => {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [discoveryLog, setDiscoveryLog] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const addToLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDiscoveryLog((prev) =>
      [`[${timestamp}] ${message}`, ...prev].slice(0, 20)
    );
  }, []);

  const startDiscovery = useCallback(() => {
    setIsScanning(true);
    addToLog('🔍 Starting WiFi discovery...');

    // Simulate discovery process
    setTimeout(() => {
      addToLog('📶 Scanning for RestaurantPOS networks...');
    }, 1000);

    setTimeout(() => {
      addToLog('🔗 Auto-connecting to strongest signal...');
    }, 2000);

    setTimeout(() => {
      addToLog('✅ Connected to RestaurantPOS_5GHz');
      addToLog('📡 Broadcasting device presence...');
    }, 3000);
  }, [addToLog]);

  useEffect(() => {
    // Listen for device changes
    wifiDiscoveryService.onDevicesChanged((newDevices) => {
      setDevices(newDevices);
      addToLog(`Discovered ${newDevices.length} devices`);
    });

    // Start automatic discovery
    startDiscovery();

    return () => {
      wifiDiscoveryService.destroy();
    };
  }, [addToLog, startDiscovery]);

  const handlePromoteToMaster = async () => {
    addToLog('👑 Promoting to master device...');
    const success = await webMasterDeviceManager.promoteMasterDevice();
    if (success) {
      addToLog('✅ Successfully promoted to master device');
      addToLog('🚀 Starting local server...');
      addToLog('📡 Broadcasting server availability...');
    } else {
      addToLog('❌ Failed to promote to master device');
    }
  };

  const handleConnectToMaster = async () => {
    addToLog('🔍 Searching for master device...');
    const success = await webMasterDeviceManager.connectToMaster();
    if (success) {
      addToLog('✅ Connected to master device');
      addToLog('🔄 Syncing data...');
    } else {
      addToLog('❌ No master device found');
    }
  };

  const handleRefreshDiscovery = () => {
    addToLog('🔄 Refreshing device discovery...');
    setDevices([]);
    startDiscovery();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          WiFi Auto-Discovery Test
        </h1>
        <p className="text-gray-600">
          Testing automatic WiFi discovery and master device functionality
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discovery Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🎮 Discovery Controls
          </h2>

          <div className="space-y-3 mb-6">
            <button
              onClick={handlePromoteToMaster}
              className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors"
            >
              👑 Become Master Hub
            </button>

            <button
              onClick={handleConnectToMaster}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔗 Connect to Master
            </button>

            <button
              onClick={handleRefreshDiscovery}
              className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              🔄 Refresh Discovery
            </button>
          </div>

          {/* Current Network Status */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              📶 Current Network
            </h3>
            <div className="text-sm text-blue-700">
              <div>SSID: RestaurantPOS_5GHz</div>
              <div>Signal: 85% (Excellent)</div>
              <div>Security: WPA2</div>
              <div className="mt-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Auto-connected
              </div>
            </div>
          </div>
        </div>

        {/* Discovered Devices */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              📱 Discovered Devices
            </h2>
            <div
              className={`px-3 py-1 rounded-full text-sm ${
                isScanning
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {isScanning ? '🔍 Scanning...' : `✅ ${devices.length} Found`}
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <div>Scanning for POS devices...</div>
              <div className="text-sm mt-1">
                Devices will appear automatically when discovered
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className={`p-4 rounded-lg border-2 ${
                    device.type === 'master'
                      ? 'border-purple-200 bg-purple-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">
                        {device.type === 'master' ? '👑' : '💻'}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {device.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {device.ip}:{device.port} • {device.type}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        📶 {device.signal}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(device.lastSeen).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Discovery Log */}
      <div className="mt-6 bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          📜 Discovery Log
        </h2>
        <div className="bg-black rounded p-4 h-64 overflow-y-auto">
          <div className="font-mono text-sm space-y-1">
            {discoveryLog.length === 0 ? (
              <div className="text-gray-500">
                Discovery log will appear here...
              </div>
            ) : (
              discoveryLog.map((entry, index) => (
                <div key={index} className="text-green-400">
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Features Demo */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-2">
            ✅ Automatic WiFi Discovery
          </h3>
          <p className="text-sm text-green-700">
            Automatically scans and connects to RestaurantPOS networks without
            manual setup
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-medium text-purple-900 mb-2">
            👑 Master Device Hub
          </h3>
          <p className="text-sm text-purple-700">
            Any device can become the master hub and start the local server for
            other devices
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">🔄 Real-time Sync</h3>
          <p className="text-sm text-blue-700">
            Automatic synchronization of inventory, orders, and data across all
            connected devices
          </p>
        </div>
      </div>
    </div>
  );
};

export default WiFiTestPage;

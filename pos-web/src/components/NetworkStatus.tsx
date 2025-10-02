import React, { useState, useEffect } from 'react';
import {
  wifiDiscoveryService,
  type NetworkDevice,
  type WiFiNetwork,
} from '../services/wifiDiscoveryService';
import {
  webMasterDeviceManager,
  type MasterDeviceStatus,
} from '../services/webMasterDeviceManager';

interface NetworkStatusProps {
  className?: string;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ className = '' }) => {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState<WiFiNetwork | null>(
    null
  );
  const [masterStatus, setMasterStatus] = useState<MasterDeviceStatus | null>(
    null
  );
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Listen for device discoveries
    wifiDiscoveryService.onDevicesChanged(setDevices);

    // Listen for master device status changes
    webMasterDeviceManager.onStatusChange(setMasterStatus);

    // Get current network
    setCurrentNetwork(wifiDiscoveryService.getCurrentNetwork());

    return () => {
      wifiDiscoveryService.destroy();
    };
  }, []);

  const masterDevice = devices.find((device) => device.type === 'master');
  const terminalDevices = devices.filter((device) => device.type === 'normal');

  const getNetworkStatusColor = () => {
    if (!masterStatus) return 'text-gray-500';

    switch (masterStatus.networkStatus) {
      case 'connected':
        return 'text-green-500';
      case 'searching':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getNetworkStatusIcon = () => {
    if (!masterStatus) return '📡';

    switch (masterStatus.networkStatus) {
      case 'connected':
        return '✅';
      case 'searching':
        return '🔍';
      case 'disconnected':
        return '❌';
      default:
        return '📡';
    }
  };

  const handlePromoteToMaster = async () => {
    await webMasterDeviceManager.promoteMasterDevice();
  };

  const handleConnectToMaster = async () => {
    await webMasterDeviceManager.connectToMaster();
  };

  const formatSignalStrength = (signal?: number) => {
    if (!signal) return 'Unknown';
    if (signal >= 80) return '📶 Excellent';
    if (signal >= 60) return '📶 Good';
    if (signal >= 40) return '📶 Fair';
    return '📶 Poor';
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-xl">{getNetworkStatusIcon()}</span>
          <div>
            <h3 className="text-lg font-semibold">Network Status</h3>
            <p className={`text-sm ${getNetworkStatusColor()}`}>
              {masterStatus?.networkStatus === 'connected' &&
                'Connected to POS Network'}
              {masterStatus?.networkStatus === 'searching' &&
                'Searching for devices...'}
              {masterStatus?.networkStatus === 'disconnected' && 'Disconnected'}
              {!masterStatus && 'Initializing...'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Quick Status */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {devices.length}
          </div>
          <div className="text-sm text-gray-600">Total Devices</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {terminalDevices.length}
          </div>
          <div className="text-sm text-gray-600">Terminals</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {masterDevice ? 1 : 0}
          </div>
          <div className="text-sm text-gray-600">Master Hub</div>
        </div>
      </div>

      {/* Current Network Info */}
      {currentNetwork && (
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-900">
                📶 {currentNetwork.ssid}
              </div>
              <div className="text-sm text-blue-700">
                {currentNetwork.security} • Signal: {currentNetwork.signal}%
              </div>
            </div>
            <div className="text-blue-600">
              {formatSignalStrength(currentNetwork.signal)}
            </div>
          </div>
        </div>
      )}

      {/* Master Device Actions */}
      <div className="flex space-x-2 mb-4">
        {!masterStatus?.isMaster && !masterDevice && (
          <button
            onClick={handlePromoteToMaster}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            👑 Become Master Hub
          </button>
        )}

        {!masterStatus?.isMaster &&
          masterDevice &&
          !masterStatus?.isConnected && (
            <button
              onClick={handleConnectToMaster}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔗 Connect to Master
            </button>
          )}

        {masterStatus?.isMaster && (
          <button
            onClick={() => webMasterDeviceManager.restartServer()}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            🔄 Restart Server
          </button>
        )}
      </div>

      {/* Expanded Device List */}
      {isExpanded && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 flex items-center">
            📱 Discovered Devices
            {devices.length === 0 && (
              <span className="ml-2 text-sm text-gray-500">(Scanning...)</span>
            )}
          </h4>

          {devices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <div>Scanning for POS devices...</div>
              <div className="text-sm mt-1">
                Make sure you're connected to the POS network
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Master Device */}
              {masterDevice && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">👑</span>
                      <div>
                        <div className="font-medium text-purple-900">
                          {masterDevice.name}
                        </div>
                        <div className="text-sm text-purple-700">
                          {masterDevice.ip}:{masterDevice.port} • Master Hub
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-purple-600">
                        {formatSignalStrength(masterDevice.signal)}
                      </div>
                      <div className="text-xs text-purple-500">
                        {formatLastSeen(masterDevice.lastSeen)}
                      </div>
                    </div>
                  </div>
                  {masterStatus?.isMaster && (
                    <div className="mt-2 pt-2 border-t border-purple-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-purple-700">Server Status:</span>
                        <span
                          className={
                            masterStatus.serverRunning
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {masterStatus.serverRunning
                            ? '🟢 Running'
                            : '🔴 Stopped'}
                        </span>
                      </div>
                      {masterStatus.lastSync && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-purple-700">Last Sync:</span>
                          <span className="text-purple-600">
                            {formatLastSeen(masterStatus.lastSync)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Terminal Devices */}
              {terminalDevices.map((device) => (
                <div
                  key={device.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">💻</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {device.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {device.ip}:{device.port} • Terminal
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        {formatSignalStrength(device.signal)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatLastSeen(device.lastSeen)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Network Details */}
          {currentNetwork && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">
                📡 Network Details
              </h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">SSID:</span>
                  <span className="ml-2 text-gray-900">
                    {currentNetwork.ssid}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Security:</span>
                  <span className="ml-2 text-gray-900">
                    {currentNetwork.security}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Signal:</span>
                  <span className="ml-2 text-gray-900">
                    {currentNetwork.signal}%
                  </span>
                </div>
                {currentNetwork.frequency && (
                  <div>
                    <span className="text-gray-600">Frequency:</span>
                    <span className="ml-2 text-gray-900">
                      {currentNetwork.frequency} MHz
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkStatus;

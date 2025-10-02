import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Server,
  Wifi,
  WifiOff,
  Users,
  ShoppingCart,
  ChefHat,
  Wine,
  Settings,
  Power,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { webMasterDeviceManager } from '../services/webMasterDeviceManager';
import NetworkStatus from './NetworkStatus';
import POS from './POS';

interface DashboardProps {
  deviceType: 'normal' | 'master';
  tenantId: string;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  deviceType,
  tenantId,
  onLogout,
}) => {
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'pos' | 'kitchen' | 'bar'
  >('dashboard');
  const [serverStatus, setServerStatus] = useState({
    isRunning: false,
    ip: null as string | null,
    port: 3000,
    connectedDevices: 0,
  });
  const [isMasterDevice, setIsMasterDevice] = useState(false);

  useEffect(() => {
    loadMasterStatus();

    // Update status every 5 seconds
    const interval = setInterval(loadMasterStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadMasterStatus = async () => {
    const status = webMasterDeviceManager.getStatus();
    setIsMasterDevice(status.isMaster);

    if (status.isMaster) {
      setServerStatus({
        isRunning: status.serverRunning,
        ip: 'localhost',
        port: 3001,
        connectedDevices: status.deviceCount,
      });
    }
  };

  const handleStopMasterMode = async () => {
    if (
      confirm(
        'Are you sure you want to stop master mode? Other devices will lose connection.'
      )
    ) {
      await webMasterDeviceManager.stopMasterDevice();
      await loadMasterStatus();
    }
  };

  const simulateDeviceConnection = (deviceType: 'kds' | 'bds' | 'pos') => {
    // For now, just simulate by updating status
    console.log(`Simulating ${deviceType} device connection`);

    // Update status after simulation
    setTimeout(loadMasterStatus, 500);
  };

  // Handle view rendering
  if (currentView !== 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header for other views */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mr-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </button>
                <div
                  className={`rounded-full w-8 h-8 flex items-center justify-center mr-3 ${
                    isMasterDevice ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                >
                  {isMasterDevice ? (
                    <Server className="text-white w-4 h-4" />
                  ) : (
                    <Monitor className="text-white w-4 h-4" />
                  )}
                </div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {currentView === 'pos' && 'Point of Sale'}
                  {currentView === 'kitchen' && 'Kitchen Display'}
                  {currentView === 'bar' && 'Bar Display'}
                </h1>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900"
              >
                <Power className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* View Content */}
        {currentView === 'pos' && <POS />}
        {currentView === 'kitchen' && (
          <div className="p-8 text-center">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Kitchen Display
            </h2>
            <p className="text-gray-600">
              Kitchen order management will be implemented here
            </p>
          </div>
        )}
        {currentView === 'bar' && (
          <div className="p-8 text-center">
            <Wine className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Bar Display
            </h2>
            <p className="text-gray-600">
              Bar order management will be implemented here
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div
                className={`
                rounded-full w-8 h-8 flex items-center justify-center mr-3
                ${isMasterDevice ? 'bg-green-600' : 'bg-blue-600'}
              `}
              >
                {isMasterDevice ? (
                  <Server className="text-white w-4 h-4" />
                ) : (
                  <Monitor className="text-white w-4 h-4" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Restaurant POS
                </h1>
                <p className="text-sm text-gray-600">
                  {isMasterDevice ? 'Master Device' : 'Normal Device'} •{' '}
                  {tenantId}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {isMasterDevice ? (
                  <div className="flex items-center text-green-600">
                    <Wifi className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Hub Active</span>
                  </div>
                ) : (
                  <div className="flex items-center text-blue-600">
                    <WifiOff className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                )}
              </div>

              <button
                onClick={onLogout}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Power className="w-4 h-4 mr-1" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Master Device Status */}
          {isMasterDevice && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Master Device Status
                  </h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={loadMasterStatus}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleStopMasterMode}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors"
                    >
                      Stop Master Mode
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Server Status */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Server Status</h3>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span
                          className={`font-medium ${
                            serverStatus.isRunning
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {serverStatus.isRunning ? 'Running' : 'Stopped'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600">IP Address:</span>
                        <span className="font-mono text-sm">
                          {serverStatus.ip || 'Detecting...'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600">Port:</span>
                        <span className="font-mono text-sm">
                          {serverStatus.port}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Connected Devices:
                        </span>
                        <span className="font-medium text-blue-600">
                          {serverStatus.connectedDevices}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connection Instructions */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">
                      Device Connection
                    </h3>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 mb-2">
                        Share this information with other devices:
                      </p>
                      <div className="font-mono text-sm bg-white rounded border p-2">
                        {serverStatus.ip
                          ? `${serverStatus.ip}:${serverStatus.port}`
                          : 'Detecting IP...'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Test Connections:
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => simulateDeviceConnection('kds')}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                        >
                          + KDS
                        </button>
                        <button
                          onClick={() => simulateDeviceConnection('bds')}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                        >
                          + BDS
                        </button>
                        <button
                          onClick={() => simulateDeviceConnection('pos')}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                        >
                          + POS
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* POS Functions */}
          <div className={isMasterDevice ? 'lg:col-span-1' : 'lg:col-span-3'}>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                POS Functions
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Main POS */}
                <button
                  onClick={() => setCurrentView('pos')}
                  className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="text-center">
                    <ShoppingCart className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                      POS Terminal
                    </span>
                  </div>
                </button>

                {/* Kitchen Display */}
                <button
                  onClick={() => setCurrentView('kitchen')}
                  className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="text-center">
                    <ChefHat className="w-8 h-8 text-gray-400 group-hover:text-green-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                      Kitchen Display
                    </span>
                  </div>
                </button>

                {/* Bar Display */}
                <button
                  onClick={() => setCurrentView('bar')}
                  className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
                >
                  <div className="text-center">
                    <Wine className="w-8 h-8 text-gray-400 group-hover:text-purple-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">
                      Bar Display
                    </span>
                  </div>
                </button>

                {/* Settings */}
                <button className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-all group">
                  <div className="text-center">
                    <Settings className="w-8 h-8 text-gray-400 group-hover:text-gray-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-700">
                      Settings
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Network Status (for normal devices) */}
          {!isMasterDevice && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  Network Status
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                      <Wifi className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-medium text-gray-900">Local Network</h3>
                    <p className="text-sm text-green-600">Connected</p>
                  </div>

                  <div className="text-center">
                    <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                      <Server className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-medium text-gray-900">Master Device</h3>
                    <p className="text-sm text-green-600">192.168.1.100:3001</p>
                  </div>

                  <div className="text-center">
                    <div className="bg-yellow-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-yellow-600" />
                    </div>
                    <h3 className="font-medium text-gray-900">Sync Status</h3>
                    <p className="text-sm text-yellow-600">Real-time</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

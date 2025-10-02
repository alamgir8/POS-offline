import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Wifi,
  WifiOff,
  Server,
  Users,
} from 'lucide-react';
import { webMasterDeviceManager } from '../services/webMasterDeviceManager';

interface LoginProps {
  onLogin: (deviceType: 'normal' | 'master', tenantId: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [tenantId, setTenantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<
    'normal' | 'master'
  >('normal');

  const handleLogin = async () => {
    if (!tenantId.trim()) {
      alert('Please enter a Restaurant ID');
      return;
    }

    setIsLoading(true);

    try {
      if (selectedDeviceType === 'master') {
        // Setup as master device
        const success = await webMasterDeviceManager.promoteMasterDevice(
          tenantId
        );

        if (success) {
          const status = webMasterDeviceManager.getServerStatus();
          console.log('✅ Master device setup successful:', status);

          // Show success message with connection details
          alert(
            `✅ Master Device Setup Complete!\n\n` +
              `🌐 Local Server: ${status.ip}:${status.port}\n` +
              `📱 Other devices can now connect to this hub\n\n` +
              `Share this IP with your team for offline sync.`
          );
        } else {
          alert('❌ Failed to setup master device. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      // Proceed with login
      onLogin(selectedDeviceType, tenantId);
    } catch (error) {
      console.error('Login failed:', error);
      alert('❌ Login failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Monitor className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Restaurant POS
          </h1>
          <p className="text-gray-600">Choose your device type</p>
        </div>

        {/* Device Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Device Type
          </label>

          <div className="grid grid-cols-1 gap-3">
            {/* Normal Device Option */}
            <div
              onClick={() => setSelectedDeviceType('normal')}
              className={`
                relative cursor-pointer rounded-lg border-2 p-4 transition-all
                ${
                  selectedDeviceType === 'normal'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <div
                  className={`
                  rounded-full w-10 h-10 flex items-center justify-center mr-3
                  ${
                    selectedDeviceType === 'normal'
                      ? 'bg-blue-600'
                      : 'bg-gray-400'
                  }
                `}
                >
                  <Smartphone className="text-white w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Normal Device</h3>
                  <p className="text-sm text-gray-600">
                    POS terminal, Kitchen Display, or Bar Display
                  </p>
                </div>
                {selectedDeviceType === 'normal' && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-blue-600 rounded-full w-4 h-4 flex items-center justify-center">
                      <div className="bg-white rounded-full w-2 h-2"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center text-sm text-gray-600">
                <WifiOff className="w-4 h-4 mr-1" />
                <span>Connects to local hub for offline sync</span>
              </div>
            </div>

            {/* Master Device Option */}
            <div
              onClick={() => setSelectedDeviceType('master')}
              className={`
                relative cursor-pointer rounded-lg border-2 p-4 transition-all
                ${
                  selectedDeviceType === 'master'
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <div
                  className={`
                  rounded-full w-10 h-10 flex items-center justify-center mr-3
                  ${
                    selectedDeviceType === 'master'
                      ? 'bg-green-600'
                      : 'bg-gray-400'
                  }
                `}
                >
                  <Server className="text-white w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Master Device</h3>
                  <p className="text-sm text-gray-600">
                    Becomes the local hub for offline operations
                  </p>
                </div>
                {selectedDeviceType === 'master' && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-green-600 rounded-full w-4 h-4 flex items-center justify-center">
                      <div className="bg-white rounded-full w-2 h-2"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center text-sm text-green-700">
                  <Wifi className="w-4 h-4 mr-1" />
                  <span>Acts as local server for other devices</span>
                </div>
                <div className="flex items-center text-sm text-green-700">
                  <Users className="w-4 h-4 mr-1" />
                  <span>Enables offline sync across all devices</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Master Device Info */}
        {selectedDeviceType === 'master' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">
                <span className="text-yellow-900 text-sm font-bold">!</span>
              </div>
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">
                  Master Device Setup
                </h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• This device will become the local server hub</li>
                  <li>
                    • Other devices will connect to this device for offline sync
                  </li>
                  <li>• Keep this device powered on and connected to WiFi</li>
                  <li>• Best suited for desktop/laptop computers</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Restaurant ID Input */}
        <div className="mb-6">
          <label
            htmlFor="tenantId"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Restaurant ID
          </label>
          <input
            type="text"
            id="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="
              w-full px-3 py-2 border border-gray-300 rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
            "
            placeholder="Enter your restaurant ID"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Contact your administrator if you don't have a Restaurant ID
          </p>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoading || !tenantId.trim()}
          className={`
            w-full py-3 px-4 rounded-lg font-semibold transition-all
            ${
              selectedDeviceType === 'master'
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }
            text-white focus:outline-none focus:ring-2 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {selectedDeviceType === 'master'
                ? 'Setting up Master Device...'
                : 'Connecting...'}
            </div>
          ) : (
            <>
              {selectedDeviceType === 'master'
                ? 'Setup Master Device & Login'
                : 'Login as Normal Device'}
            </>
          )}
        </button>

        {/* Footer */}
        <div className="text-center mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Offline-capable POS system with real-time sync
          </p>
        </div>
      </div>
    </div>
  );
};

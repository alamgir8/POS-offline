import React, { createContext, useContext, useState, useEffect } from 'react';
import { hybridSyncService } from '../services/hybridSync';

interface NetworkContextType {
  networkMode: 'online' | 'offline' | 'hybrid' | 'standalone';
  isLocalConnected: boolean;
  isCloudReachable: boolean;
  queueSize: number;
  manualSync: () => Promise<{
    synced: number;
    total: number;
    errors: string[];
  }>;
  refreshNetwork: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkMode, setNetworkMode] = useState<
    'online' | 'offline' | 'hybrid' | 'standalone'
  >('standalone');
  const [isLocalConnected, setIsLocalConnected] = useState(false);
  const [isCloudReachable, setIsCloudReachable] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    // Initialize hybrid sync
    initializeHybridSync();

    // Listen for network changes
    const handleNetworkEvent = (event: any) => {
      switch (event.type) {
        case 'MODE_CHANGE':
          setNetworkMode(event.newMode);
          updateConnectionStatus();
          break;
        case 'SYNC_COMPLETE':
          console.log(`✅ Sync complete: ${event.synced}/${event.total}`);
          updateConnectionStatus();
          break;
      }
    };

    hybridSyncService.addListener(handleNetworkEvent);

    // Periodic status update
    const statusInterval = setInterval(updateConnectionStatus, 10000);

    return () => {
      hybridSyncService.removeListener(handleNetworkEvent);
      clearInterval(statusInterval);
    };
  }, []);

  const initializeHybridSync = async () => {
    try {
      await hybridSyncService.initialize({
        cloudAPI: 'https://your-saas-api.com/api',
        tenantId: 'restaurant_123', // Get from user login
        deviceType: 'main_pos', // or 'kds', 'bds' based on device
      });
      updateConnectionStatus();
    } catch (error) {
      console.error('Failed to initialize hybrid sync:', error);
    }
  };

  const updateConnectionStatus = () => {
    const status = hybridSyncService.getConnectionStatus();
    setNetworkMode(status.networkMode);
    setIsLocalConnected(status.localConnected);
    setIsCloudReachable(status.cloudReachable);
    setQueueSize(status.queueSize);
  };

  const manualSync = async () => {
    try {
      return await hybridSyncService.manualSyncToCloud();
    } catch (error) {
      throw new Error(
        `Sync failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  };

  const refreshNetwork = async () => {
    await hybridSyncService.detectNetworkMode();
    updateConnectionStatus();
  };

  const value: NetworkContextType = {
    networkMode,
    isLocalConnected,
    isCloudReachable,
    queueSize,
    manualSync,
    refreshNetwork,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

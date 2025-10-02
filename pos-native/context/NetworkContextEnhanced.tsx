import React, { createContext, useContext, useState, useEffect } from "react";
import { Alert } from "react-native";
import { hybridSyncService } from "../pos-native/services/hybridSync";
import { masterDeviceManager } from "../pos-native/services/masterDeviceManager";

interface NetworkContextType {
  networkMode: "online" | "offline" | "hybrid" | "standalone";
  isLocalConnected: boolean;
  isCloudReachable: boolean;
  isMasterDevice: boolean;
  masterDeviceIP: string | null;
  queueSize: number;
  manualSync: () => Promise<void>;
  setupMasterDevice: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkMode, setNetworkMode] = useState<
    "online" | "offline" | "hybrid" | "standalone"
  >("standalone");
  const [isLocalConnected, setIsLocalConnected] = useState(false);
  const [isCloudReachable, setIsCloudReachable] = useState(false);
  const [isMasterDevice, setIsMasterDevice] = useState(false);
  const [masterDeviceIP, setMasterDeviceIP] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    initializeServices();

    // Listen for network changes
    const handleNetworkEvent = (event: any) => {
      switch (event.type) {
        case "MODE_CHANGE":
          setNetworkMode(event.newMode);
          handleNetworkModeChange(event.newMode);
          break;
        case "SYNC_COMPLETE":
          console.log(`✅ Sync complete: ${event.synced}/${event.total}`);
          updateConnectionStatus();
          break;
        case "INTERNET_DISCONNECTED":
          handleInternetDisconnection();
          break;
        case "MASTER_PROMOTED":
          setIsMasterDevice(true);
          setMasterDeviceIP(event.ip);
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

  const initializeServices = async () => {
    try {
      // Initialize hybrid sync service
      await hybridSyncService.initialize();

      // Check if this device is already configured as master
      const isMaster = await masterDeviceManager.isMasterDevice();
      setIsMasterDevice(isMaster);

      if (isMaster) {
        const masterIP = await masterDeviceManager.getMasterIP();
        setMasterDeviceIP(masterIP);
      }

      // Update initial status
      await updateConnectionStatus();
    } catch (error) {
      console.error("Failed to initialize services:", error);
    }
  };

  const handleNetworkModeChange = async (newMode: string) => {
    console.log(`🌐 Network mode changed to: ${newMode}`);

    if (newMode === "offline") {
      // Internet lost - check master device options
      await handleInternetDisconnection();
    }
  };

  const handleInternetDisconnection = async () => {
    console.log("📡 Internet disconnected - activating offline mode...");

    try {
      // Let master device manager handle the disconnection
      await masterDeviceManager.handleInternetDisconnection();

      // Update our state
      const isMaster = await masterDeviceManager.isMasterDevice();
      setIsMasterDevice(isMaster);

      if (isMaster) {
        const masterIP = await masterDeviceManager.getMasterIP();
        setMasterDeviceIP(masterIP);
      }
    } catch (error) {
      console.error("Failed to handle internet disconnection:", error);
    }
  };

  const updateConnectionStatus = async () => {
    try {
      // Get status from hybrid sync service
      const status = hybridSyncService.getConnectionStatus();

      setIsLocalConnected(status.localConnected || false);
      setIsCloudReachable(status.cloudReachable || false);
      setQueueSize(status.queueSize || 0);

      // Update master device status
      const isMaster = await masterDeviceManager.isMasterDevice();
      setIsMasterDevice(isMaster);
    } catch (error) {
      console.error("Failed to update connection status:", error);
    }
  };

  const manualSync = async () => {
    try {
      console.log("🔄 Starting manual sync...");
      await hybridSyncService.manualSyncToCloud();
      await updateConnectionStatus();
    } catch (error) {
      console.error("Manual sync failed:", error);
      Alert.alert(
        "Sync Failed",
        "Could not sync with cloud. Will retry automatically."
      );
    }
  };

  const setupMasterDevice = async () => {
    try {
      console.log("🚀 Setting up master device...");
      const success = await masterDeviceManager.promoteMasterDevice();

      if (success) {
        setIsMasterDevice(true);
        const masterIP = await masterDeviceManager.getMasterIP();
        setMasterDeviceIP(masterIP);
        await updateConnectionStatus();
      }
    } catch (error) {
      console.error("Failed to setup master device:", error);
      Alert.alert(
        "Setup Failed",
        "Could not setup master device. Please try again."
      );
    }
  };

  const refreshNetwork = async () => {
    try {
      console.log("🔄 Refreshing network status...");
      await hybridSyncService.detectNetworkMode();
      await updateConnectionStatus();
    } catch (error) {
      console.error("Failed to refresh network:", error);
    }
  };

  const value: NetworkContextType = {
    networkMode,
    isLocalConnected,
    isCloudReachable,
    isMasterDevice,
    masterDeviceIP,
    queueSize,
    manualSync,
    setupMasterDevice,
    refreshNetwork,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

// Network Status Component for debugging/admin
export function NetworkStatusDisplay() {
  const {
    networkMode,
    isLocalConnected,
    isCloudReachable,
    isMasterDevice,
    masterDeviceIP,
    queueSize,
    manualSync,
    setupMasterDevice,
    refreshNetwork,
  } = useNetwork();

  const getStatusColor = (status: boolean) =>
    status ? "text-green-600" : "text-red-600";
  const getModeColor = (mode: string) => {
    switch (mode) {
      case "online":
        return "text-green-600";
      case "hybrid":
        return "text-blue-600";
      case "offline":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-3">Network Status</h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Mode:</span>
          <span className={`font-semibold ${getModeColor(networkMode)}`}>
            {networkMode.toUpperCase()}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Cloud:</span>
          <span className={getStatusColor(isCloudReachable)}>
            {isCloudReachable ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Local:</span>
          <span className={getStatusColor(isLocalConnected)}>
            {isLocalConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Master Device:</span>
          <span className={getStatusColor(isMasterDevice)}>
            {isMasterDevice ? "Yes" : "No"}
          </span>
        </div>

        {masterDeviceIP && (
          <div className="flex justify-between">
            <span>Master IP:</span>
            <span className="font-mono text-sm">{masterDeviceIP}</span>
          </div>
        )}

        {queueSize > 0 && (
          <div className="flex justify-between">
            <span>Pending Sync:</span>
            <span className="text-orange-600">{queueSize} items</span>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <button
          onClick={refreshNetwork}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Refresh Network
        </button>

        {!isMasterDevice && !isLocalConnected && (
          <button
            onClick={setupMasterDevice}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            Setup as Master Device
          </button>
        )}

        {queueSize > 0 && (
          <button
            onClick={manualSync}
            className="w-full bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700"
          >
            Sync Now ({queueSize} items)
          </button>
        )}
      </div>
    </div>
  );
}

// Web-based Master Device Manager
export interface MasterDeviceConfig {
  isMaster: boolean;
  serverPort: number;
  serverIP?: string;
  tenantId: string;
  deviceCapabilities: {
    canRunServer: boolean;
    isDesktop: boolean;
    hasReliablePower: boolean;
    networkStability: 'high' | 'medium' | 'low';
  };
}

import {
  wifiDiscoveryService,
  type NetworkDevice,
} from './wifiDiscoveryService';

interface MasterDeviceStatus {
  isMaster: boolean;
  isConnected: boolean;
  deviceCount: number;
  lastSync: Date | null;
  serverRunning: boolean;
  networkStatus: 'connected' | 'disconnected' | 'searching';
  connectedDevices: NetworkDevice[];
}

interface ServerConfig {
  port: number;
  host: string;
  maxConnections: number;
  syncInterval: number;
}

class WebMasterDeviceManager {
  private status: MasterDeviceStatus = {
    isMaster: false,
    isConnected: false,
    deviceCount: 0,
    lastSync: null,
    serverRunning: false,
    networkStatus: 'disconnected',
    connectedDevices: [],
  };

  private serverConfig: ServerConfig = {
    port: 3001,
    host: '0.0.0.0',
    maxConnections: 50,
    syncInterval: 30000, // 30 seconds
  };

  private serviceWorker: ServiceWorker | null = null;
  private syncInterval: number | null = null;
  private statusCallbacks: Array<(status: MasterDeviceStatus) => void> = [];

  constructor() {
    this.initializeWiFiDiscovery();
    this.initializeServiceWorker();
  }

  private initializeWiFiDiscovery() {
    // Listen for device changes
    wifiDiscoveryService.onDevicesChanged((devices) => {
      this.status.connectedDevices = devices;
      this.status.deviceCount = devices.filter(
        (d) => d.type !== 'master'
      ).length;

      // Update network status
      const master = devices.find((d) => d.type === 'master');
      if (master) {
        this.status.networkStatus = 'connected';
        this.status.isConnected = true;
      } else {
        this.status.networkStatus = 'searching';
      }

      this.notifyStatusChange();
    });
  }

  private async initializeServiceWorker() {
    try {
      console.log('🔧 Initializing POS service worker...');

      if ('serviceWorker' in navigator) {
        // Register the service worker
        const registration = await navigator.serviceWorker.register(
          '/pos-server-sw.js',
          {
            scope: '/',
          }
        );

        console.log('✅ Service worker registered:', registration.scope);

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;

        // Get the active service worker
        this.serviceWorker = registration.active;

        if (this.serviceWorker) {
          console.log('✅ Service worker active and ready');

          // Set up message handling
          navigator.serviceWorker.addEventListener(
            'message',
            this.handleServiceWorkerMessage.bind(this)
          );
        }

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Service worker update found');
        });
      } else {
        console.warn('⚠️ Service workers not supported');
      }
    } catch (error) {
      console.error('❌ Service worker registration failed:', error);
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, data } = event.data;

    switch (type) {
      case 'SERVER_STATUS':
        this.status.serverRunning = data.running;
        this.notifyStatusChange();
        break;

      case 'DEVICE_CONNECTED':
        console.log('📱 Device connected:', data.device);
        this.updateDeviceStatus();
        break;

      case 'SYNC_COMPLETE':
        this.status.lastSync = new Date();
        this.notifyStatusChange();
        break;

      case 'ERROR':
        console.error('❌ Service worker error:', data.error);
        break;
    }
  }

  private sendMessageToServiceWorker(message: {
    type: string;
    config?: ServerConfig;
    device?: NetworkDevice;
    [key: string]: unknown;
  }) {
    if (this.serviceWorker) {
      this.serviceWorker.postMessage(message);
    }
  }

  public async promoteMasterDevice(): Promise<boolean> {
    try {
      console.log('👑 Promoting to master device...');

      // Set device type in WiFi discovery
      wifiDiscoveryService.setDeviceType('master');

      // Start the local server
      await this.startWebServer();

      // Update status
      this.status.isMaster = true;
      this.status.serverRunning = true;
      this.status.networkStatus = 'connected';

      // Start sync interval
      this.startSyncInterval();

      console.log('✅ Successfully promoted to master device');
      this.notifyStatusChange();

      return true;
    } catch (error) {
      console.error('❌ Failed to promote to master device:', error);
      return false;
    }
  }

  public async startWebServer(): Promise<boolean> {
    try {
      console.log(
        `🚀 Starting web server on port ${this.serverConfig.port}...`
      );

      // Send message to service worker to start server
      this.sendMessageToServiceWorker({
        type: 'START_SERVER',
        config: this.serverConfig,
      });

      // Simulate server startup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test server is running
      const isRunning = await this.testServerConnection();

      if (isRunning) {
        this.status.serverRunning = true;
        console.log('✅ Web server started successfully');

        // Announce server availability
        this.announceServerAvailability();

        this.notifyStatusChange();
        return true;
      } else {
        throw new Error('Server failed to start');
      }
    } catch (error) {
      console.error('❌ Failed to start web server:', error);
      this.status.serverRunning = false;
      this.notifyStatusChange();
      return false;
    }
  }

  private async testServerConnection(): Promise<boolean> {
    try {
      // Test the service worker API endpoints
      const response = await fetch('/api/health');
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Server connection test failed:', error);
      return false;
    }
  }

  private announceServerAvailability() {
    // Broadcast server availability to network
    console.log('� Announcing server availability to network...');

    // This will be handled by the WiFi discovery service
    wifiDiscoveryService.setDeviceType('master');
  }

  private startSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncWithDevices();
    }, this.serverConfig.syncInterval);

    // Initial sync
    this.syncWithDevices();
  }

  private async syncWithDevices() {
    try {
      console.log('🔄 Syncing with connected devices...');

      // Get connected devices from WiFi discovery
      const devices = wifiDiscoveryService.getDiscoveredDevices();
      const nonMasterDevices = devices.filter((d) => d.type !== 'master');

      // Sync inventory and orders with each device
      for (const device of nonMasterDevices) {
        await this.syncWithDevice(device);
      }

      this.status.lastSync = new Date();
      this.notifyStatusChange();

      console.log(`✅ Sync completed with ${nonMasterDevices.length} devices`);
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }

  private async syncWithDevice(device: NetworkDevice) {
    try {
      // Send sync message to service worker for this device
      this.sendMessageToServiceWorker({
        type: 'SYNC_DEVICE',
        device: device,
      });

      console.log(`� Synced with ${device.name}`);
    } catch (error) {
      console.warn(`⚠️ Failed to sync with ${device.name}:`, error);
    }
  }

  private updateDeviceStatus() {
    const devices = wifiDiscoveryService.getDiscoveredDevices();
    this.status.connectedDevices = devices;
    this.status.deviceCount = devices.filter((d) => d.type !== 'master').length;
    this.notifyStatusChange();
  }

  public async connectToMaster(): Promise<boolean> {
    try {
      console.log('🔍 Searching for master device...');

      // Use WiFi discovery to find and connect to master
      const connected = await wifiDiscoveryService.connectToMaster();

      if (connected) {
        this.status.isConnected = true;
        this.status.networkStatus = 'connected';
        console.log('✅ Connected to master device');
      } else {
        this.status.isConnected = false;
        this.status.networkStatus = 'searching';
        console.log('⚠️ No master device found');
      }

      this.notifyStatusChange();
      return connected;
    } catch (error) {
      console.error('❌ Failed to connect to master:', error);
      this.status.isConnected = false;
      this.status.networkStatus = 'disconnected';
      this.notifyStatusChange();
      return false;
    }
  }

  public onStatusChange(callback: (status: MasterDeviceStatus) => void) {
    this.statusCallbacks.push(callback);
    // Immediately call with current status
    callback(this.status);
  }

  private notifyStatusChange() {
    this.statusCallbacks.forEach((callback) => callback(this.status));
  }

  public getStatus(): MasterDeviceStatus {
    return { ...this.status };
  }

  public async stopMasterDevice(): Promise<boolean> {
    try {
      console.log('⏹️ Stopping master device...');

      // Stop sync interval
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      // Stop server
      this.sendMessageToServiceWorker({
        type: 'STOP_SERVER',
      });

      // Update status
      this.status.isMaster = false;
      this.status.serverRunning = false;

      // Set device type back to normal
      wifiDiscoveryService.setDeviceType('normal');

      console.log('✅ Master device stopped');
      this.notifyStatusChange();

      return true;
    } catch (error) {
      console.error('❌ Failed to stop master device:', error);
      return false;
    }
  }

  public getConnectedDevices(): NetworkDevice[] {
    return this.status.connectedDevices;
  }

  public async restartServer(): Promise<boolean> {
    console.log('🔄 Restarting server...');

    // Stop server first
    this.sendMessageToServiceWorker({
      type: 'STOP_SERVER',
    });

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start server again
    return await this.startWebServer();
  }

  public destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.statusCallbacks = [];

    // Clean up WiFi discovery
    wifiDiscoveryService.destroy();
  }

  // --- Compatibility helpers for older UI code ---
  // Some UI components expect these legacy methods. Keep thin wrappers here to avoid breaking changes.

  // Legacy: was used as `await isMasterDevice()`
  public async isMasterDevice(): Promise<boolean> {
    return this.status.isMaster;
  }

  // Legacy: UI expects server status object
  public getServerStatus(): {
    isRunning: boolean;
    ip: string | null;
    port: number;
    connectedDevices: number;
  } {
    return {
      isRunning: this.status.serverRunning,
      ip: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      port: this.serverConfig.port,
      connectedDevices: this.status.deviceCount,
    };
  }

  // Legacy: alias to stop master
  public async stopMasterMode(): Promise<boolean> {
    return this.stopMasterDevice();
  }

  // Legacy: demo helper – no-op other than logging
  public simulateDeviceConnection(deviceId: string, deviceType: 'kds' | 'bds' | 'pos'): void {
    console.log(`(simulate) device connected: ${deviceId} [${deviceType}]`);
  }
}

export const webMasterDeviceManager = new WebMasterDeviceManager();
export type { MasterDeviceStatus, NetworkDevice };

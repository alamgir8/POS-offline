// WiFi Discovery and Auto-Connection Service
interface NetworkDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'master' | 'normal';
  lastSeen: Date;
  signal?: number;
}

interface WiFiNetwork {
  ssid: string;
  security: string;
  signal: number;
  frequency?: number;
}

class WiFiDiscoveryService {
  private discoveredDevices = new Map<string, NetworkDevice>();
  private discoveryInterval: number | null = null;
  private broadcastInterval: number | null = null;
  private currentNetwork: WiFiNetwork | null = null;
  private callbacks: Array<(devices: NetworkDevice[]) => void> = [];

  // Auto-discovery configuration
  private readonly DISCOVERY_INTERVAL = 5000; // 5 seconds
  private readonly BROADCAST_INTERVAL = 3000; // 3 seconds
  private readonly DEVICE_TIMEOUT = 30000; // 30 seconds

  constructor() {
    this.initializeNetworkDiscovery();
  }

  private async initializeNetworkDiscovery() {
    // Simulate network detection
    console.log('🔍 Initializing network discovery...');

    // Auto-detect current network
    this.currentNetwork = await this.detectCurrentNetwork();
    console.log('📶 Current network:', this.currentNetwork?.ssid);

    // Start looking for POS devices
    this.startDeviceDiscovery();
  }

  private async detectCurrentNetwork(): Promise<WiFiNetwork | null> {
    try {
      // Simulate WiFi network detection
      // In a real implementation, this would use navigator.connection or similar APIs
      const simulatedNetworks: WiFiNetwork[] = [
        { ssid: 'RestaurantPOS_5GHz', security: 'WPA2', signal: 85 },
        { ssid: 'RestaurantPOS_2.4GHz', security: 'WPA2', signal: 78 },
        { ssid: 'Restaurant_Staff', security: 'WPA2', signal: 65 },
      ];

      // Auto-connect to the strongest POS network
      const posNetworks = simulatedNetworks.filter(
        (n) => n.ssid.includes('RestaurantPOS') || n.ssid.includes('POS')
      );

      if (posNetworks.length > 0) {
        const bestNetwork = posNetworks.reduce((best, current) =>
          current.signal > best.signal ? current : best
        );

        console.log(`🔗 Auto-connecting to: ${bestNetwork.ssid}`);
        return bestNetwork;
      }

      return simulatedNetworks[0]; // Fallback to any available network
    } catch (error) {
      console.warn('⚠️ WiFi detection failed:', error);
      return null;
    }
  }

  private startDeviceDiscovery() {
    // Start broadcasting our presence
    this.startBroadcasting();

    // Start listening for other devices
    this.startListening();

    // Clean up old devices periodically
    this.startCleanup();
  }

  private startBroadcasting() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    this.broadcastInterval = setInterval(() => {
      this.broadcastPresence();
    }, this.BROADCAST_INTERVAL);

    // Initial broadcast
    this.broadcastPresence();
  }

  private async broadcastPresence() {
    try {
      const deviceInfo = {
        id: this.getDeviceId(),
        name: this.getDeviceName(),
        type: this.getDeviceType(),
        timestamp: Date.now(),
        services: this.getAvailableServices(),
        network: this.currentNetwork?.ssid,
      };

      console.log('📡 Broadcasting device presence:', deviceInfo.name);

      // Simulate broadcasting to local network
      // In a real implementation, this would use WebRTC data channels or WebSocket broadcasting
      this.simulateNetworkBroadcast(deviceInfo);
    } catch (error) {
      console.warn('⚠️ Broadcast failed:', error);
    }
  }

  private startListening() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    this.discoveryInterval = setInterval(() => {
      this.discoverDevices();
    }, this.DISCOVERY_INTERVAL);

    // Initial discovery
    this.discoverDevices();
  }

  private async discoverDevices() {
    try {
      console.log('🔍 Scanning for POS devices...');

      // Simulate network scanning for POS devices
      const discoveredDevices = await this.simulateNetworkScan();

      // Update our device list
      discoveredDevices.forEach((device) => {
        this.discoveredDevices.set(device.id, {
          ...device,
          lastSeen: new Date(),
        });
      });

      // Notify listeners
      this.notifyDeviceListeners();
    } catch (error) {
      console.warn('⚠️ Device discovery failed:', error);
    }
  }

  private async simulateNetworkScan(): Promise<NetworkDevice[]> {
    // Simulate finding devices on the network
    const simulatedDevices: NetworkDevice[] = [
      {
        id: 'master-001',
        name: 'POS Master Hub',
        ip: '192.168.1.100',
        port: 3001,
        type: 'master',
        lastSeen: new Date(),
        signal: 95,
      },
      {
        id: 'terminal-002',
        name: 'Cashier Terminal 1',
        ip: '192.168.1.101',
        port: 3001,
        type: 'normal',
        lastSeen: new Date(),
        signal: 88,
      },
      {
        id: 'kitchen-003',
        name: 'Kitchen Display',
        ip: '192.168.1.102',
        port: 3001,
        type: 'normal',
        lastSeen: new Date(),
        signal: 82,
      },
    ];

    // Only return devices if we're on the right network
    if (this.currentNetwork?.ssid.includes('RestaurantPOS')) {
      return simulatedDevices;
    }

    return [];
  }

  private simulateNetworkBroadcast(deviceInfo: {
    id: string;
    name: string;
    type: 'master' | 'normal';
    timestamp: number;
    services: string[];
    network?: string;
  }) {
    // Simulate other devices receiving our broadcast
    // In a real implementation, this would use actual network protocols

    // Add ourselves to discovered devices if we're a master
    if (deviceInfo.type === 'master') {
      const selfDevice: NetworkDevice = {
        id: deviceInfo.id,
        name: deviceInfo.name,
        ip: '192.168.1.100',
        port: 3001,
        type: 'master',
        lastSeen: new Date(),
        signal: 100,
      };

      this.discoveredDevices.set(selfDevice.id, selfDevice);
      this.notifyDeviceListeners();
    }
  }

  private startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const devicesToRemove: string[] = [];

      this.discoveredDevices.forEach((device, id) => {
        if (now - device.lastSeen.getTime() > this.DEVICE_TIMEOUT) {
          devicesToRemove.push(id);
        }
      });

      devicesToRemove.forEach((id) => {
        console.log(
          `🗑️ Removing stale device: ${this.discoveredDevices.get(id)?.name}`
        );
        this.discoveredDevices.delete(id);
      });

      if (devicesToRemove.length > 0) {
        this.notifyDeviceListeners();
      }
    }, 10000); // Check every 10 seconds
  }

  private getDeviceId(): string {
    // Get or create persistent device ID
    let deviceId = localStorage.getItem('pos-device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem('pos-device-id', deviceId);
    }
    return deviceId;
  }

  private getDeviceName(): string {
    // Get device name from storage or generate one
    let deviceName = localStorage.getItem('pos-device-name');
    if (!deviceName) {
      const deviceType = this.getDeviceType();
      const randomId = Math.floor(Math.random() * 100);
      deviceName =
        deviceType === 'master'
          ? `Master Hub ${randomId}`
          : `Terminal ${randomId}`;
      localStorage.setItem('pos-device-name', deviceName);
    }
    return deviceName;
  }

  private getDeviceType(): 'master' | 'normal' {
    return (
      (localStorage.getItem('pos-device-type') as 'master' | 'normal') ||
      'normal'
    );
  }

  private getAvailableServices(): string[] {
    const deviceType = this.getDeviceType();
    if (deviceType === 'master') {
      return [
        'pos-server',
        'inventory-sync',
        'order-management',
        'device-discovery',
      ];
    }
    return ['pos-terminal', 'order-entry'];
  }

  private notifyDeviceListeners() {
    const devices = Array.from(this.discoveredDevices.values());
    this.callbacks.forEach((callback) => callback(devices));
  }

  // Public API
  public onDevicesChanged(callback: (devices: NetworkDevice[]) => void) {
    this.callbacks.push(callback);

    // Immediately call with current devices
    callback(Array.from(this.discoveredDevices.values()));
  }

  public getDiscoveredDevices(): NetworkDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  public getMasterDevice(): NetworkDevice | null {
    const devices = Array.from(this.discoveredDevices.values());
    return devices.find((device) => device.type === 'master') || null;
  }

  public getCurrentNetwork(): WiFiNetwork | null {
    return this.currentNetwork;
  }

  public async connectToMaster(): Promise<boolean> {
    const master = this.getMasterDevice();
    if (!master) {
      console.warn('⚠️ No master device found');
      return false;
    }

    try {
      console.log(
        `🔗 Connecting to master: ${master.name} (${master.ip}:${master.port})`
      );

      // Simulate connection to master
      const response = await fetch(
        `http://${master.ip}:${master.port}/api/health`
      );
      if (response.ok) {
        console.log('✅ Connected to master device');
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Failed to connect to master:', error);
    }

    return false;
  }

  public setDeviceType(type: 'master' | 'normal') {
    localStorage.setItem('pos-device-type', type);

    if (type === 'master') {
      // Start master services
      this.startMasterServices();
    } else {
      // Stop master services if running
      this.stopMasterServices();
    }

    // Restart broadcasting with new type
    this.startBroadcasting();
  }

  private startMasterServices() {
    console.log('🚀 Starting master device services...');
    // Master services will be handled by the webMasterDeviceManager
  }

  private stopMasterServices() {
    console.log('⏹️ Stopping master device services...');
  }

  public destroy() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.callbacks = [];
    this.discoveredDevices.clear();
  }
}

export const wifiDiscoveryService = new WiFiDiscoveryService();
export type { NetworkDevice, WiFiNetwork };

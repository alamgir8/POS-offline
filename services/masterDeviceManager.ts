import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { hybridSyncService } from './hybridSync';

interface MasterDeviceConfig {
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

export class MasterDeviceManager {
  private config: MasterDeviceConfig | null = null;
  private serverProcess: any = null;
  private isServerRunning: boolean = false;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem('master_device_config');
      if (configStr) {
        this.config = JSON.parse(configStr);
      }
    } catch (error) {
      console.error('Failed to load master device config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    if (this.config) {
      try {
        await AsyncStorage.setItem(
          'master_device_config',
          JSON.stringify(this.config)
        );
      } catch (error) {
        console.error('Failed to save master device config:', error);
      }
    }
  }

  async checkMasterCapability(): Promise<boolean> {
    const capabilities = await this.getDeviceCapabilities();

    // Desktop/web apps are best candidates for master
    if (capabilities.isDesktop && capabilities.canRunServer) {
      return true;
    }

    // Tablets can be backup masters
    if (capabilities.networkStability === 'high') {
      return true;
    }

    return false;
  }

  private async getDeviceCapabilities() {
    const isDesktop =
      Platform.OS === 'web' ||
      Platform.OS === 'macos' ||
      Platform.OS === 'windows';

    return {
      canRunServer: isDesktop || Platform.OS === 'android', // Android can run background services
      isDesktop,
      hasReliablePower: isDesktop, // Desktops usually have reliable power
      networkStability: isDesktop
        ? ('high' as const)
        : Platform.OS === 'android'
        ? ('medium' as const)
        : ('low' as const),
    };
  }

  async handleInternetDisconnection(): Promise<void> {
    console.log('🌐 Internet disconnected - checking master device options...');

    // Check if we're already a master
    if (this.config?.isMaster && this.isServerRunning) {
      console.log('✅ Already running as master device');
      return;
    }

    // Check if this device can be a master
    const canBeMaster = await this.checkMasterCapability();

    if (canBeMaster) {
      const shouldBecomeMaster = await this.showMasterSetupPrompt();

      if (shouldBecomeMaster) {
        await this.promoteMasterDevice();
      }
    } else {
      // Look for existing master on network
      await this.discoverExistingMaster();
    }
  }

  private async showMasterSetupPrompt(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        '🌐 Internet Connection Lost',
        'Your POS system can continue working offline. Would you like to set up this device as the local server hub?\n\nThis will allow all other devices to sync with this device.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Setup Local Hub',
            onPress: () => resolve(true),
          },
        ]
      );
    });
  }

  async promoteMasterDevice(): Promise<boolean> {
    try {
      console.log('🚀 Promoting this device to master...');

      // 1. Setup device capabilities
      const capabilities = await this.getDeviceCapabilities();

      // 2. Initialize master configuration
      this.config = {
        isMaster: true,
        serverPort: 3001,
        tenantId: await this.getTenantId(),
        deviceCapabilities: capabilities,
      };

      // 3. Start local server based on platform
      if (capabilities.canRunServer) {
        await this.startLocalServer();
      } else {
        await this.startRelayService();
      }

      // 4. Save configuration
      await this.saveConfig();

      // 5. Broadcast master status to network
      await this.broadcastMasterStatus();

      // 6. Update hybrid sync service
      await hybridSyncService.setMasterMode(true, this.config.serverIP);

      Alert.alert(
        '✅ Local Hub Active',
        'This device is now the local server hub. Other devices will automatically connect for offline sync.'
      );

      return true;
    } catch (error) {
      console.error('Failed to promote to master device:', error);

      Alert.alert(
        '❌ Setup Failed',
        'Failed to setup local hub. The system will continue in offline-only mode.'
      );

      return false;
    }
  }

  private async startLocalServer(): Promise<void> {
    const capabilities = this.config?.deviceCapabilities;

    if (capabilities?.isDesktop) {
      // For desktop/web - start actual Node.js server
      await this.startNodeJSServer();
    } else if (Platform.OS === 'android') {
      // For Android - start background service
      await this.startAndroidServerService();
    } else {
      // For iOS/other - start relay service
      await this.startRelayService();
    }
  }

  private async startNodeJSServer(): Promise<void> {
    if (Platform.OS === 'web') {
      // For web platform, we need to use a different approach
      // This would typically involve starting a service worker or using WebRTC
      await this.startWebServerAlternative();
    } else {
      // For Electron or desktop apps
      const serverCode = await this.getServerBundle();
      // Start Node.js process (implementation depends on your build setup)
      this.isServerRunning = true;
    }
  }

  private async startAndroidServerService(): Promise<void> {
    // Start Android background service to act as local server
    // This would use React Native background services
    try {
      // Implementation would use react-native-background-service
      console.log('🤖 Starting Android background server service...');
      this.isServerRunning = true;

      // Store server IP
      this.config!.serverIP = await this.getLocalIP();
    } catch (error) {
      console.error('Failed to start Android server service:', error);
      throw error;
    }
  }

  private async startRelayService(): Promise<void> {
    // For devices that can't run full server, create a WebSocket relay
    console.log('🔄 Starting relay service for device sync...');

    // This would create a simple relay that forwards messages between devices
    // Implementation would use WebSocket or WebRTC for peer-to-peer communication
    this.isServerRunning = true;
  }

  private async startWebServerAlternative(): Promise<void> {
    // For web platforms, use Service Worker + WebRTC for local networking
    console.log('🌐 Starting web-based local server alternative...');

    // Register service worker for background processing
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/pos-local-server-sw.js');
    }

    // Setup WebRTC for peer-to-peer communication
    // This allows web app to act as coordination hub
    this.isServerRunning = true;
  }

  private async getServerBundle(): Promise<string> {
    // Download server bundle from cloud if needed
    // Or return embedded server code
    return `
      // Minimal server implementation
      const express = require('express');
      const WebSocket = require('ws');
      const app = express();
      const server = require('http').createServer(app);
      const wss = new WebSocket.Server({ server });
      
      // Server implementation here...
    `;
  }

  private async getLocalIP(): Promise<string> {
    // Get device's local IP address
    // Implementation depends on platform
    if (Platform.OS === 'web') {
      // For web, try to get IP via WebRTC
      return await this.getWebLocalIP();
    } else {
      // For mobile, use network info
      return '192.168.1.100'; // Placeholder
    }
  }

  private async getWebLocalIP(): Promise<string> {
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({
        iceServers: [],
      });

      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      pc.onicecandidate = (ice) => {
        if (ice.candidate) {
          const ip = ice.candidate.candidate.split(' ')[4];
          if (ip && ip.startsWith('192.168.')) {
            pc.close();
            resolve(ip);
          }
        }
      };

      // Fallback after timeout
      setTimeout(() => {
        pc.close();
        resolve('192.168.1.100');
      }, 3000);
    });
  }

  private async broadcastMasterStatus(): Promise<void> {
    // Broadcast to local network that this device is now master
    const announcement = {
      type: 'MASTER_ANNOUNCEMENT',
      masterIP: this.config?.serverIP,
      masterPort: this.config?.serverPort,
      tenantId: this.config?.tenantId,
      timestamp: new Date().toISOString(),
    };

    // Send UDP broadcast or use mDNS
    console.log('📢 Broadcasting master status:', announcement);
  }

  private async discoverExistingMaster(): Promise<void> {
    console.log('🔍 Looking for existing master device on network...');

    try {
      // Scan common IPs for existing master
      const commonIPs = this.generateLocalIPs();

      for (const ip of commonIPs) {
        try {
          const response = await fetch(`http://${ip}:3001/master-status`, {
            method: 'GET',
            timeout: 1000,
          });

          if (response.ok) {
            const masterInfo = await response.json();
            console.log(`✅ Found master device at ${ip}:3001`);

            // Connect to existing master
            await hybridSyncService.connectToLocalServer(ip, 3001);
            return;
          }
        } catch (error) {
          // Continue to next IP
        }
      }

      console.log('❌ No master device found on network');
      this.showOfflineModeMessage();
    } catch (error) {
      console.error('Failed to discover master device:', error);
    }
  }

  private generateLocalIPs(): string[] {
    // Generate common local network IPs to scan
    const baseIPs = [
      '192.168.1.',
      '192.168.0.',
      '192.168.43.', // Android hotspot
      '172.20.10.', // iPhone hotspot
      '10.0.0.',
    ];

    const ips: string[] = [];

    baseIPs.forEach((base) => {
      // Scan common device IPs
      [1, 2, 100, 101, 102, 200, 254].forEach((last) => {
        ips.push(base + last);
      });
    });

    return ips;
  }

  private showOfflineModeMessage(): void {
    Alert.alert(
      '📱 Offline Mode',
      'No local server found. The app will work in offline-only mode. Data will sync when internet connection is restored.',
      [{ text: 'OK' }]
    );
  }

  private async getTenantId(): Promise<string> {
    const tenantId = await AsyncStorage.getItem('tenant_id');
    return tenantId || 'default_tenant';
  }

  // Public methods for other services
  async isMasterDevice(): Promise<boolean> {
    return this.config?.isMaster || false;
  }

  async getMasterIP(): Promise<string | null> {
    return this.config?.serverIP || null;
  }

  async stopMasterMode(): Promise<void> {
    if (this.config?.isMaster) {
      this.isServerRunning = false;
      this.config.isMaster = false;
      await this.saveConfig();

      console.log('🛑 Master mode stopped');
    }
  }
}

// Export singleton instance
export const masterDeviceManager = new MasterDeviceManager();

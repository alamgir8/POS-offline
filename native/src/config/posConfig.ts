// Environment Configuration for React Native POS
// Handles switching between local development and production modes

export interface PosConfig {
  serverPort: number;
  localServerIPs: string[];
  productionServerURL?: string;
  isProduction: boolean;
  autoDiscovery: boolean;
  reconnectAttempts: number;
  heartbeatInterval: number;
}

// Default configuration for development
const developmentConfig: PosConfig = {
  serverPort: 8080,
  localServerIPs: [
    '10.167.4.87:8080', // Current mobile hotspot IP
    '192.168.1.1:8080', // Common router IP
    '192.168.0.1:8080', // Common router IP
    '192.168.43.1:8080', // Android hotspot
    '172.20.10.1:8080', // iPhone hotspot
    '10.0.2.2:8080', // Android emulator
    'localhost:8080', // Local development
  ],
  isProduction: false,
  autoDiscovery: true,
  reconnectAttempts: 5,
  heartbeatInterval: 30000,
};

// Configuration for production
const productionConfig: PosConfig = {
  serverPort: 8080,
  localServerIPs: [], // Will be detected from network
  productionServerURL: undefined, // Should be set via environment or config
  isProduction: true,
  autoDiscovery: true,
  reconnectAttempts: 10,
  heartbeatInterval: 15000,
};

// Environment detection for React Native
function detectEnvironment(): 'development' | 'production' {
  // Check if we're in development mode
  if (__DEV__) {
    return 'development';
  }

  return 'production';
}

// Network detection helpers for React Native
export async function detectNetworkType(): Promise<
  'mobile-hotspot' | 'wifi-router' | 'cellular' | 'unknown'
> {
  try {
    // Import NetInfo dynamically to avoid issues during build
    const NetInfo = await import('@react-native-community/netinfo');
    const netInfo = await NetInfo.default.fetch();

    if (
      netInfo.type === 'wifi' &&
      netInfo.details &&
      'ipAddress' in netInfo.details
    ) {
      const ip = netInfo.details.ipAddress;

      if (ip?.startsWith('172.20.10.')) {
        return 'mobile-hotspot'; // iPhone hotspot
      } else if (
        ip?.startsWith('192.168.43.') ||
        ip?.startsWith('192.168.137.')
      ) {
        return 'mobile-hotspot'; // Android hotspot
      } else if (ip?.startsWith('192.168.') || ip?.startsWith('10.')) {
        return 'wifi-router';
      }
    } else if (netInfo.type === 'cellular') {
      return 'cellular';
    }
  } catch (error) {
    console.warn('Failed to detect network type:', error);
  }

  return 'unknown';
}

// Get current device IP for server discovery
export async function getCurrentDeviceIP(): Promise<string | null> {
  try {
    const NetInfo = await import('@react-native-community/netinfo');
    const netInfo = await NetInfo.default.fetch();

    if (
      netInfo.type === 'wifi' &&
      netInfo.details &&
      'ipAddress' in netInfo.details
    ) {
      return netInfo.details.ipAddress || null;
    }
  } catch (error) {
    console.warn('Failed to get device IP:', error);
  }

  return null;
}

// Generate potential server IPs based on device IP
export function generateServerIPs(deviceIP: string): string[] {
  const serverIPs: string[] = [];
  const port = '8080';

  if (deviceIP.startsWith('192.168.')) {
    // WiFi network - try common gateway IPs
    const networkPrefix = deviceIP.substring(0, deviceIP.lastIndexOf('.'));
    serverIPs.push(`${networkPrefix}.1:${port}`); // Common router IP
    serverIPs.push(`${networkPrefix}.254:${port}`); // Alternative router IP
  } else if (deviceIP.startsWith('172.20.10.')) {
    // iPhone hotspot
    serverIPs.push(`172.20.10.1:${port}`);
  } else if (deviceIP.startsWith('192.168.43.')) {
    // Android hotspot
    serverIPs.push(`192.168.43.1:${port}`);
  } else if (deviceIP.startsWith('10.')) {
    // Mobile hotspot or corporate network
    const networkPrefix = deviceIP.substring(0, deviceIP.lastIndexOf('.'));
    serverIPs.push(`${networkPrefix}.1:${port}`);
  }

  return serverIPs;
}

// Main configuration factory for React Native
export async function createPosConfig(): Promise<PosConfig> {
  const environment = detectEnvironment();
  const networkType = await detectNetworkType();
  const deviceIP = await getCurrentDeviceIP();

  console.log(`🔧 POS Environment: ${environment}`);
  console.log(`🌐 Network Type: ${networkType}`);
  console.log(`📱 Device IP: ${deviceIP}`);

  let serverIPs: string[] = [];

  if (deviceIP) {
    serverIPs = generateServerIPs(deviceIP);
    console.log(`📡 Generated Server IPs:`, serverIPs);
  }

  if (environment === 'production') {
    return {
      ...productionConfig,
      localServerIPs:
        serverIPs.length > 0 ? serverIPs : productionConfig.localServerIPs,
    };
  } else {
    return {
      ...developmentConfig,
      localServerIPs:
        serverIPs.length > 0
          ? [...serverIPs, ...developmentConfig.localServerIPs]
          : developmentConfig.localServerIPs,
    };
  }
}

// Utility functions
export function getServerURL(ip: string): string {
  return `ws://${ip}`;
}

export function getHealthCheckURL(ip: string): string {
  return `http://${ip}/health`;
}

export function getDiscoveryURL(ip: string): string {
  return `http://${ip}/discover`;
}

// Re-configure for different environment (useful for testing)
export function reconfigureForEnvironment(
  env: 'development' | 'production'
): PosConfig {
  if (env === 'production') {
    return { ...productionConfig };
  } else {
    return { ...developmentConfig };
  }
}

export default createPosConfig;

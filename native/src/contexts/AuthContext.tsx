import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthUser {
  userId: string;
  userName: string;
  email: string;
  tenantId: string;
  storeId: string;
  role: 'admin' | 'manager' | 'cashier' | 'server' | 'kitchen' | 'bar';
  permissions: string[];
}

interface AuthSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  tenantId: string;
  storeId: string;
  expiresAt: string;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, tenantId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const [userData, sessionData] = await Promise.all([
        AsyncStorage.getItem('pos_user'),
        AsyncStorage.getItem('pos_session'),
      ]);

      if (userData && sessionData) {
        const parsedUser = JSON.parse(userData);
        const parsedSession = JSON.parse(sessionData);

        // Check if session is still valid
        const expiresAt = new Date(parsedSession.expiresAt);
        if (expiresAt > new Date()) {
          setUser(parsedUser);
          setSession(parsedSession);
        } else {
          // Session expired, clear it
          await Promise.all([
            AsyncStorage.removeItem('pos_user'),
            AsyncStorage.removeItem('pos_session'),
          ]);
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    tenantId: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Demo user credentials
      const demoUsers = {
        demo: { password: 'demo', email: 'demo@pos.demo', tenantId: 'demo' },
        'admin@restaurant.demo': {
          password: 'password123',
          email: 'admin@restaurant.demo',
          tenantId: 'restaurant_demo',
        },
        'admin@retail.demo': {
          password: 'password123',
          email: 'admin@retail.demo',
          tenantId: 'retail_demo',
        },
        'cashier@restaurant.demo': {
          password: 'cashier123',
          email: 'cashier@restaurant.demo',
          tenantId: 'restaurant_demo',
        },
      };

      // Check demo credentials
      const demoUser = demoUsers[email as keyof typeof demoUsers];
      if (demoUser && demoUser.password === password) {
        let deviceId = await AsyncStorage.getItem('pos_device_id');
        if (!deviceId) {
          deviceId = `mobile_${Math.random().toString(36).slice(2, 10)}`;
          await AsyncStorage.setItem('pos_device_id', deviceId);
        }

        const mockUser: AuthUser = {
          userId: `user_${email.split('@')[0]}`,
          userName: email.split('@')[0].replace('.', ' ').toUpperCase(),
          email: email,
          tenantId: demoUser.tenantId,
          storeId: 'store_001',
          role: email.includes('admin') ? 'admin' : 'cashier',
          permissions: email.includes('admin')
            ? ['*']
            : ['orders.create', 'orders.update', 'orders.pay'],
        };

        const mockSession: AuthSession = {
          sessionId: `session_${Math.random().toString(36).slice(2, 10)}`,
          userId: mockUser.userId,
          deviceId: deviceId,
          tenantId: mockUser.tenantId,
          storeId: mockUser.storeId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        };

        setUser(mockUser);
        setSession(mockSession);

        // Store session for persistence
        await Promise.all([
          AsyncStorage.setItem('pos_user', JSON.stringify(mockUser)),
          AsyncStorage.setItem('pos_session', JSON.stringify(mockSession)),
        ]);

        return;
      }

      // If demo login fails, try hub server
      try {
        // Get or generate device ID
        let deviceId = await AsyncStorage.getItem('pos_device_id');
        if (!deviceId) {
          deviceId = `mobile_${Math.random().toString(36).slice(2, 10)}`;
          await AsyncStorage.setItem('pos_device_id', deviceId);
        }

        const hubUrl = 'http://localhost:4001'; // In production, this would be configurable
        const response = await fetch(`${hubUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            tenantId,
            deviceId,
            deviceName: `Mobile Client - ${deviceId}`,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setUser(result.data.user);
          setSession(result.data.session);

          // Store session for persistence
          await Promise.all([
            AsyncStorage.setItem('pos_user', JSON.stringify(result.data.user)),
            AsyncStorage.setItem(
              'pos_session',
              JSON.stringify(result.data.session)
            ),
          ]);
        } else {
          throw new Error(result.error || 'Login failed');
        }
      } catch (hubError) {
        throw new Error(
          'Invalid credentials. Use: demo/demo, admin@restaurant.demo/password123, or admin@retail.demo/password123'
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setSession(null);
      setError(null);

      await Promise.all([
        AsyncStorage.removeItem('pos_user'),
        AsyncStorage.removeItem('pos_session'),
      ]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

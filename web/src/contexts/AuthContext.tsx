// Enhanced authentication context for web app
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  removeFromLocalStorage,
} from "../utils";
import type { AuthUser, AuthSession } from "../types";

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  login: (email: string, password: string, tenantId: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for stored session on mount
  useEffect(() => {
    const storedSession = loadFromLocalStorage<AuthSession>("pos_session");
    const storedUser = loadFromLocalStorage<AuthUser>("pos_user");

    if (storedSession && storedUser) {
      // Check if session is still valid
      const expiresAt = new Date(storedSession.expiresAt);
      if (expiresAt > new Date()) {
        setSession(storedSession);
        setUser(storedUser);
        setIsAuthenticated(true);
      } else {
        // Session expired, clear it
        removeFromLocalStorage("pos_session");
        removeFromLocalStorage("pos_user");
      }
    }
  }, []);

  const login = async (email: string, password: string, tenantId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Demo user credentials
      const demoUsers = {
        demo: { password: "demo", email: "demo@pos.demo", tenantId: "demo" },
        "admin@restaurant.demo": {
          password: "password123",
          email: "admin@restaurant.demo",
          tenantId: "restaurant_demo",
        },
        "admin@retail.demo": {
          password: "password123",
          email: "admin@retail.demo",
          tenantId: "retail_demo",
        },
        "cashier@restaurant.demo": {
          password: "cashier123",
          email: "cashier@restaurant.demo",
          tenantId: "restaurant_demo",
        },
      };

      // Check demo credentials
      const demoUser = demoUsers[email as keyof typeof demoUsers];
      if (demoUser && demoUser.password === password) {
        const deviceId =
          loadFromLocalStorage<string>("pos_device_id") ||
          `web_${Math.random().toString(36).slice(2, 10)}`;

        saveToLocalStorage("pos_device_id", deviceId);

        const mockUser: AuthUser = {
          userId: `user_${email.split("@")[0]}`,
          userName: email.split("@")[0].replace(".", " ").toUpperCase(),
          email: email,
          tenantId: demoUser.tenantId,
          storeId: "store_001",
          role: email.includes("admin") ? "admin" : "cashier",
          permissions: email.includes("admin")
            ? ["*"]
            : ["orders.create", "orders.update", "orders.pay"],
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
        setIsAuthenticated(true);

        // Store session for persistence
        saveToLocalStorage("pos_user", mockUser);
        saveToLocalStorage("pos_session", mockSession);

        return;
      }

      // If demo login fails, try hub server
      try {
        const hubUrl =
          (import.meta as any).env?.VITE_HUB_URL || "http://localhost:4001";
        const deviceId =
          loadFromLocalStorage<string>("pos_device_id") ||
          `web_${Math.random().toString(36).slice(2, 10)}`;

        saveToLocalStorage("pos_device_id", deviceId);

        const response = await fetch(`${hubUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            tenantId,
            deviceId,
            deviceName: `Web Client - ${deviceId}`,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setUser(result.data.user);
          setSession(result.data.session);
          setIsAuthenticated(true);

          // Store session for persistence
          saveToLocalStorage("pos_user", result.data.user);
          saveToLocalStorage("pos_session", result.data.session);
        } else {
          throw new Error(result.error || "Login failed");
        }
      } catch (hubError) {
        throw new Error(
          "Invalid credentials. Use: demo/demo, admin@restaurant.demo/password123, or admin@retail.demo/password123"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setSession(null);
    setError(null);

    // Clear stored data
    removeFromLocalStorage("pos_user");
    removeFromLocalStorage("pos_session");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        session,
        login,
        logout,
        isLoading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

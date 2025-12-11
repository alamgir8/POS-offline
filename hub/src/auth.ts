// Authentication middleware and utilities for the hub

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import type {
  AuthUser,
  AuthSession,
  LoginRequest,
  AuthenticationResult,
} from "./types.js";

// In-memory stores (in production, use a proper database)
const users = new Map<string, AuthUser & { passwordHash: string }>();
const sessions = new Map<string, AuthSession>();

// Demo data for testing
const JWT_SECRET =
  process.env.JWT_SECRET || "demo-jwt-secret-change-in-production";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize demo users and tenants
 */
export function initializeAuth(): void {
  // Demo tenant: restaurant
  const restaurantUser: AuthUser & { passwordHash: string } = {
    userId: "user_restaurant_admin",
    userName: "Restaurant Admin",
    email: "admin@restaurant.demo",
    tenantId: "restaurant_demo",
    storeId: "store_001",
    tenantType: "restaurant",
    role: "admin",
    permissions: ["*"],
    passwordHash: bcrypt.hashSync("password123", 10),
  };

  // Demo tenant: retail
  const retailUser: AuthUser & { passwordHash: string } = {
    userId: "user_retail_admin",
    userName: "Retail Admin",
    email: "admin@retail.demo",
    tenantId: "retail_demo",
    storeId: "store_001",
    tenantType: "retail",
    role: "admin",
    permissions: ["*"],
    passwordHash: bcrypt.hashSync("password123", 10),
  };

  // Demo cashier for restaurant
  const cashierUser: AuthUser & { passwordHash: string } = {
    userId: "user_cashier_001",
    userName: "Cashier One",
    email: "cashier@restaurant.demo",
    tenantId: "restaurant_demo",
    storeId: "store_001",
    tenantType: "restaurant",
    role: "cashier",
    permissions: ["orders.create", "orders.update", "orders.pay"],
    passwordHash: bcrypt.hashSync("cashier123", 10),
  };

  users.set(restaurantUser.email, restaurantUser);
  users.set(retailUser.email, retailUser);
  users.set(cashierUser.email, cashierUser);

  console.log("Demo users initialized:");
  console.log("- Restaurant Admin: admin@restaurant.demo / password123");
  console.log("- Retail Admin: admin@retail.demo / password123");
  console.log("- Cashier: cashier@restaurant.demo / cashier123");
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  loginRequest: LoginRequest
): Promise<AuthenticationResult> {
  const { email, password, tenantId, deviceId, deviceName } = loginRequest;

  // Find user by email
  const user = users.get(email);
  if (!user) {
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Verify tenant access
  if (user.tenantId !== tenantId) {
    return {
      success: false,
      error: "Access denied for this tenant",
    };
  }

  // Create session
  const session: AuthSession = {
    sessionId: uuid(),
    userId: user.userId,
    deviceId,
    tenantId: user.tenantId,
    storeId: user.storeId,
    expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    createdAt: new Date().toISOString(),
  };

  sessions.set(session.sessionId, session);

  // Remove password hash from user object
  const { passwordHash, ...safeUser } = user;

  console.log(
    `User authenticated: ${user.userName} (${user.email}) on device ${deviceName}`
  );

  return {
    success: true,
    user: safeUser,
    session,
  };
}

/**
 * Validate session token
 */
export function validateSession(sessionId: string): AuthUser | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  // Check if session is expired
  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(sessionId);
    return null;
  }

  // Get user details
  const user = Array.from(users.values()).find(
    (u) => u.userId === session.userId
  );
  if (!user) {
    sessions.delete(sessionId);
    return null;
  }

  // Remove password hash from user object
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Generate JWT token for session
 */
export function generateJWT(session: AuthSession): string {
  return jwt.sign(
    {
      sessionId: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      storeId: session.storeId,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

/**
 * Verify JWT token
 */
export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Create a new user (admin function)
 */
export async function createUser(
  email: string,
  password: string,
  userName: string,
  tenantId: string,
  storeId: string,
  role: AuthUser["role"]
): Promise<AuthUser> {
  if (users.has(email)) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: AuthUser & { passwordHash: string } = {
    userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userName,
    email,
    tenantId,
    storeId,
    role,
    permissions: getDefaultPermissions(role),
    passwordHash,
  };

  users.set(email, user);

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Get default permissions for a role
 */
function getDefaultPermissions(role: AuthUser["role"]): string[] {
  switch (role) {
    case "admin":
      return ["*"];
    case "manager":
      return ["orders.*", "products.*", "users.read", "reports.*"];
    case "cashier":
      return ["orders.create", "orders.update", "orders.pay", "products.read"];
    case "server":
      return ["orders.create", "orders.update", "orders.park", "orders.repark"];
    case "kitchen":
      return ["kds.*", "orders.read"];
    case "bar":
      return ["bds.*", "orders.read"];
    default:
      return ["orders.read"];
  }
}

/**
 * Logout user (invalidate session)
 */
export function logout(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * Get all active sessions (admin function)
 */
export function getActiveSessions(): AuthSession[] {
  const now = new Date();
  const activeSessions = Array.from(sessions.values()).filter(
    (session) => new Date(session.expiresAt) > now
  );
  return activeSessions;
}

/**
 * Cleanup expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let removedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (new Date(session.expiresAt) <= now) {
      sessions.delete(sessionId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired sessions`);
  }

  return removedCount;
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

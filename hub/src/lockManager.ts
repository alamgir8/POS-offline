// Lock Manager for distributed order locking across devices
// Prevents same parked order from being opened on multiple devices simultaneously

export interface OrderLock {
  orderId: string;
  deviceId: string;
  userId: string;
  userName: string;
  tenantId: string;
  storeId: string;
  acquiredAt: Date;
  expiresAt: Date;
  renewCount: number;
}

export interface LockResult {
  success: boolean;
  lock?: OrderLock;
  error?: string;
  currentHolder?: {
    deviceId: string;
    userName: string;
    acquiredAt: Date;
  };
}

export class LockManager {
  private locks: Map<string, OrderLock> = new Map(); // orderId -> lock
  private lockTimeoutMs: number = 5 * 60 * 1000; // 5 minutes default
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(lockTimeoutMs: number = 5 * 60 * 1000) {
    this.lockTimeoutMs = lockTimeoutMs;
    // Start cleanup interval to remove expired locks
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000); // Check every 30 seconds
  }

  /**
   * Create a unique lock key for tenant/store/order isolation
   */
  private getLockKey(
    tenantId: string,
    storeId: string,
    orderId: string
  ): string {
    return `${tenantId}:${storeId}:${orderId}`;
  }

  /**
   * Attempt to acquire a lock on an order
   */
  acquireLock(
    orderId: string,
    deviceId: string,
    userId: string,
    userName: string,
    tenantId: string,
    storeId: string
  ): LockResult {
    const lockKey = this.getLockKey(tenantId, storeId, orderId);
    const existingLock = this.locks.get(lockKey);

    // Check if lock exists and is still valid
    if (existingLock) {
      const now = new Date();

      // If lock is expired, remove it
      if (existingLock.expiresAt < now) {
        console.log(`🔓 Lock expired for order ${orderId}, releasing...`);
        this.locks.delete(lockKey);
      } else if (existingLock.deviceId !== deviceId) {
        // Lock held by another device
        console.log(
          `🔒 Order ${orderId} is locked by device ${existingLock.deviceId}`
        );
        return {
          success: false,
          error: "ORDER_LOCKED",
          currentHolder: {
            deviceId: existingLock.deviceId,
            userName: existingLock.userName,
            acquiredAt: existingLock.acquiredAt,
          },
        };
      } else {
        // Same device already holds the lock, renew it
        existingLock.expiresAt = new Date(Date.now() + this.lockTimeoutMs);
        existingLock.renewCount += 1;
        console.log(
          `🔄 Lock renewed for order ${orderId} by device ${deviceId}`
        );
        return {
          success: true,
          lock: existingLock,
        };
      }
    }

    // Create new lock
    const lock: OrderLock = {
      orderId,
      deviceId,
      userId,
      userName,
      tenantId,
      storeId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + this.lockTimeoutMs),
      renewCount: 0,
    };

    this.locks.set(lockKey, lock);
    console.log(
      `🔒 Lock acquired for order ${orderId} by device ${deviceId} (${userName})`
    );

    return {
      success: true,
      lock,
    };
  }

  /**
   * Renew an existing lock
   */
  renewLock(
    orderId: string,
    deviceId: string,
    tenantId: string,
    storeId: string
  ): LockResult {
    const lockKey = this.getLockKey(tenantId, storeId, orderId);
    const existingLock = this.locks.get(lockKey);

    if (!existingLock) {
      return {
        success: false,
        error: "LOCK_NOT_FOUND",
      };
    }

    if (existingLock.deviceId !== deviceId) {
      return {
        success: false,
        error: "LOCK_OWNED_BY_ANOTHER_DEVICE",
        currentHolder: {
          deviceId: existingLock.deviceId,
          userName: existingLock.userName,
          acquiredAt: existingLock.acquiredAt,
        },
      };
    }

    existingLock.expiresAt = new Date(Date.now() + this.lockTimeoutMs);
    existingLock.renewCount += 1;
    console.log(
      `🔄 Lock renewed for order ${orderId} (renewal #${existingLock.renewCount})`
    );

    return {
      success: true,
      lock: existingLock,
    };
  }

  /**
   * Release a lock on an order
   */
  releaseLock(
    orderId: string,
    deviceId: string,
    tenantId: string,
    storeId: string
  ): LockResult {
    const lockKey = this.getLockKey(tenantId, storeId, orderId);
    const existingLock = this.locks.get(lockKey);

    if (!existingLock) {
      return {
        success: true, // Lock doesn't exist, consider it released
      };
    }

    if (existingLock.deviceId !== deviceId) {
      return {
        success: false,
        error: "LOCK_OWNED_BY_ANOTHER_DEVICE",
        currentHolder: {
          deviceId: existingLock.deviceId,
          userName: existingLock.userName,
          acquiredAt: existingLock.acquiredAt,
        },
      };
    }

    this.locks.delete(lockKey);
    console.log(`🔓 Lock released for order ${orderId} by device ${deviceId}`);

    return {
      success: true,
    };
  }

  /**
   * Force release a lock (admin action or device disconnect)
   */
  forceReleaseLock(orderId: string, tenantId: string, storeId: string): void {
    const lockKey = this.getLockKey(tenantId, storeId, orderId);
    const existingLock = this.locks.get(lockKey);

    if (existingLock) {
      this.locks.delete(lockKey);
      console.log(`🔓 Lock force-released for order ${orderId}`);
    }
  }

  /**
   * Release all locks held by a specific device (called on disconnect)
   */
  releaseDeviceLocks(deviceId: string): OrderLock[] {
    const releasedLocks: OrderLock[] = [];

    for (const [lockKey, lock] of this.locks.entries()) {
      if (lock.deviceId === deviceId) {
        this.locks.delete(lockKey);
        releasedLocks.push(lock);
        console.log(
          `🔓 Lock released for order ${lock.orderId} (device ${deviceId} disconnected)`
        );
      }
    }

    return releasedLocks;
  }

  /**
   * Get lock status for an order
   */
  getLockStatus(
    orderId: string,
    tenantId: string,
    storeId: string
  ): OrderLock | null {
    const lockKey = this.getLockKey(tenantId, storeId, orderId);
    const lock = this.locks.get(lockKey);

    if (lock && lock.expiresAt > new Date()) {
      return lock;
    }

    // Lock expired or doesn't exist
    if (lock) {
      this.locks.delete(lockKey);
    }
    return null;
  }

  /**
   * Get all active locks for a tenant/store
   */
  getActiveLocks(tenantId: string, storeId: string): OrderLock[] {
    const now = new Date();
    const activeLocks: OrderLock[] = [];

    for (const lock of this.locks.values()) {
      if (
        lock.tenantId === tenantId &&
        lock.storeId === storeId &&
        lock.expiresAt > now
      ) {
        activeLocks.push(lock);
      }
    }

    return activeLocks;
  }

  /**
   * Get all locks held by a specific device
   */
  getDeviceLocks(deviceId: string): OrderLock[] {
    const now = new Date();
    const deviceLocks: OrderLock[] = [];

    for (const lock of this.locks.values()) {
      if (lock.deviceId === deviceId && lock.expiresAt > now) {
        deviceLocks.push(lock);
      }
    }

    return deviceLocks;
  }

  /**
   * Cleanup expired locks
   */
  private cleanup(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [lockKey, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(lockKey);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired locks`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLocks: number;
    locksByTenant: Record<string, number>;
    locksByDevice: Record<string, number>;
  } {
    const locksByTenant: Record<string, number> = {};
    const locksByDevice: Record<string, number> = {};

    for (const lock of this.locks.values()) {
      locksByTenant[lock.tenantId] = (locksByTenant[lock.tenantId] || 0) + 1;
      locksByDevice[lock.deviceId] = (locksByDevice[lock.deviceId] || 0) + 1;
    }

    return {
      totalLocks: this.locks.size,
      locksByTenant,
      locksByDevice,
    };
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.locks.clear();
  }
}

/**
 * Session Tracking - automatic sessionId generation with timeout
 */

import type { SessionConfig, SessionOption } from '../types/index.js';

// Re-export types from canonical source
export type { SessionConfig, SessionOption };

interface Session {
  id: string;
  startedAt: number;
  lastActivity: number;
}

const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'svoose_session';

export interface SessionManager {
  /** Get current session ID (creates new session if expired) */
  getSessionId: () => string;
  /** Force create a new session */
  reset: () => string;
  /** Destroy session manager and clear storage */
  destroy: () => void;
}

/**
 * Generate a unique session ID
 * Format: timestamp-randomString (e.g., "1706123456789-abc123def")
 */
function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 11);
  return `${timestamp}-${random}`;
}

/**
 * Create a session manager
 *
 * @param config - Session configuration (true = defaults, false = disabled)
 * @returns SessionManager or null if disabled
 *
 * @example
 * // Enable with defaults
 * const session = createSessionManager(true);
 * session?.getSessionId(); // "1706123456789-abc123def"
 *
 * @example
 * // Custom config
 * const session = createSessionManager({
 *   timeout: 60 * 60 * 1000, // 1 hour
 *   storage: 'localStorage',
 * });
 */
export function createSessionManager(config: SessionOption): SessionManager | null {
  // Disabled
  if (config === false) return null;

  // Normalize config
  const opts: SessionConfig = config === true
    ? { timeout: DEFAULT_TIMEOUT, storage: 'sessionStorage' }
    : {
        timeout: config.timeout ?? DEFAULT_TIMEOUT,
        storage: config.storage ?? 'sessionStorage',
      };

  let currentSession: Session | null = null;

  /**
   * Get storage instance (with SSR and private mode safety)
   */
  function getStorage(): Storage | null {
    if (opts.storage === 'memory') return null;
    if (typeof window === 'undefined') return null;

    try {
      const storage = opts.storage === 'localStorage' ? localStorage : sessionStorage;
      // Test if storage is available (throws in private mode on some browsers)
      const testKey = '__svoose_test__';
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    } catch {
      return null;
    }
  }

  /**
   * Load session from storage
   */
  function load(): Session | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
      const data = storage.getItem(STORAGE_KEY);
      if (!data) return null;

      const session = JSON.parse(data) as Session;

      // Validate session structure
      if (
        typeof session.id !== 'string' ||
        typeof session.startedAt !== 'number' ||
        typeof session.lastActivity !== 'number'
      ) {
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Save session to storage
   */
  function save(session: Session): void {
    const storage = getStorage();
    if (!storage) return;

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Quota exceeded - fail silently
    }
  }

  /**
   * Create a new session
   */
  function createNew(): Session {
    const now = Date.now();
    const session: Session = {
      id: generateId(),
      startedAt: now,
      lastActivity: now,
    };
    save(session);
    return session;
  }

  /**
   * Check if session is expired
   */
  function isExpired(session: Session): boolean {
    const now = Date.now();
    return now - session.lastActivity > opts.timeout;
  }

  return {
    getSessionId(): string {
      const now = Date.now();

      // Try to load from storage if not in memory
      if (!currentSession) {
        currentSession = load();
      }

      // Create new session if none exists or expired
      if (!currentSession || isExpired(currentSession)) {
        currentSession = createNew();
        return currentSession.id;
      }

      // Update last activity
      currentSession.lastActivity = now;
      save(currentSession);
      return currentSession.id;
    },

    reset(): string {
      currentSession = createNew();
      return currentSession.id;
    },

    destroy(): void {
      currentSession = null;
      const storage = getStorage();
      if (storage) {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore errors
        }
      }
    },
  };
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSessionManager } from '../src/observe/session';

describe('Session Tracking', () => {
  beforeEach(() => {
    // Clear storage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createSessionManager', () => {
    it('should return null when disabled (false)', () => {
      const manager = createSessionManager(false);
      expect(manager).toBeNull();
    });

    it('should create manager when enabled (true)', () => {
      const manager = createSessionManager(true);
      expect(manager).not.toBeNull();
      expect(manager?.getSessionId).toBeDefined();
      expect(manager?.reset).toBeDefined();
      expect(manager?.destroy).toBeDefined();
    });

    it('should create manager with custom config', () => {
      const manager = createSessionManager({
        timeout: 60 * 60 * 1000, // 1 hour
        storage: 'localStorage',
      });
      expect(manager).not.toBeNull();
    });
  });

  describe('getSessionId', () => {
    it('should generate a session ID', () => {
      const manager = createSessionManager(true);
      const sessionId = manager!.getSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(10);
    });

    it('should return same session ID within timeout', () => {
      const manager = createSessionManager(true);
      const id1 = manager!.getSessionId();

      // Advance time by 5 minutes (within default 30 min timeout)
      vi.advanceTimersByTime(5 * 60 * 1000);

      const id2 = manager!.getSessionId();
      expect(id2).toBe(id1);
    });

    it('should generate new session ID after timeout', () => {
      const manager = createSessionManager({
        timeout: 10 * 60 * 1000, // 10 minutes
        storage: 'memory',
      });
      const id1 = manager!.getSessionId();

      // Advance time past timeout
      vi.advanceTimersByTime(11 * 60 * 1000);

      const id2 = manager!.getSessionId();
      expect(id2).not.toBe(id1);
    });

    it('should have format: timestamp-randomString', () => {
      const manager = createSessionManager({ storage: 'memory' });
      const sessionId = manager!.getSessionId();

      const parts = sessionId.split('-');
      expect(parts.length).toBe(2);

      // First part should be a timestamp
      const timestamp = parseInt(parts[0], 10);
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());

      // Second part should be alphanumeric
      expect(parts[1]).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('reset', () => {
    it('should generate a new session ID', () => {
      const manager = createSessionManager({ storage: 'memory' });
      const id1 = manager!.getSessionId();
      const id2 = manager!.reset();

      expect(id2).not.toBe(id1);
    });

    it('should persist new session after reset', () => {
      const manager = createSessionManager({ storage: 'memory' });
      manager!.getSessionId();
      const resetId = manager!.reset();
      const currentId = manager!.getSessionId();

      expect(currentId).toBe(resetId);
    });
  });

  describe('destroy', () => {
    it('should clear session from memory', () => {
      const manager = createSessionManager({ storage: 'memory' });
      const id1 = manager!.getSessionId();
      manager!.destroy();

      // Create new manager - should get new session
      const manager2 = createSessionManager({ storage: 'memory' });
      const id2 = manager2!.getSessionId();

      expect(id2).not.toBe(id1);
    });

    it('should clear session from sessionStorage', () => {
      const manager = createSessionManager({
        storage: 'sessionStorage',
      });
      manager!.getSessionId();

      expect(sessionStorage.getItem('svoose_session')).not.toBeNull();

      manager!.destroy();

      expect(sessionStorage.getItem('svoose_session')).toBeNull();
    });

    it('should clear session from localStorage', () => {
      const manager = createSessionManager({
        storage: 'localStorage',
      });
      manager!.getSessionId();

      expect(localStorage.getItem('svoose_session')).not.toBeNull();

      manager!.destroy();

      expect(localStorage.getItem('svoose_session')).toBeNull();
    });
  });

  describe('storage persistence', () => {
    it('should persist session in sessionStorage', () => {
      const manager1 = createSessionManager({
        storage: 'sessionStorage',
      });
      const id1 = manager1!.getSessionId();

      // Simulate page refresh - create new manager
      const manager2 = createSessionManager({
        storage: 'sessionStorage',
      });
      const id2 = manager2!.getSessionId();

      expect(id2).toBe(id1);
    });

    it('should persist session in localStorage', () => {
      const manager1 = createSessionManager({
        storage: 'localStorage',
      });
      const id1 = manager1!.getSessionId();

      // Simulate new tab - create new manager
      const manager2 = createSessionManager({
        storage: 'localStorage',
      });
      const id2 = manager2!.getSessionId();

      expect(id2).toBe(id1);
    });

    it('should NOT persist session in memory mode', () => {
      const manager1 = createSessionManager({
        storage: 'memory',
      });
      const id1 = manager1!.getSessionId();

      // Create new manager - gets new session
      const manager2 = createSessionManager({
        storage: 'memory',
      });
      const id2 = manager2!.getSessionId();

      expect(id2).not.toBe(id1);
    });
  });

  describe('activity tracking', () => {
    it('should update lastActivity on getSessionId', () => {
      const manager = createSessionManager({
        timeout: 30 * 60 * 1000, // 30 minutes
        storage: 'sessionStorage',
      });

      manager!.getSessionId();

      // Advance 20 minutes
      vi.advanceTimersByTime(20 * 60 * 1000);
      manager!.getSessionId();

      // Advance another 20 minutes (40 total, but only 20 since last activity)
      vi.advanceTimersByTime(20 * 60 * 1000);
      const id = manager!.getSessionId();

      // Should still be same session (activity resets timeout)
      expect(id).toBeDefined();

      // Check storage was updated
      const stored = JSON.parse(sessionStorage.getItem('svoose_session')!);
      expect(stored.lastActivity).toBeGreaterThan(stored.startedAt);
    });
  });

  describe('graceful degradation', () => {
    it('should work with corrupted storage data', () => {
      // Write corrupted data
      sessionStorage.setItem('svoose_session', 'not-json');

      const manager = createSessionManager({
        storage: 'sessionStorage',
      });

      // Should create new session without throwing
      const id = manager!.getSessionId();
      expect(id).toBeDefined();
    });

    it('should work with incomplete session data', () => {
      // Write incomplete session
      sessionStorage.setItem('svoose_session', JSON.stringify({ id: 'test' }));

      const manager = createSessionManager({
        storage: 'sessionStorage',
      });

      // Should create new session
      const id = manager!.getSessionId();
      expect(id).not.toBe('test');
    });
  });

  describe('default values', () => {
    it('should use 30 minute timeout by default', () => {
      const manager = createSessionManager(true);
      const id1 = manager!.getSessionId();

      // Advance 29 minutes - should keep session
      vi.advanceTimersByTime(29 * 60 * 1000);
      expect(manager!.getSessionId()).toBe(id1);

      // Advance to 31 minutes from last activity - should create new session
      vi.advanceTimersByTime(31 * 60 * 1000);
      expect(manager!.getSessionId()).not.toBe(id1);
    });

    it('should use sessionStorage by default', () => {
      const manager = createSessionManager(true);
      manager!.getSessionId();

      expect(sessionStorage.getItem('svoose_session')).not.toBeNull();
      expect(localStorage.getItem('svoose_session')).toBeNull();
    });
  });
});

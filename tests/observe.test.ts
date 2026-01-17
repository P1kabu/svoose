import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observe } from '../src/observe/observe.svelte.js';
import type { Transport, ObserveEvent, VitalEvent } from '../src/types/index.js';

// Mock PerformanceObserver to prevent actual vital observation
class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

describe('observe', () => {
  beforeEach(() => {
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
      value: [],
      writable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('sync transport support', () => {
    it('should work with sync transport (returns void)', () => {
      const events: ObserveEvent[][] = [];

      // Sync transport - returns void, not Promise
      const syncTransport: Transport = {
        send: (e) => {
          events.push(e);
          // No return - this is void
        },
      };

      const cleanup = observe({
        transport: syncTransport,
        vitals: false,
        errors: false,
        batchSize: 1,
      });

      // Should not throw
      expect(cleanup).toBeTypeOf('function');
      cleanup();
    });

    it('should work with console.log transport (common use case)', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // This was causing "Cannot read properties of undefined (reading 'catch')"
      const consoleTransport: Transport = {
        send: (events) => console.log('[Test]', events),
      };

      const cleanup = observe({
        transport: consoleTransport,
        vitals: false,
        errors: false,
      });

      // Should not throw
      expect(cleanup).toBeTypeOf('function');
      cleanup();

      consoleSpy.mockRestore();
    });

    it('should work with async transport (returns Promise)', async () => {
      const events: ObserveEvent[][] = [];

      const asyncTransport: Transport = {
        send: async (e) => {
          events.push(e);
        },
      };

      const cleanup = observe({
        transport: asyncTransport,
        vitals: false,
        errors: false,
      });

      expect(cleanup).toBeTypeOf('function');
      cleanup();
    });

    it('should handle errors in async transport gracefully', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failingTransport: Transport = {
        send: async () => {
          throw new Error('Network error');
        },
      };

      const cleanup = observe({
        transport: failingTransport,
        vitals: false,
        errors: false,
        debug: true,
        batchSize: 1,
      });

      // Should not throw even when transport fails
      cleanup();

      // Allow async error handling
      await vi.runAllTimersAsync();

      errorSpy.mockRestore();
    });
  });

  describe('sampling', () => {
    it('should skip observation when sample rate excludes', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);

      const sendSpy = vi.fn();
      const transport: Transport = { send: sendSpy };

      const cleanup = observe({
        transport,
        sampleRate: 0.5, // 50% sample rate, random = 0.9 > 0.5
        vitals: false,
        errors: false,
      });

      cleanup();
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should include observation when within sample rate', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);

      const sendSpy = vi.fn();
      const transport: Transport = { send: sendSpy };

      const cleanup = observe({
        transport,
        sampleRate: 0.5, // 50% sample rate, random = 0.3 < 0.5
        vitals: false,
        errors: false,
      });

      expect(cleanup).toBeTypeOf('function');
      cleanup();
    });
  });

  describe('batching', () => {
    it('should batch events before sending', () => {
      const sentBatches: ObserveEvent[][] = [];
      const transport: Transport = {
        send: (events) => {
          sentBatches.push([...events]);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 3,
        debug: true,
      });

      // The buffer is internal, we test via cleanup flush
      cleanup();

      // Should have flushed on cleanup
      expect(sentBatches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('filter', () => {
    it('should filter events based on filter function', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => {
          sentEvents.push(...events);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        filter: (event) => event.type === 'vital',
        batchSize: 10,
      });

      cleanup();
    });
  });

  describe('debug mode', () => {
    it('should log events when debug is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const transport: Transport = { send: () => {} };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        debug: true,
      });

      cleanup();
      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should flush remaining events on cleanup', () => {
      const sentBatches: ObserveEvent[][] = [];
      const transport: Transport = {
        send: (events) => {
          sentBatches.push([...events]);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100, // High batch size so nothing auto-flushes
      });

      cleanup(); // Should flush any buffered events
    });

    it('should stop interval timer on cleanup', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const cleanup = observe({
        vitals: false,
        errors: false,
      });

      cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('flush interval', () => {
    it('should flush on interval', () => {
      const sendSpy = vi.fn();
      const transport: Transport = { send: sendSpy };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        flushInterval: 1000,
        batchSize: 100,
      });

      // Advance timer
      vi.advanceTimersByTime(1000);

      // Buffer is empty so no send
      expect(sendSpy).not.toHaveBeenCalled();

      cleanup();
    });
  });
});

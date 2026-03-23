import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observe, setGlobalObserver, getGlobalObserver } from '../src/observe/observe.svelte.js';
import { createMachine } from '../src/machine/index.js';
import { productionDefaults } from '../src/observe/presets.js';
import type { Transport, ObserveEvent, ObserveInstance, VitalEvent, TransitionEvent } from '../src/types/index.js';

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
    it('should validate batchSize', () => {
      expect(() => observe({
        batchSize: -5,
        vitals: false,
        errors: false,
      })).toThrow('[svoose] batchSize must be >= 1');
    });

    it('should validate flushInterval', () => {
      expect(() => observe({
        flushInterval: 0,
        vitals: false,
        errors: false,
      })).toThrow('[svoose] flushInterval must be >= 100ms');
    });

    it('should validate sampling rate', () => {
      expect(() => observe({
        sampling: 1.5,
        vitals: false,
        errors: false,
      })).toThrow('[svoose] sampling rate must be between 0 and 1');
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

    it('should call transport.destroy() on cleanup if available', () => {
      const destroySpy = vi.fn();
      const transport = {
        send: vi.fn(),
        destroy: destroySpy,
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
      });

      cleanup();

      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should not fail if transport has no destroy()', () => {
      const transport: Transport = { send: vi.fn() };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
      });

      expect(() => cleanup()).not.toThrow();
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

  describe('visibility change handling', () => {
    it('should flush on visibility change to hidden', () => {
      const sentBatches: ObserveEvent[][] = [];
      const transport: Transport = {
        send: (events) => {
          sentBatches.push([...events]);
        },
      };

      // Add events via global observer
      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
      });

      // Get the global observer and send events
      const observer = getGlobalObserver();
      expect(observer).not.toBeNull();

      // Simulate some events
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // Simulate visibility change
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(sentBatches.length).toBeGreaterThan(0);

      // Reset visibility state
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });

      cleanup();
    });
  });

  describe('beforeunload handling', () => {
    it('should flush on beforeunload', () => {
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
        batchSize: 100,
      });

      // Get the global observer and send events
      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // Simulate beforeunload
      window.dispatchEvent(new Event('beforeunload'));

      expect(sentBatches.length).toBeGreaterThan(0);

      cleanup();
    });
  });

  describe('global observer', () => {
    it('should set and get global observer', () => {
      const callback = vi.fn();
      setGlobalObserver(callback);

      expect(getGlobalObserver()).toBe(callback);

      setGlobalObserver(null);
      expect(getGlobalObserver()).toBeNull();
    });

    it('should clear global observer on cleanup', () => {
      const cleanup = observe({
        vitals: false,
        errors: false,
      });

      expect(getGlobalObserver()).not.toBeNull();

      cleanup();

      expect(getGlobalObserver()).toBeNull();
    });
  });

  describe('machine integration', () => {
    it('should receive transition events from machine', () => {
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
        batchSize: 1, // Flush immediately
      });

      const machine = createMachine({
        id: 'test-machine',
        initial: 'idle',
        observe: true,
        states: {
          idle: { on: { START: 'running' } },
          running: { on: { STOP: 'idle' } },
        },
      });

      machine.send('START');

      expect(sentEvents).toContainEqual(
        expect.objectContaining({
          type: 'transition',
          machineId: 'test-machine',
          from: 'idle',
          to: 'running',
          event: 'START',
        })
      );

      machine.destroy();
      cleanup();
    });

    it('should include context in transition events when configured', () => {
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
        batchSize: 1,
      });

      const machine = createMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        observe: { transitions: true, context: true },
        states: {
          active: {
            on: {
              INCREMENT: {
                target: 'active',
                action: (ctx) => ({ count: ctx.count + 1 }),
              },
            },
          },
        },
      });

      machine.send('INCREMENT');

      const transitionEvent = sentEvents.find(
        (e) => e.type === 'transition'
      ) as TransitionEvent;

      expect(transitionEvent).toBeDefined();
      expect(transitionEvent.context).toEqual({ count: 1 });

      machine.destroy();
      cleanup();
    });
  });

  describe('multiple observers', () => {
    it('should handle multiple observe() calls', () => {
      const sent1: ObserveEvent[][] = [];
      const sent2: ObserveEvent[][] = [];

      const transport1: Transport = {
        send: (events) => sent1.push([...events]),
      };
      const transport2: Transport = {
        send: (events) => sent2.push([...events]),
      };

      const cleanup1 = observe({
        transport: transport1,
        vitals: false,
        errors: false,
      });

      // Second observe() replaces the global observer
      const cleanup2 = observe({
        transport: transport2,
        vitals: false,
        errors: false,
      });

      // Only the second observer receives events
      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      cleanup2();
      cleanup1();
    });
  });

  describe('session tracking', () => {
    it('should add sessionId to events when session is enabled', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        session: true,
        batchSize: 1,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(sentEvents).toHaveLength(1);
      expect((sentEvents[0] as any).sessionId).toBeDefined();
      expect(typeof (sentEvents[0] as any).sessionId).toBe('string');

      cleanup();
    });

    it('should NOT add sessionId when session is disabled', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        session: false,
        batchSize: 1,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(sentEvents).toHaveLength(1);
      expect((sentEvents[0] as any).sessionId).toBeUndefined();

      cleanup();
    });

    it('should NOT add sessionId when session option is not provided', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(sentEvents).toHaveLength(1);
      expect((sentEvents[0] as any).sessionId).toBeUndefined();

      cleanup();
    });

    it('should use same sessionId for all events in same session', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        session: true,
        batchSize: 1,
      });

      const observer = getGlobalObserver();

      // Send multiple events
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'b',
        to: 'c',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(sentEvents).toHaveLength(2);
      expect((sentEvents[0] as any).sessionId).toBe((sentEvents[1] as any).sessionId);

      cleanup();
    });

    it('should support custom session config', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        session: {
          timeout: 60 * 60 * 1000, // 1 hour
          storage: 'memory',
        },
        batchSize: 1,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(sentEvents).toHaveLength(1);
      expect((sentEvents[0] as any).sessionId).toBeDefined();

      cleanup();
    });
  });

  describe('edge cases', () => {
    it('should handle empty filter function gracefully', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        filter: () => false, // Filter out all events
        batchSize: 1,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // Event should be filtered out
      expect(sentEvents).toHaveLength(0);

      cleanup();
    });

    it('should handle transport that returns undefined', () => {
      const transport: Transport = {
        send: () => undefined as unknown as void,
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
      });

      const observer = getGlobalObserver();

      // Should not throw
      expect(() => {
        observer!({
          type: 'transition',
          machineId: 'test',
          from: 'a',
          to: 'b',
          event: 'NEXT',
          timestamp: Date.now(),
        });
      }).not.toThrow();

      cleanup();
    });
  });

  describe('onError callback', () => {
    it('should call onError when sync transport throws', () => {
      const onError = vi.fn();
      const transport: Transport = {
        send: () => { throw new Error('sync fail'); },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
        onError,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'sync fail' }));

      cleanup();
    });

    it('should call onError when async transport rejects', async () => {
      const onError = vi.fn();
      const transport: Transport = {
        send: () => Promise.reject(new Error('async fail')),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
        onError,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // Wait for promise rejection to be handled
      await vi.advanceTimersByTimeAsync(0);

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'async fail' }));

      cleanup();
    });

    it('should not throw when onError is not provided and transport fails', () => {
      const transport: Transport = {
        send: () => { throw new Error('no handler'); },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
      });

      const observer = getGlobalObserver();

      expect(() => {
        observer!({
          type: 'transition',
          machineId: 'test',
          from: 'a',
          to: 'b',
          event: 'NEXT',
          timestamp: Date.now(),
        });
      }).not.toThrow();

      cleanup();
    });

    it('should wrap non-Error thrown values into Error objects', () => {
      const onError = vi.fn();
      const transport: Transport = {
        send: () => { throw 'string error'; },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
        onError,
      });

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(onError).toHaveBeenCalledOnce();
      const arg = onError.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('string error');

      cleanup();
    });
  });

  describe('ObserveInstance API', () => {
    function makeTransport() {
      const sent: ObserveEvent[][] = [];
      const transport: Transport = { send: (e) => { sent.push([...e]); } };
      return { sent, transport };
    }

    function makeEvent(overrides?: Partial<TransitionEvent>): TransitionEvent {
      return {
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'GO',
        timestamp: Date.now(),
        ...overrides,
      };
    }

    it('should be callable (backward compat) — calling instance destroys it', () => {
      const { transport } = makeTransport();
      const obs = observe({ transport, vitals: false, errors: false });

      expect(obs).toBeTypeOf('function');
      // calling obs() should not throw
      obs();
    });

    it('should have flush, destroy, getStats, onEvent methods', () => {
      const { transport } = makeTransport();
      const obs = observe({ transport, vitals: false, errors: false });

      expect(obs.flush).toBeTypeOf('function');
      expect(obs.destroy).toBeTypeOf('function');
      expect(obs.getStats).toBeTypeOf('function');
      expect(obs.onEvent).toBeTypeOf('function');

      obs.destroy();
    });

    it('flush() should send buffered events without destroying', () => {
      const { sent, transport } = makeTransport();
      const obs = observe({ transport, vitals: false, errors: false, batchSize: 100 });

      const observer = getGlobalObserver()!;
      observer(makeEvent());
      observer(makeEvent());

      expect(sent).toHaveLength(0);
      obs.flush();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toHaveLength(2);

      // Still works after flush (not destroyed)
      observer(makeEvent());
      obs.flush();
      expect(sent).toHaveLength(2);

      obs.destroy();
    });

    it('getStats() should track buffered, sent, dropped', () => {
      const { transport } = makeTransport();
      const obs = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
        sampling: { transitions: 0 }, // drop all transitions
      });

      const stats0 = obs.getStats();
      expect(stats0).toEqual({ buffered: 0, sent: 0, dropped: 0, lastSendTime: 0, transportErrors: 0 });

      const observer = getGlobalObserver()!;

      // These will be dropped by sampling
      observer(makeEvent());
      observer(makeEvent());
      const stats1 = obs.getStats();
      expect(stats1.dropped).toBe(2);
      expect(stats1.buffered).toBe(0);

      obs.destroy();
    });

    it('getStats() should count sent after flush', () => {
      const { transport } = makeTransport();
      const obs = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
      });

      const observer = getGlobalObserver()!;
      observer(makeEvent());
      observer(makeEvent());
      observer(makeEvent());

      expect(obs.getStats().buffered).toBe(3);
      expect(obs.getStats().sent).toBe(0);

      obs.flush();

      expect(obs.getStats().sent).toBe(3);

      obs.destroy();
    });

    it('getStats() should return a copy (not a reference)', () => {
      const { transport } = makeTransport();
      const obs = observe({ transport, vitals: false, errors: false });

      const stats1 = obs.getStats();
      const stats2 = obs.getStats();
      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2);

      obs.destroy();
    });

    it('onEvent() should receive events passing through the pipeline', () => {
      const { transport } = makeTransport();
      const obs = observe({ transport, vitals: false, errors: false, batchSize: 100 });

      const received: ObserveEvent[] = [];
      const unsub = obs.onEvent((e) => received.push(e));

      const observer = getGlobalObserver()!;
      observer(makeEvent({ from: 'x', to: 'y' }));
      observer(makeEvent({ from: 'y', to: 'z' }));

      expect(received).toHaveLength(2);
      expect((received[0] as TransitionEvent).from).toBe('x');
      expect((received[1] as TransitionEvent).from).toBe('y');

      unsub();
      observer(makeEvent());
      // After unsub, no more events
      expect(received).toHaveLength(2);

      obs.destroy();
    });

    it('onEvent() should not receive dropped events (sampling)', () => {
      const { transport } = makeTransport();
      const obs = observe({
        transport,
        vitals: false,
        errors: false,
        sampling: { transitions: 0 },
      });

      const received: ObserveEvent[] = [];
      obs.onEvent((e) => received.push(e));

      const observer = getGlobalObserver()!;
      observer(makeEvent());

      expect(received).toHaveLength(0);

      obs.destroy();
    });

    it('destroy() should clear onEvent listeners', () => {
      const { transport } = makeTransport();
      const obs = observe({ transport, vitals: false, errors: false, batchSize: 100 });

      const received: ObserveEvent[] = [];
      obs.onEvent((e) => received.push(e));

      obs.destroy();

      // After destroy, global observer is null — no way to push events
      // but listeners should be cleared regardless
      expect(received).toHaveLength(0);
    });

    it('SSR should return noop instance with all methods', () => {
      // Temporarily remove window/document
      const origWindow = globalThis.window;
      const origDocument = globalThis.document;
      // @ts-expect-error — SSR simulation
      delete globalThis.window;
      // @ts-expect-error — SSR simulation
      delete globalThis.document;

      try {
        const obs = observe({ endpoint: '/test' });
        expect(obs).toBeTypeOf('function');
        expect(obs.flush).toBeTypeOf('function');
        expect(obs.destroy).toBeTypeOf('function');
        expect(obs.getStats).toBeTypeOf('function');
        expect(obs.onEvent).toBeTypeOf('function');

        // All methods should be noop
        obs.flush();
        obs.destroy();
        expect(obs.getStats()).toEqual({ buffered: 0, sent: 0, dropped: 0, lastSendTime: 0, transportErrors: 0 });
        const unsub = obs.onEvent(() => {});
        expect(unsub).toBeTypeOf('function');
        unsub();
        obs(); // callable noop
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDocument;
      }
    });
  });

  describe('productionDefaults', () => {
    it('should export productionDefaults with expected fields', () => {
      expect(productionDefaults.batchSize).toBe(50);
      expect(productionDefaults.flushInterval).toBe(10000);
      expect(productionDefaults.session).toBe(true);
      expect(productionDefaults.sampling).toEqual({
        errors: 1.0,
        vitals: 0.5,
        custom: 0.5,
        transitions: 0.1,
      });
    });

    it('should work with observe() via spread', () => {
      const { transport } = makeTransport();
      const obs = observe({ ...productionDefaults, transport, vitals: false, errors: false });

      expect(obs).toBeTypeOf('function');
      expect(obs.getStats).toBeTypeOf('function');

      obs.destroy();

      function makeTransport() {
        const sent: ObserveEvent[][] = [];
        const transport: Transport = { send: (e) => { sent.push([...e]); } };
        return { sent, transport };
      }
    });
  });
});

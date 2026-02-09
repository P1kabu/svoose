import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  metric,
  setMetricEmitter,
  _getPendingEventsCount,
  _clearPendingEvents,
} from '../src/metrics/index.js';
import { observe } from '../src/observe/observe.svelte.js';
import type { Transport, ObserveEvent, CustomMetricEvent } from '../src/types/index.js';

// Mock PerformanceObserver to prevent actual vital observation
class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

describe('metric', () => {
  beforeEach(() => {
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
      value: [],
      writable: true,
    });
    vi.useFakeTimers();
    _clearPendingEvents();
    setMetricEmitter(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
    _clearPendingEvents();
    setMetricEmitter(null);
  });

  describe('basic usage', () => {
    it('should emit custom metric event with name and data', () => {
      const events: ObserveEvent[] = [];
      setMetricEmitter((e) => events.push(e));

      metric('checkout_started', { step: 1, cartTotal: 99.99 });

      expect(events).toHaveLength(1);
      const event = events[0] as CustomMetricEvent;
      expect(event.type).toBe('custom');
      expect(event.name).toBe('checkout_started');
      expect(event.data).toEqual({ step: 1, cartTotal: 99.99 });
      expect(event.timestamp).toBeTypeOf('number');
    });

    it('should emit custom metric event with empty data by default', () => {
      const events: ObserveEvent[] = [];
      setMetricEmitter((e) => events.push(e));

      metric('button_clicked');

      expect(events).toHaveLength(1);
      const event = events[0] as CustomMetricEvent;
      expect(event.type).toBe('custom');
      expect(event.name).toBe('button_clicked');
      expect(event.data).toEqual({});
    });

    it('should include timestamp', () => {
      const events: ObserveEvent[] = [];
      setMetricEmitter((e) => events.push(e));

      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
      metric('test_event', {});

      const event = events[0] as CustomMetricEvent;
      expect(event.timestamp).toBe(Date.now());
    });
  });

  describe('pending buffer', () => {
    it('should buffer events before observe() is initialized', () => {
      // No emitter set
      metric('before_init', { test: true });
      metric('before_init_2', { test: true });

      expect(_getPendingEventsCount()).toBe(2);
    });

    it('should flush pending events when observe() initializes', () => {
      // Buffer events before observe
      metric('pending_1', { id: 1 });
      metric('pending_2', { id: 2 });

      expect(_getPendingEventsCount()).toBe(2);

      // Initialize observe with custom transport
      const events: ObserveEvent[] = [];
      const transport: Transport = {
        send: (e) => events.push(...e),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 10,
      });

      // Pending events should be flushed to emitter
      expect(_getPendingEventsCount()).toBe(0);

      // Force flush to see buffered events
      cleanup();

      // Find custom events
      const customEvents = events.filter((e) => e.type === 'custom') as CustomMetricEvent[];
      expect(customEvents).toHaveLength(2);
      expect(customEvents[0].name).toBe('pending_1');
      expect(customEvents[1].name).toBe('pending_2');
    });

    it('should drop events when buffer is full (100 events)', () => {
      // Fill buffer to max (100 events)
      for (let i = 0; i < 100; i++) {
        metric(`event_${i}`, {});
      }

      expect(_getPendingEventsCount()).toBe(100);

      // Try to add one more - should drop silently in non-dev
      metric('overflow', {});

      expect(_getPendingEventsCount()).toBe(100); // Still 100, not 101
    });

    it('should warn in dev mode when buffer is full', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('process', { env: { NODE_ENV: 'development' } });

      // Fill buffer to max (100 events)
      for (let i = 0; i < 100; i++) {
        metric(`event_${i}`, {});
      }

      // Try to add one more - should warn in dev
      metric('overflow', {});

      expect(_getPendingEventsCount()).toBe(100);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('metric() buffer full')
      );

      warnSpy.mockRestore();
    });
  });

  describe('integration with observe()', () => {
    it('should batch custom metrics with other events', () => {
      const batches: ObserveEvent[][] = [];
      const transport: Transport = {
        send: (e) => batches.push([...e]),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 3,
      });

      metric('event_1', {});
      metric('event_2', {});
      metric('event_3', {}); // Should trigger batch

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(3);

      cleanup();
    });

    it('should respect custom sampling rate', () => {
      const events: ObserveEvent[] = [];
      const transport: Transport = {
        send: (e) => events.push(...e),
      };

      // Mock Math.random to control sampling
      let randomValue = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => randomValue);

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
        sampling: {
          custom: 0.5, // 50% sampling
        },
      });

      // First event - random 0 < 0.5, should pass
      randomValue = 0;
      metric('sampled', {});

      // Second event - random 0.6 >= 0.5, should be dropped
      randomValue = 0.6;
      metric('dropped', {});

      // Third event - random 0.4 < 0.5, should pass
      randomValue = 0.4;
      metric('sampled_2', {});

      cleanup();

      const customEvents = events.filter((e) => e.type === 'custom') as CustomMetricEvent[];
      expect(customEvents).toHaveLength(2);
      expect(customEvents[0].name).toBe('sampled');
      expect(customEvents[1].name).toBe('sampled_2');
    });

    it('should attach sessionId when session is enabled', () => {
      const events: ObserveEvent[] = [];
      const transport: Transport = {
        send: (e) => events.push(...e),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
        session: {
          storage: 'memory',
        },
      });

      metric('with_session', { test: true });

      cleanup();

      const customEvents = events.filter((e) => e.type === 'custom') as CustomMetricEvent[];
      expect(customEvents).toHaveLength(1);
      expect(customEvents[0].sessionId).toBeDefined();
      expect(customEvents[0].sessionId).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('cleanup', () => {
    it('should disconnect emitter on cleanup', () => {
      const events: ObserveEvent[] = [];
      const transport: Transport = {
        send: (e) => events.push(...e),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
      });

      metric('before_cleanup', {});
      cleanup();

      // After cleanup, emitter should be null, events should buffer
      metric('after_cleanup', {});

      expect(_getPendingEventsCount()).toBe(1);
    });
  });
});

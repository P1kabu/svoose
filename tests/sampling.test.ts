import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSampler,
  eventTypeToSamplingType,
  type SamplingConfig,
  type SamplingOption,
} from '../src/observe/sampling.js';
import { observe, getGlobalObserver } from '../src/observe/observe.svelte.js';
import type { Transport, ObserveEvent, TransitionEvent, VitalEvent } from '../src/types/index.js';

// Mock PerformanceObserver
class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

describe('sampling', () => {
  describe('createSampler', () => {
    describe('simple rate (number)', () => {
      it('should create sampler with same rate for all event types', () => {
        const sampler = createSampler(0.5);

        expect(sampler.getRate('vitals')).toBe(0.5);
        expect(sampler.getRate('errors')).toBe(0.5);
        expect(sampler.getRate('custom')).toBe(0.5);
        expect(sampler.getRate('transitions')).toBe(0.5);
      });

      it('should keep identify at 1.0 when using simple rate', () => {
        const sampler = createSampler(0.1);

        expect(sampler.getRate('identify')).toBe(1);
      });

      it('should handle rate of 0 (disabled)', () => {
        const sampler = createSampler(0);

        expect(sampler.getRate('vitals')).toBe(0);
        expect(sampler.shouldSample('vitals')).toBe(false);
      });

      it('should handle rate of 1 (all events)', () => {
        const sampler = createSampler(1);

        expect(sampler.getRate('vitals')).toBe(1);
        expect(sampler.shouldSample('vitals')).toBe(true);
      });

      it('should normalize rates > 1 to 1', () => {
        const sampler = createSampler(1.5);

        expect(sampler.getRate('vitals')).toBe(1);
        expect(sampler.shouldSample('vitals')).toBe(true);
      });

      it('should normalize rates < 0 to 0', () => {
        const sampler = createSampler(-0.5);

        expect(sampler.getRate('vitals')).toBe(0);
        expect(sampler.shouldSample('vitals')).toBe(false);
      });
    });

    describe('per-event-type config', () => {
      it('should create sampler with different rates per type', () => {
        const config: SamplingConfig = {
          vitals: 0.1,
          errors: 1.0,
          custom: 0.5,
          transitions: 0.0,
        };

        const sampler = createSampler(config);

        expect(sampler.getRate('vitals')).toBe(0.1);
        expect(sampler.getRate('errors')).toBe(1);
        expect(sampler.getRate('custom')).toBe(0.5);
        expect(sampler.getRate('transitions')).toBe(0);
      });

      it('should default missing rates to 1', () => {
        const config: SamplingConfig = {
          vitals: 0.1,
        };

        const sampler = createSampler(config);

        expect(sampler.getRate('vitals')).toBe(0.1);
        expect(sampler.getRate('errors')).toBe(1); // default
        expect(sampler.getRate('custom')).toBe(1); // default
        expect(sampler.getRate('transitions')).toBe(1); // default
        expect(sampler.getRate('identify')).toBe(1); // default
      });

      it('should allow custom identify rate', () => {
        const sampler = createSampler({
          identify: 0.5,
        });

        expect(sampler.getRate('identify')).toBe(0.5);
      });
    });

    describe('shouldSample', () => {
      it('should always return true for rate 1', () => {
        const sampler = createSampler(1);

        // Call multiple times to ensure consistency
        for (let i = 0; i < 10; i++) {
          expect(sampler.shouldSample('vitals')).toBe(true);
        }
      });

      it('should always return false for rate 0', () => {
        const sampler = createSampler(0);

        // Call multiple times to ensure consistency
        for (let i = 0; i < 10; i++) {
          expect(sampler.shouldSample('vitals')).toBe(false);
        }
      });

      it('should respect sampling rate with mocked random', () => {
        const sampler = createSampler(0.5);

        // Mock random to return 0.3 (< 0.5 = should sample)
        vi.spyOn(Math, 'random').mockReturnValue(0.3);
        expect(sampler.shouldSample('vitals')).toBe(true);

        // Mock random to return 0.7 (> 0.5 = should not sample)
        vi.spyOn(Math, 'random').mockReturnValue(0.7);
        expect(sampler.shouldSample('vitals')).toBe(false);

        vi.restoreAllMocks();
      });

      it('should sample different types independently', () => {
        const sampler = createSampler({
          vitals: 0,
          errors: 1,
        });

        expect(sampler.shouldSample('vitals')).toBe(false);
        expect(sampler.shouldSample('errors')).toBe(true);
      });
    });
  });

  describe('eventTypeToSamplingType', () => {
    it('should map vital to vitals', () => {
      expect(eventTypeToSamplingType('vital')).toBe('vitals');
    });

    it('should map error to errors', () => {
      expect(eventTypeToSamplingType('error')).toBe('errors');
    });

    it('should map unhandled-rejection to errors', () => {
      expect(eventTypeToSamplingType('unhandled-rejection')).toBe('errors');
    });

    it('should map custom to custom', () => {
      expect(eventTypeToSamplingType('custom')).toBe('custom');
    });

    it('should map transition to transitions', () => {
      expect(eventTypeToSamplingType('transition')).toBe('transitions');
    });

    it('should map identify to identify', () => {
      expect(eventTypeToSamplingType('identify')).toBe('identify');
    });

    it('should return null for unknown types', () => {
      expect(eventTypeToSamplingType('unknown')).toBeNull();
    });
  });

  describe('observe() integration', () => {
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

    it('should sample events based on simple rate', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      // Mock random to return 0.15 for all calls
      vi.spyOn(Math, 'random').mockReturnValue(0.15);

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        sampling: 0.1, // 10% - should drop (0.15 > 0.1)
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

      expect(sentEvents).toHaveLength(0); // Dropped by sampling

      cleanup();
    });

    it('should include events within sample rate', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      // Mock random to return 0.05 (< 0.1)
      vi.spyOn(Math, 'random').mockReturnValue(0.05);

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        sampling: 0.1, // 10% - should include (0.05 < 0.1)
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

      cleanup();
    });

    it('should sample per-event-type independently', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        sampling: {
          transitions: 0, // Disabled
          errors: 1, // All
        },
        batchSize: 1,
      });

      const observer = getGlobalObserver();

      // Transition should be dropped (rate 0)
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // Error should be included (rate 1)
      observer!({
        type: 'error',
        message: 'Test error',
        timestamp: Date.now(),
        url: 'http://localhost',
      });

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0].type).toBe('error');

      cleanup();
    });

    it('should work without sampling option (backward compatible)', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        // No sampling option - all events should pass
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

      cleanup();
    });

    it('should combine sampling with filter', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        sampling: { transitions: 1 }, // Allow all transitions
        filter: (event) => {
          // But filter out events from 'ignored' machine
          if (event.type === 'transition') {
            return (event as TransitionEvent).machineId !== 'ignored';
          }
          return true;
        },
        batchSize: 1,
      });

      const observer = getGlobalObserver();

      // This should pass sampling but be filtered out
      observer!({
        type: 'transition',
        machineId: 'ignored',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // This should pass both sampling and filter
      observer!({
        type: 'transition',
        machineId: 'allowed',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      expect(sentEvents).toHaveLength(1);
      expect((sentEvents[0] as TransitionEvent).machineId).toBe('allowed');

      cleanup();
    });

    it('should apply filter before sampling', () => {
      // This test verifies the order: filter -> sampling
      // Filter is checked first, then sampling

      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => sentEvents.push(...events),
      };

      let filterCallCount = 0;
      let randomCallCount = 0;

      // Track Math.random calls after observer is created
      const originalRandom = Math.random;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        randomCallCount++;
        return 0; // Always sample (return low value)
      });

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        filter: () => {
          filterCallCount++;
          return false; // Filter out
        },
        sampling: 0.5,
        batchSize: 1,
      });

      // Reset counter after observe() setup (sampleRate check calls random)
      const randomCallsBeforeEvent = randomCallCount;

      const observer = getGlobalObserver();
      observer!({
        type: 'transition',
        machineId: 'test',
        from: 'a',
        to: 'b',
        event: 'NEXT',
        timestamp: Date.now(),
      });

      // Filter should be called
      expect(filterCallCount).toBe(1);
      // Sampling should NOT be called because filter returned false
      // (no additional random calls after the event was sent)
      expect(randomCallCount).toBe(randomCallsBeforeEvent);
      // Event should not be sent
      expect(sentEvents).toHaveLength(0);

      cleanup();
    });
  });
});

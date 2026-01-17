import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  observeCLS,
  observeLCP,
  observeFID,
  observeINP,
  observeFCP,
  observeTTFB,
} from '../src/observe/vitals.js';
import type { Metric } from '../src/types/index.js';

// Mock PerformanceObserver
class MockPerformanceObserver {
  private callback: PerformanceObserverCallback;
  private static instances: MockPerformanceObserver[] = [];
  private disconnected = false;

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
    MockPerformanceObserver.instances.push(this);
  }

  observe() {
    // Will be triggered manually in tests
  }

  disconnect() {
    this.disconnected = true;
  }

  isDisconnected() {
    return this.disconnected;
  }

  // Helper to trigger the callback
  trigger(entries: Partial<PerformanceEntry>[]) {
    if (this.disconnected) return;
    const list = {
      getEntries: () => entries as PerformanceEntry[],
    } as PerformanceObserverEntryList;
    this.callback(list, this as unknown as PerformanceObserver);
  }

  static getLastInstance() {
    return MockPerformanceObserver.instances[MockPerformanceObserver.instances.length - 1];
  }

  static clearInstances() {
    MockPerformanceObserver.instances = [];
  }
}

// Mock supportedEntryTypes
const mockSupportedEntryTypes = [
  'layout-shift',
  'largest-contentful-paint',
  'first-input',
  'event',
  'paint',
  'navigation',
];

describe('vitals observers', () => {
  beforeEach(() => {
    MockPerformanceObserver.clearInstances();
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
      value: mockSupportedEntryTypes,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('observeCLS', () => {
    it('should calculate cumulative layout shift', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // Simulate layout shifts
      observer.trigger([
        { value: 0.05, hadRecentInput: false },
        { value: 0.03, hadRecentInput: false },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CLS',
          value: 0.08,
          rating: 'good',
        })
      );

      cleanup();
    });

    it('should ignore shifts with recent input', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { value: 0.5, hadRecentInput: true }, // Should be ignored
        { value: 0.05, hadRecentInput: false },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0.05,
        })
      );

      cleanup();
    });

    it('should rate CLS correctly', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // Poor CLS
      observer.trigger([{ value: 0.3, hadRecentInput: false }]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 'poor',
        })
      );

      cleanup();
    });
  });

  describe('observeLCP', () => {
    it('should report largest contentful paint', () => {
      const callback = vi.fn();
      const cleanup = observeLCP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ startTime: 1500 }]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'LCP',
          value: 1500,
          rating: 'good',
        })
      );

      cleanup();
    });

    it('should use last entry when multiple exist', () => {
      const callback = vi.fn();
      const cleanup = observeLCP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { startTime: 1000 },
        { startTime: 2000 },
        { startTime: 3500 }, // Last entry
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 3500,
          rating: 'needs-improvement',
        })
      );

      cleanup();
    });
  });

  describe('observeFID', () => {
    it('should calculate first input delay', () => {
      const callback = vi.fn();
      const cleanup = observeFID(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        {
          processingStart: 150,
          startTime: 100,
        },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'FID',
          value: 50,
          rating: 'good',
        })
      );

      cleanup();
    });

    it('should disconnect after first input (no double fire)', () => {
      const callback = vi.fn();
      observeFID(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // First trigger
      observer.trigger([{ processingStart: 150, startTime: 100 }]);
      expect(callback).toHaveBeenCalledTimes(1);

      // Second trigger should not fire (observer disconnected)
      observer.trigger([{ processingStart: 200, startTime: 150 }]);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('observeFCP', () => {
    it('should report first contentful paint', () => {
      const callback = vi.fn();
      const cleanup = observeFCP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { name: 'first-paint', startTime: 800 },
        { name: 'first-contentful-paint', startTime: 1200 },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'FCP',
          value: 1200,
          rating: 'good',
        })
      );

      cleanup();
    });

    it('should disconnect after FCP (no double fire)', () => {
      const callback = vi.fn();
      observeFCP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ name: 'first-contentful-paint', startTime: 1200 }]);
      expect(callback).toHaveBeenCalledTimes(1);

      // Should not fire again
      observer.trigger([{ name: 'first-contentful-paint', startTime: 1500 }]);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('observeTTFB', () => {
    it('should calculate time to first byte', () => {
      const callback = vi.fn();
      const cleanup = observeTTFB(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        {
          responseStart: 500,
          requestStart: 100,
        },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TTFB',
          value: 400,
          rating: 'good',
        })
      );

      cleanup();
    });

    it('should disconnect after TTFB (no double fire bug fix)', () => {
      const callback = vi.fn();
      observeTTFB(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // First trigger
      observer.trigger([{ responseStart: 500, requestStart: 100 }]);
      expect(callback).toHaveBeenCalledTimes(1);

      // Second trigger should NOT fire (this was the bug)
      observer.trigger([{ responseStart: 600, requestStart: 100 }]);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should rate TTFB correctly', () => {
      const callback = vi.fn();
      const cleanup = observeTTFB(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ responseStart: 2000, requestStart: 100 }]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 'poor', // 1900ms > 1800ms threshold
        })
      );

      cleanup();
    });
  });

  describe('observeINP', () => {
    it('should track maximum interaction duration', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ duration: 100 }]);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          name: 'INP',
          value: 100,
          rating: 'good',
        })
      );

      // Higher duration should update
      observer.trigger([{ duration: 250 }]);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          value: 250,
          rating: 'needs-improvement',
        })
      );

      cleanup();
    });

    it('should not report lower durations', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ duration: 300 }]);
      expect(callback).toHaveBeenCalledTimes(1);

      // Lower duration should not trigger callback
      observer.trigger([{ duration: 150 }]);
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  describe('unsupported environments', () => {
    it('should return noop when PerformanceObserver is undefined', () => {
      vi.stubGlobal('PerformanceObserver', undefined);

      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      expect(cleanup).toBeTypeOf('function');
      cleanup(); // Should not throw
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

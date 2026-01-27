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
    // CLS uses session windows and reports on visibility change or cleanup
    // This matches the web-vitals standard behavior

    it('should calculate cumulative layout shift on cleanup', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // Simulate layout shifts within same session window
      observer.trigger([
        { value: 0.05, hadRecentInput: false, startTime: 100 },
        { value: 0.03, hadRecentInput: false, startTime: 200 },
      ]);

      // CLS should NOT report immediately (session windows algorithm)
      expect(callback).not.toHaveBeenCalled();

      // Cleanup triggers final report
      cleanup();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CLS',
          value: 0.08,
          rating: 'good',
        })
      );
    });

    it('should report on visibility change to hidden', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { value: 0.05, hadRecentInput: false, startTime: 100 },
      ]);

      expect(callback).not.toHaveBeenCalled();

      // Simulate visibility change to hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CLS',
          value: 0.05,
        })
      );

      // Restore visibility state
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });

      cleanup();
    });

    it('should ignore shifts with recent input', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { value: 0.5, hadRecentInput: true, startTime: 100 }, // Should be ignored
        { value: 0.05, hadRecentInput: false, startTime: 200 },
      ]);

      // Cleanup to trigger report
      cleanup();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0.05,
        })
      );
    });

    it('should rate CLS correctly', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // Poor CLS
      observer.trigger([{ value: 0.3, hadRecentInput: false, startTime: 100 }]);

      // Cleanup to trigger report
      cleanup();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 'poor',
        })
      );
    });

    it('should start new session after 1 second gap', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // First session
      observer.trigger([
        { value: 0.05, hadRecentInput: false, startTime: 100 },
      ]);

      // New session after 1.5s gap (> SESSION_GAP of 1000ms)
      observer.trigger([
        { value: 0.08, hadRecentInput: false, startTime: 1600 },
      ]);

      cleanup();

      // Should report the max session value (0.08, not 0.13)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0.08,
        })
      );
    });

    it('should start new session after 5 second duration', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // Session starts at 100, should end before 5100
      observer.trigger([
        { value: 0.02, hadRecentInput: false, startTime: 100 },
        { value: 0.03, hadRecentInput: false, startTime: 500 },
        { value: 0.04, hadRecentInput: false, startTime: 1000 },
      ]);

      // This shift is > 5000ms after session start, should start new session
      observer.trigger([
        { value: 0.15, hadRecentInput: false, startTime: 5200 },
      ]);

      cleanup();

      // Max session is 0.15 (second session) > 0.09 (first session)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0.15,
        })
      );
    });

    it('should not report if no shifts occurred', () => {
      const callback = vi.fn();
      const cleanup = observeCLS(callback);

      // No shifts triggered
      cleanup();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('observeLCP', () => {
    // LCP reports on visibility change, user input, or cleanup (web-vitals standard)

    it('should report largest contentful paint on cleanup', () => {
      const callback = vi.fn();
      const cleanup = observeLCP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ startTime: 1500 }]);

      // LCP should NOT report immediately
      expect(callback).not.toHaveBeenCalled();

      // Cleanup triggers final report
      cleanup();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'LCP',
          value: 1500,
          rating: 'good',
        })
      );
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

      // Cleanup to trigger report
      cleanup();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 3500,
          rating: 'needs-improvement',
        })
      );
    });

    it('should not report if no entries', () => {
      const callback = vi.fn();
      const cleanup = observeLCP(callback);

      // No entries triggered
      cleanup();

      expect(callback).not.toHaveBeenCalled();
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
    // TTFB = responseStart - activationStart (web-vitals standard)

    it('should calculate time to first byte from responseStart', () => {
      const callback = vi.fn();
      const cleanup = observeTTFB(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        {
          responseStart: 500,
          activationStart: 0, // Normal navigation
        },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TTFB',
          value: 500, // responseStart - activationStart(0)
          rating: 'good',
        })
      );

      cleanup();
    });

    it('should account for bfcache restore (activationStart)', () => {
      const callback = vi.fn();
      const cleanup = observeTTFB(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        {
          responseStart: 500,
          activationStart: 200, // bfcache restore
        },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TTFB',
          value: 300, // 500 - 200
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
    // INP reports on visibility change or cleanup (web-vitals standard)
    // Only counts events with interactionId (discrete events)

    it('should track maximum interaction duration on cleanup', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([{ duration: 100, interactionId: 1 }]);

      // INP should NOT report immediately
      expect(callback).not.toHaveBeenCalled();

      // Cleanup triggers final report
      cleanup();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'INP',
          value: 100,
          rating: 'good',
        })
      );
    });

    it('should track maximum across multiple interactions', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { duration: 100, interactionId: 1 },
        { duration: 250, interactionId: 2 },
        { duration: 150, interactionId: 3 },
      ]);

      cleanup();

      // Should report the max (250)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 250,
          rating: 'needs-improvement',
        })
      );
    });

    it('should ignore events without interactionId', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      observer.trigger([
        { duration: 500, interactionId: 0 }, // Non-interaction event (scroll, etc.)
        { duration: 100, interactionId: 1 }, // Real interaction
      ]);

      cleanup();

      // Should report 100, not 500
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 100,
        })
      );
    });

    it('should not count same interactionId twice', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      const observer = MockPerformanceObserver.getLastInstance();

      // Same interactionId (e.g., pointerdown + pointerup)
      observer.trigger([
        { duration: 100, interactionId: 1 },
        { duration: 120, interactionId: 1 }, // Same interaction, higher duration
      ]);

      cleanup();

      // Should only count first entry with this interactionId
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 100,
        })
      );
    });

    it('should not report if no interactions', () => {
      const callback = vi.fn();
      const cleanup = observeINP(callback);

      // No entries triggered
      cleanup();

      expect(callback).not.toHaveBeenCalled();
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

/**
 * Web Vitals collection - NO external dependencies
 * Uses PerformanceObserver API directly
 */

import type { MetricName, MetricRating, Metric } from '../types/index.js';

// Google's official thresholds
const THRESHOLDS: Record<MetricName, [number, number]> = {
  CLS: [0.1, 0.25],
  LCP: [2500, 4000],
  FID: [100, 300],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

function getRating(name: MetricName, value: number): MetricRating {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function createMetric(
  name: MetricName,
  value: number,
  prevValue: number = 0
): Metric {
  return {
    name,
    value,
    rating: getRating(name, value),
    delta: value - prevValue,
    timestamp: Date.now(),
  };
}

// Check if PerformanceObserver supports given entry type
function isSupported(type: string): boolean {
  if (typeof PerformanceObserver === 'undefined') return false;
  try {
    return PerformanceObserver.supportedEntryTypes?.includes(type) ?? false;
  } catch {
    return false;
  }
}

/**
 * CLS - Cumulative Layout Shift
 * Measures visual stability using session windows algorithm (web-vitals standard)
 *
 * Session window rules:
 * - Max duration: 5 seconds
 * - Max gap between shifts: 1 second
 * - Reports final value on visibility change (hidden) or pagehide
 *
 * @see https://web.dev/cls/#what-is-a-good-cls-score
 * @see https://github.com/GoogleChrome/web-vitals/blob/main/src/onCLS.ts
 */
export function observeCLS(callback: (metric: Metric) => void): () => void {
  if (!isSupported('layout-shift')) return () => {};

  // Session window state
  let sessionValue = 0;
  let sessionStart = -1;
  let lastEntryTime = 0;

  // Track max session for final CLS value
  let maxSessionValue = 0;
  let prevReportedValue = 0;
  let hasReported = false;

  const SESSION_GAP = 1000; // 1 second max gap
  const SESSION_MAX = 5000; // 5 seconds max duration

  const processEntries = (entries: PerformanceEntryList) => {
    for (const entry of entries) {
      const shift = entry as LayoutShiftEntry;

      // Ignore shifts with recent user input (clicks, taps, key presses)
      if (shift.hadRecentInput) continue;

      const entryTime = shift.startTime;

      // Start new session if:
      // 1. First entry ever
      // 2. Gap from last entry > 1 second
      // 3. Session duration would exceed 5 seconds
      if (
        sessionStart === -1 ||
        entryTime - lastEntryTime > SESSION_GAP ||
        entryTime - sessionStart > SESSION_MAX
      ) {
        // Start new session
        sessionStart = entryTime;
        sessionValue = 0;
      }

      // Accumulate shift in current session
      sessionValue += shift.value;
      lastEntryTime = entryTime;

      // Track maximum session value (this is the CLS score)
      if (sessionValue > maxSessionValue) {
        maxSessionValue = sessionValue;
      }
    }
  };

  const reportCLS = () => {
    // Only report if we have a value and it changed
    if (maxSessionValue > 0 && maxSessionValue !== prevReportedValue) {
      callback(createMetric('CLS', maxSessionValue, prevReportedValue));
      prevReportedValue = maxSessionValue;
      hasReported = true;
    }
  };

  // Report on visibility change (user switches tab or minimizes)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      reportCLS();
    }
  };

  // Report on page unload (closing tab, navigation away)
  const onPageHide = () => {
    reportCLS();
  };

  const observer = new PerformanceObserver((list) => {
    processEntries(list.getEntries());
  });

  observer.observe({ type: 'layout-shift', buffered: true });

  // Listen for lifecycle events to report final CLS
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  // Cleanup function
  return () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);

    // Report final value on disconnect if not already reported
    if (!hasReported && maxSessionValue > 0) {
      reportCLS();
    }
  };
}

/**
 * LCP - Largest Contentful Paint
 * Measures loading performance
 *
 * LCP is finalized when:
 * - User interacts with the page (click, keydown, scroll, etc.)
 * - Page becomes hidden (visibility change)
 *
 * @see https://web.dev/lcp/
 * @see https://github.com/GoogleChrome/web-vitals/blob/main/src/onLCP.ts
 */
export function observeLCP(callback: (metric: Metric) => void): () => void {
  if (!isSupported('largest-contentful-paint')) return () => {};

  let lcpValue = 0;
  let prevReportedValue = 0;
  let hasReported = false;

  const reportLCP = () => {
    if (lcpValue > 0 && !hasReported) {
      callback(createMetric('LCP', lcpValue, prevReportedValue));
      prevReportedValue = lcpValue;
      hasReported = true;
    }
  };

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    // LCP can have multiple entries, track the last one
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      lcpValue = lastEntry.startTime;
    }
  });

  // LCP is finalized on first user input
  const stopListening = () => {
    reportLCP();
    observer.disconnect();
    removeEventListeners();
  };

  // User input events that finalize LCP
  const onInput = () => stopListening();
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      stopListening();
    }
  };

  const removeEventListeners = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    // Use capture to catch events before they're handled
    ['keydown', 'click', 'pointerdown'].forEach((type) => {
      document.removeEventListener(type, onInput, { capture: true } as EventListenerOptions);
    });
  };

  observer.observe({ type: 'largest-contentful-paint', buffered: true });

  // Listen for events that finalize LCP
  document.addEventListener('visibilitychange', onVisibilityChange);
  ['keydown', 'click', 'pointerdown'].forEach((type) => {
    document.addEventListener(type, onInput, { capture: true, once: true });
  });

  return () => {
    if (!hasReported && lcpValue > 0) {
      reportLCP();
    }
    observer.disconnect();
    removeEventListeners();
  };
}

/**
 * FID - First Input Delay
 * Measures interactivity (deprecated in favor of INP)
 */
export function observeFID(callback: (metric: Metric) => void): () => void {
  if (!isSupported('first-input')) return () => {};

  const observer = new PerformanceObserver((list) => {
    const entry = list.getEntries()[0] as PerformanceEventTiming | undefined;
    if (entry) {
      const value = entry.processingStart - entry.startTime;
      callback(createMetric('FID', value));
      observer.disconnect();
    }
  });

  observer.observe({ type: 'first-input', buffered: true });
  return () => observer.disconnect();
}

/**
 * INP - Interaction to Next Paint
 * Measures responsiveness (replaced FID as Core Web Vital)
 *
 * INP tracks the worst interaction latency during the page lifecycle.
 * Reports on visibility change (hidden) or pagehide.
 *
 * Simplified algorithm (vs web-vitals p98):
 * - Tracks max interaction duration
 * - Only counts discrete events (click, keydown, pointerdown)
 * - Reports once on page hide
 *
 * @see https://web.dev/inp/
 * @see https://github.com/GoogleChrome/web-vitals/blob/main/src/onINP.ts
 */
export function observeINP(callback: (metric: Metric) => void): () => void {
  if (!isSupported('event')) return () => {};

  let maxINP = 0;
  let prevReportedValue = 0;
  let hasReported = false;

  // Track interactions by interactionId to avoid counting same interaction twice
  const processedInteractions = new Set<number>();

  const reportINP = () => {
    if (maxINP > 0 && !hasReported) {
      callback(createMetric('INP', maxINP, prevReportedValue));
      prevReportedValue = maxINP;
      hasReported = true;
    }
  };

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const eventEntry = entry as PerformanceEventTimingExtended;

      // Only count discrete events (not scroll, mousemove, etc.)
      // interactionId is 0 or undefined for non-interaction events
      if (!eventEntry.interactionId) continue;

      // Avoid counting the same interaction multiple times
      // (e.g., pointerdown + pointerup for same click)
      if (processedInteractions.has(eventEntry.interactionId)) continue;

      // Prevent unbounded growth in long-lived SPAs
      if (processedInteractions.size >= 1000) {
        processedInteractions.clear();
      }
      processedInteractions.add(eventEntry.interactionId);

      // Track maximum interaction duration
      if (eventEntry.duration > maxINP) {
        maxINP = eventEntry.duration;
      }
    }
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      reportINP();
    }
  };

  const onPageHide = () => {
    reportINP();
  };

  observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);

    if (!hasReported && maxINP > 0) {
      reportINP();
    }
  };
}

/**
 * FCP - First Contentful Paint
 * Measures when first content is painted
 */
export function observeFCP(callback: (metric: Metric) => void): () => void {
  if (!isSupported('paint')) return () => {};

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        callback(createMetric('FCP', entry.startTime));
        observer.disconnect();
      }
    }
  });

  observer.observe({ type: 'paint', buffered: true });
  return () => observer.disconnect();
}

/**
 * TTFB - Time to First Byte
 * Measures server response time from navigation start
 *
 * TTFB = responseStart - activationStart (or 0 if no bfcache)
 *
 * activationStart is non-zero for bfcache restores, ensuring we measure
 * the actual server response time, not time in cache.
 *
 * @see https://web.dev/ttfb/
 * @see https://github.com/GoogleChrome/web-vitals/blob/main/src/onTTFB.ts
 */
export function observeTTFB(callback: (metric: Metric) => void): () => void {
  if (!isSupported('navigation')) return () => {};

  const observer = new PerformanceObserver((list) => {
    const entry = list.getEntries()[0] as PerformanceNavigationTiming | undefined;
    if (entry) {
      // activationStart is non-zero for bfcache restores
      const activationStart = (entry as PerformanceNavigationTiming & { activationStart?: number }).activationStart ?? 0;
      const value = Math.max(entry.responseStart - activationStart, 0);
      callback(createMetric('TTFB', value));
      observer.disconnect();
    }
  });

  observer.observe({ type: 'navigation', buffered: true });
  return () => observer.disconnect();
}

// Type for layout-shift entries (not in standard lib)
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Extended PerformanceEventTiming with interactionId (not in all TS versions)
interface PerformanceEventTimingExtended extends PerformanceEventTiming {
  interactionId?: number;
}

// Export observer map for easy access
export const vitalObservers = {
  CLS: observeCLS,
  LCP: observeLCP,
  FID: observeFID,
  INP: observeINP,
  FCP: observeFCP,
  TTFB: observeTTFB,
} as const;

export type { Metric, MetricName, MetricRating };

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
 * Measures visual stability
 */
export function observeCLS(callback: (metric: Metric) => void): () => void {
  if (!isSupported('layout-shift')) return () => {};

  let clsValue = 0;
  let prevValue = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Only count shifts without recent user input
      if (!(entry as LayoutShiftEntry).hadRecentInput) {
        clsValue += (entry as LayoutShiftEntry).value;
      }
    }
    callback(createMetric('CLS', clsValue, prevValue));
    prevValue = clsValue;
  });

  observer.observe({ type: 'layout-shift', buffered: true });
  return () => observer.disconnect();
}

/**
 * LCP - Largest Contentful Paint
 * Measures loading performance
 */
export function observeLCP(callback: (metric: Metric) => void): () => void {
  if (!isSupported('largest-contentful-paint')) return () => {};

  let prevValue = 0;

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    // LCP can have multiple entries, we want the last one
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      const value = lastEntry.startTime;
      callback(createMetric('LCP', value, prevValue));
      prevValue = value;
    }
  });

  observer.observe({ type: 'largest-contentful-paint', buffered: true });
  return () => observer.disconnect();
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
    }
  });

  observer.observe({ type: 'first-input', buffered: true });
  return () => observer.disconnect();
}

/**
 * INP - Interaction to Next Paint
 * Measures responsiveness (replaced FID as Core Web Vital)
 */
export function observeINP(callback: (metric: Metric) => void): () => void {
  if (!isSupported('event')) return () => {};

  let maxINP = 0;
  let prevValue = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const duration = (entry as PerformanceEventTiming).duration;
      if (duration > maxINP) {
        maxINP = duration;
        callback(createMetric('INP', maxINP, prevValue));
        prevValue = maxINP;
      }
    }
  });

  observer.observe({ type: 'event', buffered: true });
  return () => observer.disconnect();
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
 * Measures server response time
 */
export function observeTTFB(callback: (metric: Metric) => void): () => void {
  if (!isSupported('navigation')) return () => {};

  const observer = new PerformanceObserver((list) => {
    const entry = list.getEntries()[0] as PerformanceNavigationTiming | undefined;
    if (entry) {
      const value = entry.responseStart - entry.requestStart;
      callback(createMetric('TTFB', value));
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

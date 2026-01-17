/**
 * Main observe() function - combines vitals, errors, and transport
 */

import { vitalObservers, type Metric, type MetricName } from './vitals.js';
import { observeErrors, type ObserveErrorEvent } from './errors.js';
import { createFetchTransport } from '../transport/fetch.js';
import type { ObserveOptions, VitalEvent, ObserveEvent, Transport } from '../types/index.js';

// Default configuration
const defaults = {
  endpoint: '/api/observe',
  vitals: true as const,
  errors: true,
  batchSize: 10,
  flushInterval: 5000,
  sampleRate: 1,
  debug: false,
} satisfies Required<Omit<ObserveOptions, 'transport' | 'filter'>>;

// Global observer callback for state machines
let globalObserverCallback: ((event: ObserveEvent) => void) | null = null;

/**
 * Set global observer callback for state machines
 * Called internally to connect machines to observe()
 */
export function setGlobalObserver(callback: typeof globalObserverCallback): void {
  globalObserverCallback = callback;
}

/**
 * Get global observer callback
 * Used by createMachine to send transition events
 */
export function getGlobalObserver(): typeof globalObserverCallback {
  return globalObserverCallback;
}

/**
 * Main observe function - starts collecting metrics and errors
 *
 * @param options - Configuration options
 * @returns Cleanup function to stop observing
 *
 * @example
 * // Basic usage
 * observe();
 *
 * @example
 * // With options
 * observe({
 *   endpoint: '/api/metrics',
 *   vitals: ['CLS', 'LCP', 'INP'],
 *   errors: true,
 *   debug: true,
 * });
 */
export function observe(options: ObserveOptions = {}): () => void {
  // Check sampling rate
  if (Math.random() > (options.sampleRate ?? defaults.sampleRate)) {
    return () => {};
  }

  const config = { ...defaults, ...options };
  const transport: Transport = config.transport ?? createFetchTransport(config.endpoint);

  const cleanups: (() => void)[] = [];
  const buffer: ObserveEvent[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  // Get current URL
  const getUrl = (): string => {
    try {
      return typeof location !== 'undefined' ? location.href : '';
    } catch {
      return '';
    }
  };

  // Buffer an event and potentially flush
  const bufferEvent = (event: ObserveEvent): void => {
    // Apply filter if provided
    if (config.filter && !config.filter(event)) {
      return;
    }

    if (config.debug) {
      console.log('[svoose]', event);
    }

    buffer.push(event);

    if (buffer.length >= config.batchSize) {
      flush();
    }
  };

  // Send buffered events to transport
  const flush = (): void => {
    if (buffer.length === 0) return;

    const events = buffer.splice(0, buffer.length);
    // Handle both Promise and non-Promise returns from transport.send()
    const result = transport.send(events);
    if (result && typeof result.catch === 'function') {
      result.catch((err) => {
        if (config.debug) {
          console.error('[svoose] transport error:', err);
        }
      });
    }
  };

  // Convert metric to vital event
  const handleMetric = (metric: Metric): void => {
    const vitalEvent: VitalEvent = {
      type: 'vital',
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      timestamp: metric.timestamp,
      url: getUrl(),
    };
    bufferEvent(vitalEvent);
  };

  // Setup vitals observers
  if (config.vitals) {
    const vitalsToObserve: MetricName[] =
      config.vitals === true
        ? ['CLS', 'LCP', 'FID', 'INP', 'FCP', 'TTFB']
        : config.vitals;

    for (const name of vitalsToObserve) {
      const observer = vitalObservers[name];
      if (observer) {
        cleanups.push(observer(handleMetric));
      }
    }
  }

  // Setup error observer
  if (config.errors) {
    cleanups.push(
      observeErrors((event: ObserveErrorEvent) => {
        bufferEvent(event);
      })
    );
  }

  // Setup global observer for state machines
  setGlobalObserver(bufferEvent);
  cleanups.push(() => setGlobalObserver(null));

  // Setup flush interval
  flushTimer = setInterval(flush, config.flushInterval);
  cleanups.push(() => {
    if (flushTimer) clearInterval(flushTimer);
  });

  // Flush on page visibility change (user navigating away)
  if (typeof document !== 'undefined') {
    const visibilityHandler = (): void => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    cleanups.push(() => {
      document.removeEventListener('visibilitychange', visibilityHandler);
    });
  }

  // Flush on beforeunload
  if (typeof window !== 'undefined') {
    const unloadHandler = (): void => {
      flush();
    };
    window.addEventListener('beforeunload', unloadHandler);
    cleanups.push(() => {
      window.removeEventListener('beforeunload', unloadHandler);
    });
  }

  // Return cleanup function
  return () => {
    flush();
    cleanups.forEach((fn) => fn());
  };
}

export type { ObserveOptions };

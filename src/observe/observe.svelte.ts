/**
 * Main observe() function - combines vitals, errors, and transport
 */

import { vitalObservers, type Metric, type MetricName } from './vitals.js';
import { observeErrors, type ObserveErrorEvent } from './errors.js';
import { createHybridTransport } from '../transport/hybrid.js';
import {
  createSampler,
  eventTypeToSamplingType,
  type Sampler,
} from './sampling.js';
import { createSessionManager, type SessionManager } from './session.js';
import { setMetricEmitter, getMetricEmitter } from '../metrics/metric.js';
import { sanitizeEvent } from './privacy.js';
import { fingerprint as computeFingerprint, createDedupTracker, type DedupTracker } from './fingerprint.js';
import type {
  ObserveOptions,
  ObserveInstance,
  ObserveStats,
  VitalEvent,
  ObserveEvent,
  Transport,
  ErrorTrackingConfig,
  ErrorsOption,
} from '../types/index.js';

// Default configuration
const defaults = {
  endpoint: '/api/metrics',
  vitals: true as const,
  errors: true as ErrorsOption,
  batchSize: 10,
  flushInterval: 5000,
  debug: false,
} satisfies Required<Omit<ObserveOptions, 'transport' | 'filter' | 'sampling' | 'session' | 'onError' | 'privacy'>>;

/**
 * Validate observe options at startup
 */
function validateOptions(options: ObserveOptions): void {
  if (options.batchSize !== undefined && (options.batchSize < 1 || !Number.isFinite(options.batchSize))) {
    throw new Error(`[svoose] batchSize must be >= 1, got ${options.batchSize}`);
  }
  if (options.flushInterval !== undefined && (options.flushInterval < 100 || !Number.isFinite(options.flushInterval))) {
    throw new Error(`[svoose] flushInterval must be >= 100ms, got ${options.flushInterval}`);
  }
  if (typeof options.sampling === 'number' && (options.sampling < 0 || options.sampling > 1)) {
    throw new Error(`[svoose] sampling rate must be between 0 and 1, got ${options.sampling}`);
  }
}

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

// SSR noop instance
const noopInstance: ObserveInstance = Object.assign(
  () => {},
  {
    flush: () => {},
    destroy: () => {},
    getStats: (): ObserveStats => ({ buffered: 0, sent: 0, dropped: 0, lastSendTime: 0, transportErrors: 0 }),
    onEvent: () => () => {},
  }
);

/**
 * Main observe function - starts collecting metrics and errors
 *
 * @param options - Configuration options
 * @returns ObserveInstance — callable (backward compat) with flush/destroy/getStats/onEvent methods
 *
 * @example
 * // Backward compatible — calling instance === destroy()
 * const cleanup = observe({ endpoint: '/api/metrics' });
 * cleanup();
 *
 * @example
 * // New API — use methods
 * const obs = observe({ endpoint: '/api/metrics' });
 * obs.getStats();
 * obs.flush();
 * obs.onEvent((event) => console.log(event));
 * obs.destroy();
 */
export function observe(options: ObserveOptions = {}): ObserveInstance {
  // SSR guard — silently return noop instance if not in browser
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return noopInstance;
  }

  validateOptions(options);

  const config = { ...defaults, ...options };
  // Default transport: hybrid (fetch + beacon on unload) for reliable delivery
  const transport: Transport = config.transport ?? createHybridTransport(config.endpoint);

  // Create sampler if sampling option is provided
  const sampler: Sampler | null = config.sampling != null
    ? createSampler(config.sampling)
    : null;

  // Create session manager if session option is provided
  const sessionManager: SessionManager | null = config.session != null
    ? createSessionManager(config.session, config.debug)
    : null;

  // Resolve error tracking config
  const errorsConfig: ErrorTrackingConfig | null =
    typeof config.errors === 'object' && config.errors !== null ? config.errors : null;

  // Optional dedup tracker (only when errors.dedupe === true)
  const dedupTracker: DedupTracker | null = errorsConfig?.dedupe
    ? createDedupTracker(errorsConfig.dedupeWindow ?? 60_000)
    : null;

  const cleanups: (() => void)[] = [];

  // Cleanup session manager on destroy
  if (sessionManager) {
    cleanups.push(() => sessionManager.destroy());
  }

  // Cleanup dedup tracker on destroy
  if (dedupTracker) {
    cleanups.push(() => dedupTracker.clear());
  }
  const buffer: ObserveEvent[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  // Stats tracking
  const stats: ObserveStats = { buffered: 0, sent: 0, dropped: 0, lastSendTime: 0, transportErrors: 0 };

  // Event subscribers
  const eventListeners: Set<(event: ObserveEvent) => void> = new Set();

  // Get current URL
  const getUrl = (): string => {
    try {
      return typeof location !== 'undefined' ? location.href : '';
    } catch {
      return '';
    }
  };

  // Buffer an event and potentially flush
  //
  // Pipeline (canonical order — see v0.2.0 plan):
  //   1. Fingerprint (error events only — uses RAW message before privacy)
  //   2. Dedup check (drop duplicates within window)
  //   3. Privacy / sanitize (may DROP via null)
  //   4. Filter (may DROP)
  //   5. Sampling (may DROP)
  //   6. Inject sessionId
  //   7. Notify onEvent listeners
  //   8. Buffer
  const bufferEvent = (incoming: ObserveEvent): void => {
    let event = incoming;

    // 1. Fingerprint (compute on RAW message before any sanitization)
    if (event.type === 'error' || event.type === 'unhandled-rejection') {
      if (!event.fingerprint) {
        event.fingerprint = computeFingerprint(event);
      }

      // 2. Dedup check
      if (dedupTracker && dedupTracker.seen(event.fingerprint, Date.now())) {
        stats.dropped++;
        return;
      }
    }

    // 3. Privacy / sanitize — may DROP
    if (config.privacy) {
      const sanitized = sanitizeEvent(event, config.privacy);
      if (sanitized === null) {
        stats.dropped++;
        return;
      }
      event = sanitized;
    }

    // 4. Filter
    if (config.filter && !config.filter(event)) {
      stats.dropped++;
      return;
    }

    // 5. Sampling
    if (sampler) {
      const samplingType = eventTypeToSamplingType(event.type);
      if (samplingType && !sampler.shouldSample(samplingType)) {
        stats.dropped++;
        return;
      }
    }

    // 6. Add sessionId if session manager is enabled
    if (sessionManager) {
      // All event types have optional sessionId, safe to assign
      (event as { sessionId?: string }).sessionId = sessionManager.getSessionId();
    }

    if (config.debug) {
      console.log('[svoose]', event);
    }

    // 7. Notify event subscribers
    for (const listener of eventListeners) {
      try { listener(event); } catch { /* ignore listener errors */ }
    }

    // 8. Buffer
    buffer.push(event);
    stats.buffered++;

    if (buffer.length >= config.batchSize) {
      flush();
    }
  };

  // Handle transport errors consistently
  const handleError = (err: unknown): void => {
    stats.transportErrors++;
    const error = err instanceof Error ? err : new Error(String(err));
    if (config.onError) {
      config.onError(error);
    }
    if (config.debug) {
      console.error('[svoose] transport error:', error);
    }
  };

  // Send buffered events to transport
  const flush = (): void => {
    if (buffer.length === 0) return;

    const events = buffer.splice(0, buffer.length);
    stats.lastSendTime = Date.now();
    try {
      // Handle both Promise and non-Promise returns from transport.send()
      const result = transport.send(events);
      if (result && typeof result.then === 'function') {
        result.then(
          () => { stats.sent += events.length; },
          (err) => handleError(err),
        );
      } else {
        // Sync transport succeeded
        stats.sent += events.length;
      }
    } catch (err) {
      handleError(err);
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
  cleanups.push(() => {
    // Only clear if we're still the active observer
    if (getGlobalObserver() === bufferEvent) {
      setGlobalObserver(null);
    }
  });

  // Setup metric emitter for custom metrics
  setMetricEmitter(bufferEvent);
  cleanups.push(() => {
    // Only clear if we're still the active emitter
    if (getMetricEmitter() === bufferEvent) {
      setMetricEmitter(null);
    }
  });

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

  // Destroy function
  const destroy = (): void => {
    flush();
    cleanups.forEach((fn) => fn());
    eventListeners.clear();
    // Destroy transport if it has a destroy method (e.g. HybridTransport)
    const destroyable = transport as Transport & { destroy?: () => void };
    if (typeof destroyable.destroy === 'function') {
      destroyable.destroy();
    }
  };

  // Build callable instance: instance() === instance.destroy()
  const instance = (() => destroy()) as unknown as ObserveInstance;
  instance.flush = flush;
  instance.destroy = destroy;
  instance.getStats = () => ({ ...stats });
  instance.onEvent = (callback: (event: ObserveEvent) => void) => {
    eventListeners.add(callback);
    return () => { eventListeners.delete(callback); };
  };

  return instance;
}

export type { ObserveOptions, ObserveInstance, ObserveStats };

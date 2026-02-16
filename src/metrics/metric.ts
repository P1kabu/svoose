/**
 * Custom metrics module
 *
 * Provides metric() function for sending custom events with pending buffer support.
 */

import type { CustomMetricEvent, ObserveEvent } from '../types/index.js';

// Maximum pending events before dropping (with warning in dev)
const MAX_PENDING_EVENTS = 100;

// Emitter function set by observe()
let emitter: ((event: ObserveEvent) => void) | null = null;

// Pending events buffer for events sent before observe() is initialized
const pendingEvents: CustomMetricEvent[] = [];

/**
 * Set the metric emitter function
 * Called by observe() to wire up the metric system
 *
 * @param emit - The emit function from observe(), or null to disconnect
 */
export function setMetricEmitter(emit: ((event: ObserveEvent) => void) | null): void {
  emitter = emit;

  // Flush pending events when emitter is set
  if (emitter && pendingEvents.length > 0) {
    const events = pendingEvents.splice(0, pendingEvents.length);
    for (const event of events) {
      emitter(event);
    }
  }
}

/**
 * Send a custom metric event
 *
 * Events are automatically batched with other metrics and sent to your backend.
 * If called before observe() is initialized, events are buffered (max 100).
 *
 * @param name - Metric name (e.g., 'checkout_started', 'button_clicked')
 * @param data - Optional data payload
 *
 * @example
 * metric('checkout_started', { step: 1, cartTotal: 99.99 });
 * metric('button_clicked', { id: 'submit-btn' });
 * metric('feature_used', { name: 'dark_mode', enabled: true });
 */
/**
 * Get the current metric emitter function (for internal use)
 * @internal
 */
export function getMetricEmitter(): ((event: ObserveEvent) => void) | null {
  return emitter;
}

declare const process: { env: Record<string, string | undefined> } | undefined;

function isDev(): boolean {
  try {
    if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') {
      return true;
    }
    if ((import.meta as any).env?.DEV === true) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function metric(name: string, data: Record<string, unknown> = {}): void {
  emitEvent({ type: 'custom', name, data, timestamp: Date.now() });
}

/**
 * Internal helper to emit or buffer a CustomMetricEvent
 */
function emitEvent(event: CustomMetricEvent): void {
  if (emitter) {
    emitter(event);
  } else {
    if (pendingEvents.length >= MAX_PENDING_EVENTS) {
      if (isDev()) {
        console.warn(
          `[svoose] metric() buffer full (${MAX_PENDING_EVENTS} events). ` +
          `Call observe() to start sending events. New events are being dropped.`
        );
      }
      return;
    }
    pendingEvents.push(event);
  }
}

/**
 * Internal helper for typed metric helpers (counter, gauge, histogram)
 */
function emitMetric(
  name: string,
  metricKind: 'counter' | 'gauge' | 'histogram',
  value: number,
  metadata: Record<string, unknown> = {},
): void {
  emitEvent({ type: 'custom', name, metricKind, value, data: metadata, timestamp: Date.now() });
}

/**
 * Increment a counter metric
 *
 * @param name - Counter name
 * @param value - Increment amount (default: 1)
 * @param metadata - Optional metadata
 *
 * @example
 * counter('page_views');
 * counter('items_purchased', 3);
 * counter('api_calls', 1, { endpoint: '/users' });
 */
export function counter(name: string, value: number = 1, metadata?: Record<string, unknown>): void {
  emitMetric(name, 'counter', value, metadata);
}

/**
 * Set a gauge metric (point-in-time value)
 *
 * @param name - Gauge name
 * @param value - Current value
 * @param metadata - Optional metadata
 *
 * @example
 * gauge('active_users', 42);
 * gauge('memory_usage_mb', 256, { heap: 'old' });
 */
export function gauge(name: string, value: number, metadata?: Record<string, unknown>): void {
  emitMetric(name, 'gauge', value, metadata);
}

/**
 * Record a histogram metric (distribution value)
 *
 * @param name - Histogram name
 * @param value - Observed value
 * @param metadata - Optional metadata
 *
 * @example
 * histogram('response_time_ms', 123);
 * histogram('payload_size', 4096, { route: '/api/data' });
 */
export function histogram(name: string, value: number, metadata?: Record<string, unknown>): void {
  emitMetric(name, 'histogram', value, metadata);
}

// ============================================
// Test helpers (not exported in production builds)
// ============================================

/**
 * Get number of pending events (for testing)
 * @internal
 */
export function _getPendingEventsCount(): number {
  return pendingEvents.length;
}

/**
 * Clear pending events (for testing)
 * @internal
 */
export function _clearPendingEvents(): void {
  pendingEvents.length = 0;
}

// ============================================
// Metric Types
// ============================================

export type MetricName = 'CLS' | 'LCP' | 'FID' | 'INP' | 'FCP' | 'TTFB';

export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface Metric {
  name: MetricName;
  value: number;
  rating: MetricRating;
  delta: number;
  timestamp: number;
}

// ============================================
// Error Types
// ============================================

export interface ErrorEvent {
  type: 'error';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  url: string;
  machineId?: string;
  machineState?: string;
}

export interface UnhandledRejectionEvent {
  type: 'unhandled-rejection';
  reason: string;
  timestamp: number;
  url: string;
  machineId?: string;
  machineState?: string;
}

export type ObserveErrorEvent = ErrorEvent | UnhandledRejectionEvent;

// ============================================
// Vital Event
// ============================================

export interface VitalEvent {
  type: 'vital';
  name: MetricName;
  value: number;
  rating: MetricRating;
  delta: number;
  timestamp: number;
  url: string;
}

// ============================================
// Transition Event (for state machines)
// ============================================

export interface TransitionEvent {
  type: 'transition';
  machineId: string;
  from: string;
  to: string;
  event: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

// ============================================
// Union Event Type
// ============================================

export type ObserveEvent = VitalEvent | ObserveErrorEvent | TransitionEvent;

// ============================================
// Transport Types
// ============================================

export interface Transport {
  /** Send events to backend. Can return Promise or void for sync transports. */
  send(events: ObserveEvent[]): Promise<void> | void;
}

export interface TransportOptions {
  headers?: Record<string, string>;
  onError?: (error: Error) => void;
}

// ============================================
// Sampling Types
// ============================================

/**
 * Per-event-type sampling rates
 * Each rate is a number between 0 and 1 (0 = disabled, 1 = all)
 */
export interface SamplingConfig {
  /** Sampling rate for Web Vitals events (default: 1) */
  vitals?: number;
  /** Sampling rate for error events (default: 1) */
  errors?: number;
  /** Sampling rate for custom metric events (default: 1) */
  custom?: number;
  /** Sampling rate for state machine transition events (default: 1) */
  transitions?: number;
  /** Sampling rate for identify events (default: 1) */
  identify?: number;
}

/**
 * Sampling option - either a single rate for all events or per-type config
 */
export type SamplingOption = number | SamplingConfig;

// ============================================
// Observe Options
// ============================================

export interface ObserveOptions {
  /** URL endpoint for sending data */
  endpoint?: string;
  /** Custom transport implementation */
  transport?: Transport;

  /** Collect Web Vitals. true = all, array = selected */
  vitals?: boolean | MetricName[];
  /** Collect errors */
  errors?: boolean;

  /** Batch size before sending */
  batchSize?: number;
  /** Flush interval in ms */
  flushInterval?: number;

  /** Filter function for events */
  filter?: (event: ObserveEvent) => boolean;

  /**
   * Per-event-type sampling rates
   *
   * @example
   * // Simple - same rate for all events
   * sampling: 0.1 // 10% of all events
   *
   * @example
   * // Per-event-type rates (recommended)
   * sampling: {
   *   vitals: 0.1,       // 10% - sufficient for statistics
   *   errors: 1.0,       // 100% - all errors matter
   *   custom: 0.5,       // 50%
   *   transitions: 0.0,  // disabled
   * }
   */
  sampling?: SamplingOption;

  /**
   * @deprecated Use `sampling` instead. Will be removed in v0.3.0.
   * Global sampling rate (0-1) - applies to entire observer
   */
  sampleRate?: number;

  /** Log to console */
  debug?: boolean;
}

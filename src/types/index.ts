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
  sessionId?: string;
  machineId?: string;
  machineState?: string;
}

export interface UnhandledRejectionEvent {
  type: 'unhandled-rejection';
  reason: string;
  timestamp: number;
  url: string;
  sessionId?: string;
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
  sessionId?: string;
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
  sessionId?: string;
  context?: Record<string, unknown>;
}

// ============================================
// Custom Metric Event
// ============================================

export interface CustomMetricEvent {
  type: 'custom';
  name: string;
  metricKind?: 'counter' | 'gauge' | 'histogram';
  value?: number;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId?: string;
}

// ============================================
// Union Event Type
// ============================================

export type ObserveEvent = VitalEvent | ObserveErrorEvent | TransitionEvent | CustomMetricEvent;

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
// Session Types
// ============================================

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session timeout in milliseconds (default: 30 minutes) */
  timeout: number;
  /** Storage type for session persistence */
  storage: 'sessionStorage' | 'localStorage' | 'memory';
}

/**
 * Session option - true = defaults, false = disabled, object = custom config
 */
export type SessionOption = boolean | Partial<SessionConfig>;

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
   * Session tracking configuration
   *
   * @example
   * // Enable with defaults (30 min timeout, sessionStorage)
   * session: true
   *
   * @example
   * // Custom config
   * session: {
   *   timeout: 60 * 60 * 1000, // 1 hour
   *   storage: 'localStorage',
   * }
   *
   * @example
   * // Disable explicitly
   * session: false
   */
  session?: SessionOption;

  /**
   * @deprecated Use `sampling` instead. Will be removed in v0.3.0.
   * Global sampling rate (0-1) - applies to entire observer
   */
  sampleRate?: number;

  /** Log to console */
  debug?: boolean;
}

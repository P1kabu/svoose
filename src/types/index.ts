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
  send(events: ObserveEvent[]): Promise<void>;
}

export interface TransportOptions {
  headers?: Record<string, string>;
  onError?: (error: Error) => void;
}

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
  /** Sampling rate (0-1) */
  sampleRate?: number;

  /** Log to console */
  debug?: boolean;
}

/**
 * Sampling utilities for rate limiting events by type
 */

// ============================================
// Types
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

/**
 * Event types that can be sampled
 */
export type SamplingEventType = keyof SamplingConfig;

// ============================================
// Sampler
// ============================================

/**
 * Sampler interface returned by createSampler
 */
export interface Sampler {
  /**
   * Check if an event should be sampled (included)
   * @param eventType - The type of event
   * @returns true if the event should be included, false if dropped
   */
  shouldSample(eventType: SamplingEventType): boolean;

  /**
   * Get the sampling rate for an event type
   * @param eventType - The type of event
   * @returns The rate (0-1)
   */
  getRate(eventType: SamplingEventType): number;
}

/**
 * Normalize a sampling rate to be between 0 and 1
 */
function normalizeRate(rate: number): number {
  if (rate <= 0) return 0;
  if (rate >= 1) return 1;
  return rate;
}

/**
 * Create a sampler instance for filtering events by sampling rate
 *
 * @param config - Sampling configuration (number or per-type config)
 * @returns Sampler instance
 *
 * @example
 * // Simple - same rate for all events
 * const sampler = createSampler(0.1); // 10% of all events
 *
 * @example
 * // Per-event-type rates
 * const sampler = createSampler({
 *   vitals: 0.1,       // 10% of vitals
 *   errors: 1.0,       // 100% of errors
 *   custom: 0.5,       // 50% of custom metrics
 *   transitions: 0.0,  // disabled
 * });
 */
export function createSampler(config: SamplingOption): Sampler {
  // Build rates object with defaults
  const rates: Required<SamplingConfig> =
    typeof config === 'number'
      ? {
          vitals: normalizeRate(config),
          errors: normalizeRate(config),
          custom: normalizeRate(config),
          transitions: normalizeRate(config),
          identify: 1, // Always send identify events by default
        }
      : {
          vitals: normalizeRate(config.vitals ?? 1),
          errors: normalizeRate(config.errors ?? 1),
          custom: normalizeRate(config.custom ?? 1),
          transitions: normalizeRate(config.transitions ?? 1),
          identify: normalizeRate(config.identify ?? 1),
        };

  return {
    shouldSample(eventType: SamplingEventType): boolean {
      const rate = rates[eventType];

      // Fast paths
      if (rate >= 1) return true;
      if (rate <= 0) return false;

      // Random sampling
      return Math.random() < rate;
    },

    getRate(eventType: SamplingEventType): number {
      return rates[eventType];
    },
  };
}

/**
 * Map ObserveEvent.type to SamplingEventType
 */
export function eventTypeToSamplingType(
  eventType: string
): SamplingEventType | null {
  switch (eventType) {
    case 'vital':
      return 'vitals';
    case 'error':
    case 'unhandled-rejection':
      return 'errors';
    case 'custom':
      return 'custom';
    case 'transition':
      return 'transitions';
    case 'identify':
      return 'identify';
    default:
      return null;
  }
}

/**
 * Retry logic with configurable backoff strategies
 */

import type { RetryConfig } from '../types/index.js';

/**
 * Calculate delay for a given retry attempt
 *
 * @param config - Retry configuration
 * @param attempt - Current attempt number (1-based)
 * @returns Delay in milliseconds
 */
export function calculateDelay(config: RetryConfig, attempt: number): number {
  const initialDelay = config.initialDelay ?? 1000;
  const maxDelay = config.maxDelay ?? 30000;

  let delay: number;
  switch (config.backoff) {
    case 'fixed':
      delay = initialDelay;
      break;
    case 'linear':
      delay = Math.min(initialDelay * attempt, maxDelay);
      break;
    case 'exponential':
      delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      break;
    default:
      delay = initialDelay;
  }

  if (config.jitter) {
    delay = Math.round(delay * (0.9 + Math.random() * 0.2));
  }

  return delay;
}

/**
 * Retry wrapper for async functions
 * Standalone — can be used with any async transport
 *
 * @param fn - Async function to retry (receives optional AbortSignal)
 * @param config - Retry configuration
 * @param options - Optional timeout and abort control
 */
export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  config: RetryConfig,
  options?: {
    timeout?: number;
    shouldAbort?: () => boolean;
  }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    if (options?.shouldAbort?.()) {
      throw new Error('[svoose] Retry aborted');
    }

    try {
      let signal: AbortSignal | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (options?.timeout) {
        const controller = new AbortController();
        signal = controller.signal;
        timeoutId = setTimeout(() => controller.abort(), options.timeout);
      }

      try {
        return await fn(signal);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.attempts) {
        if (options?.shouldAbort?.()) {
          throw new Error('[svoose] Retry aborted');
        }
        const delay = calculateDelay(config, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('[svoose] Retry failed');
}

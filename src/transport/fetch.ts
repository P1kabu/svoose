/**
 * Fetch-based transport
 */

import type { Transport, FetchTransportOptions } from '../types/index.js';
import { withRetry } from './retry.js';

/**
 * Create a fetch-based transport
 * Always uses fetch with keepalive: true
 *
 * @param endpoint - URL to send events to
 * @param options - Transport options (headers, error callback, retry, timeout)
 */
export function createFetchTransport(
  endpoint: string,
  options: FetchTransportOptions = {}
): Transport {
  return {
    async send(events) {
      if (events.length === 0) return;

      const doFetch = async (signal?: AbortSignal): Promise<void> => {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify(events),
          keepalive: true,
          signal,
        });
      };

      try {
        if (options.retry) {
          await withRetry(doFetch, options.retry, { timeout: options.timeout });
        } else if (options.timeout) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), options.timeout);
          try {
            await doFetch(controller.signal);
          } finally {
            clearTimeout(timeoutId);
          }
        } else {
          await doFetch();
        }
      } catch (error) {
        // Notify local listener if provided, then re-throw so observe()
        // can update transportErrors and call ObserveOptions.onError.
        options.onError?.(error as Error);
        throw error;
      }
    },
  };
}

/**
 * Create a console transport for development/debugging
 */
export function createConsoleTransport(options: { pretty?: boolean } = {}): Transport {
  return {
    send(events) {
      for (const event of events) {
        if (options.pretty) {
          console.log('[svoose]', JSON.stringify(event, null, 2));
        } else {
          console.log('[svoose]', event);
        }
      }
    },
  };
}

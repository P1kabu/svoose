/**
 * Fetch-based transport
 */

import type { Transport, TransportOptions } from '../types/index.js';

/**
 * Create a fetch-based transport
 * Always uses fetch with keepalive: true
 *
 * @param endpoint - URL to send events to
 * @param options - Transport options (headers, error callback)
 */
export function createFetchTransport(
  endpoint: string,
  options: TransportOptions = {}
): Transport {
  return {
    async send(events) {
      if (events.length === 0) return;

      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify(events),
          keepalive: true,
        });
      } catch (error) {
        options.onError?.(error as Error);
      }
    },
  };
}

/**
 * Create a console transport for development/debugging
 */
export function createConsoleTransport(options: { pretty?: boolean } = {}): Transport {
  return {
    async send(events) {
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

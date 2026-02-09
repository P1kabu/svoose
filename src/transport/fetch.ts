/**
 * Fetch-based transport with sendBeacon fallback
 */

import type { Transport, TransportOptions } from '../types/index.js';

/**
 * Create a fetch-based transport
 * Uses sendBeacon for page unload, fetch otherwise
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
        const payload = JSON.stringify(events);

        // Use sendBeacon when page is hidden (e.g., user navigating away)
        // sendBeacon is more reliable for unload scenarios
        if (
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden' &&
          typeof navigator !== 'undefined' &&
          navigator.sendBeacon
        ) {
          const blob = new Blob([payload], { type: 'application/json' });
          const success = navigator.sendBeacon(endpoint, blob);
          if (!success) {
            throw new Error('sendBeacon failed');
          }
          return;
        }

        // Use fetch for normal operation
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: payload,
          // keepalive ensures request completes even if page is closed
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

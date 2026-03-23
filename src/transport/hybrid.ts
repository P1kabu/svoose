/**
 * Hybrid transport — fetch by default, beacon on page unload
 */

import type { HybridTransport, HybridTransportOptions, ObserveEvent } from '../types/index.js';
import { createFetchTransport } from './fetch.js';
import { createBeaconTransport } from './beacon.js';

/**
 * Create a hybrid transport that switches between fetch and beacon
 * based on page lifecycle events
 *
 * Retry/timeout config is passed ONLY to the fetch sub-transport.
 * Beacon NEVER retries (fire-and-forget by design).
 *
 * @param endpoint - URL to send events to
 * @param options - Hybrid transport options
 */
export function createHybridTransport(
  endpoint: string,
  options: HybridTransportOptions = {}
): HybridTransport {
  const { default: defaultMode = 'fetch', onUnload = 'beacon', retry, timeout, ...transportOptions } = options;

  // Fetch transport GETS retry config
  const fetchTransport = createFetchTransport(endpoint, { ...transportOptions, retry, timeout });
  // Beacon transport NEVER gets retry
  const beaconTransport = createBeaconTransport(endpoint, transportOptions);

  let isUnloading = false;

  const onBeforeUnload = () => {
    isUnloading = true;
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      isUnloading = true;
    } else if (document.visibilityState === 'visible') {
      isUnloading = false;
    }
  };

  // SSR guard
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function getActiveTransport() {
    const mode = isUnloading ? onUnload : defaultMode;
    return mode === 'beacon' ? beaconTransport : fetchTransport;
  }

  return {
    send(events: ObserveEvent[]) {
      return getActiveTransport().send(events);
    },
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', onBeforeUnload);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    },
  };
}

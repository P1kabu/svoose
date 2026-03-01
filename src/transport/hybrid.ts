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
 * @param endpoint - URL to send events to
 * @param options - Hybrid transport options
 */
export function createHybridTransport(
  endpoint: string,
  options: HybridTransportOptions = {}
): HybridTransport {
  const defaultMode = options.default ?? 'fetch';
  const unloadMode = options.onUnload ?? 'beacon';

  const fetchTransport = createFetchTransport(endpoint, options);
  const beaconTransport = createBeaconTransport(endpoint, options);

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
    const mode = isUnloading ? unloadMode : defaultMode;
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

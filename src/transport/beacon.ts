/**
 * Beacon-based transport using navigator.sendBeacon
 * Guarantees delivery even during page unload
 */

import type { Transport, BeaconTransportOptions, ObserveEvent } from '../types/index.js';

const DEFAULT_MAX_PAYLOAD_SIZE = 60 * 1024; // 60KB
const MAX_CHUNK_DEPTH = 20;

/**
 * Create a beacon-based transport
 * Uses navigator.sendBeacon for reliable delivery during page unload
 *
 * @param endpoint - URL to send events to
 * @param options - Beacon transport options
 */
export function createBeaconTransport(
  endpoint: string,
  options: BeaconTransportOptions = {}
): Transport {
  const maxPayloadSize = options.maxPayloadSize ?? DEFAULT_MAX_PAYLOAD_SIZE;

  function sendChunk(events: ObserveEvent[], depth: number): void {
    if (events.length === 0) return;

    if (depth >= MAX_CHUNK_DEPTH) {
      console.error('[svoose] Beacon chunk depth limit reached, dropping events');
      return;
    }

    const payload = JSON.stringify(events);

    if (payload.length > maxPayloadSize) {
      if (events.length === 1) {
        console.error('[svoose] Single event exceeds maxPayloadSize, dropping');
        return;
      }

      // Split in half and recurse
      const mid = Math.floor(events.length / 2);
      sendChunk(events.slice(0, mid), depth + 1);
      sendChunk(events.slice(mid), depth + 1);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;

    const blob = new Blob([payload], { type: 'application/json' });
    const success = navigator.sendBeacon(endpoint, blob);

    if (!success) {
      options.onError?.(new Error('sendBeacon failed'));
    }
  }

  return {
    send(events) {
      if (events.length === 0) return;

      // SSR guard
      if (typeof navigator === 'undefined') return;

      sendChunk(events, 0);
    },
  };
}

/**
 * Transport interface - defines how events are sent to backend
 */

import type { ObserveEvent } from '../types/index.js';

export interface Transport {
  send(events: ObserveEvent[]): Promise<void>;
}

export interface TransportOptions {
  headers?: Record<string, string>;
  onError?: (error: Error) => void;
}

/**
 * Transport interface - defines how events are sent to backend
 */

import type { ObserveEvent } from '../types/index.js';

export interface Transport {
  /** Send events to backend. Can return Promise or void for sync transports. */
  send(events: ObserveEvent[]): Promise<void> | void;
}

export interface TransportOptions {
  headers?: Record<string, string>;
  onError?: (error: Error) => void;
}

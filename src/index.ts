/**
 * 🪿 svoose - Observability + State Machines for Svelte 5
 *
 * @packageDocumentation
 */

// ============================================
// Core Observability
// ============================================
export { observe } from './observe/index.js';
export type { ObserveOptions } from './observe/index.js';

// ============================================
// Error Tracking
// ============================================
export {
  observeErrors,
  registerMachineContext,
  unregisterMachineContext,
} from './observe/index.js';
export type {
  ObserveErrorEvent,
  ErrorEvent,
  UnhandledRejectionEvent,
} from './observe/index.js';

// ============================================
// Web Vitals
// ============================================
export {
  observeCLS,
  observeLCP,
  observeFID,
  observeINP,
  observeFCP,
  observeTTFB,
  vitalObservers,
} from './observe/index.js';
export type { Metric, MetricName, MetricRating } from './observe/index.js';

// ============================================
// Transport
// ============================================
export { createFetchTransport, createConsoleTransport } from './transport/index.js';
export type { Transport, TransportOptions } from './transport/index.js';

// ============================================
// State Machines
// ============================================
export { createMachine, createEvent } from './machine/index.js';
export type {
  MachineConfig,
  Machine,
  EventObject,
  StateNode,
  TransitionConfig,
  InferStates,
  InferEvents,
  InferContext,
} from './machine/index.js';

// ============================================
// Shared Types
// ============================================
export type {
  VitalEvent,
  TransitionEvent,
  ObserveEvent,
} from './types/index.js';

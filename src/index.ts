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
// Sampling
// ============================================
export { createSampler, eventTypeToSamplingType } from './observe/index.js';
export type { SamplingConfig, SamplingOption, SamplingEventType, Sampler } from './observe/index.js';

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
// Custom Metrics
// ============================================
export { metric, counter, gauge, histogram, createTypedMetric } from './metrics/index.js';

// ============================================
// Shared Types
// ============================================
export type {
  VitalEvent,
  TransitionEvent,
  CustomMetricEvent,
  ObserveEvent,
} from './types/index.js';

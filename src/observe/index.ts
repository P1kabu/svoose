/**
 * Observe module exports
 */

export { observe, setGlobalObserver, getGlobalObserver } from './observe.svelte.js';
export type { ObserveOptions, ObserveInstance, ObserveStats } from './observe.svelte.js';
export { observeErrors, registerMachineContext, unregisterMachineContext } from './errors.js';
export type { ObserveErrorEvent, ErrorEvent, UnhandledRejectionEvent } from './errors.js';
export { vitalObservers, observeCLS, observeLCP, observeFID, observeINP, observeFCP, observeTTFB } from './vitals.js';
export type { Metric, MetricName, MetricRating } from './vitals.js';
export { createSampler, eventTypeToSamplingType } from './sampling.js';
export type { SamplingConfig, SamplingOption, SamplingEventType, Sampler } from './sampling.js';
export { productionDefaults } from './presets.js';
export { createSessionManager } from './session.js';
export type { SessionConfig, SessionOption, SessionManager } from './session.js';
export {
  configurePII,
  getPIIConfig,
  sanitizeEvent,
  scrubUrl,
  maskValue,
  stripQueryParams,
  stripHash,
  isExcludedPath,
  deepClone,
} from './privacy.js';
export {
  fingerprint,
  simpleHash,
  extractFunctionName,
  createDedupTracker,
} from './fingerprint.js';
export type { DedupTracker } from './fingerprint.js';

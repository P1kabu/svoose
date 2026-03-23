/**
 * Metrics module exports
 */

export {
  metric,
  counter,
  gauge,
  histogram,
} from './metric.js';

// Internal functions - not exported publicly.
// observe() imports setMetricEmitter/getMetricEmitter directly from './metric.js'.
// Tests can import from '../src/metrics/metric.js' directly.

export { createTypedMetric } from './typed.js';

/**
 * Metrics module exports
 */

export {
  metric,
  counter,
  gauge,
  histogram,
  setMetricEmitter,
  getMetricEmitter,
} from './metric.js';

export { createTypedMetric } from './typed.js';

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
  _getPendingEventsCount,
  _clearPendingEvents,
} from './metric.js';

export { createTypedMetric } from './typed.js';

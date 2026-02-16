/**
 * Typed metric factory for TypeScript autocomplete
 */

import { metric } from './metric.js';

/**
 * Create a typed metric function with autocomplete for metric names and data shapes
 *
 * @example
 * const m = createTypedMetric<{
 *   checkout_started: { step: number; cartTotal: number };
 *   button_clicked: { id: string };
 * }>();
 *
 * m('checkout_started', { step: 1, cartTotal: 99.99 }); // ✅ autocomplete works
 * m('button_clicked', { id: 'submit' });                 // ✅
 * m('unknown_event', {});                                 // ❌ TypeScript error
 */
export function createTypedMetric<T extends Record<string, Record<string, unknown>>>() {
  return function <K extends keyof T & string>(name: K, data: T[K]): void {
    metric(name, data);
  };
}

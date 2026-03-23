import type { ObserveOptions } from '../types/index.js';

/**
 * Recommended production defaults.
 *
 * @example
 * import { observe, productionDefaults } from 'svoose';
 * observe({ ...productionDefaults, endpoint: '/api/metrics' });
 */
export const productionDefaults = {
  batchSize: 50,
  flushInterval: 10000,
  sampling: { errors: 1.0, vitals: 0.5, custom: 0.5, transitions: 0.1 },
  session: true,
} as const satisfies Partial<ObserveOptions>;

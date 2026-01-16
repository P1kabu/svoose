/**
 * after() - Delayed transitions (v0.2)
 *
 * Автоматичний перехід після затримки
 *
 * @example
 * const notification = createMachine({
 *   initial: 'visible',
 *   states: {
 *     visible: {
 *       after: {
 *         3000: 'hidden', // Перехід через 3 секунди
 *       },
 *       on: { DISMISS: 'hidden' },
 *     },
 *     hidden: {},
 *   },
 * });
 */

// TODO: Implement in v0.2
export interface AfterConfig {
  /** Delay in ms -> target state */
  [delay: number]: string | {
    target: string;
    guard?: (context: unknown) => boolean;
    action?: (context: unknown) => Partial<unknown> | void;
  };
}

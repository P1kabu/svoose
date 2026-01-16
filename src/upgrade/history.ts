/**
 * History states (v0.3)
 *
 * Запам'ятовує попередній стан для повернення
 *
 * @example
 * const player = createMachine({
 *   initial: 'stopped',
 *   states: {
 *     stopped: {
 *       on: { PLAY: 'playing' },
 *     },
 *     playing: {
 *       on: {
 *         PAUSE: 'paused',
 *         STOP: 'stopped',
 *       },
 *     },
 *     paused: {
 *       on: {
 *         // Повертається до попереднього стану (playing)
 *         RESUME: { target: 'playing.history' },
 *         STOP: 'stopped',
 *       },
 *     },
 *   },
 * });
 */

// TODO: Implement in v0.3
export type HistoryType = 'shallow' | 'deep';

export interface HistoryStateConfig {
  type: 'history';
  history: HistoryType;
  /** Default state if no history */
  target?: string;
}

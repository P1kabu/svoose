/**
 * Machine module exports
 */

export { createMachine } from './machine.svelte.js';
export type {
  MachineConfig,
  Machine,
  EventObject,
  StateNode,
  TransitionConfig,
  InferStates,
  InferEvents,
  InferContext,
} from './types.js';

// ============================================
// Helper: createEvent
// ============================================

/**
 * Helper to create typed events
 *
 * @example
 * const loginEvent = createEvent('LOGIN', { email: 'test@example.com' });
 */
export function createEvent<T extends string>(type: T): { type: T };
export function createEvent<T extends string, P extends object>(
  type: T,
  payload: P
): { type: T } & P;
export function createEvent(type: string, payload?: object) {
  return payload ? { type, ...payload } : { type };
}

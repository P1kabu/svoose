/**
 * spawn() - Dynamic child machines (v0.2)
 *
 * Дозволяє динамічно створювати child machines
 *
 * @example
 * const parent = createMachine({
 *   context: { children: [] },
 *   states: {
 *     active: {
 *       on: {
 *         ADD_CHILD: {
 *           action: (ctx) => ({
 *             children: [...ctx.children, spawn(childMachine, { id: `child-${Date.now()}` })],
 *           }),
 *         },
 *       },
 *     },
 *   },
 * });
 */

// TODO: Implement in v0.2
export interface SpawnOptions {
  /** Unique ID for the spawned machine */
  id?: string;
  /** Sync with parent (auto-cleanup) */
  sync?: boolean;
}

export interface SpawnedMachine<TContext, TState, TEvent> {
  id: string;
  state: TState;
  context: TContext;
  send: (event: TEvent) => void;
  stop: () => void;
}

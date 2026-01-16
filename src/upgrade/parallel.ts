/**
 * Parallel states (v0.3)
 *
 * Дозволяє мати кілька активних станів одночасно
 *
 * @example
 * const editor = createMachine({
 *   type: 'parallel',
 *   states: {
 *     text: {
 *       initial: 'idle',
 *       states: {
 *         idle: { on: { EDIT: 'editing' } },
 *         editing: { on: { SAVE: 'idle' } },
 *       },
 *     },
 *     toolbar: {
 *       initial: 'collapsed',
 *       states: {
 *         collapsed: { on: { EXPAND: 'expanded' } },
 *         expanded: { on: { COLLAPSE: 'collapsed' } },
 *       },
 *     },
 *   },
 * });
 *
 * // editor.state = { text: 'idle', toolbar: 'collapsed' }
 */

// TODO: Implement in v0.3
export interface ParallelStateConfig {
  type: 'parallel';
  states: Record<string, {
    initial: string;
    states: Record<string, unknown>;
  }>;
}

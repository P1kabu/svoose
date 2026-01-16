/**
 * invoke() - Async service invocation (v0.2)
 *
 * Дозволяє викликати async функції/promises з машини станів
 *
 * @example
 * const auth = createMachine({
 *   states: {
 *     loading: {
 *       invoke: {
 *         src: async (ctx) => await api.login(ctx.email),
 *         onDone: { target: 'success', action: (ctx, e) => ({ user: e.data }) },
 *         onError: { target: 'error', action: (ctx, e) => ({ error: e.message }) },
 *       },
 *     },
 *   },
 * });
 */

// TODO: Implement in v0.2
export interface InvokeConfig<TContext, TData, TError = Error> {
  /** Async function to invoke */
  src: (context: TContext) => Promise<TData>;
  /** Transition on success */
  onDone?: {
    target: string;
    action?: (context: TContext, event: { type: 'done'; data: TData }) => Partial<TContext> | void;
  };
  /** Transition on error */
  onError?: {
    target: string;
    action?: (context: TContext, event: { type: 'error'; error: TError }) => Partial<TContext> | void;
  };
}

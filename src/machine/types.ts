/**
 * State Machine Types
 */

// ============================================
// Event Types
// ============================================

export type EventObject = { type: string; [key: string]: unknown };

// ============================================
// Action Types
// ============================================

export type Action<TContext, TEvent extends EventObject = EventObject> = (
  context: TContext,
  event?: TEvent
) => Partial<TContext> | void;

// ============================================
// Transition Types
// ============================================

export interface TransitionConfig<
  TContext,
  TState extends string,
  TEvent extends EventObject,
  K extends TEvent['type'] = TEvent['type']
> {
  /** Target state */
  target: TState;
  /** Guard condition - transition only if returns true */
  guard?: (context: TContext, event: Extract<TEvent, { type: K }>) => boolean;
  /** Action to run during transition */
  action?: (
    context: TContext,
    event: Extract<TEvent, { type: K }>
  ) => Partial<TContext> | void;
}

export type Transition<
  TContext,
  TState extends string,
  TEvent extends EventObject,
  K extends TEvent['type'] = TEvent['type']
> = TState | TransitionConfig<TContext, TState, TEvent, K>;

// ============================================
// State Node Types
// ============================================

export interface StateNode<
  TContext,
  TState extends string,
  TEvent extends EventObject
> {
  /** Event handlers */
  on?: {
    [K in TEvent['type']]?: Transition<TContext, TState, TEvent, K>;
  };
  /** Action to run when entering this state */
  entry?: Action<TContext, TEvent>;
  /** Action to run when exiting this state */
  exit?: Action<TContext, TEvent>;
}

// ============================================
// Machine Config Types
// ============================================

export interface MachineConfig<
  TContext extends object,
  TState extends string,
  TEvent extends EventObject
> {
  /** Unique machine ID */
  id: string;
  /** Initial state */
  initial: TState;
  /** Initial context */
  context?: TContext;
  /** State definitions */
  states: {
    [K in TState]: StateNode<TContext, TState, TEvent>;
  };
  /** Observability options */
  observe?:
    | boolean
    | {
        transitions?: boolean;
        context?: boolean;
      };
}

// ============================================
// Machine Instance Types
// ============================================

export interface Machine<
  TContext extends object,
  TState extends string,
  TEvent extends EventObject
> {
  /** Current state (reactive in Svelte 5) */
  readonly state: TState;
  /** Current context (reactive in Svelte 5) */
  readonly context: TContext;
  /** Check if machine is in given state */
  matches(state: TState): boolean;
  /** Check if machine is in any of given states */
  matchesAny(...states: TState[]): boolean;
  /** Check if event can be sent (has valid transition) */
  can(eventType: TEvent['type']): boolean;
  /** Send event to machine */
  send(event: TEvent | TEvent['type']): void;
  /** Cleanup machine (unregister from error tracking) */
  destroy(): void;
}

// ============================================
// Type Helpers
// ============================================

/** Extract states from machine config */
export type InferStates<T> = T extends MachineConfig<object, infer S, EventObject>
  ? S
  : never;

/** Extract events from machine config */
export type InferEvents<T> = T extends MachineConfig<object, string, infer E>
  ? E
  : never;

/** Extract context from machine config */
export type InferContext<T> = T extends MachineConfig<infer C, string, EventObject>
  ? C
  : never;

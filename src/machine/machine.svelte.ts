/**
 * Minimal FSM with Svelte 5 Runes support
 *
 * Note: When used with Svelte 5, state and context are reactive via $state.
 * When used outside Svelte, they work as regular properties.
 */

import { registerMachineContext, unregisterMachineContext } from '../observe/errors.js';
import { getGlobalObserver } from '../observe/observe.svelte.js';
import type {
  EventObject,
  MachineConfig,
  Machine,
  StateNode,
  TransitionConfig,
} from './types.js';
import type { TransitionEvent } from '../types/index.js';

/**
 * Create a state machine
 *
 * @example
 * const toggle = createMachine({
 *   id: 'toggle',
 *   initial: 'off',
 *   states: {
 *     off: { on: { TOGGLE: 'on' } },
 *     on: { on: { TOGGLE: 'off' } },
 *   },
 * });
 *
 * toggle.send('TOGGLE');
 * console.log(toggle.state); // 'on'
 */
export function createMachine<
  TContext extends object,
  TState extends string,
  TEvent extends EventObject
>(config: MachineConfig<TContext, TState, TEvent>): Machine<TContext, TState, TEvent> {
  // Validate initial state exists
  if (!(config.initial in config.states)) {
    throw new Error(
      `[svoose] Invalid initial state "${config.initial}" for machine "${config.id}". ` +
        `Available states: ${Object.keys(config.states).join(', ')}`
    );
  }

  // Internal state
  // For Svelte 5 reactivity, use useMachine() from 'svoose/svelte'
  let _state: TState = config.initial;
  let _context: TContext = config.context ? { ...config.context } : ({} as TContext);

  // Parse observe config
  const observeConfig =
    config.observe === true
      ? { transitions: true, context: false }
      : config.observe === false || config.observe === undefined
        ? { transitions: false, context: false }
        : config.observe;

  // Register for error context tracking
  registerMachineContext(config.id, () => _state);

  // Run entry action for initial state (with error handling)
  const initialState = config.states[config.initial];
  if (initialState?.entry) {
    try {
      const update = initialState.entry(_context);
      if (update) {
        _context = { ..._context, ...update };
      }
    } catch (err) {
      console.error(`[svoose] Error in entry action for initial state "${config.initial}":`, err);
    }
  }

  /**
   * Get transition config for an event
   */
  function getTransition(
    stateConfig: StateNode<TContext, TState, TEvent>,
    eventType: TEvent['type']
  ): TransitionConfig<TContext, TState, TEvent> | TState | undefined {
    return stateConfig.on?.[eventType as keyof typeof stateConfig.on] as
      | TransitionConfig<TContext, TState, TEvent>
      | TState
      | undefined;
  }

  /**
   * Check if a transition is valid (exists and guard passes)
   */
  function canTransition(eventType: TEvent['type']): boolean {
    const stateConfig = config.states[_state];
    if (!stateConfig?.on) return false;

    const transition = getTransition(stateConfig, eventType);
    if (!transition) return false;

    // If it's just a target state string, it's always valid
    if (typeof transition === 'string') return true;

    // If there's a guard, check it (with empty event for can() check)
    if (transition.guard) {
      return transition.guard(_context, { type: eventType } as Extract<
        TEvent,
        { type: typeof eventType }
      >);
    }

    return true;
  }

  /**
   * Send an event to the machine
   */
  function send(event: TEvent | TEvent['type']): void {
    const eventObj: TEvent =
      typeof event === 'string' ? ({ type: event } as TEvent) : event;

    const stateConfig = config.states[_state];
    if (!stateConfig?.on) return;

    const transition = getTransition(stateConfig, eventObj.type);
    if (!transition) return;

    const targetState: TState =
      typeof transition === 'string' ? transition : transition.target;

    // Check guard (with error handling)
    if (typeof transition === 'object' && transition.guard) {
      try {
        if (
          !transition.guard(
            _context,
            eventObj as Extract<TEvent, { type: (typeof eventObj)['type'] }>
          )
        ) {
          return;
        }
      } catch (err) {
        console.error(`[svoose] Error in guard for event "${eventObj.type}":`, err);
        return; // Don't transition if guard throws
      }
    }

    const prevState = _state;

    // Run exit action (with error handling)
    if (stateConfig.exit) {
      try {
        stateConfig.exit(_context);
      } catch (err) {
        console.error(`[svoose] Error in exit action for state "${_state}":`, err);
      }
    }

    // Run transition action (with error handling)
    if (typeof transition === 'object' && transition.action) {
      try {
        const update = transition.action(
          _context,
          eventObj as Extract<TEvent, { type: (typeof eventObj)['type'] }>
        );
        if (update) {
          _context = { ..._context, ...update };
        }
      } catch (err) {
        console.error(`[svoose] Error in action for event "${eventObj.type}":`, err);
      }
    }

    // Update state
    _state = targetState;

    // Run entry action for new state (with error handling)
    const newStateConfig = config.states[_state];
    if (newStateConfig?.entry) {
      try {
        const update = newStateConfig.entry(_context);
        if (update) {
          _context = { ..._context, ...update };
        }
      } catch (err) {
        console.error(`[svoose] Error in entry action for state "${_state}":`, err);
      }
    }

    // Emit observation event
    if (observeConfig.transitions) {
      const observer = getGlobalObserver();
      if (observer) {
        const transitionEvent: TransitionEvent = {
          type: 'transition',
          machineId: config.id,
          from: prevState,
          to: _state,
          event: eventObj.type,
          timestamp: Date.now(),
          ...(observeConfig.context
            ? { context: { ..._context } as Record<string, unknown> }
            : {}),
        };
        observer(transitionEvent);
      }
    }
  }

  /**
   * Cleanup machine
   */
  function destroy(): void {
    unregisterMachineContext(config.id);
  }

  // Return machine instance
  return {
    get state(): TState {
      return _state;
    },
    get context(): TContext {
      return _context;
    },
    matches(state: TState): boolean {
      return _state === state;
    },
    matchesAny(...states: TState[]): boolean {
      return states.includes(_state);
    },
    can(eventType: TEvent['type']): boolean {
      return canTransition(eventType);
    },
    send,
    destroy,
  };
}

// Re-export types
export type { MachineConfig, Machine, EventObject, StateNode, TransitionConfig } from './types.js';

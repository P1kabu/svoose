/**
 * Svelte 5 specific utilities for svoose
 *
 * Provides reactive wrappers and hooks for state machines
 */

/// <reference path="./runes.d.ts" />

import { createMachine, type MachineConfig, type EventObject } from '../machine/index.js';

/**
 * Reactive machine state for Svelte 5 components
 */
export interface ReactiveMachine<
  TContext extends object,
  TState extends string,
  TEvent extends EventObject
> {
  /** Current state (reactive - triggers re-render on change) */
  readonly state: TState;
  /** Current context (reactive - triggers re-render on change) */
  readonly context: TContext;
  /** Check if machine is in given state */
  matches(state: TState): boolean;
  /** Check if machine is in any of given states */
  matchesAny(...states: TState[]): boolean;
  /** Check if event can be sent */
  can(eventType: TEvent['type']): boolean;
  /** Send event to machine */
  send(event: TEvent | TEvent['type']): void;
  /** Cleanup machine */
  destroy(): void;
}

/**
 * Create a reactive state machine for Svelte 5 components
 *
 * This is the recommended way to use svoose in Svelte 5 components.
 * The returned machine's state and context are automatically reactive
 * and will trigger component re-renders when they change.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useMachine } from 'svoose/svelte';
 *
 *   const toggle = useMachine({
 *     id: 'toggle',
 *     initial: 'off',
 *     states: {
 *       off: { on: { TOGGLE: 'on' } },
 *       on: { on: { TOGGLE: 'off' } },
 *     },
 *   });
 * </script>
 *
 * <button onclick={() => toggle.send('TOGGLE')}>
 *   {toggle.state}
 * </button>
 * ```
 */
export function useMachine<
  TContext extends object,
  TState extends string,
  TEvent extends EventObject
>(config: MachineConfig<TContext, TState, TEvent>): ReactiveMachine<TContext, TState, TEvent> {
  // Create base machine
  const machine = createMachine(config);

  // Reactive state using Svelte 5 $state rune
  let reactiveState = $state<TState>(machine.state);
  let reactiveContext = $state<TContext>(machine.context);

  // Wrap send to update reactive state
  const originalSend = machine.send.bind(machine);

  const reactiveSend = (event: TEvent | TEvent['type']): void => {
    originalSend(event);
    // Update reactive state after transition
    reactiveState = machine.state;
    reactiveContext = machine.context;
  };

  // Return reactive wrapper
  return {
    get state(): TState {
      return reactiveState;
    },
    get context(): TContext {
      return reactiveContext;
    },
    matches(state: TState): boolean {
      return reactiveState === state;
    },
    matchesAny(...states: TState[]): boolean {
      return states.includes(reactiveState);
    },
    can(eventType: TEvent['type']): boolean {
      return machine.can(eventType);
    },
    send: reactiveSend,
    destroy: machine.destroy.bind(machine),
  };
}

/**
 * Create a machine from an existing config with reactive state
 *
 * Use this when you have a pre-defined machine config that you want
 * to instantiate as a reactive machine in a component.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { fromMachine } from 'svoose/svelte';
 *   import { toggleConfig } from './machines/toggle';
 *
 *   const toggle = fromMachine(toggleConfig);
 * </script>
 * ```
 */
export const fromMachine = useMachine;

// Re-export useful types
export type { MachineConfig, EventObject } from '../machine/index.js';

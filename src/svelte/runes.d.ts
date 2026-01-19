/**
 * Svelte 5 Runes type declarations
 *
 * These are compile-time features that Svelte compiler transforms.
 * This file provides TypeScript definitions for development.
 */

declare function $state<T>(initial: T): T;
declare function $state<T>(): T | undefined;

declare function $derived<T>(expression: T): T;

declare function $effect(fn: () => void | (() => void)): void;

declare function $props<T>(): T;

declare function $bindable<T>(fallback?: T): T;

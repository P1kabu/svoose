/**
 * 🪿 svoose/upgrade - Future features
 *
 * v0.2 - Async & Time:
 * - invoke() - async functions/promises
 * - spawn() - dynamic child machines
 * - after() - delayed transitions
 *
 * v0.3 - Advanced States:
 * - Parallel states
 * - History states
 * - Devtools
 *
 * v0.4 - Integration:
 * - @svoose/reactor - svelte-reactor integration
 *   (persist, middleware, sync, etc.)
 * - @svoose/sveltekit - SvelteKit hooks
 */

export const UPGRADE_VERSION = '0.2.0';

// v0.2 types
export type { InvokeConfig } from './invoke.js';
export type { SpawnOptions, SpawnedMachine } from './spawn.js';
export type { AfterConfig } from './after.js';

// v0.3 types
export type { ParallelStateConfig } from './parallel.js';
export type { HistoryType, HistoryStateConfig } from './history.js';

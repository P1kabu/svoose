/**
 * User identification module
 *
 * `identify()` records the current user so every subsequent event picked up by
 * `bufferEvent()` carries `userId`/`userTraits` for downstream correlation.
 * It also emits a discrete `IdentifyEvent` on login and logout transitions.
 *
 * Module-scoped state mirrors `metric.ts`: the emitter is wired by `observe()`
 * and cleared on `destroy()`. No window/document access — SSR-safe.
 */

import type { IdentifyEvent, ObserveEvent } from '../types/index.js';

/**
 * The cached form used for injection into other events.
 * `userTraits` is preserved as-is from the last `identify()` traits payload.
 */
interface UserContext {
  userId: string;
  userTraits?: Record<string, unknown>;
}

let currentUser: UserContext | null = null;

let emitter: ((event: ObserveEvent) => void) | null = null;

/**
 * Wire the identify pipeline into observe(). Pass `null` to disconnect.
 * @internal
 */
export function setIdentifyEmitter(emit: ((event: ObserveEvent) => void) | null): void {
  emitter = emit;
}

/**
 * Get the current emitter (for parity with metric/global observer).
 * @internal
 */
export function getIdentifyEmitter(): ((event: ObserveEvent) => void) | null {
  return emitter;
}

/**
 * Get the current user context for injection into outgoing events.
 * @internal
 */
export function getUserContext(): UserContext | null {
  return currentUser;
}

/**
 * Identify the current user (login) or clear identity (logout).
 *
 * @param user - `{ id, traits? }` to log in, or `null` to log out.
 *
 * @example
 * // Login
 * identify({ id: 'user_123', traits: { plan: 'premium' } });
 *
 * @example
 * // Logout — emits IdentifyEvent with previousUserId set
 * identify(null);
 */
export function identify(
  user: { id: string; traits?: Record<string, unknown> } | null,
): void {
  if (user === null) {
    // Logout — no-op if nobody was logged in.
    if (currentUser === null) return;
    const previousUserId = currentUser.userId;
    currentUser = null;
    const event: IdentifyEvent = {
      type: 'identify',
      userId: null,
      previousUserId,
      timestamp: Date.now(),
    };
    emitter?.(event);
    return;
  }

  // Login (or re-identify) — last call wins.
  currentUser = user.traits
    ? { userId: user.id, userTraits: user.traits }
    : { userId: user.id };

  const event: IdentifyEvent = {
    type: 'identify',
    userId: user.id,
    timestamp: Date.now(),
  };
  if (user.traits) event.traits = user.traits;
  emitter?.(event);
}

/**
 * Reset module state — TEST ONLY.
 * @internal
 */
export function _resetUser(): void {
  currentUser = null;
}

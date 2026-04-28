/**
 * Error fingerprinting for client-side grouping & deduplication.
 *
 * Strategy: hash of `message` + first stable function name from the stack.
 *
 * Why NOT raw stack frame? Minified file names contain build hashes that change
 * with every deploy (e.g. `app-Bx7k2.js:1:43567`). Same error → different
 * fingerprint → dedup breaks. Function names like `Object.handler`,
 * `HTMLButtonElement.onclick` are stable across builds.
 *
 * Single-letter minified names (a, b, c) are skipped — they're not stable.
 */

import type { ErrorEvent, UnhandledRejectionEvent } from '../types/index.js';

/**
 * Extract the first stable function name from a stack trace.
 * Returns empty string if no stable name found.
 *
 * Examples:
 *   "at Object.handler (app-Bx7k2.js:1:43567)" → "Object.handler"
 *   "at HTMLButtonElement.onclick (chunk-abc.js:3:22)" → "HTMLButtonElement.onclick"
 *   "at a (app-Bx7k2.js:1:43567)" → "" (single-letter = minified, not stable)
 *   "at app-Bx7k2.js:1:43567" → "" (anonymous)
 */
export function extractFunctionName(stack?: string): string {
  if (!stack) return '';
  const lines = stack.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;

    // "at FunctionName (file.js:1:2)"
    const match = line.match(/^at\s+(.+?)\s+\(/);
    if (!match) continue;

    const name = match[1];
    if (name.length <= 1) continue;          // minified single-letter
    if (name.includes('/') || name.includes('\\')) continue; // looks like a path
    return name;
  }
  return '';
}

/**
 * djb2 hash → 8-char hex
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Compute a deploy-resistant fingerprint for an error / unhandled-rejection event.
 */
export function fingerprint(event: ErrorEvent | UnhandledRejectionEvent): string {
  const msg = event.type === 'error' ? event.message : event.reason;
  const fnName = extractFunctionName(event.stack);
  const input = fnName ? `${msg}|${fnName}` : msg;
  return simpleHash(input);
}

// ============================================
// Window-based dedup map
// ============================================

/**
 * Tracks fingerprints seen within a sliding time window for dedup.
 * Lazily evicts expired entries on every `seen()` call to keep memory bounded
 * even under sustained error storms.
 */
export interface DedupTracker {
  /** True if this fingerprint was seen in the last `windowMs` and should be DROPPED. */
  seen(fp: string, now: number): boolean;
  /** Clear all entries (used in destroy()) */
  clear(): void;
  /** Current map size — for tests/diagnostics */
  size(): number;
}

export function createDedupTracker(windowMs: number): DedupTracker {
  const seenMap = new Map<string, number>();

  return {
    seen(fp: string, now: number): boolean {
      // Sweep expired entries
      for (const [k, ts] of seenMap) {
        if (now - ts > windowMs) seenMap.delete(k);
      }

      const last = seenMap.get(fp);
      if (last !== undefined && now - last <= windowMs) {
        // Refresh timestamp so a continuous burst keeps suppressing
        seenMap.set(fp, now);
        return true;
      }
      seenMap.set(fp, now);
      return false;
    },
    clear(): void {
      seenMap.clear();
    },
    size(): number {
      return seenMap.size;
    },
  };
}

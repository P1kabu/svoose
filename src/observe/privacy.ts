/**
 * Privacy / PII sanitization
 *
 * - URL scrubbing (params via string or RegExp)
 * - Field masking (preserve last 4 chars)
 * - stripQueryParams / stripHash
 * - excludePaths — drop events whose URL prefix matches a sensitive path
 * - sanitize callback — return null to DROP entire event
 *
 * @remarks
 * `configurePII()` uses **overwrite** semantics. The most recent call wins.
 * Pass `null` (or `{}`) to reset.
 */

import type { ObserveEvent, PIIConfig } from '../types/index.js';

const REDACTED = '[REDACTED]';

let runtimeConfig: PIIConfig | null = null;

/**
 * Configure global PII rules. Overwrites previous config.
 * Pass `null` (or omit) to reset.
 *
 * The `observe({ privacy })` form takes precedence over `configurePII()`
 * inside a single observe() instance — `configurePII()` only acts as a
 * runtime fallback for code that doesn't pass `privacy` explicitly.
 */
export function configurePII(config?: PIIConfig | null): void {
  runtimeConfig = config && Object.keys(config).length > 0 ? { ...config } : null;
}

/**
 * @internal — exposed for tests and internal pipeline lookup.
 */
export function getPIIConfig(): PIIConfig | null {
  return runtimeConfig;
}

/**
 * Mask a string value, preserving the last 4 characters.
 * Strings of length ≤ 4 become a fixed mask. Non-strings pass through.
 */
export function maskValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length <= 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

/**
 * Replace param values in a URL whose key matches one of `patterns`.
 * Supports both string equality and RegExp test.
 */
export function scrubUrl(url: string, patterns: ReadonlyArray<string | RegExp>): string {
  if (!url || patterns.length === 0) return url;

  // Try parsing as absolute URL; fall back to a synthetic base for relative URLs.
  let parsed: URL;
  let isRelative = false;
  try {
    parsed = new URL(url);
  } catch {
    try {
      parsed = new URL(url, 'http://_relative_');
      isRelative = true;
    } catch {
      return url; // unparseable — leave as is
    }
  }

  const matches = (key: string): boolean => {
    for (const p of patterns) {
      if (typeof p === 'string') {
        if (p === key) return true;
      } else if (p.test(key)) {
        return true;
      }
    }
    return false;
  };

  let mutated = false;
  for (const key of [...parsed.searchParams.keys()]) {
    if (matches(key)) {
      parsed.searchParams.set(key, REDACTED);
      mutated = true;
    }
  }

  if (!mutated) return url;

  if (isRelative) {
    const path = parsed.pathname + (parsed.search || '') + (parsed.hash || '');
    return path;
  }
  return parsed.toString();
}

/** Drop the query string from a URL (preserves hash) */
export function stripQueryParams(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.search = '';
    return u.toString();
  } catch {
    // Relative URL — manual strip
    const qIdx = url.indexOf('?');
    if (qIdx < 0) return url;
    const hashIdx = url.indexOf('#', qIdx);
    return hashIdx >= 0 ? url.slice(0, qIdx) + url.slice(hashIdx) : url.slice(0, qIdx);
  }
}

/** Drop the hash fragment from a URL */
export function stripHash(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    const idx = url.indexOf('#');
    return idx >= 0 ? url.slice(0, idx) : url;
  }
}

/**
 * True if `url`'s pathname matches any prefix in `paths`.
 * `'/admin'` matches `/admin` and `/admin/users`, but NOT `/admins`.
 */
export function isExcludedPath(url: string, paths: ReadonlyArray<string>): boolean {
  if (!url || paths.length === 0) return false;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    const qIdx = url.indexOf('?');
    const hIdx = url.indexOf('#');
    const end = Math.min(
      qIdx < 0 ? url.length : qIdx,
      hIdx < 0 ? url.length : hIdx,
    );
    pathname = url.slice(0, end);
  }
  for (const p of paths) {
    if (pathname === p || pathname.startsWith(p + '/')) return true;
  }
  return false;
}

/**
 * Clone an event before mutation. Uses structuredClone if available,
 * falls back to JSON round-trip otherwise.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Some values (functions, DOM nodes) aren't structured-cloneable; fall through.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    // Last resort: shallow copy at top level
    return { ...(value as object) } as T;
  }
}

/**
 * Mask configured fields inside a record, in place.
 * Top-level keys only — nested objects are not traversed (KISS).
 */
function maskRecord(rec: Record<string, unknown> | undefined, fields: ReadonlyArray<string>): void {
  if (!rec) return;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(rec, f)) {
      rec[f] = maskValue(rec[f]);
    }
  }
}

/**
 * Apply privacy rules to a single event.
 * Returns the (possibly cloned) event, or `null` to DROP it.
 *
 * Order of operations:
 *   1. Resolve effective config (passed > runtime > none)
 *   2. excludePaths → DROP if URL matches
 *   3. Clone event (we never mutate inputs)
 *   4. URL transformations (scrubFromUrl, stripQueryParams, stripHash)
 *   5. Field masking (in metadata)
 *   6. Custom sanitize (last — gets a fully sanitized event)
 */
export function sanitizeEvent(
  event: ObserveEvent,
  config: PIIConfig | null,
): ObserveEvent | null {
  // Effective config: explicit param overrides runtime
  const cfg = config ?? runtimeConfig;
  if (!cfg) return event;

  const url = (event as { url?: string }).url ?? '';

  // 2. excludePaths — drop pre-clone (cheap path)
  if (cfg.excludePaths && cfg.excludePaths.length > 0 && url) {
    if (isExcludedPath(url, cfg.excludePaths)) {
      return null;
    }
  }

  // 3. Clone
  const cloned = deepClone(event) as ObserveEvent;
  const target = cloned as { url?: string; metadata?: Record<string, unknown> };

  // 4. URL transformations
  if (target.url) {
    let u = target.url;
    if (cfg.scrubFromUrl && cfg.scrubFromUrl.length > 0) {
      u = scrubUrl(u, cfg.scrubFromUrl);
    }
    if (cfg.stripQueryParams) u = stripQueryParams(u);
    if (cfg.stripHash) u = stripHash(u);
    target.url = u;
  }

  // 5. Field masking — applied to metadata bag (CustomMetricEvent and any future metadata-bearing events)
  if (cfg.maskFields && cfg.maskFields.length > 0) {
    maskRecord(target.metadata, cfg.maskFields);
  }

  // 6. Custom sanitize — last
  if (cfg.sanitize) {
    const result = cfg.sanitize(cloned);
    if (result === null) return null;
    return result;
  }

  return cloned;
}

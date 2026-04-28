import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fingerprint,
  simpleHash,
  extractFunctionName,
  createDedupTracker,
} from '../src/observe/fingerprint.js';
import { observe, getGlobalObserver } from '../src/observe/observe.svelte.js';
import type { ErrorEvent, UnhandledRejectionEvent, ObserveEvent, Transport } from '../src/types/index.js';

class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('simpleHash', () => {
  it('should produce deterministic 8-char hex', () => {
    const a = simpleHash('hello');
    const b = simpleHash('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should differ on different inputs', () => {
    expect(simpleHash('a')).not.toBe(simpleHash('b'));
  });
});

describe('extractFunctionName', () => {
  it('should extract qualified function name', () => {
    const stack = `Error: x
    at Object.handler (app-Bx7k2.js:1:43567)
    at next (app-Bx7k2.js:1:1234)`;
    expect(extractFunctionName(stack)).toBe('Object.handler');
  });

  it('should extract DOM-style function name', () => {
    const stack = `Error: x
    at HTMLButtonElement.onclick (chunk-abc.js:3:22)`;
    expect(extractFunctionName(stack)).toBe('HTMLButtonElement.onclick');
  });

  it('should skip single-letter minified names', () => {
    const stack = `Error: x
    at a (app-Bx7k2.js:1:43567)
    at Object.real (app-Bx7k2.js:1:99)`;
    expect(extractFunctionName(stack)).toBe('Object.real');
  });

  it('should skip frames that look like file paths', () => {
    const stack = `Error: x
    at /usr/local/app/src/index.js (file.js:1:1)
    at Object.real (chunk.js:2:2)`;
    expect(extractFunctionName(stack)).toBe('Object.real');
  });

  it('should return empty string when stack has only anonymous frames', () => {
    const stack = `Error: x
    at app-Bx7k2.js:1:43567
    at chunk.js:2:1`;
    expect(extractFunctionName(stack)).toBe('');
  });

  it('should return empty string for undefined stack', () => {
    expect(extractFunctionName(undefined)).toBe('');
  });
});

describe('fingerprint', () => {
  const baseError: ErrorEvent = {
    type: 'error',
    message: 'Cannot read properties of null',
    stack: `TypeError: Cannot read properties of null
    at Object.handler (app-Bx7k2.js:1:43567)`,
    timestamp: 100,
    url: '/',
  };

  it('should produce same hash for identical events', () => {
    expect(fingerprint(baseError)).toBe(fingerprint(baseError));
  });

  it('should differ on different messages', () => {
    const other: ErrorEvent = { ...baseError, message: 'Different' };
    expect(fingerprint(baseError)).not.toBe(fingerprint(other));
  });

  it('should be deploy-resistant (same fn name, different file hash → same fingerprint)', () => {
    const v1: ErrorEvent = {
      ...baseError,
      stack: `TypeError: Cannot read properties of null
    at Object.handler (app-Bx7k2.js:1:43567)`,
    };
    const v2: ErrorEvent = {
      ...baseError,
      stack: `TypeError: Cannot read properties of null
    at Object.handler (app-Cy9m4.js:1:99999)`,
    };
    expect(fingerprint(v1)).toBe(fingerprint(v2));
  });

  it('should fall back to message-only when no stable fn name', () => {
    const noFn: ErrorEvent = {
      type: 'error',
      message: 'oops',
      stack: 'Error: oops\n    at app-x.js:1:2',
      timestamp: 0,
      url: '/',
    };
    const noStack: ErrorEvent = { ...noFn, stack: undefined };
    expect(fingerprint(noFn)).toBe(fingerprint(noStack));
  });

  it('should work for unhandled-rejection events', () => {
    const rej: UnhandledRejectionEvent = {
      type: 'unhandled-rejection',
      reason: 'Promise rejected',
      stack: 'Error: rej\n    at Object.handler (app.js:1:1)',
      timestamp: 0,
      url: '/',
    };
    expect(fingerprint(rej)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('createDedupTracker', () => {
  it('should pass first occurrence', () => {
    const t = createDedupTracker(60_000);
    expect(t.seen('abc', 1000)).toBe(false);
  });

  it('should drop duplicate within window', () => {
    const t = createDedupTracker(60_000);
    t.seen('abc', 1000);
    expect(t.seen('abc', 30_000)).toBe(true);
  });

  it('should pass duplicate after window expiry', () => {
    const t = createDedupTracker(60_000);
    t.seen('abc', 1000);
    expect(t.seen('abc', 100_000)).toBe(false);
  });

  it('should evict expired entries from the map', () => {
    const t = createDedupTracker(1000);
    t.seen('a', 0);
    t.seen('b', 100);
    t.seen('c', 200);
    expect(t.size()).toBe(3);

    // Advancing past window should sweep all on next call
    t.seen('d', 5000);
    expect(t.size()).toBe(1);
  });

  it('should clear() reset state', () => {
    const t = createDedupTracker(60_000);
    t.seen('a', 0);
    t.clear();
    expect(t.size()).toBe(0);
    expect(t.seen('a', 100)).toBe(false);
  });
});

describe('observe() integration with fingerprint + dedup', () => {
  it('should attach fingerprint to error events automatically', () => {
    const sent: ObserveEvent[][] = [];
    const transport: Transport = { send: (e) => { sent.push([...e]); } };

    const obs = observe({
      transport,
      vitals: false,
      errors: true,
      batchSize: 100,
    });

    const observer = getGlobalObserver()!;
    observer({
      type: 'error',
      message: 'boom',
      timestamp: 100,
      url: '/',
    });

    obs.flush();
    const flat = sent.flat() as ErrorEvent[];
    expect(flat[0].fingerprint).toMatch(/^[0-9a-f]{8}$/);
    obs.destroy();
  });

  it('should NOT dedup by default', () => {
    const sent: ObserveEvent[][] = [];
    const transport: Transport = { send: (e) => { sent.push([...e]); } };

    const obs = observe({
      transport,
      vitals: false,
      errors: true, // boolean — no dedup
      batchSize: 100,
    });

    const observer = getGlobalObserver()!;
    for (let i = 0; i < 5; i++) {
      observer({ type: 'error', message: 'same', timestamp: i, url: '/' });
    }
    obs.flush();
    expect(sent.flat()).toHaveLength(5);
    obs.destroy();
  });

  it('should dedup duplicates when errors.dedupe is enabled', () => {
    const sent: ObserveEvent[][] = [];
    const transport: Transport = { send: (e) => { sent.push([...e]); } };

    const obs = observe({
      transport,
      vitals: false,
      errors: { dedupe: true, dedupeWindow: 60_000 },
      batchSize: 100,
    });

    const observer = getGlobalObserver()!;
    for (let i = 0; i < 5; i++) {
      observer({ type: 'error', message: 'same', timestamp: i, url: '/' });
    }
    obs.flush();
    expect(sent.flat()).toHaveLength(1);
    expect(obs.getStats().dropped).toBe(4);
    obs.destroy();
  });

  it('should NOT dedup different errors', () => {
    const sent: ObserveEvent[][] = [];
    const transport: Transport = { send: (e) => { sent.push([...e]); } };

    const obs = observe({
      transport,
      vitals: false,
      errors: { dedupe: true },
      batchSize: 100,
    });

    const observer = getGlobalObserver()!;
    observer({ type: 'error', message: 'a', timestamp: 1, url: '/' });
    observer({ type: 'error', message: 'b', timestamp: 2, url: '/' });
    obs.flush();
    expect(sent.flat()).toHaveLength(2);
    obs.destroy();
  });
});

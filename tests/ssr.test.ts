import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * SSR safety tests.
 *
 * Verifies that svoose functions don't crash when called
 * in server-side environments (no window, document, navigator).
 */
describe('SSR safety', () => {
  describe('observe() SSR guard', () => {
    it('should return noop cleanup when window is undefined', async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error — simulating SSR
      delete globalThis.window;

      try {
        // Dynamic import to get fresh module after globalThis change
        const { observe } = await import('../src/observe/observe.svelte.js');
        const cleanup = observe({ endpoint: '/api/metrics' });

        expect(typeof cleanup).toBe('function');
        // Should not throw
        cleanup();
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('should return noop cleanup when document is undefined', async () => {
      const originalDocument = globalThis.document;
      // @ts-expect-error — simulating SSR
      delete globalThis.document;

      try {
        const { observe } = await import('../src/observe/observe.svelte.js');
        const cleanup = observe({ endpoint: '/api/metrics' });

        expect(typeof cleanup).toBe('function');
        cleanup();
      } finally {
        globalThis.document = originalDocument;
      }
    });
  });

  describe('metric functions SSR safety', () => {
    it('should not crash when calling metric() without observe()', async () => {
      const { metric, counter, gauge, histogram } = await import('../src/metrics/metric.js');

      // These should buffer, not crash
      expect(() => metric('test')).not.toThrow();
      expect(() => counter('test')).not.toThrow();
      expect(() => gauge('test', 42)).not.toThrow();
      expect(() => histogram('test', 100)).not.toThrow();
    });
  });

  describe('createMachine SSR safety', () => {
    it('should work without window/document', async () => {
      const { createMachine } = await import('../src/machine/machine.svelte.js');

      const machine = createMachine({
        id: 'ssr-test',
        initial: 'idle',
        context: {},
        states: {
          idle: { on: { START: 'running' } },
          running: { on: { STOP: 'idle' } },
        },
      });

      expect(machine.state).toBe('idle');
      machine.send('START');
      expect(machine.state).toBe('running');
      machine.destroy();
    });
  });
});

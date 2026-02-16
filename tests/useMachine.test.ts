import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMachine } from '../src/svelte/index.svelte.js';

// Mock PerformanceObserver to prevent vitals from interfering
vi.stubGlobal('PerformanceObserver', vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
})));

describe('useMachine', () => {
  describe('basic functionality', () => {
    it('should create a machine with initial state', () => {
      const machine = useMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      expect(machine.state).toBe('off');
      machine.destroy();
    });

    it('should create a machine with initial context', () => {
      const machine = useMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INCREMENT: {
                target: 'active',
                action: (ctx) => ({ count: ctx.count + 1 }),
              },
            },
          },
        },
      });

      expect(machine.context).toEqual({ count: 0 });
      machine.destroy();
    });
  });

  describe('send', () => {
    it('should transition state on send', () => {
      const machine = useMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      machine.send('TOGGLE');
      expect(machine.state).toBe('on');

      machine.send('TOGGLE');
      expect(machine.state).toBe('off');

      machine.destroy();
    });

    it('should accept event objects', () => {
      const machine = useMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      machine.send({ type: 'TOGGLE' });
      expect(machine.state).toBe('on');
      machine.destroy();
    });

    it('should update context on transition action', () => {
      const machine = useMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INCREMENT: {
                target: 'active',
                action: (ctx) => ({ count: ctx.count + 1 }),
              },
            },
          },
        },
      });

      machine.send('INCREMENT');
      expect(machine.context.count).toBe(1);

      machine.send('INCREMENT');
      expect(machine.context.count).toBe(2);

      machine.destroy();
    });
  });

  describe('matches', () => {
    it('should return true for current state', () => {
      const machine = useMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      expect(machine.matches('off')).toBe(true);
      expect(machine.matches('on')).toBe(false);

      machine.send('TOGGLE');
      expect(machine.matches('on')).toBe(true);
      expect(machine.matches('off')).toBe(false);

      machine.destroy();
    });
  });

  describe('matchesAny', () => {
    it('should return true if current state is in the list', () => {
      const machine = useMachine({
        id: 'traffic',
        initial: 'red',
        states: {
          red: { on: { NEXT: 'green' } },
          green: { on: { NEXT: 'yellow' } },
          yellow: { on: { NEXT: 'red' } },
        },
      });

      expect(machine.matchesAny('red', 'yellow')).toBe(true);
      expect(machine.matchesAny('green', 'yellow')).toBe(false);

      machine.send('NEXT');
      expect(machine.matchesAny('green', 'yellow')).toBe(true);

      machine.destroy();
    });
  });

  describe('can', () => {
    it('should check if event can be sent', () => {
      const machine = useMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      expect(machine.can('TOGGLE')).toBe(true);
      expect(machine.can('NONEXISTENT' as any)).toBe(false);

      machine.destroy();
    });

    it('should respect guards', () => {
      const machine = useMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INCREMENT: {
                target: 'active',
                guard: (ctx) => ctx.count < 2,
                action: (ctx) => ({ count: ctx.count + 1 }),
              },
            },
          },
        },
      });

      expect(machine.can('INCREMENT')).toBe(true);
      machine.send('INCREMENT');
      machine.send('INCREMENT');
      expect(machine.context.count).toBe(2);
      expect(machine.can('INCREMENT')).toBe(false);

      machine.destroy();
    });
  });

  describe('destroy', () => {
    it('should call destroy without error', () => {
      const machine = useMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      expect(() => machine.destroy()).not.toThrow();
    });
  });

  describe('entry/exit actions', () => {
    it('should run entry and exit actions', () => {
      const log: string[] = [];

      const machine = useMachine({
        id: 'steps',
        initial: 'a',
        context: {},
        states: {
          a: {
            exit: () => { log.push('exit-a'); },
            on: { NEXT: 'b' },
          },
          b: {
            entry: () => { log.push('enter-b'); },
            on: { NEXT: 'a' },
          },
        },
      });

      machine.send('NEXT');
      expect(log).toEqual(['exit-a', 'enter-b']);
      expect(machine.state).toBe('b');

      machine.destroy();
    });
  });

  describe('reactive state updates after send', () => {
    it('should reflect state changes immediately after send', () => {
      const machine = useMachine({
        id: 'multi',
        initial: 'a',
        context: { value: 0 },
        states: {
          a: {
            on: {
              GO_B: {
                target: 'b',
                action: () => ({ value: 1 }),
              },
            },
          },
          b: {
            on: {
              GO_C: {
                target: 'c',
                action: () => ({ value: 2 }),
              },
            },
          },
          c: {},
        },
      });

      expect(machine.state).toBe('a');
      expect(machine.context.value).toBe(0);

      machine.send('GO_B');
      expect(machine.state).toBe('b');
      expect(machine.context.value).toBe(1);

      machine.send('GO_C');
      expect(machine.state).toBe('c');
      expect(machine.context.value).toBe(2);

      machine.destroy();
    });
  });

  describe('fromMachine alias', () => {
    it('should be exported as an alias for useMachine', async () => {
      const { fromMachine } = await import('../src/svelte/index.svelte.js');
      expect(fromMachine).toBe(useMachine);
    });
  });
});

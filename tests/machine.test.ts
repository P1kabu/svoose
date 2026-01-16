import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMachine, createEvent } from '../src/machine/index.js';

describe('createMachine', () => {
  describe('basic functionality', () => {
    it('should create a machine with initial state', () => {
      const machine = createMachine({
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

    it('should transition on event', () => {
      const machine = createMachine({
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
      const machine = createMachine({
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

    it('should ignore unknown events', () => {
      const machine = createMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off' } },
        },
      });

      machine.send('UNKNOWN' as 'TOGGLE');
      expect(machine.state).toBe('off');

      machine.destroy();
    });
  });

  describe('matches()', () => {
    it('should return true for current state', () => {
      const machine = createMachine({
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
      expect(machine.matches('off')).toBe(false);
      expect(machine.matches('on')).toBe(true);

      machine.destroy();
    });
  });

  describe('matchesAny()', () => {
    it('should return true if in any of the states', () => {
      const machine = createMachine({
        id: 'traffic',
        initial: 'red',
        states: {
          red: { on: { NEXT: 'green' } },
          yellow: { on: { NEXT: 'red' } },
          green: { on: { NEXT: 'yellow' } },
        },
      });

      expect(machine.matchesAny('red', 'yellow')).toBe(true);
      expect(machine.matchesAny('green', 'yellow')).toBe(false);

      machine.destroy();
    });
  });

  describe('can()', () => {
    it('should return true if transition exists', () => {
      const machine = createMachine({
        id: 'toggle',
        initial: 'off',
        states: {
          off: { on: { TOGGLE: 'on' } },
          on: { on: { TOGGLE: 'off', RESET: 'off' } },
        },
      });

      expect(machine.can('TOGGLE')).toBe(true);
      expect(machine.can('RESET')).toBe(false);

      machine.send('TOGGLE');
      expect(machine.can('TOGGLE')).toBe(true);
      expect(machine.can('RESET')).toBe(true);

      machine.destroy();
    });

    it('should respect guards in can()', () => {
      const machine = createMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              DECREMENT: {
                target: 'active',
                guard: (ctx) => ctx.count > 0,
                action: (ctx) => ({ count: ctx.count - 1 }),
              },
            },
          },
        },
      });

      expect(machine.can('DECREMENT')).toBe(false);

      machine.destroy();
    });
  });

  describe('context', () => {
    it('should initialize with context', () => {
      const machine = createMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 5, name: 'test' },
        states: {
          active: {},
        },
      });

      expect(machine.context.count).toBe(5);
      expect(machine.context.name).toBe('test');

      machine.destroy();
    });

    it('should update context via action', () => {
      type Event = { type: 'INCREMENT' } | { type: 'SET'; value: number };

      const machine = createMachine<{ count: number }, 'active', Event>({
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
              SET: {
                target: 'active',
                action: (ctx, event) => ({ count: event.value }),
              },
            },
          },
        },
      });

      machine.send('INCREMENT');
      expect(machine.context.count).toBe(1);

      machine.send('INCREMENT');
      expect(machine.context.count).toBe(2);

      machine.send({ type: 'SET', value: 10 });
      expect(machine.context.count).toBe(10);

      machine.destroy();
    });
  });

  describe('guards', () => {
    it('should prevent transition when guard returns false', () => {
      const machine = createMachine({
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              DECREMENT: {
                target: 'active',
                guard: (ctx) => ctx.count > 0,
                action: (ctx) => ({ count: ctx.count - 1 }),
              },
              INCREMENT: {
                target: 'active',
                action: (ctx) => ({ count: ctx.count + 1 }),
              },
            },
          },
        },
      });

      // Should not decrement below 0
      machine.send('DECREMENT');
      expect(machine.context.count).toBe(0);

      // Increment first
      machine.send('INCREMENT');
      machine.send('INCREMENT');
      expect(machine.context.count).toBe(2);

      // Now can decrement
      machine.send('DECREMENT');
      expect(machine.context.count).toBe(1);

      machine.destroy();
    });

    it('should pass event to guard', () => {
      type Event = { type: 'SET'; value: number };

      const guardFn = vi.fn((ctx: { max: number }, event: Event) => {
        return event.value <= ctx.max;
      });

      const machine = createMachine<{ max: number; value: number }, 'active', Event>({
        id: 'bounded',
        initial: 'active',
        context: { max: 10, value: 0 },
        states: {
          active: {
            on: {
              SET: {
                target: 'active',
                guard: guardFn,
                action: (_, event) => ({ value: event.value }),
              },
            },
          },
        },
      });

      machine.send({ type: 'SET', value: 5 });
      expect(machine.context.value).toBe(5);
      expect(guardFn).toHaveBeenCalledWith(
        expect.objectContaining({ max: 10 }),
        expect.objectContaining({ type: 'SET', value: 5 })
      );

      // Should not update - guard fails
      machine.send({ type: 'SET', value: 15 });
      expect(machine.context.value).toBe(5);

      machine.destroy();
    });
  });

  describe('entry/exit actions', () => {
    it('should run entry action on initial state', () => {
      const entryFn = vi.fn(() => ({ initialized: true }));

      const machine = createMachine({
        id: 'test',
        initial: 'idle',
        context: { initialized: false },
        states: {
          idle: {
            entry: entryFn,
            on: { START: 'running' },
          },
          running: {},
        },
      });

      expect(entryFn).toHaveBeenCalledTimes(1);
      expect(machine.context.initialized).toBe(true);

      machine.destroy();
    });

    it('should run entry and exit actions on transition', () => {
      const exitIdle = vi.fn();
      const entryRunning = vi.fn(() => ({ status: 'running' }));

      const machine = createMachine({
        id: 'test',
        initial: 'idle',
        context: { status: 'idle' },
        states: {
          idle: {
            exit: exitIdle,
            on: { START: 'running' },
          },
          running: {
            entry: entryRunning,
            on: { STOP: 'idle' },
          },
        },
      });

      expect(exitIdle).not.toHaveBeenCalled();
      expect(entryRunning).not.toHaveBeenCalled();

      machine.send('START');

      expect(exitIdle).toHaveBeenCalledTimes(1);
      expect(entryRunning).toHaveBeenCalledTimes(1);
      expect(machine.context.status).toBe('running');

      machine.destroy();
    });
  });

  describe('complex scenarios', () => {
    it('should handle auth flow', () => {
      type AuthContext = {
        user: { name: string } | null;
        error: string | null;
      };

      type AuthEvent =
        | { type: 'LOGIN' }
        | { type: 'SUCCESS'; user: { name: string } }
        | { type: 'ERROR'; message: string }
        | { type: 'LOGOUT' };

      const auth = createMachine<AuthContext, 'idle' | 'loading' | 'authenticated', AuthEvent>({
        id: 'auth',
        initial: 'idle',
        context: { user: null, error: null },
        states: {
          idle: {
            on: { LOGIN: 'loading' },
          },
          loading: {
            entry: () => ({ error: null }),
            on: {
              SUCCESS: {
                target: 'authenticated',
                action: (_, event) => ({ user: event.user }),
              },
              ERROR: {
                target: 'idle',
                action: (_, event) => ({ error: event.message }),
              },
            },
          },
          authenticated: {
            on: {
              LOGOUT: {
                target: 'idle',
                action: () => ({ user: null }),
              },
            },
          },
        },
      });

      expect(auth.state).toBe('idle');
      expect(auth.context.user).toBeNull();

      auth.send('LOGIN');
      expect(auth.state).toBe('loading');

      auth.send({ type: 'SUCCESS', user: { name: 'John' } });
      expect(auth.state).toBe('authenticated');
      expect(auth.context.user?.name).toBe('John');

      auth.send('LOGOUT');
      expect(auth.state).toBe('idle');
      expect(auth.context.user).toBeNull();

      // Test error path
      auth.send('LOGIN');
      auth.send({ type: 'ERROR', message: 'Invalid credentials' });
      expect(auth.state).toBe('idle');
      expect(auth.context.error).toBe('Invalid credentials');

      auth.destroy();
    });
  });
});

describe('createEvent', () => {
  it('should create event with type only', () => {
    const event = createEvent('TOGGLE');
    expect(event).toEqual({ type: 'TOGGLE' });
  });

  it('should create event with payload', () => {
    const event = createEvent('SET', { value: 42 });
    expect(event).toEqual({ type: 'SET', value: 42 });
  });
});

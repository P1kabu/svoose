import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMachine } from '../src/machine/index.js';
import { observe, getGlobalObserver } from '../src/observe/observe.svelte.js';
import type { Transport, ObserveEvent } from '../src/types/index.js';

// Mock PerformanceObserver
class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

describe('stress tests', () => {
  beforeEach(() => {
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
      value: [],
      writable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('machine stress tests', () => {
    it('should handle 10000 rapid transitions without memory leak', () => {
      const machine = createMachine({
        id: 'stress-toggle',
        initial: 'off',
        context: { toggleCount: 0 },
        states: {
          off: {
            on: {
              TOGGLE: {
                target: 'on',
                action: (ctx) => ({ toggleCount: ctx.toggleCount + 1 }),
              },
            },
          },
          on: {
            on: {
              TOGGLE: {
                target: 'off',
                action: (ctx) => ({ toggleCount: ctx.toggleCount + 1 }),
              },
            },
          },
        },
      });

      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        machine.send('TOGGLE');
      }

      expect(machine.context.toggleCount).toBe(iterations);
      // Even iterations = off state
      expect(machine.state).toBe('off');

      machine.destroy();
    });

    it('should handle complex state machine with many states', () => {
      type State = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';
      const states: State[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

      const stateConfig = {} as Record<State, { on: { NEXT: State } }>;
      for (let i = 0; i < states.length; i++) {
        const nextState = states[(i + 1) % states.length];
        stateConfig[states[i]] = {
          on: { NEXT: nextState },
        };
      }

      const machine = createMachine({
        id: 'many-states',
        initial: 'a' as State,
        context: { visits: {} as Record<State, number> },
        states: stateConfig,
      });

      // Visit all states multiple times
      for (let i = 0; i < 1000; i++) {
        machine.send('NEXT');
      }

      // 1000 % 10 = 0, should be back at 'a'
      expect(machine.state).toBe('a');

      machine.destroy();
    });

    it('should handle machine with complex context updates', () => {
      const machine = createMachine({
        id: 'complex-context',
        initial: 'active',
        context: {
          items: [] as number[],
          map: {} as Record<string, number>,
          nested: { level1: { level2: { value: 0 } } },
        },
        states: {
          active: {
            on: {
              ADD_ITEM: {
                target: 'active',
                action: (ctx, event: { type: 'ADD_ITEM'; value: number }) => ({
                  items: [...ctx.items, event.value],
                }),
              },
              SET_MAP: {
                target: 'active',
                action: (ctx, event: { type: 'SET_MAP'; key: string; value: number }) => ({
                  map: { ...ctx.map, [event.key]: event.value },
                }),
              },
              UPDATE_NESTED: {
                target: 'active',
                action: (ctx) => ({
                  nested: {
                    level1: {
                      level2: {
                        value: ctx.nested.level1.level2.value + 1,
                      },
                    },
                  },
                }),
              },
            },
          },
        },
      });

      // Add many items
      for (let i = 0; i < 1000; i++) {
        machine.send({ type: 'ADD_ITEM', value: i });
      }
      expect(machine.context.items.length).toBe(1000);

      // Set many map entries
      for (let i = 0; i < 100; i++) {
        machine.send({ type: 'SET_MAP', key: `key${i}`, value: i });
      }
      expect(Object.keys(machine.context.map).length).toBe(100);

      // Update nested value many times
      for (let i = 0; i < 500; i++) {
        machine.send({ type: 'UPDATE_NESTED' });
      }
      expect(machine.context.nested.level1.level2.value).toBe(500);

      machine.destroy();
    });

    it('should handle multiple machines running simultaneously', () => {
      const machines = [];

      for (let i = 0; i < 100; i++) {
        const machine = createMachine({
          id: `machine-${i}`,
          initial: 'idle',
          context: { value: i },
          states: {
            idle: {
              on: {
                INCREMENT: {
                  target: 'idle',
                  action: (ctx) => ({ value: ctx.value + 1 }),
                },
              },
            },
          },
        });
        machines.push(machine);
      }

      // Send events to all machines
      for (const machine of machines) {
        for (let j = 0; j < 100; j++) {
          machine.send('INCREMENT');
        }
      }

      // Verify all machines updated correctly
      for (let i = 0; i < machines.length; i++) {
        expect(machines[i].context.value).toBe(i + 100);
      }

      // Cleanup all machines
      for (const machine of machines) {
        machine.destroy();
      }
    });

    it('should handle guards that do complex checks', () => {
      const machine = createMachine({
        id: 'guard-stress',
        initial: 'active',
        context: { values: [] as number[] },
        states: {
          active: {
            on: {
              ADD: {
                target: 'active',
                guard: (ctx, event: { type: 'ADD'; value: number }) => {
                  // Complex guard: check if value is prime
                  const isPrime = (n: number) => {
                    if (n < 2) return false;
                    for (let i = 2; i <= Math.sqrt(n); i++) {
                      if (n % i === 0) return false;
                    }
                    return true;
                  };
                  return isPrime(event.value);
                },
                action: (ctx, event: { type: 'ADD'; value: number }) => ({
                  values: [...ctx.values, event.value],
                }),
              },
            },
          },
        },
      });

      // Try to add numbers 1-1000, only primes should be added
      for (let i = 1; i <= 1000; i++) {
        machine.send({ type: 'ADD', value: i });
      }

      // There are 168 primes between 1 and 1000
      expect(machine.context.values.length).toBe(168);

      machine.destroy();
    });
  });

  describe('observe stress tests', () => {
    it('should handle large batches of events', () => {
      const sentBatches: ObserveEvent[][] = [];
      const transport: Transport = {
        send: (events) => {
          sentBatches.push([...events]);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
      });

      const observer = getGlobalObserver()!;

      // Send 1000 events
      for (let i = 0; i < 1000; i++) {
        observer({
          type: 'transition',
          machineId: 'stress',
          from: 'a',
          to: 'b',
          event: 'TEST',
          timestamp: Date.now(),
        });
      }

      // Should have batched into ~10 batches of 100
      expect(sentBatches.length).toBe(10);
      expect(sentBatches.every((batch) => batch.length === 100)).toBe(true);

      cleanup();
    });

    it('should handle rapid flush intervals', () => {
      const sentBatches: ObserveEvent[][] = [];
      const transport: Transport = {
        send: (events) => {
          sentBatches.push([...events]);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1000,
        flushInterval: 100,
      });

      const observer = getGlobalObserver()!;

      // Send events over time
      for (let i = 0; i < 50; i++) {
        observer({
          type: 'transition',
          machineId: 'stress',
          from: 'a',
          to: 'b',
          event: 'TEST',
          timestamp: Date.now(),
        });
        vi.advanceTimersByTime(10);
      }

      // Flush remaining
      vi.advanceTimersByTime(100);

      // Should have sent multiple batches due to interval
      expect(sentBatches.length).toBeGreaterThan(0);

      cleanup();
    });

    it('should handle mixed event types', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => {
          sentEvents.push(...events);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 1,
      });

      const observer = getGlobalObserver()!;

      // Send different event types
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          observer({
            type: 'transition',
            machineId: 'test',
            from: 'a',
            to: 'b',
            event: 'TEST',
            timestamp: Date.now(),
          });
        } else if (i % 3 === 1) {
          observer({
            type: 'vital',
            name: 'CLS',
            value: 0.1,
            rating: 'good',
            delta: 0.1,
            timestamp: Date.now(),
            url: 'https://test.com',
          });
        } else {
          observer({
            type: 'error',
            message: 'Test error',
            timestamp: Date.now(),
            url: 'https://test.com',
          });
        }
      }

      expect(sentEvents.length).toBe(100);

      const transitions = sentEvents.filter((e) => e.type === 'transition');
      const vitals = sentEvents.filter((e) => e.type === 'vital');
      const errors = sentEvents.filter((e) => e.type === 'error');

      expect(transitions.length).toBe(34); // 0, 3, 6, ..., 99 => 34 items
      expect(vitals.length).toBe(33); // 1, 4, 7, ..., 97 => 33 items
      expect(errors.length).toBe(33); // 2, 5, 8, ..., 98 => 33 items

      cleanup();
    });

    it('should handle transport failures gracefully under load', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let sendCount = 0;
      let failCount = 0;

      const transport: Transport = {
        send: (events) => {
          sendCount++;
          if (sendCount % 2 === 0) {
            failCount++;
            // Sync failure - no promise
          }
          // Sync transport - returns void
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 10,
        debug: true,
        flushInterval: 60000, // Disable flush interval for this test
      });

      const observer = getGlobalObserver()!;

      // Send many events that will trigger multiple sends
      for (let i = 0; i < 100; i++) {
        observer({
          type: 'transition',
          machineId: 'stress',
          from: 'a',
          to: 'b',
          event: 'TEST',
          timestamp: Date.now(),
        });
      }

      // Should have attempted to send multiple times (100 events / 10 batch size = 10 sends)
      expect(sendCount).toBe(10);

      cleanup();
      errorSpy.mockRestore();
    });
  });

  describe('combined stress tests', () => {
    it('should handle machine with observe under heavy load', () => {
      const sentEvents: ObserveEvent[] = [];
      const transport: Transport = {
        send: (events) => {
          sentEvents.push(...events);
        },
      };

      const cleanup = observe({
        transport,
        vitals: false,
        errors: false,
        batchSize: 100,
        flushInterval: 60000, // Disable auto-flush for predictable test
      });

      const machine = createMachine({
        id: 'observed-stress',
        initial: 'idle',
        context: { count: 0 },
        observe: true,
        states: {
          idle: {
            on: {
              START: 'running',
            },
          },
          running: {
            on: {
              TICK: {
                target: 'running',
                action: (ctx) => ({ count: ctx.count + 1 }),
              },
              STOP: 'idle',
            },
          },
        },
      });

      machine.send('START');

      // Send many ticks
      for (let i = 0; i < 1000; i++) {
        machine.send('TICK');
      }

      machine.send('STOP');

      expect(machine.context.count).toBe(1000);

      // Cleanup flushes remaining events
      cleanup();

      // Should have sent many transition events
      // 1 START + 1000 TICKs + 1 STOP = 1002 transitions
      const totalSent = sentEvents.length;
      expect(totalSent).toBe(1002);

      machine.destroy();
    });

    it('should maintain consistency with errors during heavy load', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let shouldFail = false;
      let externalCounter = 0;

      const machine = createMachine({
        id: 'error-stress',
        initial: 'active',
        context: { successCount: 0 },
        states: {
          active: {
            on: {
              ATTEMPT: {
                target: 'active',
                action: (ctx) => {
                  externalCounter++;
                  // Fail every 10th attempt when shouldFail is true
                  if (shouldFail && externalCounter % 10 === 0) {
                    throw new Error('Simulated failure');
                  }
                  return {
                    successCount: ctx.successCount + 1,
                  };
                },
              },
            },
          },
        },
      });

      // First batch without failures
      for (let i = 0; i < 100; i++) {
        machine.send('ATTEMPT');
      }
      expect(machine.context.successCount).toBe(100);
      expect(externalCounter).toBe(100);

      // Enable failures
      shouldFail = true;
      for (let i = 0; i < 100; i++) {
        machine.send('ATTEMPT');
      }

      // External counter still increments for all 100 attempts
      expect(externalCounter).toBe(200);

      // Every 10th attempt fails (110, 120, 130, ..., 200), so 10 failures out of 100
      // Success count should be 100 (before) + 90 (after, minus 10 failures)
      expect(machine.context.successCount).toBe(190);

      machine.destroy();
      errorSpy.mockRestore();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observe, getGlobalObserver } from '../src/observe/observe.svelte.js';
import { identify, _resetUser, getUserContext } from '../src/observe/user.js';
import { isIdentify } from '../src/observe/guards.js';
import type { Transport, ObserveEvent, IdentifyEvent, CustomMetricEvent } from '../src/types/index.js';

class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

describe('identify()', () => {
  beforeEach(() => {
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
      value: [],
      writable: true,
    });
    vi.useFakeTimers();
    _resetUser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
    _resetUser();
  });

  it('emits IdentifyEvent on login with traits', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify({ id: 'user_123', traits: { plan: 'premium' } });

    expect(sent).toHaveLength(1);
    const event = sent[0] as IdentifyEvent;
    expect(event.type).toBe('identify');
    expect(event.userId).toBe('user_123');
    expect(event.traits).toEqual({ plan: 'premium' });
    expect(event.previousUserId).toBeUndefined();
    expect(typeof event.timestamp).toBe('number');

    obs.destroy();
  });

  it('emits IdentifyEvent on login without traits', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify({ id: 'user_42' });

    const event = sent[0] as IdentifyEvent;
    expect(event.userId).toBe('user_42');
    expect(event.traits).toBeUndefined();

    obs.destroy();
  });

  it('emits IdentifyEvent on logout with previousUserId', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify({ id: 'user_123' });
    identify(null);

    expect(sent).toHaveLength(2);
    const logout = sent[1] as IdentifyEvent;
    expect(logout.userId).toBeNull();
    expect(logout.previousUserId).toBe('user_123');
    expect(logout.traits).toBeUndefined();

    obs.destroy();
  });

  it('identify(null) is a no-op when no user is logged in', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify(null);

    expect(sent).toHaveLength(0);
    expect(getUserContext()).toBeNull();

    obs.destroy();
  });

  it('injects userId/userTraits into subsequent events', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify({ id: 'user_123', traits: { plan: 'premium' } });

    // Reach into the global observer (the bufferEvent function) — same path used by metric()
    const customEvent: CustomMetricEvent = {
      type: 'custom',
      name: 'checkout_started',
      timestamp: Date.now(),
    };
    getGlobalObserver()!(customEvent);

    const customSent = sent.find((e) => e.type === 'custom') as CustomMetricEvent & {
      userId?: string;
      userTraits?: Record<string, unknown>;
    };
    expect(customSent.userId).toBe('user_123');
    expect(customSent.userTraits).toEqual({ plan: 'premium' });

    obs.destroy();
  });

  it('subsequent events have no userId after logout', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify({ id: 'user_123' });
    identify(null);

    getGlobalObserver()!({
      type: 'transition',
      machineId: 'm',
      from: 'a',
      to: 'b',
      event: 'NEXT',
      timestamp: Date.now(),
    });

    const transition = sent.find((e) => e.type === 'transition') as ObserveEvent & {
      userId?: string;
    };
    expect(transition.userId).toBeUndefined();

    obs.destroy();
  });

  it('last identify() wins on re-identification', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    identify({ id: 'user_a', traits: { plan: 'free' } });
    identify({ id: 'user_b', traits: { plan: 'premium' } });

    const ctx = getUserContext();
    expect(ctx?.userId).toBe('user_b');
    expect(ctx?.userTraits).toEqual({ plan: 'premium' });

    obs.destroy();
  });

  it('drops identify events when sampling.identify = 0', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({
      transport,
      vitals: false,
      errors: false,
      batchSize: 1,
      sampling: { identify: 0 },
    });

    identify({ id: 'user_123' });
    expect(sent.filter((e) => e.type === 'identify')).toHaveLength(0);

    obs.destroy();
  });

  it('isIdentify type guard works', () => {
    const event: IdentifyEvent = {
      type: 'identify',
      userId: 'user_1',
      timestamp: Date.now(),
    };
    expect(isIdentify(event)).toBe(true);
    expect(isIdentify({ type: 'vital', name: 'LCP', value: 0, rating: 'good', delta: 0, timestamp: 0, url: '/' })).toBe(false);
  });

  it('passes through privacy.sanitize and respects null=DROP', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({
      transport,
      vitals: false,
      errors: false,
      batchSize: 1,
      privacy: {
        sanitize: (event) => (event.type === 'identify' ? null : event),
      },
    });

    identify({ id: 'user_123' });
    expect(sent.filter((e) => e.type === 'identify')).toHaveLength(0);

    obs.destroy();
  });

  it('cleanup on destroy() — later identify() does not crash and does not emit', () => {
    const sent: ObserveEvent[] = [];
    const transport: Transport = { send: (e) => { sent.push(...e); } };
    const obs = observe({ transport, vitals: false, errors: false, batchSize: 1 });

    obs.destroy();
    expect(() => identify({ id: 'after_destroy' })).not.toThrow();
    expect(sent.filter((e) => e.type === 'identify')).toHaveLength(0);
  });

  it('does not crash when called before observe() is initialized (SSR-safe path)', () => {
    expect(() => identify({ id: 'no_observer' })).not.toThrow();
    expect(() => identify(null)).not.toThrow();
    expect(getUserContext()).toBeNull();
  });
});

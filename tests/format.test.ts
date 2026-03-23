import { describe, it, expect } from 'vitest';
import type {
  VitalEvent,
  ErrorEvent,
  UnhandledRejectionEvent,
  TransitionEvent,
  CustomMetricEvent,
  ObserveEvent,
} from '../src/types/index.js';

/**
 * JSON format stability tests.
 *
 * These tests ensure that ObserveEvent JSON structure remains stable
 * for downstream consumers (Grafana templates, database schemas, reference backends).
 * If a field is renamed or removed, these tests catch it.
 */
describe('event format stability', () => {
  const timestamp = 1710500000000;

  describe('VitalEvent', () => {
    const event: VitalEvent = {
      type: 'vital',
      name: 'LCP',
      value: 1234,
      rating: 'good',
      delta: 1234,
      timestamp,
      url: 'https://example.com/page',
    };

    it('should have stable field names', () => {
      expect(Object.keys(event).sort()).toEqual([
        'delta', 'name', 'rating', 'timestamp', 'type', 'url', 'value',
      ]);
    });

    it('should serialize to valid JSON', () => {
      const json = JSON.stringify(event);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(event);
    });

    it('should have correct field types', () => {
      expect(typeof event.type).toBe('string');
      expect(typeof event.name).toBe('string');
      expect(typeof event.value).toBe('number');
      expect(typeof event.rating).toBe('string');
      expect(typeof event.delta).toBe('number');
      expect(typeof event.timestamp).toBe('number');
      expect(typeof event.url).toBe('string');
    });

    it('should support optional sessionId', () => {
      const withSession: VitalEvent = { ...event, sessionId: '1710500000000-abc123' };
      const parsed = JSON.parse(JSON.stringify(withSession));
      expect(parsed.sessionId).toBe('1710500000000-abc123');
    });

    it('should accept all valid metric names', () => {
      const names: VitalEvent['name'][] = ['CLS', 'LCP', 'FID', 'INP', 'FCP', 'TTFB'];
      for (const name of names) {
        const e: VitalEvent = { ...event, name };
        expect(e.name).toBe(name);
      }
    });

    it('should accept all valid ratings', () => {
      const ratings: VitalEvent['rating'][] = ['good', 'needs-improvement', 'poor'];
      for (const rating of ratings) {
        const e: VitalEvent = { ...event, rating };
        expect(e.rating).toBe(rating);
      }
    });
  });

  describe('ErrorEvent', () => {
    const event: ErrorEvent = {
      type: 'error',
      message: 'Cannot read properties of null',
      stack: 'TypeError: Cannot read properties of null\n    at handleClick (app.js:42:15)',
      filename: 'app.js',
      lineno: 42,
      colno: 15,
      timestamp,
      url: 'https://example.com/page',
    };

    it('should have stable required field names', () => {
      const required = ['type', 'message', 'timestamp', 'url'];
      for (const field of required) {
        expect(event).toHaveProperty(field);
      }
    });

    it('should have stable optional field names', () => {
      const optional = ['stack', 'filename', 'lineno', 'colno', 'sessionId', 'machineId', 'machineState', 'machines'];
      for (const field of optional) {
        // These should be valid fields (not cause TS errors)
        const withField = { ...event, [field]: 'test' };
        expect(withField).toHaveProperty(field);
      }
    });

    it('should serialize to valid JSON', () => {
      const json = JSON.stringify(event);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(event);
    });

    it('should support machine context fields', () => {
      const withMachine: ErrorEvent = {
        ...event,
        machineId: 'auth',
        machineState: 'loading',
        machines: [{ id: 'auth', state: 'loading' }, { id: 'cart', state: 'idle' }],
      };
      const parsed = JSON.parse(JSON.stringify(withMachine));
      expect(parsed.machineId).toBe('auth');
      expect(parsed.machineState).toBe('loading');
      expect(parsed.machines).toHaveLength(2);
      expect(parsed.machines[0]).toEqual({ id: 'auth', state: 'loading' });
    });
  });

  describe('UnhandledRejectionEvent', () => {
    const event: UnhandledRejectionEvent = {
      type: 'unhandled-rejection',
      reason: 'Network error',
      timestamp,
      url: 'https://example.com/page',
    };

    it('should have stable field names', () => {
      expect(Object.keys(event).sort()).toEqual([
        'reason', 'timestamp', 'type', 'url',
      ]);
    });

    it('should serialize to valid JSON', () => {
      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed).toEqual(event);
    });
  });

  describe('TransitionEvent', () => {
    const event: TransitionEvent = {
      type: 'transition',
      machineId: 'auth',
      from: 'idle',
      to: 'loading',
      event: 'LOGIN',
      timestamp,
    };

    it('should have stable field names', () => {
      expect(Object.keys(event).sort()).toEqual([
        'event', 'from', 'machineId', 'timestamp', 'to', 'type',
      ]);
    });

    it('should serialize to valid JSON', () => {
      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed).toEqual(event);
    });

    it('should support optional context', () => {
      const withContext: TransitionEvent = {
        ...event,
        context: { user: 'john', count: 42 },
      };
      const parsed = JSON.parse(JSON.stringify(withContext));
      expect(parsed.context).toEqual({ user: 'john', count: 42 });
    });

    it('should support optional sessionId', () => {
      const withSession: TransitionEvent = { ...event, sessionId: 'sess-123' };
      const parsed = JSON.parse(JSON.stringify(withSession));
      expect(parsed.sessionId).toBe('sess-123');
    });
  });

  describe('CustomMetricEvent', () => {
    const event: CustomMetricEvent = {
      type: 'custom',
      name: 'page_views',
      timestamp,
    };

    it('should have stable required field names', () => {
      expect(Object.keys(event).sort()).toEqual([
        'name', 'timestamp', 'type',
      ]);
    });

    it('should serialize to valid JSON', () => {
      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed).toEqual(event);
    });

    it('should support counter format', () => {
      const counter: CustomMetricEvent = {
        ...event,
        name: 'api_calls',
        metricKind: 'counter',
        value: 1,
      };
      const parsed = JSON.parse(JSON.stringify(counter));
      expect(parsed.metricKind).toBe('counter');
      expect(parsed.value).toBe(1);
    });

    it('should support gauge format', () => {
      const gauge: CustomMetricEvent = {
        ...event,
        name: 'active_users',
        metricKind: 'gauge',
        value: 42,
      };
      const parsed = JSON.parse(JSON.stringify(gauge));
      expect(parsed.metricKind).toBe('gauge');
      expect(parsed.value).toBe(42);
    });

    it('should support histogram format', () => {
      const histogram: CustomMetricEvent = {
        ...event,
        name: 'response_time_ms',
        metricKind: 'histogram',
        value: 234,
        metadata: { route: '/api/users' },
      };
      const parsed = JSON.parse(JSON.stringify(histogram));
      expect(parsed.metricKind).toBe('histogram');
      expect(parsed.value).toBe(234);
      expect(parsed.metadata).toEqual({ route: '/api/users' });
    });

    it('should support metadata with nested objects', () => {
      const withMeta: CustomMetricEvent = {
        ...event,
        metadata: {
          step: 1,
          cartTotal: 99.99,
          items: ['a', 'b'],
          nested: { deep: true },
        },
      };
      const parsed = JSON.parse(JSON.stringify(withMeta));
      expect(parsed.metadata).toEqual(withMeta.metadata);
    });
  });

  describe('ObserveEvent union', () => {
    it('should distinguish event types by type field', () => {
      const events: ObserveEvent[] = [
        { type: 'vital', name: 'LCP', value: 1234, rating: 'good', delta: 1234, timestamp, url: '/' },
        { type: 'error', message: 'test', timestamp, url: '/' },
        { type: 'unhandled-rejection', reason: 'test', timestamp, url: '/' },
        { type: 'transition', machineId: 'x', from: 'a', to: 'b', event: 'E', timestamp },
        { type: 'custom', name: 'test', timestamp },
      ];

      const types = events.map(e => e.type);
      expect(types).toEqual(['vital', 'error', 'unhandled-rejection', 'transition', 'custom']);
    });

    it('should all have type and timestamp fields', () => {
      const events: ObserveEvent[] = [
        { type: 'vital', name: 'LCP', value: 1234, rating: 'good', delta: 1234, timestamp, url: '/' },
        { type: 'error', message: 'test', timestamp, url: '/' },
        { type: 'unhandled-rejection', reason: 'test', timestamp, url: '/' },
        { type: 'transition', machineId: 'x', from: 'a', to: 'b', event: 'E', timestamp },
        { type: 'custom', name: 'test', timestamp },
      ];

      for (const event of events) {
        expect(event.type).toBeTypeOf('string');
        expect(event.timestamp).toBeTypeOf('number');
      }
    });

    it('should all serialize to valid JSON arrays (batch format)', () => {
      const batch: ObserveEvent[] = [
        { type: 'vital', name: 'LCP', value: 1234, rating: 'good', delta: 1234, timestamp, url: '/' },
        { type: 'error', message: 'test', timestamp, url: '/' },
        { type: 'custom', name: 'click', metricKind: 'counter', value: 1, timestamp },
      ];

      const json = JSON.stringify(batch);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].type).toBe('vital');
      expect(parsed[1].type).toBe('error');
      expect(parsed[2].type).toBe('custom');
    });
  });

  describe('JSON compatibility', () => {
    it('should not contain undefined values after serialization', () => {
      const event: CustomMetricEvent = {
        type: 'custom',
        name: 'test',
        timestamp,
        // metricKind, value, metadata are all undefined
      };

      const json = JSON.stringify(event);
      expect(json).not.toContain('undefined');

      const parsed = JSON.parse(json);
      expect(parsed).not.toHaveProperty('metricKind');
      expect(parsed).not.toHaveProperty('value');
      expect(parsed).not.toHaveProperty('metadata');
    });

    it('should handle special number values gracefully', () => {
      const event: CustomMetricEvent = {
        type: 'custom',
        name: 'test',
        value: 0,
        timestamp,
      };

      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed.value).toBe(0);
    });

    it('should handle empty metadata', () => {
      const event: CustomMetricEvent = {
        type: 'custom',
        name: 'test',
        metadata: {},
        timestamp,
      };

      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed.metadata).toEqual({});
    });

    it('should preserve unicode in messages and metadata', () => {
      const event: ErrorEvent = {
        type: 'error',
        message: 'Помилка: не вдалося завантажити 日本語',
        timestamp,
        url: '/',
      };

      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed.message).toBe('Помилка: не вдалося завантажити 日本語');
    });
  });
});

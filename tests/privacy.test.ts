import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  scrubUrl,
  maskValue,
  stripQueryParams,
  stripHash,
  isExcludedPath,
  configurePII,
  getPIIConfig,
  sanitizeEvent,
  deepClone,
} from '../src/observe/privacy.js';
import { observe, setGlobalObserver, getGlobalObserver } from '../src/observe/observe.svelte.js';
import type { ObserveEvent, Transport, VitalEvent, CustomMetricEvent } from '../src/types/index.js';

class MockPerformanceObserver {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
  configurePII(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  configurePII(null);
});

describe('scrubUrl', () => {
  it('should redact param values matching string keys', () => {
    const out = scrubUrl('https://example.com/?token=abc&safe=ok', ['token']);
    expect(out).toBe('https://example.com/?token=%5BREDACTED%5D&safe=ok');
  });

  it('should redact param values matching regex keys', () => {
    const out = scrubUrl('https://example.com/?Password=secret&id=1', [/password/i]);
    expect(out).toContain('Password=%5BREDACTED%5D');
    expect(out).toContain('id=1');
  });

  it('should handle relative URLs', () => {
    const out = scrubUrl('/api?api_key=zzz&page=1', ['api_key']);
    expect(out).toBe('/api?api_key=%5BREDACTED%5D&page=1');
  });

  it('should leave URL untouched when no params match', () => {
    const url = 'https://example.com/?safe=ok';
    expect(scrubUrl(url, ['token'])).toBe(url);
  });

  it('should return URL untouched on empty patterns', () => {
    const url = 'https://example.com/?token=abc';
    expect(scrubUrl(url, [])).toBe(url);
  });
});

describe('maskValue', () => {
  it('should preserve last 4 chars on long strings', () => {
    expect(maskValue('user@example.com')).toBe('************.com');
  });

  it('should fully mask short strings', () => {
    expect(maskValue('abc')).toBe('****');
    expect(maskValue('abcd')).toBe('****');
  });

  it('should pass non-strings through unchanged', () => {
    expect(maskValue(42)).toBe(42);
    expect(maskValue(null)).toBe(null);
    expect(maskValue(undefined)).toBe(undefined);
    const obj = { a: 1 };
    expect(maskValue(obj)).toBe(obj);
  });
});

describe('stripQueryParams / stripHash', () => {
  it('should strip query params from absolute URL', () => {
    expect(stripQueryParams('https://x.com/p?a=1&b=2')).toBe('https://x.com/p');
  });

  it('should strip query from relative URL', () => {
    expect(stripQueryParams('/p?a=1#h')).toBe('/p#h');
  });

  it('should strip hash from URL', () => {
    expect(stripHash('https://x.com/p?a=1#frag')).toBe('https://x.com/p?a=1');
  });

  it('should strip hash from relative URL', () => {
    expect(stripHash('/p#frag')).toBe('/p');
  });
});

describe('isExcludedPath', () => {
  it('should match exact path', () => {
    expect(isExcludedPath('https://x.com/admin', ['/admin'])).toBe(true);
  });

  it('should match prefix with separator', () => {
    expect(isExcludedPath('https://x.com/admin/users', ['/admin'])).toBe(true);
  });

  it('should NOT match overlapping prefix without separator', () => {
    // '/admin' should NOT match '/admins'
    expect(isExcludedPath('https://x.com/admins', ['/admin'])).toBe(false);
  });

  it('should match relative path', () => {
    expect(isExcludedPath('/login?next=/x', ['/login'])).toBe(true);
  });

  it('should return false on empty paths', () => {
    expect(isExcludedPath('/admin', [])).toBe(false);
  });
});

describe('configurePII', () => {
  it('should overwrite, not merge', () => {
    configurePII({ scrubFromUrl: ['token'] });
    expect(getPIIConfig()).toEqual({ scrubFromUrl: ['token'] });

    configurePII({ maskFields: ['email'] });
    expect(getPIIConfig()).toEqual({ maskFields: ['email'] });
    expect(getPIIConfig()?.scrubFromUrl).toBeUndefined();
  });

  it('should reset on null', () => {
    configurePII({ scrubFromUrl: ['token'] });
    configurePII(null);
    expect(getPIIConfig()).toBeNull();
  });

  it('should reset on empty object', () => {
    configurePII({ scrubFromUrl: ['token'] });
    configurePII({});
    expect(getPIIConfig()).toBeNull();
  });
});

describe('sanitizeEvent', () => {
  const baseVital: VitalEvent = {
    type: 'vital',
    name: 'LCP',
    value: 1234,
    rating: 'good',
    delta: 1234,
    timestamp: 100,
    url: 'https://example.com/page?token=abc&keep=1#frag',
  };

  it('should be a no-op when no config', () => {
    expect(sanitizeEvent(baseVital, null)).toBe(baseVital);
  });

  it('should clone (not mutate input) when config present', () => {
    const out = sanitizeEvent(baseVital, { stripQueryParams: true });
    expect(out).not.toBe(baseVital);
    expect(baseVital.url).toContain('token=abc'); // original untouched
    expect((out as VitalEvent).url).not.toContain('token=abc');
  });

  it('should scrub URL params', () => {
    const out = sanitizeEvent(baseVital, { scrubFromUrl: ['token'] }) as VitalEvent;
    expect(out.url).toContain('token=%5BREDACTED%5D');
    expect(out.url).toContain('keep=1');
  });

  it('should strip query params', () => {
    const out = sanitizeEvent(baseVital, { stripQueryParams: true }) as VitalEvent;
    expect(out.url).not.toContain('?');
    expect(out.url).toContain('#frag');
  });

  it('should strip hash', () => {
    const out = sanitizeEvent(baseVital, { stripHash: true }) as VitalEvent;
    expect(out.url).not.toContain('#frag');
  });

  it('should drop event when path is excluded', () => {
    const out = sanitizeEvent(
      { ...baseVital, url: 'https://example.com/admin/users' },
      { excludePaths: ['/admin'] },
    );
    expect(out).toBeNull();
  });

  it('should mask configured metadata fields', () => {
    const custom: CustomMetricEvent = {
      type: 'custom',
      name: 'signup',
      metadata: { email: 'user@example.com', plan: 'premium' },
      timestamp: 100,
    };
    const out = sanitizeEvent(custom, { maskFields: ['email'] }) as CustomMetricEvent;
    expect(out.metadata?.email).toBe('************.com');
    expect(out.metadata?.plan).toBe('premium');
  });

  it('should DROP via custom sanitize returning null', () => {
    const out = sanitizeEvent(baseVital, { sanitize: () => null });
    expect(out).toBeNull();
  });

  it('should let custom sanitize mutate event', () => {
    const out = sanitizeEvent(baseVital, {
      sanitize: (e) => {
        (e as VitalEvent).value = 9999;
        return e;
      },
    }) as VitalEvent;
    expect(out.value).toBe(9999);
  });

  it('should fall back to runtime configurePII when no inline config passed', () => {
    configurePII({ stripQueryParams: true });
    const out = sanitizeEvent(baseVital, null) as VitalEvent;
    expect(out.url).not.toContain('?');
  });
});

describe('deepClone', () => {
  it('should produce a deep copy', () => {
    const obj = { a: 1, b: { c: 2, d: [3, 4] } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
  });
});

describe('observe() integration with privacy', () => {
  it('should drop events whose URL matches excludePaths', () => {
    const sent: ObserveEvent[][] = [];
    const transport: Transport = { send: (e) => { sent.push([...e]); } };

    const obs = observe({
      transport,
      vitals: false,
      errors: false,
      batchSize: 100,
      privacy: { excludePaths: ['/admin'] },
    });

    const observer = getGlobalObserver()!;
    observer({
      type: 'error',
      message: 'boom',
      timestamp: 100,
      url: 'https://example.com/admin',
    });
    observer({
      type: 'error',
      message: 'visible',
      timestamp: 101,
      url: 'https://example.com/public',
    });

    obs.flush();

    const flat = sent.flat();
    expect(flat).toHaveLength(1);
    expect((flat[0] as { message: string }).message).toBe('visible');
    expect(obs.getStats().dropped).toBe(1);

    obs.destroy();
  });

  it('should run privacy BEFORE filter (pipeline order)', () => {
    const sent: ObserveEvent[][] = [];
    const transport: Transport = { send: (e) => { sent.push([...e]); } };

    let filterSawSecret = false;

    const obs = observe({
      transport,
      vitals: false,
      errors: false,
      batchSize: 100,
      privacy: {
        sanitize: (e) => {
          if ('message' in e && (e as { message: string }).message.includes('secret')) {
            return null;
          }
          return e;
        },
      },
      filter: (e) => {
        if ('message' in e && (e as { message: string }).message.includes('secret')) {
          filterSawSecret = true;
        }
        return true;
      },
    });

    const observer = getGlobalObserver()!;
    observer({
      type: 'error',
      message: 'leaked secret',
      timestamp: 100,
      url: '/',
    });

    obs.flush();
    expect(filterSawSecret).toBe(false); // privacy dropped before filter saw it
    expect(sent.flat()).toHaveLength(0);
    obs.destroy();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDelay, withRetry } from '../src/transport/retry.js';
import { createFetchTransport } from '../src/transport/fetch.js';
import { createHybridTransport } from '../src/transport/hybrid.js';
import type { RetryConfig } from '../src/types/index.js';

describe('calculateDelay', () => {
  it('fixed backoff returns same delay for all attempts', () => {
    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 1000 };
    expect(calculateDelay(config, 1)).toBe(1000);
    expect(calculateDelay(config, 2)).toBe(1000);
    expect(calculateDelay(config, 3)).toBe(1000);
  });

  it('linear backoff scales linearly with attempt', () => {
    const config: RetryConfig = { attempts: 5, backoff: 'linear', initialDelay: 1000 };
    expect(calculateDelay(config, 1)).toBe(1000);
    expect(calculateDelay(config, 2)).toBe(2000);
    expect(calculateDelay(config, 3)).toBe(3000);
  });

  it('exponential backoff doubles each attempt', () => {
    const config: RetryConfig = { attempts: 5, backoff: 'exponential', initialDelay: 1000 };
    expect(calculateDelay(config, 1)).toBe(1000);  // 1000 * 2^0
    expect(calculateDelay(config, 2)).toBe(2000);  // 1000 * 2^1
    expect(calculateDelay(config, 3)).toBe(4000);  // 1000 * 2^2
    expect(calculateDelay(config, 4)).toBe(8000);  // 1000 * 2^3
  });

  it('should cap at maxDelay', () => {
    const config: RetryConfig = { attempts: 10, backoff: 'exponential', initialDelay: 1000, maxDelay: 5000 };
    expect(calculateDelay(config, 1)).toBe(1000);
    expect(calculateDelay(config, 2)).toBe(2000);
    expect(calculateDelay(config, 3)).toBe(4000);
    expect(calculateDelay(config, 4)).toBe(5000); // capped
    expect(calculateDelay(config, 5)).toBe(5000); // capped
  });

  it('linear backoff caps at maxDelay', () => {
    const config: RetryConfig = { attempts: 10, backoff: 'linear', initialDelay: 1000, maxDelay: 3000 };
    expect(calculateDelay(config, 4)).toBe(3000); // capped
  });

  it('jitter applies ±10% randomization', () => {
    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 1000, jitter: true };
    const delays = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const delay = calculateDelay(config, 1);
      delays.add(delay);
      expect(delay).toBeGreaterThanOrEqual(900);
      expect(delay).toBeLessThanOrEqual(1100);
    }
    // Should have some variation (not all the same)
    expect(delays.size).toBeGreaterThan(1);
  });

  it('uses defaults when initialDelay/maxDelay not specified', () => {
    const config: RetryConfig = { attempts: 3, backoff: 'fixed' };
    expect(calculateDelay(config, 1)).toBe(1000); // default initialDelay
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 100 };

    const result = await withRetry(fn, config);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should succeed on retry after initial failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValueOnce('ok');

    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 100 };

    const promise = withRetry(fn, config);
    // Advance past the delay between attempt 1 and 2
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after all attempts fail', async () => {
    vi.useRealTimers();

    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 1 };

    await expect(withRetry(fn, config)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should abort before first attempt when shouldAbort returns true', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 100 };

    await expect(
      withRetry(fn, config, { shouldAbort: () => true })
    ).rejects.toThrow('[svoose] Retry aborted');

    expect(fn).not.toHaveBeenCalled();
  });

  it('should abort between retries when shouldAbort returns true', async () => {
    vi.useRealTimers();

    let abortAfterFirst = false;
    const fn = vi.fn().mockImplementation(async () => {
      if (!abortAfterFirst) {
        abortAfterFirst = true;
        throw new Error('fail');
      }
      return 'ok';
    });

    const config: RetryConfig = { attempts: 3, backoff: 'fixed', initialDelay: 1 };

    await expect(
      withRetry(fn, config, { shouldAbort: () => abortAfterFirst })
    ).rejects.toThrow('[svoose] Retry aborted');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass AbortSignal when timeout is set', async () => {
    vi.useRealTimers(); // need real timers for AbortController

    let receivedSignal: AbortSignal | undefined;
    const fn = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      receivedSignal = signal;
      return 'ok';
    });

    const config: RetryConfig = { attempts: 1, backoff: 'fixed' };
    await withRetry(fn, config, { timeout: 5000 });

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it('should convert non-Error throws to Error', async () => {
    vi.useRealTimers();

    const fn = vi.fn().mockRejectedValue('string error');
    const config: RetryConfig = { attempts: 1, backoff: 'fixed' };

    await expect(withRetry(fn, config)).rejects.toThrow('string error');
  });
});

describe('createFetchTransport with retry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('should retry on fetch failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(new Response());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createFetchTransport('/api/test', {
      retry: { attempts: 3, backoff: 'fixed', initialDelay: 100 },
    });

    const promise = transport.send([{ type: 'vital', name: 'CLS', value: 0, rating: 'good', delta: 0, timestamp: Date.now(), url: '' }]);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should call onError after all retries exhausted', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);
    const onError = vi.fn();

    const transport = createFetchTransport('/api/test', {
      retry: { attempts: 2, backoff: 'fixed', initialDelay: 100 },
      onError,
    });

    const promise = transport.send([{ type: 'vital', name: 'CLS', value: 0, rating: 'good', delta: 0, timestamp: Date.now(), url: '' }]);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should work with timeout only (no retry)', async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createFetchTransport('/api/test', {
      timeout: 5000,
    });

    await transport.send([{ type: 'vital', name: 'CLS', value: 0, rating: 'good', delta: 0, timestamp: Date.now(), url: '' }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Verify signal was passed
    const callArgs = fetchMock.mock.calls[0][1];
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('createHybridTransport with retry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()));
    vi.stubGlobal('navigator', { sendBeacon: vi.fn().mockReturnValue(true) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should pass retry config to fetch transport only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createHybridTransport('/api/test', {
      retry: { attempts: 3, backoff: 'exponential' },
      timeout: 5000,
    });

    await transport.send([{ type: 'vital', name: 'CLS', value: 0, rating: 'good', delta: 0, timestamp: Date.now(), url: '' }]);

    // Should use fetch (default mode) with signal (from retry timeout)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0][1];
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);

    transport.destroy();
  });
});

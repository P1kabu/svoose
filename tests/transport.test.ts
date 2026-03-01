import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFetchTransport, createConsoleTransport } from '../src/transport/index.js';
import type { VitalEvent } from '../src/types/index.js';

describe('createFetchTransport', () => {
  const mockFetch = vi.fn();
  const mockSendBeacon = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });
    mockFetch.mockResolvedValue({ ok: true });
    mockSendBeacon.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should send events via fetch', async () => {
    const transport = createFetchTransport('/api/metrics');
    const events: VitalEvent[] = [
      {
        type: 'vital',
        name: 'CLS',
        value: 0.1,
        rating: 'good',
        delta: 0.1,
        timestamp: Date.now(),
        url: 'https://example.com',
      },
    ];

    await transport.send(events);

    expect(mockFetch).toHaveBeenCalledWith('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(events),
      keepalive: true,
    });
  });

  it('should include custom headers', async () => {
    const transport = createFetchTransport('/api/metrics', {
      headers: {
        Authorization: 'Bearer token123',
        'X-Custom': 'value',
      },
    });

    await transport.send([
      {
        type: 'vital',
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        timestamp: Date.now(),
        url: 'https://example.com',
      },
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/metrics',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
          'X-Custom': 'value',
        },
      })
    );
  });

  it('should not send empty events array', async () => {
    const transport = createFetchTransport('/api/metrics');
    await transport.send([]);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should always use fetch even when page is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    const transport = createFetchTransport('/api/metrics');
    const events: VitalEvent[] = [
      {
        type: 'vital',
        name: 'CLS',
        value: 0.1,
        rating: 'good',
        delta: 0.1,
        timestamp: Date.now(),
        url: 'https://example.com',
      },
    ];

    await transport.send(events);

    expect(mockFetch).toHaveBeenCalled();
    expect(mockSendBeacon).not.toHaveBeenCalled();

    // Reset
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('should call onError when fetch fails', async () => {
    const onError = vi.fn();
    mockFetch.mockRejectedValue(new Error('Network error'));

    const transport = createFetchTransport('/api/metrics', { onError });

    await transport.send([
      {
        type: 'vital',
        name: 'CLS',
        value: 0.1,
        rating: 'good',
        delta: 0.1,
        timestamp: Date.now(),
        url: 'https://example.com',
      },
    ]);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('createConsoleTransport', () => {
  it('should log events to console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = createConsoleTransport();
    const events: VitalEvent[] = [
      {
        type: 'vital',
        name: 'CLS',
        value: 0.1,
        rating: 'good',
        delta: 0.1,
        timestamp: Date.now(),
        url: 'https://example.com',
      },
    ];

    await transport.send(events);

    expect(consoleSpy).toHaveBeenCalledWith('[svoose]', events[0]);

    consoleSpy.mockRestore();
  });

  it('should pretty print when option is set', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = createConsoleTransport({ pretty: true });
    const events: VitalEvent[] = [
      {
        type: 'vital',
        name: 'LCP',
        value: 2500,
        rating: 'good',
        delta: 2500,
        timestamp: 1234567890,
        url: 'https://example.com',
      },
    ];

    await transport.send(events);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[svoose]',
      JSON.stringify(events[0], null, 2)
    );

    consoleSpy.mockRestore();
  });
});

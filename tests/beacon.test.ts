import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBeaconTransport } from '../src/transport/beacon.js';
import type { VitalEvent } from '../src/types/index.js';

function makeEvent(overrides: Partial<VitalEvent> = {}): VitalEvent {
  return {
    type: 'vital',
    name: 'CLS',
    value: 0.1,
    rating: 'good',
    delta: 0.1,
    timestamp: Date.now(),
    url: 'https://example.com',
    ...overrides,
  };
}

describe('createBeaconTransport', () => {
  const mockSendBeacon = vi.fn().mockReturnValue(true);

  beforeEach(() => {
    vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });
    mockSendBeacon.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should send events via sendBeacon', () => {
    const transport = createBeaconTransport('/api/events');
    const events = [makeEvent()];

    transport.send(events);

    expect(mockSendBeacon).toHaveBeenCalledWith(
      '/api/events',
      expect.any(Blob)
    );
  });

  it('should skip empty events array', () => {
    const transport = createBeaconTransport('/api/events');

    transport.send([]);

    expect(mockSendBeacon).not.toHaveBeenCalled();
  });

  it('should chunk large payloads', () => {
    // Single event JSON is ~120 bytes, so 200 fits 1 but not 4
    const transport = createBeaconTransport('/api/events', {
      maxPayloadSize: 200,
    });

    const events = [makeEvent(), makeEvent(), makeEvent(), makeEvent()];
    transport.send(events);

    // Should have been called multiple times due to chunking
    expect(mockSendBeacon.mock.calls.length).toBeGreaterThan(1);
  });

  it('should drop single oversized event with error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const transport = createBeaconTransport('/api/events', {
      maxPayloadSize: 10,
    });

    transport.send([makeEvent()]);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Single event exceeds maxPayloadSize')
    );
    expect(mockSendBeacon).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('should respect depth limit', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // maxPayloadSize of 1 means every payload is "too big" — will recurse until depth limit
    const transport = createBeaconTransport('/api/events', {
      maxPayloadSize: 1,
    });

    transport.send([makeEvent(), makeEvent()]);

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should call onError AND throw when sendBeacon fails (Bug #7)', () => {
    mockSendBeacon.mockReturnValue(false);
    const onError = vi.fn();
    const transport = createBeaconTransport('/api/events', { onError });

    // Bug #7: throws so observe.flush() can route through its onError /
    // transport-error stats path (sendBeacon=false used to be silent loss).
    expect(() => transport.send([makeEvent()])).toThrow(/sendBeacon rejected/);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should be SSR safe when navigator is undefined', () => {
    vi.stubGlobal('navigator', undefined);

    const transport = createBeaconTransport('/api/events');

    // Should not throw
    expect(() => transport.send([makeEvent()])).not.toThrow();
    expect(mockSendBeacon).not.toHaveBeenCalled();
  });

  it('observe() routes sendBeacon=false throw through transportErrors + onError (Bug #7)', async () => {
    // Need PerformanceObserver mock for observe() under jsdom
    class MockPO {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('PerformanceObserver', MockPO);
    Object.defineProperty(MockPO, 'supportedEntryTypes', { value: [], writable: true });

    mockSendBeacon.mockReturnValue(false);
    const beacon = createBeaconTransport('/api/events');

    const { observe, getGlobalObserver } = await import('../src/observe/observe.svelte.js');
    const obsOnError = vi.fn();
    const obs = observe({
      transport: beacon,
      vitals: false,
      errors: false,
      batchSize: 100,
      onError: obsOnError,
    });

    const observer = getGlobalObserver()!;
    observer({ type: 'error', message: 'lost', timestamp: 1, url: '/' });
    obs.flush();

    expect(obsOnError).toHaveBeenCalledWith(expect.any(Error));
    expect(obs.getStats().transportErrors).toBe(1);
    // Events were splice()'d from buffer and rejected — count as dropped.
    expect(obs.getStats().dropped).toBe(1);
    obs.destroy();
  });
});

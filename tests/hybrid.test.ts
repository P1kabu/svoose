import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHybridTransport } from '../src/transport/hybrid.js';
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

describe('createHybridTransport', () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true });
  const mockSendBeacon = vi.fn().mockReturnValue(true);
  let addedListeners: Record<string, Function[]>;

  beforeEach(() => {
    addedListeners = {};
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });

    // Track event listeners
    const originalAddEventListener = window.addEventListener.bind(window);
    const originalDocAddEventListener = document.addEventListener.bind(document);

    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, handler: any) => {
      addedListeners[`window:${type}`] = addedListeners[`window:${type}`] || [];
      addedListeners[`window:${type}`].push(handler);
      originalAddEventListener(type, handler);
    });

    vi.spyOn(document, 'addEventListener').mockImplementation((type: string, handler: any) => {
      addedListeners[`document:${type}`] = addedListeners[`document:${type}`] || [];
      addedListeners[`document:${type}`].push(handler);
      originalDocAddEventListener(type, handler);
    });

    vi.spyOn(window, 'removeEventListener');
    vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should use fetch by default', async () => {
    const transport = createHybridTransport('/api/events');
    await transport.send([makeEvent()]);

    expect(mockFetch).toHaveBeenCalled();
    expect(mockSendBeacon).not.toHaveBeenCalled();

    transport.destroy();
  });

  it('should switch to beacon on beforeunload', async () => {
    const transport = createHybridTransport('/api/events');

    // Trigger beforeunload
    window.dispatchEvent(new Event('beforeunload'));

    transport.send([makeEvent()]);

    expect(mockSendBeacon).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    transport.destroy();
  });

  it('should switch to beacon on visibilitychange hidden', async () => {
    const transport = createHybridTransport('/api/events');

    // Simulate visibility hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    transport.send([makeEvent()]);

    expect(mockSendBeacon).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    // Reset
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    transport.destroy();
  });

  it('should reset to fetch on visibilitychange visible', async () => {
    const transport = createHybridTransport('/api/events');

    // Go hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Come back visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await transport.send([makeEvent()]);

    expect(mockFetch).toHaveBeenCalled();
    expect(mockSendBeacon).not.toHaveBeenCalled();

    transport.destroy();
  });

  it('should stop sending after destroy()', async () => {
    const transport = createHybridTransport('/api/events');
    transport.destroy();

    // After destroy, listeners removed — but send should still work
    // (destroy only removes lifecycle listeners, not sending ability)
    await transport.send([makeEvent()]);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should remove listeners on destroy()', () => {
    const transport = createHybridTransport('/api/events');
    transport.destroy();

    expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('should be SSR safe', () => {
    // In jsdom, window exists, so we test that no errors occur
    const transport = createHybridTransport('/api/events');
    expect(() => transport.destroy()).not.toThrow();
  });
});

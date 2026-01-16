import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  observeErrors,
  registerMachineContext,
  unregisterMachineContext,
} from '../src/observe/errors.js';
import type { ObserveErrorEvent } from '../src/types/index.js';

describe('observeErrors', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('should capture error events', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    const errorEvent = new ErrorEvent('error', {
      message: 'Test error',
      filename: 'test.js',
      lineno: 10,
      colno: 5,
      error: new Error('Test error'),
    });

    window.dispatchEvent(errorEvent);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      })
    );
  });

  it('should capture unhandled promise rejections', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    // Use a resolved promise to avoid actual unhandled rejection
    const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
      reason: 'Promise failed',
      promise: Promise.resolve() as Promise<never>,
    });

    window.dispatchEvent(rejectionEvent);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'unhandled-rejection',
        reason: 'Promise failed',
      })
    );
  });

  it('should handle Error objects in rejections', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    const error = new Error('Promise error');
    // Use a resolved promise to avoid actual unhandled rejection
    const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
      reason: error,
      promise: Promise.resolve() as Promise<never>,
    });

    window.dispatchEvent(rejectionEvent);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'unhandled-rejection',
        reason: 'Promise error',
      })
    );
  });

  it('should include timestamp in events', () => {
    const callback = vi.fn();
    const before = Date.now();
    cleanup = observeErrors(callback);

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'Test' })
    );

    const after = Date.now();
    const event = callback.mock.calls[0][0] as ObserveErrorEvent;

    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
  });

  it('should cleanup listeners on destroy', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);
    cleanup();
    cleanup = null;

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'After cleanup' })
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('machine context integration', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    unregisterMachineContext('test-machine');
  });

  it('should include machine context in error events', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    // Register a machine
    registerMachineContext('test-machine', () => 'loading');

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'Error with machine context' })
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        machineId: 'test-machine',
        machineState: 'loading',
      })
    );
  });

  it('should not include machine context when no machine registered', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'Error without machine' })
    );

    const event = callback.mock.calls[0][0] as ObserveErrorEvent;
    expect(event.machineId).toBeUndefined();
    expect(event.machineState).toBeUndefined();
  });

  it('should update machine context dynamically', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    let currentState = 'idle';
    registerMachineContext('test-machine', () => currentState);

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'First error' })
    );

    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        machineState: 'idle',
      })
    );

    // Change state
    currentState = 'loading';

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'Second error' })
    );

    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        machineState: 'loading',
      })
    );
  });

  it('should handle unregistered machine', () => {
    const callback = vi.fn();
    cleanup = observeErrors(callback);

    registerMachineContext('test-machine', () => 'active');
    unregisterMachineContext('test-machine');

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'After unregister' })
    );

    const event = callback.mock.calls[0][0] as ObserveErrorEvent;
    expect(event.machineId).toBeUndefined();
  });
});

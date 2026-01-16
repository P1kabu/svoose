/**
 * Error tracking - captures errors and unhandled promise rejections
 * Integrates with state machines to include machine context in error reports
 */

import type { ErrorEvent, UnhandledRejectionEvent, ObserveErrorEvent } from '../types/index.js';

// Global machine context registry (populated by createMachine)
const machineContexts = new Map<string, { getState: () => string }>();

/**
 * Register a machine's context for error tracking
 * Called internally by createMachine()
 */
export function registerMachineContext(id: string, getState: () => string): void {
  machineContexts.set(id, { getState });
}

/**
 * Unregister a machine's context
 * Called internally when machine is destroyed
 */
export function unregisterMachineContext(id: string): void {
  machineContexts.delete(id);
}

/**
 * Get current machine context for error reports
 * Returns first active machine (could be enhanced for multiple)
 */
function getMachineContext(): { machineId?: string; machineState?: string } {
  for (const [id, ctx] of machineContexts) {
    try {
      return { machineId: id, machineState: ctx.getState() };
    } catch {
      // Machine might be in invalid state, skip it
    }
  }
  return {};
}

/**
 * Get current URL safely
 */
function getCurrentUrl(): string {
  try {
    return typeof location !== 'undefined' ? location.href : '';
  } catch {
    return '';
  }
}

/**
 * Observe global errors and unhandled promise rejections
 * @param callback - Called for each error event
 * @returns Cleanup function
 */
export function observeErrors(
  callback: (event: ObserveErrorEvent) => void
): () => void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return () => {};
  }

  const errorHandler = (event: globalThis.ErrorEvent) => {
    const errorEvent: ErrorEvent = {
      type: 'error',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: Date.now(),
      url: getCurrentUrl(),
      ...getMachineContext(),
    };
    callback(errorEvent);
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    let message: string;

    if (reason instanceof Error) {
      message = reason.message;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = String(reason);
      }
    }

    const rejectionEvent: UnhandledRejectionEvent = {
      type: 'unhandled-rejection',
      reason: message,
      timestamp: Date.now(),
      url: getCurrentUrl(),
      ...getMachineContext(),
    };
    callback(rejectionEvent);
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);

  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', rejectionHandler);
  };
}

export type { ErrorEvent, UnhandledRejectionEvent, ObserveErrorEvent };

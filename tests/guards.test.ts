import { describe, it, expect } from 'vitest';
import {
  isVital,
  isError,
  isUnhandledRejection,
  isTransition,
  isCustom,
  isHistogram,
  isCounter,
  isGauge,
  isTrack,
} from '../src/observe/guards.js';
import type {
  VitalEvent,
  ErrorEvent,
  UnhandledRejectionEvent,
  TransitionEvent,
  CustomMetricEvent,
} from '../src/types/index.js';

const timestamp = 1710500000000;

const vital: VitalEvent = {
  type: 'vital',
  name: 'LCP',
  value: 1234,
  rating: 'good',
  delta: 1234,
  timestamp,
  url: 'https://example.com',
};

const errorEvent: ErrorEvent = {
  type: 'error',
  message: 'boom',
  timestamp,
  url: 'https://example.com',
};

const unhandled: UnhandledRejectionEvent = {
  type: 'unhandled-rejection',
  reason: 'rejected',
  timestamp,
  url: 'https://example.com',
};

const transition: TransitionEvent = {
  type: 'transition',
  machineId: 'm1',
  from: 'idle',
  to: 'active',
  event: 'GO',
  timestamp,
};

const counterEvent: CustomMetricEvent = {
  type: 'custom',
  name: 'page_views',
  metricKind: 'counter',
  value: 1,
  timestamp,
};

const gaugeEvent: CustomMetricEvent = {
  type: 'custom',
  name: 'active_users',
  metricKind: 'gauge',
  value: 42,
  timestamp,
};

const histogramEvent: CustomMetricEvent = {
  type: 'custom',
  name: 'response_time_ms',
  metricKind: 'histogram',
  value: 123,
  timestamp,
};

const trackEvent: CustomMetricEvent = {
  type: 'custom',
  name: 'click',
  metadata: { button: 'submit' },
  timestamp,
};

describe('type guards', () => {
  describe('isVital', () => {
    it('returns true for VitalEvent', () => {
      expect(isVital(vital)).toBe(true);
    });
    it('returns false for non-vital events', () => {
      expect(isVital(errorEvent)).toBe(false);
      expect(isVital(transition)).toBe(false);
      expect(isVital(counterEvent)).toBe(false);
    });
  });

  describe('isError', () => {
    it('returns true for ErrorEvent', () => {
      expect(isError(errorEvent)).toBe(true);
    });
    it('returns false for unhandled-rejection (different type)', () => {
      expect(isError(unhandled)).toBe(false);
    });
    it('returns false for non-error events', () => {
      expect(isError(vital)).toBe(false);
      expect(isError(transition)).toBe(false);
    });
  });

  describe('isUnhandledRejection', () => {
    it('returns true for UnhandledRejectionEvent', () => {
      expect(isUnhandledRejection(unhandled)).toBe(true);
    });
    it('returns false for ErrorEvent', () => {
      expect(isUnhandledRejection(errorEvent)).toBe(false);
    });
  });

  describe('isTransition', () => {
    it('returns true for TransitionEvent', () => {
      expect(isTransition(transition)).toBe(true);
    });
    it('returns false for non-transition events', () => {
      expect(isTransition(vital)).toBe(false);
      expect(isTransition(counterEvent)).toBe(false);
    });
  });

  describe('isCustom', () => {
    it('returns true for all CustomMetricEvent variants', () => {
      expect(isCustom(counterEvent)).toBe(true);
      expect(isCustom(gaugeEvent)).toBe(true);
      expect(isCustom(histogramEvent)).toBe(true);
      expect(isCustom(trackEvent)).toBe(true);
    });
    it('returns false for non-custom events', () => {
      expect(isCustom(vital)).toBe(false);
      expect(isCustom(errorEvent)).toBe(false);
      expect(isCustom(transition)).toBe(false);
    });
  });

  describe('isHistogram', () => {
    it('returns true only for metricKind=histogram', () => {
      expect(isHistogram(histogramEvent)).toBe(true);
    });
    it('returns false for other metric kinds', () => {
      expect(isHistogram(counterEvent)).toBe(false);
      expect(isHistogram(gaugeEvent)).toBe(false);
      expect(isHistogram(trackEvent)).toBe(false);
    });
    it('returns false for non-custom events', () => {
      expect(isHistogram(vital)).toBe(false);
      expect(isHistogram(errorEvent)).toBe(false);
    });
  });

  describe('isCounter', () => {
    it('returns true only for metricKind=counter', () => {
      expect(isCounter(counterEvent)).toBe(true);
    });
    it('returns false for other metric kinds and types', () => {
      expect(isCounter(gaugeEvent)).toBe(false);
      expect(isCounter(histogramEvent)).toBe(false);
      expect(isCounter(trackEvent)).toBe(false);
      expect(isCounter(vital)).toBe(false);
    });
  });

  describe('isGauge', () => {
    it('returns true only for metricKind=gauge', () => {
      expect(isGauge(gaugeEvent)).toBe(true);
    });
    it('returns false for other metric kinds and types', () => {
      expect(isGauge(counterEvent)).toBe(false);
      expect(isGauge(histogramEvent)).toBe(false);
      expect(isGauge(trackEvent)).toBe(false);
      expect(isGauge(transition)).toBe(false);
    });
  });

  describe('isTrack', () => {
    it('returns true for custom events without metricKind', () => {
      expect(isTrack(trackEvent)).toBe(true);
    });
    it('returns false for typed metric events', () => {
      expect(isTrack(counterEvent)).toBe(false);
      expect(isTrack(gaugeEvent)).toBe(false);
      expect(isTrack(histogramEvent)).toBe(false);
    });
    it('returns false for non-custom events', () => {
      expect(isTrack(vital)).toBe(false);
      expect(isTrack(errorEvent)).toBe(false);
    });
  });
});

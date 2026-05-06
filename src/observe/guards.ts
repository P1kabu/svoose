/**
 * Type guards for narrowing ObserveEvent unions.
 *
 * These exist because the event union is keyed on `type`, but custom metric
 * variants (counter / gauge / histogram / track) all share `type: 'custom'`
 * and differ only by `metricKind`. A bare `event.type === 'histogram'` check
 * never matches — use `isHistogram(event)` instead.
 *
 * @example
 * obs.onEvent((event) => {
 *   if (isHistogram(event)) console.log(event.value);
 *   if (isError(event)) console.warn(event.fingerprint);
 * });
 */

import type {
  ObserveEvent,
  VitalEvent,
  ErrorEvent,
  UnhandledRejectionEvent,
  TransitionEvent,
  CustomMetricEvent,
} from '../types/index.js';

export function isVital(event: ObserveEvent): event is VitalEvent {
  return event.type === 'vital';
}

export function isError(event: ObserveEvent): event is ErrorEvent {
  return event.type === 'error';
}

export function isUnhandledRejection(event: ObserveEvent): event is UnhandledRejectionEvent {
  return event.type === 'unhandled-rejection';
}

export function isTransition(event: ObserveEvent): event is TransitionEvent {
  return event.type === 'transition';
}

export function isCustom(event: ObserveEvent): event is CustomMetricEvent {
  return event.type === 'custom';
}

export function isHistogram(
  event: ObserveEvent,
): event is CustomMetricEvent & { metricKind: 'histogram' } {
  return event.type === 'custom' && (event as CustomMetricEvent).metricKind === 'histogram';
}

export function isCounter(
  event: ObserveEvent,
): event is CustomMetricEvent & { metricKind: 'counter' } {
  return event.type === 'custom' && (event as CustomMetricEvent).metricKind === 'counter';
}

export function isGauge(
  event: ObserveEvent,
): event is CustomMetricEvent & { metricKind: 'gauge' } {
  return event.type === 'custom' && (event as CustomMetricEvent).metricKind === 'gauge';
}

export function isTrack(
  event: ObserveEvent,
): event is CustomMetricEvent & { metricKind: undefined } {
  return event.type === 'custom' && (event as CustomMetricEvent).metricKind === undefined;
}

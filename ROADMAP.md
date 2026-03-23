# svoose Roadmap

> Strategy: **"Deep Niche"** — become the best Svelte 5 observability solution

## Development Philosophy

1. **Svelte-first** — every feature optimized for the Svelte 5 ecosystem
2. **Lightweight** — core ~3.5KB, full production ~6KB (tree-shakeable)
3. **Zero dependencies** — no runtime dependencies
4. **Observability focus** — FSM as a lightweight bonus, not an XState competitor
5. **Production-ready** — every release is production-ready
6. **Incremental delivery** — small, frequent releases instead of big ones
7. **Framework-agnostic core** — core works without Svelte, adapters are separate
8. **Stay focused** — better to do less, but do it well
9. **Docs-first releases** — README updated with every release

---

## Product Strategy

### One product — observability toolkit

```
svoose → "Svelte 5 observability toolkit"
         Web Vitals, errors, custom metrics, session tracking
         + lightweight state helper with auto-telemetry (bonus)
```

**FSM as bonus**: `createMachine()` / `useMachine()` is a lightweight helper for simple UI states (loading, error, success). Not an XState alternative. For complex state machines — use XState.

### Competitive Positioning

| Segment | Competitors | svoose Advantage |
|---------|-------------|------------------|
| Observability | Vercel Analytics, PostHog | Open source, self-hosted, Svelte-native |
| Web Vitals | web-vitals | Batching, transports, error context |

> **Note**: FSM is not a competition segment. For advanced FSM — XState. svoose FSM = lightweight bonus.

---

## Versions

### Released

#### v0.1.2 — Foundation
- Web Vitals (CLS, LCP, FID, INP, FCP, TTFB)
- Error tracking (global errors + unhandled rejections)
- Lightweight state helper with TypeScript inference (bonus)
- `useMachine()` hook for Svelte 5 (bonus)
- Batching and basic transport
- 90 tests

**Bundle**: ~3.0 KB gzipped

---

#### v0.1.3 — Sampling

**Released**: January 2026

| Feature | Description |
|---------|-------------|
| **Sampling** | Per-event-type rate limiting (vitals: 10%, errors: 100%) |

**Bundle**: 3.1 KB (+0.1 KB)

> Known bug: `sampling.js` not included in npm package. Fixed in v0.1.4.

---

#### v0.1.4 — Hotfix: Missing sampling.js

**Released**: January 24, 2026

| Feature | Description |
|---------|-------------|
| **Bugfix** | Fixed missing `sampling.js` in npm package |

**Cause**: `src/observe/sampling.ts` was not included in esbuild entryPoints in `scripts/build.js`.

---

#### v0.1.5 — Session Tracking + Web Vitals Fix

**Released**: January 27, 2026

| Feature | Description | Status |
|---------|-------------|--------|
| **Web Vitals Fix** | CLS, LCP, INP, TTFB according to web-vitals standard | Done |
| **Session Tracking** | Automatic sessionId with timeout | Done |

**Bundle**: 3.3 KB gzip (+0.2 KB)

##### Web Vitals Fix (Breaking Change in behavior)

All Web Vitals fixed according to [web-vitals standard](https://github.com/GoogleChrome/web-vitals):

| Metric | Before | After |
|--------|--------|-------|
| **CLS** | Report on every batch | Session windows, report on visibility change |
| **LCP** | Report on every entry | Report on user input or visibility change |
| **INP** | Report on every max | Filter by interactionId, report on visibility change |
| **TTFB** | `responseStart - requestStart` | `responseStart - activationStart` (bfcache aware) |

**Key changes**:
- **CLS**: Session windows (max 5s, gap 1s), reports max session value
- **LCP**: Finalizes on first user input (click/keydown/pointerdown) or visibility change
- **INP**: Filters by `interactionId`, ignores scroll/mousemove
- **TTFB**: bfcache support via `activationStart`

> **Breaking Change**: CLS, LCP, INP now report **once** per page lifecycle instead of spamming events. This matches Chrome DevTools and Google Search Console.

---

#### v0.1.6 — Basic Custom Metrics

**Released**: February 2026

| Feature | Description |
|---------|-------------|
| **metric()** | Basic function for custom events |
| **Pending buffer** | Buffer events until observe() is called (max 100) |
| **Dev warnings** | Warning if observe() not called |
| **Sampling integration** | Respects `sampling.custom` rate |
| **Session integration** | Includes `sessionId` in events |

**Bundle**: 4.5 KB full / 3.5 KB observe-only (measured)

```typescript
import { observe, metric } from 'svoose';

observe({ endpoint: '/api/metrics' });

metric('checkout_started', { step: 1, cartTotal: 99.99 });
metric('feature_used', { name: 'dark_mode' });
```

---

#### v0.1.7 — Extended Metrics + Typed API

**Released**: February 2026

| Feature | Description |
|---------|-------------|
| **counter()** | Increments (api_calls, button_clicks) |
| **gauge()** | Absolute values (active_users, queue_size) |
| **histogram()** | Distributions (response_time, payload_size) |
| **createTypedMetric&lt;T&gt;()** | TypeScript autocomplete for metrics |

**Consistent API**: All functions use `(name, value?, metadata?)` order. All use top-level `metricKind` and `value` fields (not nested in `data`).

**Bundle**: 4.7 KB full / 3.6 KB observe-only (measured)

```typescript
import { counter, gauge, histogram, createTypedMetric } from 'svoose';

// Consistent API: (name, value?, metadata?)
counter('api_calls');                        // value = 1
counter('api_calls', 5, { endpoint: '/users' });
gauge('active_users', 42);
histogram('response_time', 234);

// Typed metrics (full autocomplete)
type AppMetrics = {
  checkout: { step: number; total: number };
};
const track = createTypedMetric<AppMetrics>();
track('checkout', { step: 1, total: 99 }); // autocomplete
```

---

#### v0.1.8 — Beacon + Hybrid Transport

**Released**: March 2026

| Feature | Description |
|---------|-------------|
| **sendBeacon Transport** | Reliable sending on page close |
| **Payload Chunking** | Auto-split for payloads > 60KB |
| **Hybrid Transport** | fetch + beacon auto-switch on unload |
| **INP Memory Leak Fix** | `processedInteractions` Set capped at 1000 |
| **Fetch Transport Cleanup** | Removed beacon fallback — fetch is now pure fetch |
| **Transport destroy() on cleanup** | `observe()` cleanup calls `transport.destroy?.()` automatically |

**Bundle**: 5.3 KB full / 3.6 KB observe-only (measured)

```typescript
import { createBeaconTransport, createHybridTransport } from 'svoose';

// Beacon only
const beacon = createBeaconTransport('/api/metrics');

// Hybrid (recommended for production)
observe({
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',  // reliable on page close
  }),
});
```

---

#### v0.1.9 — API Cleanup (Breaking Changes)

**Released**: March 2026

| Feature | Description |
|---------|-------------|
| **Remove `sampleRate`** | Removed deprecated `sampleRate`, use `sampling` instead |
| **Remove `identify` from sampling** | Removed premature `identify` from `SamplingConfig` (returns in v0.2.0) |
| **`data` → `metadata`** | Renamed `CustomMetricEvent.data` to `metadata` (optional) |
| **`createConsoleTransport` sync** | Removed unnecessary `async` from console transport |
| **`can()` full event support** | `can()` now accepts full event objects for payload-dependent guards |
| **Multi-machine error context** | Error events include all active machines (max 10) |
| **Options validation** | `observe()` validates `batchSize`, `flushInterval`, `sampling` |
| **`onError` callback** | Transport error callback in `ObserveOptions` |
| **Transport error handling** | Catches both sync and async transport errors |
| **Session storage warning** | Debug warning when storage unavailable (fallback to memory) |
| **Internal test helpers** | `_getPendingEventsCount`, `_clearPendingEvents` removed from public exports |

**Bundle**: 5.5 KB full / 3.8 KB observe-only (measured)

---

---

#### v0.1.10 — Retry Logic + DX Foundation

**Released**: March 2026

| Feature | Description |
|---------|-------------|
| **Retry Logic** | Configurable retry with exponential/linear/fixed backoff |
| **Backoff Strategies** | fixed, linear, exponential with optional jitter (±10%) |
| **Timeout** | AbortController timeout for fetch requests |
| **Unload check** | Abort retry via shouldAbort callback |
| **`withRetry()` utility** | Standalone retry wrapper for any async function |
| **`getStats()`** | Events buffered/sent/dropped + lastSendTime + transportErrors |
| **`onEvent()` hook** | Passive event subscription (foundation for devtools) |
| **`flush()` / `destroy()`** | `observe()` returns ObserveInstance (callable + methods) |
| **Default hybrid transport** | `observe()` defaults to hybrid (fetch + beacon on unload) |
| **`productionDefaults` preset** | Sensible defaults for production traffic |

**Bundle**: 6.7 KB full / 5.1 KB observe-only (measured)

```typescript
import { createFetchTransport } from 'svoose/transport';

const transport = createFetchTransport('/api/metrics', {
  retry: {
    attempts: 3,
    backoff: 'exponential',
    jitter: true,
  },
  timeout: 10000,
});

// Or with hybrid transport
import { createHybridTransport } from 'svoose/transport';

observe({
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});
```

---

### Planned

#### v0.1.11 — Privacy Utilities + Error Fingerprinting

**Status**: Planned
**Target**: March-April 2026

| Feature | Description |
|---------|-------------|
| **URL Scrubbing** | Remove tokens from URLs (strings + regex) |
| **Field Masking** | Mask PII (show last 4 characters) |
| **Custom Sanitizer** | Custom event sanitization callback |
| **Privacy Options** | stripQueryParams, stripHash |
| **configurePII overwrite** | Each call replaces previous config (not merge) |
| **Error Fingerprinting** | Client-side hash (message + first stack frame) |
| **Error Dedup** | Optional window-based deduplication of duplicate errors |

**Bundle**: ~6.0 KB (+0.1 KB)

```typescript
import { observe, configurePII } from 'svoose';

configurePII({
  scrubFromUrl: ['token', 'api_key'],
  maskFields: ['email', 'phone'],
});

observe({
  endpoint: '/api/metrics',
  privacy: { stripQueryParams: true },
});
```

---

### v0.2.0 — Production-Ready Observability + Dev Overlay

**Status**: Planned
**Target**: April 2026

> **Major release**: Complete production-ready observability stack + Dev Overlay + "Collect + Connect" strategy
>
> **Strategy: "Collect + Connect"** — svoose is the best client-side collector for Svelte.
> We show data in dev (overlay). We send it wherever you want (Grafana, your DB).
> We do NOT build dashboards or backends — we provide templates and examples.

| Feature | Description |
|---------|-------------|
| **Network Detection** | Pause/resume on offline/online |
| **Offline Queue** | In-memory queue with FIFO eviction |
| **User Identification** | `identify()` for analytics |
| **Bundle Restructure** | Modular entry points for tree-shaking |
| **Rate Limiter** | `maxEventsPerSecond` circuit breaker |
| **NavigationEvent type** | Type stub for future SvelteKit route tracking |
| **Dev Overlay** | `svoose/devtools` — real-time vitals, errors, stats in browser |
| **Grafana template** | JSON dashboard template for import |
| **Reference backends** | Example repos (SvelteKit+SQLite, Express+PostgreSQL) |

**Bundle**: core ~6 KB, devtools +2-3 KB (separate entry, 0 if not imported)

```typescript
import { observe, identify } from 'svoose';
import { createHybridTransport } from 'svoose/transport';

const obs = observe({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,
  sampling: { vitals: 0.1, errors: 1.0 },
  session: { timeout: 30 * 60 * 1000 },
  offline: { maxEvents: 1000 },
  maxEventsPerSecond: 100,
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});

// User identification
identify({ id: 'user_123', traits: { plan: 'premium' } });

// Dev overlay (0 bytes in production)
if (import.meta.env.DEV) {
  const { devtools } = await import('svoose/devtools');
  devtools(obs);
}
```

---

#### v0.2.1 — Breadcrumbs

**Status**: Planned
**Target**: April 2026

| Feature | Description |
|---------|-------------|
| **Breadcrumb Buffer** | Ring buffer of last 20 user actions |
| **Auto Breadcrumbs** | From transitions, metrics, navigation |
| **Error Enrichment** | Breadcrumbs attached to error events |

**Bundle**: +0.3 KB

---

#### v0.2.2 — Navigation Events + Soft Navigation

**Status**: Planned
**Target**: May 2026

| Feature | Description |
|---------|-------------|
| **NavigationEvent emission** | Auto-emit on History/popstate changes |
| **Navigation timing** | Duration measurement for SPA transitions |
| **Soft Navigation API** | PerformanceObserver soft-nav integration |

**Bundle**: +0.2 KB

---

#### v0.2.3 — Request Correlation

**Status**: Planned
**Target**: May 2026

| Feature | Description |
|---------|-------------|
| **traceId generation** | Unique ID per page load / navigation |
| **Trace header injection** | Auto-inject in transport requests |
| **Server-Timing parsing** | Extract backend timing from response headers |

**Bundle**: +0.2 KB

> Foundation for SvelteKit server integration in v0.3.0

---

### v0.3.0 — SvelteKit Integration

**Status**: Planned
**Priority**: **CRITICAL** — key competitive advantage
**Target**: June-July 2026

> **Why priority?** SvelteKit is where 80% of Svelte developers are. Zero-config integration = adoption.
> **Prerequisites**: v0.2.2 (Navigation Events), v0.2.3 (Request Correlation)

| Feature | Description | Priority |
|---------|-------------|----------|
| `svoose/sveltekit` entry | Client + server hooks | Critical |
| **Client auto-init** | Auto-call observe() with config | Critical |
| **Route tracking** | Automatic NavigationEvent on route change | Critical |
| **Server handleError()** | Error tracking in server hooks | Critical |
| **Server handle()** | Request timing + traceId propagation | High |
| **SSR Safety** | Graceful server-side noop | Critical |

**Bundle**: +1.0 KB for sveltekit entry

```typescript
// hooks.client.ts
import { initSvoose } from 'svoose/sveltekit';

initSvoose({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,
  session: true,
});
```

```typescript
// hooks.server.ts
import { handleErrorWithSvoose, handleWithSvoose } from 'svoose/sveltekit';

export const handleError = handleErrorWithSvoose({ endpoint: '/api/metrics' });
export const handle = handleWithSvoose(); // request timing + traceId
```

---

#### v0.3.1 — SvelteKit Vite Plugin

**Status**: Planned
**Target**: July 2026

| Feature | Description | Priority |
|---------|-------------|----------|
| **Vite Plugin** | Auto-instrumentation for load() functions | High |
| **Attribution API** | LCP element, CLS source identification | Medium |
| **Dev overlay** | Optional dev-mode metrics overlay | Low |

```typescript
// vite.config.ts
import { svoosePlugin } from 'svoose/vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    svoosePlugin({
      autoInstrumentLoad: true,
    }),
  ],
});
```

**Bundle**: +1.5 KB for vite plugin

---

### v1.0.0 — Stable Release

**Status**: Planned
**Target**: Q1 2027

**Criteria for v1.0:**
- [ ] 6+ months without breaking changes
- [ ] 1000+ weekly npm downloads
- [ ] Production use cases documented
- [ ] Full SvelteKit integration
- [ ] Community contributions

---

### Post v1.0 — Maintenance Mode

After v1.0.0, svoose enters **maintenance mode**:

| Activity | Priority |
|----------|----------|
| Bug fixes | Critical |
| Security updates | Critical |
| Svelte/SvelteKit version support | High |
| Documentation improvements | Medium |
| Performance optimizations | Medium |
| Community PRs (selective) | Low |
| **New features** | ❌ Only if absolutely necessary |

> **Philosophy**: "Better to do less, but do it well." Feature-complete means stable, lightweight, and reliable.

---

## Bundle Size Targets

### Current (v0.1.10 measured)

| Import | Size (gzip) |
|--------|-------------|
| `observe()` + vitals + errors + metrics | 5.1 KB |
| Full bundle (incl. machine, transport) | 6.7 KB |
| `createMachine()` only | 0.95 KB |

### v0.2.0+ (modular entry points)

| Entry Point | Size | Description |
|-------------|------|-------------|
| `svoose` | ~3.5 KB | Core: observe, vitals, errors, sampling, session |
| `svoose/metrics` | +0.3 KB | metric, counter, gauge, histogram |
| `svoose/user` | +0.2 KB | identify |
| `svoose/privacy` | +0.4 KB | configurePII, scrubbing |
| `svoose/transport` | +0.8 KB | fetch, beacon, hybrid, retry |
| `svoose/svelte` | +0.3 KB | useMachine |
| `svoose/devtools` | +2-3 KB | Dev overlay (dev only, 0 in prod) |
| `svoose/sveltekit` | +1.5 KB | hooks, plugin (v0.3.0) |
| **Full production** | **~6 KB** | Everything together (excl. devtools) |

> **Philosophy**: Most apps only need core (~3.5 KB). Pay only for what you import.
> **Backward compat**: Main `svoose` entry always re-exports all modules. Subpath imports are optional for bundle optimization.
> **Dev Overlay**: `svoose/devtools` is dev-only — 0 bytes in production builds when behind `import.meta.env.DEV` guard.

---

## Known Risks & Mitigations

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| sendBeacon 64KB limit | Large payloads fail | Auto-chunking, payload size validation |
| localStorage quota | Offline queue full | FIFO eviction, graceful degradation |
| Vite plugin complexity | Auto-instrumentation breaks | Manual wrapper as primary, plugin as opt-in |
| Safari private mode | Storage unavailable | Memory fallback, feature detection |

### Legal/Compliance Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| "GDPR-compliant" claims | False compliance impression | Use "privacy-focused", add legal disclaimer |
| PII in error stacks | Accidental data leak | Default scrubbing, documentation |
| User tracking without consent | Legal issues | All tracking opt-in, clear documentation |

---

## Timeline Overview

```
2026
├── Jan          v0.1.2 — Foundation
├── Jan          v0.1.3 — Sampling (with bug)
├── Jan 24       v0.1.4 — Hotfix: sampling.js
├── Jan 27       v0.1.5 — Session Tracking + Web Vitals Fix
│
├── Feb          v0.1.6 — Basic Custom Metrics
├── Feb          v0.1.7 — Extended Metrics + Typed API
│
├── Mar Week 1   v0.1.8 — Beacon + Hybrid Transport
├── Mar Week 2   v0.1.9 — API Cleanup (Breaking)
├── Mar Week 3   v0.1.10 — Retry + DX Foundation ← current
├── Mar-Apr      v0.1.11 — Privacy + Error Fingerprinting
├── Apr          v0.2.0 — Production-Ready + Dev Overlay ⭐
│
├── May          v0.2.1 — Breadcrumbs
├── May          v0.2.2 — Navigation Events + Soft Navigation
├── May          v0.2.3 — Request Correlation
│
├── Jun-Jul      v0.3.0 — SvelteKit Core Integration ⭐
├── Jul          v0.3.1 — SvelteKit Vite Plugin
│
2027
└── Q1-Q2        v1.0.0 — Stable Release → Maintenance Mode 🛠️
```

---

## Competitor Comparison

### svoose + XState = Complementary Tools

| Need | Solution |
|------|----------|
| **Observability** (vitals, errors, metrics) | svoose |
| **Simple UI states** (loading → success → error) | svoose FSM |
| **Complex state machines** (invoke, spawn, parallel) | XState |
| **Both observability + complex FSM** | svoose + XState together |

> **Philosophy**: svoose FSM is "Svelte $state() with transitions". For serious state machines — XState. We don't compete, we complement.

### vs web-vitals

| Feature | svoose | web-vitals |
|---------|--------|------------|
| Web Vitals | Yes | Yes |
| Batching | Yes | Manual |
| Error tracking | Yes | — |
| Custom metrics | v0.1.6+ | Manual |
| SvelteKit integration | v0.3 | — |

### vs Vercel Analytics / PostHog

| Feature | svoose | Vercel Analytics | PostHog |
|---------|--------|------------------|---------|
| Open source | Yes | No | Yes |
| Self-hosted | Yes | No | Yes |
| Svelte-native | Yes | No | No |
| Bundle size | ~6KB | ~5KB | ~30KB+ |
| Free tier | Unlimited | Limited | Limited |
| Setup complexity | Low | Zero | Medium |

---

## Release Process

1. **Feature development** — 1-week sprints
2. **Testing phase** — all tests pass, coverage > 80%
3. **Beta release** — `npm publish --tag beta`
4. **Feedback period** — 3 days minimum
5. **Stable release** — `npm publish`
6. **Announcement** — GitHub, Svelte Discord

### Versioning

- **Patch** (0.x.y): Bug fixes, docs
- **Minor** (0.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes (not before v1.0)

---

## Contributing

1. Review Issues labeled `help wanted`
2. Pick a task from the current version
3. Create PR with tests
4. Documentation required for new APIs

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-15 | 16.0 | **"Collect + Connect" strategy**: Dev Overlay added to v0.2.0, error fingerprinting added to v0.1.11, DX foundation (getStats/onEvent/flush/destroy) moved to v0.1.10. Grafana template + reference backends planned for v0.2.0. Source maps = docs-only (no implementation). Integration testing plan added. Dashboard package rejected (scope creep, violates philosophy). |
| 2026-03-15 | 15.0 | Plan sync: Fixed v0.1.11 (overwrite not merge, removed excludeUserAgent), v0.2.0 (offline=in-memory, added flush/rate-limiter/NavigationEvent, removed already-done multi-machine). Added v0.2.1-v0.2.3 roadmap (breadcrumbs, navigation, correlation). Expanded v0.3.0/v0.3.1 SvelteKit plan. |
| 2026-03-09 | 14.0 | v0.1.9 released: API Cleanup (Breaking). Removed `sampleRate`, `identify` from sampling, `data`→`metadata`, sync console transport, `can()` full event, multi-machine error context, options validation, transport error handling, session storage warning. 206 tests, 5.5KB full. |
| 2026-03-01 | 13.0 | v0.1.8 released: Beacon + Hybrid Transport (`createBeaconTransport`, `createHybridTransport`), INP memory leak fix. Fetch transport cleaned up (removed beacon fallback). Updated bundle sizes (5.3KB full). |
| 2026-02-16 | 12.0 | v0.1.7 released: Extended Metrics (`counter()`, `gauge()`, `histogram()`, `createTypedMetric<T>()`). Updated bundle sizes. |
| 2026-02-06 | 11.0 | v0.1.6 released: Basic Custom Metrics (`metric()` API, pending buffer, sampling/session integration). Updated competitor table. |
| 2026-01-27 | 10.0 | **English rewrite**: Full document translation to English. v0.1.5 released. Updated bundle sizes to realistic targets based on measurements. |
| 2026-01-25 | 9.0 | Bundle Restructure: v0.2.0 includes modular entry points |
| 2026-01-25 | 8.0 | v0.1.5 CLS fix: replaced workaround with proper CLS session windows |
| 2026-01-24 | 7.0 | v0.1.4 hotfix: fixed missing sampling.js |
| 2026-01-22 | 6.0 | FSM positioning: FSM as "lightweight state helper (bonus)" |
| 2026-01-20 | 1.0 | Initial plan |

---

*This document is updated with every release.*

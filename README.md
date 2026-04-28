# svoose

> Svelte + Goose = **svoose** — the goose that sees everything

Lightweight observability + state machines for Svelte 5. Zero dependencies. Tree-shakeable. **~6.7KB gzipped** (observe-only ~5.1KB).

## Features

- **Web Vitals** — CLS, LCP, FID, INP, FCP, TTFB (no external deps)
- **Error Tracking** — global errors + unhandled rejections
- **Custom Metrics** — `metric()`, `counter()`, `gauge()`, `histogram()`
- **Beacon Transport** — reliable delivery on page close with auto-chunking
- **Session Tracking** — automatic sessionId with timeout
- **Sampling** — per-event-type rate limiting
- **State Machines** — minimal FSM with TypeScript inference
- **Svelte 5 Native** — reactive `useMachine()` hook with $state runes
- **Tree-shakeable** — pay only for what you use

## Installation

```bash
npm install svoose
```

> svoose works without Svelte. The `svelte` peer dependency is optional — only needed if you use `svoose/svelte` (useMachine hook).

## Quick Start

### Step 1: See what svoose collects

Start with the console transport — you'll see events in DevTools immediately, no backend needed:

```typescript
import { observe, createConsoleTransport } from 'svoose';

const cleanup = observe({
  transport: createConsoleTransport({ pretty: true }),
});

// Open DevTools console — you'll see Web Vitals, errors, and metrics as they happen
```

### Step 2: Send to your backend

When you're ready, switch to an endpoint:

```typescript
import { observe } from 'svoose';

const obs = observe({
  endpoint: '/api/metrics',
  errors: true,
  vitals: true,
  session: true,
});

// New API
obs.flush();              // send buffered events now
obs.getStats();           // { buffered: 3, sent: 47, dropped: 0 }
obs.onEvent(e => ...);    // subscribe to events

// Stop observing when done
obs.destroy();
// or: obs() — backward compatible, same as destroy()
```

### Step 3: Add custom metrics and state machines

```typescript
import { observe, metric, counter, createMachine } from 'svoose';

observe({ endpoint: '/api/metrics' });

// Track custom events
metric('checkout_started', { step: 1, cartTotal: 99.99 });
counter('page_views');

// State machine with automatic transition tracking
const auth = createMachine({
  id: 'auth',
  initial: 'idle',
  context: { user: null },
  states: {
    idle: { on: { LOGIN: 'loading' } },
    loading: {
      on: {
        SUCCESS: {
          target: 'authenticated',
          action: (ctx, e) => ({ user: e.user }),
        },
        ERROR: 'idle',
      },
    },
    authenticated: { on: { LOGOUT: 'idle' } },
  },
  observe: true,
});

auth.send('LOGIN');
```

## What Data Looks Like

svoose sends JSON arrays via `POST` to your endpoint. Here's an example batch:

```json
[
  {
    "type": "vital",
    "name": "LCP",
    "value": 1234,
    "rating": "good",
    "delta": 1234,
    "timestamp": 1710500000000,
    "url": "https://myapp.com/dashboard",
    "sessionId": "1710500000000-a1b2c3"
  },
  {
    "type": "error",
    "message": "Cannot read properties of null (reading 'id')",
    "stack": "TypeError: Cannot read properties...\n    at handleClick (app.js:42)",
    "filename": "app.js",
    "lineno": 42,
    "timestamp": 1710500001000,
    "url": "https://myapp.com/dashboard",
    "sessionId": "1710500000000-a1b2c3",
    "machineId": "auth",
    "machineState": "loading"
  },
  {
    "type": "transition",
    "machineId": "auth",
    "from": "idle",
    "to": "loading",
    "event": "LOGIN",
    "timestamp": 1710500002000,
    "sessionId": "1710500000000-a1b2c3"
  },
  {
    "type": "custom",
    "name": "page_views",
    "metricKind": "counter",
    "value": 1,
    "timestamp": 1710500003000,
    "sessionId": "1710500000000-a1b2c3"
  }
]
```

**Event types:**

| Type | When | Key fields |
|------|------|------------|
| `vital` | Web Vital measured (LCP, CLS, INP, etc.) | `name`, `value`, `rating` |
| `error` | Uncaught error | `message`, `stack`, `machineState` |
| `unhandled-rejection` | Unhandled promise rejection | `reason`, `machineState` |
| `transition` | State machine transition | `machineId`, `from`, `to`, `event` |
| `custom` | `metric()`, `counter()`, `gauge()`, `histogram()` | `name`, `metricKind`, `value`, `metadata` |

### What data leaves your browser

Every event svoose sends is JSON you can inspect with `createConsoleTransport()`. Here's what each field contains:

| Field | Source | May contain PII? |
|-------|--------|-----------------|
| `url` | `location.href` at event time | Yes — query params may have tokens (`?token=xxx`) |
| `message`, `stack` | Error object | Yes — error text may include user data |
| `machineId`, `machineState` | Your machine config | No (developer-defined strings) |
| `sessionId` | Random generated ID | No (not tied to user identity) |
| `name`, `value`, `metadata` | Your `metric()` / `counter()` calls | Depends on what you pass |

> **Tip**: Use a `filter` to strip sensitive data before it's sent:
> ```typescript
> observe({
>   endpoint: '/api/metrics',
>   filter: (event) => {
>     if ('url' in event) {
>       (event as any).url = event.url.split('?')[0]; // strip query params
>     }
>     return true;
>   },
> });
> ```

## Receiving Events (Backend)

svoose is a **client-side collector** — it doesn't include a backend. Your server just needs one POST endpoint that accepts a JSON array.

### SvelteKit

> Planned for v0.3.0 — not yet implemented. The API below is a preview of the planned integration.

```typescript
// src/routes/api/metrics/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const events = await request.json();

  // Option 1: Log to stdout (pipe to your log aggregator)
  console.log(JSON.stringify(events));

  // Option 2: Insert into database
  // await db.insert('events', events);

  return json({ ok: true }, { status: 200 });
};
```

### Express

```typescript
import express from 'express';
const app = express();
app.use(express.json());

app.post('/api/metrics', (req, res) => {
  const events = req.body; // ObserveEvent[]

  // Store, forward, or log — up to you
  for (const event of events) {
    if (event.type === 'error') {
      console.error(`[${event.machineState ?? 'unknown'}] ${event.message}`);
    }
  }

  res.sendStatus(204);
});
```

### No backend? No problem

```typescript
// Development — just log to console
observe({ transport: createConsoleTransport({ pretty: true }) });

// Production without backend — silent noop
observe({ transport: { send: () => {} } });
```

### Production recommendations

Use the built-in production preset for sensible defaults:

```typescript
import { observe, productionDefaults } from 'svoose';

observe({ ...productionDefaults, endpoint: '/api/metrics' });
// Includes: batchSize 50, flushInterval 10s, sampling, sessions
```

Or configure manually for production traffic (1000+ users):

```typescript
observe({
  endpoint: '/api/metrics',

  // Larger batches = fewer HTTP requests
  batchSize: 50,
  flushInterval: 10000,

  // Sample to reduce volume
  sampling: {
    errors: 1.0,       // never skip errors
    vitals: 0.5,       // 50% is enough for p75/p95 stats
    custom: 0.5,
    transitions: 0.1,  // transitions are high-volume
  },

  // Handle transport failures
  onError: (err) => console.error('svoose transport failed:', err),

  // Track sessions
  session: true,
});
```

**Volume math**: 1000 users with default settings (`batchSize: 10`, `flushInterval: 5s`) = ~200 req/s to your endpoint. With `batchSize: 50` + `flushInterval: 10s` + `sampling: 0.5` = ~10 req/s.

## API

### `observe(options?)`

Start collecting Web Vitals and errors.

```typescript
const cleanup = observe({
  // Where to send data
  endpoint: '/api/metrics',

  // Or use custom transport (overrides endpoint)
  transport: myTransport,

  // What to collect
  vitals: true,              // or ['CLS', 'LCP', 'INP']
  errors: true,

  // Batching
  batchSize: 10,
  flushInterval: 5000,

  // Sampling — number or per-event-type config
  sampling: {
    vitals: 0.1,             // 10%
    errors: 1.0,             // 100%
    custom: 0.5,             // 50%
    transitions: 0.0,        // disabled
  },

  // Sessions
  session: true,             // or { timeout: 30 * 60 * 1000, storage: 'sessionStorage' }

  // Error callback — handle transport failures
  onError: (err) => console.error('Transport failed:', err),

  // Filter events before sending
  filter: (event) => !(event.type === 'vital' && event.name === 'TTFB'),

  // Debug
  debug: false,
});

// Stop observing
cleanup();
```

> **Note**: If neither `endpoint` nor `transport` is provided, defaults to `endpoint: '/api/metrics'`.
> The default transport is hybrid (fetch + beacon on page close) for reliable delivery.

#### Sampling

Control what percentage of events are sent:

```typescript
// Simple: same rate for all events
observe({ sampling: 0.1 }); // 10% of everything

// Per-event-type (recommended)
observe({
  sampling: {
    vitals: 0.1,       // 10% — sufficient for accurate statistics
    errors: 1.0,       // 100% — capture all errors
    custom: 0.5,       // 50% of custom metrics
    transitions: 0.0,  // disabled
  },
});
```

#### Sessions

Automatic session tracking with configurable timeout:

```typescript
// Enable with defaults (30 min timeout, sessionStorage)
observe({ session: true });

// Or custom config
observe({
  session: {
    timeout: 60 * 60 * 1000,  // 1 hour
    storage: 'localStorage',   // 'sessionStorage' | 'localStorage' | 'memory'
  },
});

// All events now include sessionId:
// { type: 'vital', name: 'LCP', value: 1234, sessionId: '1706123456789-abc123def' }
```

**Storage options:**
- `sessionStorage` (default) — session per browser tab
- `localStorage` — session persists across tabs
- `memory` — no persistence, new session on page reload

#### Web Vitals

svoose collects all Core Web Vitals using the standard [web-vitals](https://github.com/GoogleChrome/web-vitals) algorithm (own implementation, no external dependency):

| Metric | What it measures | When reported |
|--------|------------------|---------------|
| **CLS** | Visual stability (layout shifts) | On page hide |
| **LCP** | Loading performance | On user input or page hide |
| **INP** | Responsiveness (max interaction) | On page hide |
| **FCP** | First content painted | Once |
| **TTFB** | Server response time | Once |
| **FID** | First input delay (deprecated) | Once |

```typescript
// All vitals
observe({ vitals: true });

// Select specific vitals
observe({ vitals: ['CLS', 'LCP', 'INP'] });
```

> CLS, LCP, and INP report once per page lifecycle (matches Chrome DevTools and Google Search Console behavior).

#### Custom Metrics

Track custom events for analytics:

```typescript
import { metric, counter, gauge, histogram } from 'svoose';

// Basic event
metric('checkout_started', { step: 1, cartTotal: 99.99 });

// Counter — increments (default value: 1)
counter('page_views');
counter('items_purchased', 3, { category: 'electronics' });

// Gauge — point-in-time values
gauge('active_users', 42);
gauge('memory_usage_mb', 256, { heap: 'old' });

// Histogram — distribution values
histogram('response_time_ms', 123);
histogram('payload_size', 4096, { route: '/api/data' });
```

**Buffer behavior**: If `metric()` / `counter()` / `gauge()` / `histogram()` is called before `observe()`, events are buffered (max 100). They're automatically flushed when `observe()` initializes.

##### Typed Metrics

Full TypeScript autocomplete for metric names and metadata shapes:

```typescript
import { createTypedMetric } from 'svoose';

const track = createTypedMetric<{
  checkout_started: { step: number; cartTotal: number };
  button_clicked: { id: string };
}>();

track('checkout_started', { step: 1, cartTotal: 99.99 }); // autocomplete
track('button_clicked', { id: 'submit' });                 // autocomplete
track('unknown_event', {});                                 // TypeScript error
```

### `createMachine(config)`

Create a state machine.

```typescript
const machine = createMachine({
  id: 'toggle',
  initial: 'off',
  context: { count: 0 },
  states: {
    off: {
      on: { TOGGLE: 'on' },
    },
    on: {
      entry: (ctx) => ({ count: ctx.count + 1 }),
      on: { TOGGLE: 'off' },
    },
  },
});

machine.state;              // 'off'
machine.context;            // { count: 0 }

// Note: context is shallow-cloned from your initial object.
// Nested objects/arrays are shared references — same as XState.
// If you need a deep clone, pass structuredClone(ctx) yourself.

machine.matches('off');     // true
machine.matchesAny('on', 'off'); // true

machine.can('TOGGLE');      // true
machine.can({ type: 'SET', value: 42 }); // full event for payload-dependent guards

machine.send('TOGGLE');
machine.send({ type: 'SET', value: 42 });

machine.destroy();
```

#### Guards & Actions

```typescript
const counter = createMachine({
  id: 'counter',
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        INCREMENT: {
          target: 'active',
          guard: (ctx) => ctx.count < 10,
          action: (ctx) => ({ count: ctx.count + 1 }),
        },
        DECREMENT: {
          target: 'active',
          guard: (ctx) => ctx.count > 0,
          action: (ctx) => ({ count: ctx.count - 1 }),
        },
      },
    },
  },
});
```

#### Entry & Exit Actions

```typescript
const wizard = createMachine({
  id: 'wizard',
  initial: 'step1',
  context: { data: {} },
  states: {
    step1: {
      entry: (ctx) => console.log('Entered step 1'),
      exit: (ctx) => console.log('Leaving step 1'),
      on: { NEXT: 'step2' },
    },
    step2: {
      on: { BACK: 'step1', SUBMIT: 'complete' },
    },
    complete: {
      entry: (ctx) => console.log('Done!'),
    },
  },
});
```

#### Observability Integration

Machines automatically integrate with `observe()`:

```typescript
observe({ errors: true });

// Simple
const auth = createMachine({ id: 'auth', observe: true, /* ... */ });

// Or detailed config
const auth = createMachine({
  id: 'auth',
  observe: { transitions: true, context: true },
  // ...
});

// When an error occurs, it includes all active machines:
// { machineId: 'auth', machineState: 'loading', machines: [{ id: 'auth', state: 'loading' }] }
```

### Transports

#### Retry & Timeout

Add retry logic with configurable backoff to any fetch-based transport:

```typescript
import { createFetchTransport } from 'svoose';

const transport = createFetchTransport('/api/metrics', {
  retry: {
    attempts: 3,
    backoff: 'exponential',  // 'fixed' | 'linear' | 'exponential'
    initialDelay: 1000,       // 1s → 2s → 4s
    maxDelay: 30000,
    jitter: true,             // ±10% randomization
  },
  timeout: 10000,  // 10s per request
});
```

Works with hybrid transport too — retry applies to fetch only, beacon never retries:

```typescript
import { createHybridTransport } from 'svoose';

observe({
  transport: createHybridTransport('/api/metrics', {
    retry: { attempts: 3, backoff: 'exponential' },
    timeout: 10000,
  }),
});
```

`withRetry()` is also available as a standalone utility for custom transports:

```typescript
import { withRetry } from 'svoose';

await withRetry(
  (signal) => fetch('/api/metrics', { method: 'POST', body, signal }),
  { attempts: 3, backoff: 'exponential' },
  { timeout: 5000 }
);
```

#### Fetch Transport (default)

```typescript
import { observe, createFetchTransport } from 'svoose';

const transport = createFetchTransport('/api/metrics', {
  headers: { 'Authorization': 'Bearer xxx' },
  onError: (err) => console.error(err),
});
observe({ transport });
```

#### Console Transport (development)

```typescript
import { observe, createConsoleTransport } from 'svoose';

observe({ transport: createConsoleTransport({ pretty: true }) });
```

#### Beacon Transport

Guaranteed delivery on page close via `navigator.sendBeacon`:

```typescript
import { observe, createBeaconTransport } from 'svoose';

observe({
  transport: createBeaconTransport('/api/metrics', {
    maxPayloadSize: 60000, // auto-chunks if exceeded (default: 60KB)
  }),
});
```

#### Hybrid Transport (recommended for production)

Uses fetch normally, switches to beacon on page close:

```typescript
import { observe, createHybridTransport } from 'svoose';

const transport = createHybridTransport('/api/metrics', {
  default: 'fetch',
  onUnload: 'beacon',
  headers: { 'Authorization': 'Bearer xxx' },
});

observe({ transport });

// Cleanup when done (removes lifecycle listeners)
transport.destroy();
```

#### Custom Transport

```typescript
// Forward to any service
const myTransport = {
  async send(events) {
    await myApi.track(events);
  },
};
observe({ transport: myTransport });
```

#### Dev vs Prod Pattern

```typescript
const isDev = import.meta.env.DEV;
observe({
  transport: isDev
    ? createConsoleTransport({ pretty: true })
    : createHybridTransport('/api/metrics'),
});
```

## Privacy & PII Sanitization

> Privacy-focused utilities to keep PII out of your event stream. Not a legal compliance guarantee — make your own GDPR/CCPA assessment.

Configure privacy via `observe({ privacy })` (preferred) or `configurePII()` (runtime, overwrite semantics):

```typescript
import { observe } from 'svoose';

observe({
  endpoint: '/api/metrics',
  privacy: {
    // Replace matching URL params with [REDACTED]
    scrubFromUrl: ['token', 'api_key', /password/i],

    // Mask values in CustomMetricEvent.metadata (preserves last 4 chars)
    maskFields: ['email', 'phone'],

    // Drop the query string from event URLs
    stripQueryParams: true,

    // Drop the URL hash from event URLs
    stripHash: false,

    // Drop events whose URL prefix matches a sensitive path
    excludePaths: ['/admin', '/login', '/api/auth'],

    // Custom sanitizer — return null to DROP the event entirely
    sanitize: (event) => {
      if ('message' in event && typeof event.message === 'string') {
        event.message = event.message.replace(
          /[\w.+-]+@[\w.-]+\.[\w]{2,}/g,
          '[email]',
        );
      }
      return event;
    },
  },
});
```

### configurePII() — runtime override

`configurePII()` uses **overwrite** semantics — each call replaces the previous config (KISS). Pass `null` (or `{}`) to reset.

```typescript
import { configurePII } from 'svoose';

configurePII({ scrubFromUrl: ['session_id'] });

// Later — fully replaces previous config:
configurePII({ maskFields: ['email'] });

// Reset:
configurePII(null);
```

### Pipeline order

Privacy runs **first**, before sampling, filter, or session injection. This ensures dropped events never leak PII into downstream stages:

```
1. Fingerprint (error events only — uses RAW message)
2. Dedup check (if errors.dedupe enabled)
3. Privacy / sanitize  ← runs FIRST
4. Filter
5. Sampling
6. Session ID injection
7. onEvent listeners
8. Buffer
```

## Error Fingerprinting

Error events automatically receive a deploy-resistant `fingerprint` — an 8-char hex hash derived from `message` + the first stable function name in the stack:

```typescript
{
  type: 'error',
  message: 'Cannot read properties of null',
  stack: '...',
  fingerprint: 'a1b2c3d4',  // ← stable across deploys with the same call site
  ...
}
```

**Why deploy-resistant?** Minified file names contain build hashes (`app-Bx7k2.js:1:43567`) that change every deploy. Same error → different fingerprint → grouping breaks. svoose uses the qualified function name (`Object.handler`, `HTMLButtonElement.onclick`), which stays stable across builds. Single-letter minified names (`a`, `b`) are skipped.

### Optional client-side dedup

A single broken button can fire thousands of identical errors per minute. Sampling is random and won't suppress dupes. Enable client-side dedup to drop duplicate fingerprints inside a sliding window:

```typescript
observe({
  errors: {
    dedupe: true,
    dedupeWindow: 60_000, // 1 minute (default)
  },
});
```

Within the window, repeats of the same fingerprint are dropped (`stats.dropped++`). After the window, the next occurrence passes again.

## Svelte 5 Usage

### Reactive State Machines

Use `useMachine()` from `svoose/svelte` for automatic reactivity:

```svelte
<script lang="ts">
  import { useMachine } from 'svoose/svelte';

  const toggle = useMachine({
    id: 'toggle',
    initial: 'off',
    states: {
      off: { on: { TOGGLE: 'on' } },
      on: { on: { TOGGLE: 'off' } },
    },
  });
</script>

<button onclick={() => toggle.send('TOGGLE')}>
  {toggle.state}
</button>

{#if toggle.matches('on')}
  <p>Light is on!</p>
{/if}
```

### With Observability

```svelte
<script lang="ts">
  import { observe } from 'svoose';
  import { useMachine } from 'svoose/svelte';
  import { onMount, onDestroy } from 'svelte';

  let cleanup: (() => void) | null = null;

  onMount(() => {
    cleanup = observe({ endpoint: '/api/metrics' });
  });

  onDestroy(() => cleanup?.());

  const auth = useMachine({
    id: 'auth',
    initial: 'idle',
    context: { user: null },
    observe: true,
    states: {
      idle: { on: { LOGIN: 'loading' } },
      loading: {
        on: {
          SUCCESS: {
            target: 'authenticated',
            action: (ctx, e) => ({ user: e.user }),
          },
          ERROR: 'idle',
        },
      },
      authenticated: { on: { LOGOUT: 'idle' } },
    },
  });
</script>

<p>Status: {auth.state}</p>
<p>User: {auth.context.user?.name ?? 'Not logged in'}</p>
```

### Non-Reactive Usage

For non-reactive scenarios (outside components, vanilla JS), use `createMachine()` directly.

## TypeScript

Full TypeScript support with inference:

```typescript
type AuthEvent =
  | { type: 'LOGIN'; email: string }
  | { type: 'SUCCESS'; user: User }
  | { type: 'ERROR'; message: string }
  | { type: 'LOGOUT' };

const auth = createMachine<
  { user: User | null; error: string | null },
  'idle' | 'loading' | 'authenticated',
  AuthEvent
>({
  id: 'auth',
  initial: 'idle',
  context: { user: null, error: null },
  states: {
    idle: {
      on: { LOGIN: 'loading' },
    },
    loading: {
      on: {
        SUCCESS: {
          target: 'authenticated',
          action: (ctx, event) => ({ user: event.user }),
        },
      },
    },
    authenticated: {
      on: { LOGOUT: 'idle' },
    },
  },
});

auth.matches('idle');     // type-checked
auth.matches('invalid');  // TypeScript error
auth.send('LOGOUT');      // type-checked
auth.send('INVALID');     // TypeScript error
```

## Bundle Size

Tree-shakeable — pay only for what you use:

| Import | Size (gzip) |
|--------|-------------|
| `observe()` + vitals + errors + metrics | ~5.1 KB |
| `createMachine()` only | ~0.95 KB |
| Full bundle | ~6.7 KB |

> Compare: Sentry ~20KB, PostHog ~40KB.

## When to use something else

- **Session replay, alerting, team workflows** — use [Sentry](https://sentry.io) or [PostHog](https://posthog.com)
- **Complex state machines** (parallel states, invoke, spawn) — use [XState](https://xstate.js.org)
- **Full analytics platform** (funnels, cohorts, A/B tests) — use PostHog or Mixpanel

svoose is best for: lightweight self-hosted observability where you control the data and want minimal bundle overhead.

## Roadmap

- **v0.1.3–v0.1.10** — Done (sampling, sessions, custom metrics, beacon/hybrid transport, API cleanup, retry logic)

- **v0.1.11** — Privacy Utilities (planned)
- **v0.2.0** — Production-Ready: User ID, Offline, flush API, Rate Limiter (planned)
- **v0.3.0** — SvelteKit Integration (planned)
- **v1.0.0** — Stable Release

> FSM is a lightweight bonus feature, not an XState competitor. For complex state machines, use XState.

See [ROADMAP.md](./ROADMAP.md) for detailed plans.

## License

MIT

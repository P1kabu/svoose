# svoose

> Svelte + Goose = **svoose** — the goose that sees everything

Lightweight observability + state machines for Svelte 5. Zero dependencies. Tree-shakeable. **< 5KB gzipped**.

## Features

- **Web Vitals** — CLS, LCP, FID, INP, FCP, TTFB (no external deps)
- **Error Tracking** — global errors + unhandled rejections
- **State Machines** — minimal FSM with TypeScript inference
- **Svelte 5 Native** — reactive `useMachine()` hook with $state runes
- **Tree-shakeable** — pay only for what you use

## Installation

```bash
npm install svoose
```

## Quick Start

```typescript
import { observe, createMachine } from 'svoose';

// Start collecting metrics
observe({ endpoint: '/api/metrics' });

// Create a state machine
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
  observe: true, // Track transitions
});

// Use it
auth.send('LOGIN');
auth.state; // 'loading'
auth.context; // { user: null }
```

## API

### `observe(options?)`

Start collecting Web Vitals and errors.

```typescript
const cleanup = observe({
  // Where to send data (Option 1: endpoint)
  endpoint: '/api/metrics',

  // Or use custom transport (Option 2: transport)
  // NOTE: endpoint and transport are mutually exclusive
  // If transport is provided, endpoint is ignored
  transport: myTransport,

  // What to collect
  vitals: true,              // or ['CLS', 'LCP', 'INP']
  errors: true,

  // Batching
  batchSize: 10,
  flushInterval: 5000,

  // Sampling (v0.1.3+)
  sampling: 0.1,             // 10% of all events
  // or per-event-type (recommended)
  sampling: {
    vitals: 0.1,             // 10% — sufficient for statistics
    errors: 1.0,             // 100% — all errors matter
    custom: 0.5,             // 50% of custom metrics
    transitions: 0.0,        // disabled
  },

  // Debug
  debug: false,
});

// Stop observing
cleanup();
```

> **Note**: If neither `endpoint` nor `transport` is provided, defaults to `endpoint: '/api/observe'`.

#### Sampling (v0.1.3+)

Control what percentage of events are sent to your backend:

```typescript
// Simple: same rate for all events
observe({
  endpoint: '/api/metrics',
  sampling: 0.1, // 10% of all events
});

// Per-event-type: recommended for production
observe({
  endpoint: '/api/metrics',
  sampling: {
    vitals: 0.1,       // 10% — sufficient for accurate statistics
    errors: 1.0,       // 100% — capture all errors
    custom: 0.5,       // 50% of custom metrics
    transitions: 0.0,  // disabled — no state machine events
    identify: 1.0,     // 100% — always track user identification
  },
});
```

> **Note**: `sampleRate` is deprecated. Use `sampling` instead.

#### Sessions (v0.1.5+)

Automatic session tracking with configurable timeout:

```typescript
observe({
  endpoint: '/api/metrics',

  // Enable with defaults (30 min timeout, sessionStorage)
  session: true,

  // Or custom config
  session: {
    timeout: 60 * 60 * 1000,  // 1 hour in milliseconds = new session after 1h inactivity
    storage: 'localStorage',   // 'sessionStorage' | 'localStorage' | 'memory'
  },
});

// All events now include sessionId:
// { type: 'vital', name: 'LCP', value: 1234, sessionId: '1706123456789-abc123def' }
```

> **Note**: `timeout` is in **milliseconds**. Common values: `30 * 60 * 1000` (30 min), `60 * 60 * 1000` (1 hour).

**Storage options:**
- `sessionStorage` (default) — session per browser tab
- `localStorage` — session persists across tabs
- `memory` — no persistence, new session on page reload

**Features:**
- Automatic session ID generation (timestamp + random)
- Session expires after inactivity timeout (default: 30 min)
- Graceful degradation in private mode
- SSR safe

#### Web Vitals (v0.1.5+)

svoose collects all Core Web Vitals using the standard [web-vitals](https://github.com/GoogleChrome/web-vitals) algorithm:

| Metric | What it measures | When reported |
|--------|------------------|---------------|
| **CLS** | Visual stability (layout shifts) | On page hide/visibility change |
| **LCP** | Loading performance | On user input or visibility change |
| **INP** | Responsiveness (max interaction) | On page hide/visibility change |
| **FCP** | First content painted | Once |
| **TTFB** | Server response time | Once |
| **FID** | First input delay (deprecated) | Once |

**Web Vitals Reporting (v0.1.5+)**:

All vitals follow the [web-vitals](https://github.com/GoogleChrome/web-vitals) standard:

**CLS (Cumulative Layout Shift)**:
- Groups shifts into sessions (max 5s, max 1s gap)
- Reports maximum session value on page hide

**LCP (Largest Contentful Paint)**:
- Tracks largest content element painted
- Finalized on first user interaction (click/keydown) or visibility change

**INP (Interaction to Next Paint)**:
- Tracks maximum interaction duration
- Only counts discrete events with `interactionId` (ignores scroll, etc.)
- Reports on page hide

```typescript
// All vitals report automatically on page lifecycle events
observe({ vitals: true });

// Select specific vitals
observe({ vitals: ['CLS', 'LCP', 'INP'] });
```

> **Note (v0.1.5 breaking change)**: CLS, LCP, and INP now report once per page lifecycle instead of on every update. This matches Chrome DevTools and Google Search Console behavior.

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

// State & context (reactive in Svelte 5)
machine.state;              // 'off'
machine.context;            // { count: 0 }

// Check state
machine.matches('off');     // true
machine.matchesAny('on', 'off'); // true

// Check if event is valid
machine.can('TOGGLE');      // true

// Send events
machine.send('TOGGLE');
machine.send({ type: 'SET', value: 42 });

// Cleanup
machine.destroy();
```

### Guards & Actions

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
          guard: (ctx) => ctx.count < 10,    // Only if count < 10
          action: (ctx) => ({ count: ctx.count + 1 }),
        },
        DECREMENT: {
          target: 'active',
          guard: (ctx) => ctx.count > 0,     // Only if count > 0
          action: (ctx) => ({ count: ctx.count - 1 }),
        },
      },
    },
  },
});
```

### Entry & Exit Actions

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

### Observability Integration

Machines automatically integrate with `observe()`:

```typescript
// Errors include machine context
observe({ errors: true });

const auth = createMachine({
  id: 'auth',
  observe: true, // Track transitions
  // or
  observe: {
    transitions: true,
    context: true, // Include context in events
  },
});

// When an error occurs, it includes:
// { machineId: 'auth', machineState: 'loading', ... }
```

### Custom Transport

```typescript
import { observe, createFetchTransport, createConsoleTransport } from 'svoose';

// Fetch with custom headers
const transport = createFetchTransport('/api/metrics', {
  headers: { 'Authorization': 'Bearer xxx' },
  onError: (err) => console.error(err),
});
observe({ transport });

// Console only (for development) — no network requests
observe({ transport: createConsoleTransport({ pretty: true }) });

// Noop (silent, for production without backend)
observe({ transport: { send: () => {} } });

// Custom transport (Sentry, Datadog, etc.)
const myTransport = {
  async send(events) {
    await myApi.track(events);
  },
};
observe({ transport: myTransport });

// Dev vs Prod pattern
const isDev = import.meta.env.DEV;
observe({
  transport: isDev
    ? createConsoleTransport({ pretty: true })
    : createFetchTransport('/api/metrics'),
});
```

## Bundle Size

Tree-shakeable — pay only for what you use:

| Import | Size (gzip) |
|--------|-------------|
| `observe()` core | ~2.5 KB |
| `createMachine()` only | ~0.8 KB |
| Full bundle (v0.1.x) | ~3.5 KB |
| Full production (v0.2.0+) | ~5.5 KB |

> Most apps only need `observe()` core (~2.5 KB). Compare: Sentry ~20KB, PostHog ~40KB.

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
    // States are type-checked
    idle: {
      on: {
        // Events are type-checked
        LOGIN: 'loading',
      },
    },
    loading: {
      on: {
        SUCCESS: {
          target: 'authenticated',
          // event.user is typed as User
          action: (ctx, event) => ({ user: event.user }),
        },
      },
    },
    authenticated: {
      on: { LOGOUT: 'idle' },
    },
  },
});

auth.matches('idle');     // ✓ type-checked
auth.matches('invalid');  // ✗ TypeScript error
auth.send('LOGOUT');      // ✓ type-checked
auth.send('INVALID');     // ✗ TypeScript error
```

## Svelte 5 Usage

### Reactive State Machines (Recommended)

Use `useMachine()` from `svoose/svelte` for automatic reactivity:

```svelte
<script lang="ts">
  import { useMachine } from 'svoose/svelte';

  // State machine with automatic Svelte 5 reactivity
  const toggle = useMachine({
    id: 'toggle',
    initial: 'off',
    states: {
      off: { on: { TOGGLE: 'on' } },
      on: { on: { TOGGLE: 'off' } },
    },
  });

  // toggle.state and toggle.context are reactive!
  // Changes automatically trigger re-renders
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

  // Start observing
  let cleanup: (() => void) | null = null;

  onMount(() => {
    cleanup = observe({ endpoint: '/api/metrics' });
  });

  onDestroy(() => cleanup?.());

  // Reactive machine with observation
  const auth = useMachine({
    id: 'auth',
    initial: 'idle',
    context: { user: null },
    observe: true, // Track transitions
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

For non-reactive scenarios (outside components, vanilla JS), use `createMachine()`:

```typescript
import { createMachine } from 'svoose';

const machine = createMachine({
  id: 'toggle',
  initial: 'off',
  states: {
    off: { on: { TOGGLE: 'on' } },
    on: { on: { TOGGLE: 'off' } },
  },
});
```

## Roadmap

- **v0.1.3** ✅ — Sampling (per-event-type rate limiting)
- **v0.1.4** ✅ — Hotfix (missing sampling.js)
- **v0.1.5** — Session Tracking + CLS Session Windows fix
- **v0.1.6-v0.1.10** — Custom metrics, retry, beacon transport, privacy
- **v0.2.0** — Production-Ready Observability + Bundle Restructure (modular entry points)
- **v0.3.0** — SvelteKit Integration (Vite plugin, hooks, route tracking)
- **v1.0.0** — Stable Release (Q1 2027)

> **Note**: FSM is a lightweight bonus feature, not an XState competitor. For complex state machines, use XState.

See [ROADMAP.md](./ROADMAP.md) for detailed plans.

## License

MIT

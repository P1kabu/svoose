# svoose

> Svelte + Goose = **svoose** — the goose that sees everything

Lightweight observability + state machines for Svelte 5. Zero dependencies. Tree-shakeable. **< 3KB gzipped**.

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
  // Where to send data
  endpoint: '/api/metrics',

  // Or use custom transport
  transport: myTransport,

  // What to collect
  vitals: true,              // or ['CLS', 'LCP', 'INP']
  errors: true,

  // Batching
  batchSize: 10,
  flushInterval: 5000,

  // Sampling
  sampleRate: 0.1,           // 10% of users

  // Debug
  debug: false,
});

// Stop observing
cleanup();
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

// Console (for development)
observe({ transport: createConsoleTransport({ pretty: true }) });

// Custom transport
const myTransport = {
  async send(events) {
    await myApi.track(events);
  },
};
```

## Bundle Size

| Import | Size (gzip) |
|--------|-------------|
| Full bundle | ~3.0 KB |
| `observe()` only | ~2.1 KB |
| `createMachine()` only | ~0.8 KB |

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

- **v0.2** — Enhanced Observability (custom metrics, retry logic, network awareness)
- **v0.3** — SvelteKit Integration (hooks, route tracking, SSR safety)
- **v0.4** — Developer Experience (devtools, transition history, visualization)
- **v0.5** — Core FSM Enhancements (`invoke()`, `after()`, `always()`)

See [ROADMAP.md](./ROADMAP.md) for detailed plans.

## License

MIT

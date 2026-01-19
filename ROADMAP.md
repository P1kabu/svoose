# svoose Roadmap

> Стратегія: **"Глибока Ніша"** — стати найкращим Svelte 5 observability рішенням

## Філософія Розвитку

1. **Svelte-first** — кожна функція оптимізована для Svelte 5 екосистеми
2. **Lightweight** — bundle size < 5KB залишається пріоритетом
3. **Zero dependencies** — ніяких runtime залежностей
4. **Observability focus** — FSM як доповнення, не основна мета
5. **Production-ready** — кожен реліз готовий до production

---

## Версії

### ✅ v0.1.x — Foundation (Поточна)

**Статус**: Завершено

- [x] Web Vitals (CLS, LCP, FID, INP, FCP, TTFB)
- [x] Error tracking (global errors + unhandled rejections)
- [x] Базова FSM з TypeScript inference
- [x] `useMachine()` hook для Svelte 5
- [x] Batching та sampling
- [x] Fetch/Console транспорти
- [x] 90 тестів

**Bundle**: ~3.0 KB gzipped

---

### 🚧 v0.2.0 — Enhanced Observability

**Статус**: В розробці
**Пріоритет**: Критичний
**Цільова дата**: Q1 2026

#### Нові функції

| Функція | Опис | Статус |
|---------|------|--------|
| Custom Metrics API | Користувацькі метрики з batching | ⬜ Todo |
| Retry Logic | Exponential backoff для транспорту | ⬜ Todo |
| Multiple Machine Context | Всі машини в error context | ⬜ Todo |
| Network Status Awareness | Pause/resume на offline | ⬜ Todo |
| Dead Letter Queue | Збереження failed events | ⬜ Todo |

#### API Design

```typescript
// Custom Metrics
import { observe, metric } from 'svoose';

observe({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,
});

// Emit custom metric anywhere in your app
metric('checkout_started', { step: 1, cartTotal: 99.99 });
metric('feature_used', { name: 'dark_mode', enabled: true });

// Or use callback style in observe()
observe({
  custom: (emit) => {
    // Track custom performance marks
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        emit({
          type: 'custom',
          name: entry.name,
          value: entry.duration,
          metadata: { startTime: entry.startTime },
        });
      }
    });
    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  },
});
```

```typescript
// Retry Logic
import { createFetchTransport } from 'svoose/transport';

const transport = createFetchTransport('/api/metrics', {
  retry: {
    attempts: 3,           // Max retry attempts
    backoff: 'exponential', // 'exponential' | 'linear' | 'fixed'
    initialDelay: 1000,    // Start with 1s delay
    maxDelay: 30000,       // Max 30s between retries
  },
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}:`, error);
  },
  onMaxRetries: (events) => {
    // Events that failed after all retries
    localStorage.setItem('failed_metrics', JSON.stringify(events));
  },
});
```

```typescript
// Network Awareness
observe({
  endpoint: '/api/metrics',
  networkAware: true, // Pause when offline, resume when online
  offlineStorage: 'localStorage', // or 'indexeddb' | 'memory'
  maxOfflineEvents: 1000,
});
```

#### Технічні задачі

- [ ] Рефакторинг `observe.svelte.ts` для extensibility
- [ ] Додати `metric()` функцію в exports
- [ ] Імплементувати retry queue в transport
- [ ] Network status detection (navigator.onLine + events)
- [ ] LocalStorage adapter для offline events
- [ ] Оновити всі error contexts для multiple machines
- [ ] +30 нових тестів
- [ ] Оновити README з новими API

#### Breaking Changes

Немає — повна backward compatibility

#### Migration

Не потрібна — всі нові функції opt-in

---

### 📋 v0.3.0 — SvelteKit Integration

**Статус**: Планується
**Пріоритет**: Високий
**Цільова дата**: Q2 2026

#### Нові функції

| Функція | Опис | Статус |
|---------|------|--------|
| `svoose/sveltekit` entry | Новий entry point | ⬜ Todo |
| Server Hooks | handle(), handleError() | ⬜ Todo |
| Route Tracking | Автоматичний page view tracking | ⬜ Todo |
| SSR Safety | Graceful server-side handling | ⬜ Todo |
| Load Function Tracking | Track load() performance | ⬜ Todo |

#### API Design

```typescript
// hooks.server.ts
import { createSvooseHooks } from 'svoose/sveltekit';

const svoose = createSvooseHooks({
  endpoint: '/api/metrics',

  // Server-side options
  serverErrors: true,      // Track server errors
  requestTiming: true,     // Track request duration

  // What to include in events
  includeRoute: true,      // Current route
  includeParams: false,    // URL params (privacy)
  includeUserAgent: true,  // Browser info
});

export const handle = svoose.handle;
export const handleError = svoose.handleError;
```

```typescript
// hooks.client.ts
import { createClientHooks } from 'svoose/sveltekit';

export const { init } = createClientHooks({
  endpoint: '/api/metrics',

  // Client-side options
  vitals: true,
  errors: true,

  // Navigation tracking
  navigation: {
    enabled: true,
    trackParams: false,    // Don't track URL params
    trackSearchParams: false,
  },
});

// Call in +layout.svelte onMount
init();
```

```typescript
// +layout.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { init } from '$lib/hooks.client';

  onMount(() => {
    const cleanup = init();
    return cleanup;
  });
</script>

<slot />
```

```typescript
// Track load() function performance
// +page.ts
import { trackLoad } from 'svoose/sveltekit';

export const load = trackLoad(async ({ fetch, params }) => {
  const data = await fetch(`/api/posts/${params.id}`);
  return { post: await data.json() };
});

// Automatically tracks:
// - Load duration
// - Route name
// - Success/failure
```

#### Технічні задачі

- [ ] Створити `src/sveltekit/` директорію
- [ ] Server hooks implementation
- [ ] Client hooks implementation
- [ ] Navigation tracking з `beforeNavigate`/`afterNavigate`
- [ ] `trackLoad()` wrapper
- [ ] SSR detection та graceful handling
- [ ] +20 нових тестів (потребує SvelteKit test setup)
- [ ] Документація: SvelteKit Quick Start guide
- [ ] Example SvelteKit project

#### Breaking Changes

Немає

#### Package.json Update

```json
{
  "exports": {
    ".": { ... },
    "./svelte": { ... },
    "./sveltekit": {
      "types": "./dist/sveltekit/index.d.ts",
      "import": "./dist/sveltekit/index.js"
    },
    "./transport": { ... }
  }
}
```

---

### 📋 v0.4.0 — Developer Experience

**Статус**: Планується
**Пріоритет**: Середній
**Цільова дата**: Q3 2026

#### Нові функції

| Функція | Опис | Статус |
|---------|------|--------|
| Devtools Extension | Chrome extension для inspection | ⬜ Todo |
| Transition History | Circular buffer логу | ⬜ Todo |
| Machine Visualization | Export діаграм | ⬜ Todo |
| Enhanced Debug Mode | Grouped console output | ⬜ Todo |
| Event Replay | Replay transitions для debug | ⬜ Todo |

#### API Design

```typescript
// Devtools connection
const machine = createMachine({
  id: 'auth',
  initial: 'idle',
  states: { /* ... */ },

  // Enable devtools (auto-disabled in production)
  devtools: true,

  // Keep transition history
  history: {
    enabled: true,
    maxSize: 100, // Keep last 100 transitions
  },
});

// Access history programmatically
machine.getHistory();
// Returns: [
//   { from: 'idle', to: 'loading', event: 'LOGIN', timestamp: 1234567890 },
//   { from: 'loading', to: 'authenticated', event: 'SUCCESS', timestamp: 1234567891 },
// ]

// Export for visualization
machine.exportDiagram('mermaid');
// Returns:
// ```mermaid
// stateDiagram-v2
//   [*] --> idle
//   idle --> loading : LOGIN
//   loading --> authenticated : SUCCESS
//   loading --> idle : ERROR
//   authenticated --> idle : LOGOUT
// ```

machine.exportDiagram('json'); // For custom visualization
```

```typescript
// Enhanced debug mode
observe({
  endpoint: '/api/metrics',
  debug: {
    enabled: true,
    grouped: true,        // Group related events in console
    colors: true,         // Colorful output
    timestamps: true,     // Show timestamps
    filter: ['vital', 'error'], // Only show these types
  },
});

// Console output:
// ▼ [svoose] 14:32:15.123
//   ├─ vital: LCP = 1234ms (good)
//   ├─ vital: CLS = 0.05 (good)
//   └─ transition: auth idle → loading
```

```typescript
// Event replay for debugging
import { createReplayableMachine } from 'svoose';

const machine = createReplayableMachine({
  id: 'wizard',
  // ... config
});

// Record events
machine.send('NEXT');
machine.send('BACK');
machine.send('SUBMIT');

// Get recorded events
const events = machine.getRecordedEvents();

// Replay on another machine instance
const replayMachine = createReplayableMachine({ /* same config */ });
replayMachine.replay(events);
// Machine is now in same state as original
```

#### Chrome Extension Features

- View all active machines
- Inspect current state and context
- View transition history timeline
- Send events manually
- Time-travel debugging
- Export/import machine state

#### Технічні задачі

- [ ] Devtools protocol design
- [ ] Chrome extension boilerplate
- [ ] History buffer implementation
- [ ] Mermaid export
- [ ] JSON export for visualization
- [ ] Debug mode enhancements
- [ ] Replay functionality
- [ ] +15 нових тестів
- [ ] Devtools documentation

---

### 📋 v0.5.0 — Core FSM Enhancements

**Статус**: Планується
**Пріоритет**: Середній
**Цільова дата**: Q4 2026

#### Нові функції

| Функція | Опис | Статус |
|---------|------|--------|
| `invoke()` | Async operations в станах | ⬜ Todo |
| `after()` | Delayed transitions | ⬜ Todo |
| `always()` | Transient transitions | ⬜ Todo |
| Enhanced Types | Краща type inference | ⬜ Todo |

#### API Design

```typescript
// invoke() - Async operations
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  context: { data: null, error: null },
  states: {
    idle: {
      on: { FETCH: 'loading' },
    },
    loading: {
      invoke: {
        // Async function to run when entering state
        src: async (ctx, event) => {
          const response = await fetch(`/api/users/${event.id}`);
          if (!response.ok) throw new Error('Failed to fetch');
          return response.json();
        },
        // On successful completion
        onDone: {
          target: 'success',
          action: (ctx, event) => ({ data: event.data }),
        },
        // On error
        onError: {
          target: 'error',
          action: (ctx, event) => ({ error: event.error.message }),
        },
      },
    },
    success: {
      on: { RESET: 'idle' },
    },
    error: {
      on: { RETRY: 'loading' },
    },
  },
});
```

```typescript
// after() - Delayed transitions
const notificationMachine = createMachine({
  id: 'notification',
  initial: 'hidden',
  context: { message: '' },
  states: {
    hidden: {
      on: {
        SHOW: {
          target: 'visible',
          action: (ctx, e) => ({ message: e.message }),
        },
      },
    },
    visible: {
      after: {
        // Auto-hide after 5 seconds
        5000: 'hidden',

        // Or with condition
        3000: {
          target: 'hidden',
          guard: (ctx) => ctx.message.length < 50, // Short messages hide faster
        },
      },
      on: {
        DISMISS: 'hidden',
      },
    },
  },
});
```

```typescript
// always() - Transient transitions (immediate, condition-based)
const formMachine = createMachine({
  id: 'form',
  initial: 'editing',
  context: { fields: {}, errors: [] },
  states: {
    editing: {
      on: { SUBMIT: 'validating' },
    },
    validating: {
      // Immediately transition based on condition
      always: [
        {
          target: 'error',
          guard: (ctx) => ctx.errors.length > 0,
        },
        {
          target: 'submitting',
          // No guard = default transition
        },
      ],
    },
    submitting: {
      invoke: { /* ... */ },
    },
    error: {
      on: { EDIT: 'editing' },
    },
    success: {},
  },
});
```

#### Технічні задачі

- [ ] `invoke()` implementation з Promise handling
- [ ] `after()` implementation з timer management
- [ ] `always()` implementation
- [ ] Cleanup timers on destroy
- [ ] Cancel invoke on exit
- [ ] Type inference для invoke events
- [ ] +25 нових тестів
- [ ] Migration guide від базової FSM

---

### 📋 v0.6.0 — Ecosystem Plugins

**Статус**: Планується
**Пріоритет**: Низький
**Цільова дата**: 2027

#### Плагіни

| Пакет | Опис |
|-------|------|
| `@svoose/sentry` | Sentry error tracking integration |
| `@svoose/datadog` | Datadog RUM transport |
| `@svoose/posthog` | PostHog analytics transport |
| `@svoose/mixpanel` | Mixpanel events transport |
| `@svoose/amplitude` | Amplitude analytics transport |

#### API Design

```typescript
// @svoose/sentry
import { createSentryTransport } from '@svoose/sentry';
import * as Sentry from '@sentry/svelte';

observe({
  transport: createSentryTransport(Sentry, {
    // Map svoose events to Sentry
    vitals: true,         // Send as Sentry Web Vitals
    errors: true,         // Send as Sentry exceptions
    transitions: false,   // Don't send transitions

    // Custom tags
    tags: {
      environment: 'production',
      version: '1.0.0',
    },
  }),
});
```

```typescript
// @svoose/posthog
import { createPostHogTransport } from '@svoose/posthog';
import posthog from 'posthog-js';

observe({
  transport: createPostHogTransport(posthog, {
    // Map svoose events to PostHog
    vitals: {
      enabled: true,
      prefix: 'web_vital_', // Events: web_vital_lcp, web_vital_cls, etc.
    },
    errors: {
      enabled: true,
      eventName: 'error_occurred',
    },
    transitions: {
      enabled: true,
      eventName: 'state_transition',
    },
  }),
});
```

---

## Bundle Size Targets

| Версія | Full Bundle | observe() only | createMachine() only |
|--------|-------------|----------------|---------------------|
| v0.1.x | ~3.0 KB | ~2.1 KB | ~0.8 KB |
| v0.2.0 | ~3.5 KB | ~2.5 KB | ~0.8 KB |
| v0.3.0 | ~4.0 KB | ~2.5 KB | ~0.8 KB |
| v0.4.0 | ~4.5 KB | ~2.5 KB | ~1.2 KB |
| v0.5.0 | ~5.0 KB | ~2.5 KB | ~1.8 KB |

*SvelteKit entry додає ~1 KB окремо*

---

## Test Coverage Targets

| Версія | Тести | Покриття |
|--------|-------|----------|
| v0.1.x | 90 | ~75% |
| v0.2.0 | 120 | ~80% |
| v0.3.0 | 140 | ~82% |
| v0.4.0 | 155 | ~85% |
| v0.5.0 | 180 | ~87% |

---

## Технічний Борг (Кожен Реліз)

### Постійні задачі

- [ ] Svelte component тести (@testing-library/svelte)
- [ ] Browser compatibility matrix документація
- [ ] Performance benchmarks vs competitors
- [ ] Security audit для transport layer
- [ ] Changelog оновлення
- [ ] README оновлення
- [ ] TypeDoc генерація

### v0.2.0 Cleanup

- [ ] Рефакторинг error context для multiple machines
- [ ] Уніфікація guard signature (can() vs send())
- [ ] Покращення error messages

---

## Competitor Tracking

### vs XState

| Функція | svoose | XState | Пріоритет |
|---------|--------|--------|-----------|
| Basic FSM | ✅ | ✅ | — |
| invoke/spawn | v0.5 | ✅ | Low |
| Parallel states | — | ✅ | — |
| History states | — | ✅ | — |
| Devtools | v0.4 | ✅ | Medium |
| Svelte 5 native | ✅ | Plugin | — |
| Web Vitals | ✅ | — | — |
| Error tracking | ✅ | — | — |
| Bundle size | 3KB | 11KB | — |

**Стратегія**: Не конкурувати з XState на FSM функціях. Фокус на observability + Svelte integration.

### vs web-vitals

| Функція | svoose | web-vitals | Пріоритет |
|---------|--------|------------|-----------|
| Web Vitals | ✅ | ✅ | — |
| Batching | ✅ | Manual | — |
| Error tracking | ✅ | — | — |
| FSM | ✅ | — | — |
| Custom metrics | v0.2 | Manual | High |
| SvelteKit | v0.3 | — | High |

**Стратегія**: Інтегроване рішення для Svelte проектів, не просто vitals.

---

## Release Process

### Для кожного релізу

1. **Feature freeze** — 2 тижні до релізу
2. **Testing phase** — всі тести повинні проходити
3. **Documentation** — README, CHANGELOG, migration guide
4. **Beta release** — `npm publish --tag beta`
5. **Community feedback** — 1 тиждень
6. **Stable release** — `npm publish`
7. **Announcement** — GitHub, Twitter, Svelte Discord

### Versioning

- **Patch** (0.1.x): Bug fixes, documentation
- **Minor** (0.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes (not planned until v1.0)

---

## Contributing

Якщо хочете допомогти з розробкою:

1. Перегляньте Issues з лейблом `help wanted`
2. Виберіть задачу з поточної версії
3. Створіть PR з тестами
4. Документація обов'язкова для нових API

### Priority Labels

- `critical` — блокує реліз
- `high` — важливо для релізу
- `medium` — бажано для релізу
- `low` — можна відкласти

---

## Revision History

| Дата | Версія | Зміни |
|------|--------|-------|
| 2026-01-20 | 1.0 | Початковий план |

---

*Цей документ оновлюється з кожним релізом.*

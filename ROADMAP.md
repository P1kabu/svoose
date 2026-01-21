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
| **Typed Metrics API** | Типізовані користувацькі метрики з autocomplete | ⬜ Todo |
| Custom Metrics API | Користувацькі метрики з batching | ⬜ Todo |
| **Sampling** | Відправляти лише % подій (production optimization) | ⬜ Todo |
| **Session Tracking** | Автоматичний sessionId для групування подій | ⬜ Todo |
| **User Identification** | Опціональний userId для аналітики | ⬜ Todo |
| Retry Logic | Exponential backoff для транспорту | ⬜ Todo |
| **sendBeacon Transport** | Надійна відправка при закритті сторінки | ⬜ Todo |
| Multiple Machine Context | Всі машини в error context | ⬜ Todo |
| Network Status Awareness | Pause/resume на offline | ⬜ Todo |
| Dead Letter Queue | Збереження failed events | ⬜ Todo |
| **Privacy Utilities** | PII scrubbing, data sanitization | ⬜ Todo |

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

// ✨ NEW: Typed Metrics API (повний autocomplete)
import { createTypedMetric } from 'svoose';

// Визначте всі ваші метрики з типами
type AppMetrics = {
  checkout_started: { step: number; cartTotal: number };
  feature_used: { name: string; enabled: boolean };
  search_performed: { query: string; resultsCount: number };
  error_boundary_hit: { componentName: string; error: string };
};

const metric = createTypedMetric<AppMetrics>();

metric('checkout_started', { step: 1, cartTotal: 99.99 }); // ✅ autocomplete працює
metric('checkout_started', { wrong: 'field' });            // ❌ TypeScript error
metric('unknown_metric', {});                               // ❌ TypeScript error

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

```typescript
// ✨ NEW: Sampling — критично для high-traffic сайтів
observe({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,

  sampling: {
    // Відправляти лише 10% vitals (економія bandwidth)
    vitals: 0.1,
    // Але всі помилки важливі!
    errors: 1.0,
    // Custom метрики — 50%
    custom: 0.5,
  },

  // Або простий варіант — однаковий % для всіх
  // sampling: 0.1, // 10% всіх подій
});
```

```typescript
// ✨ NEW: Session & User Tracking
observe({
  endpoint: '/api/metrics',

  // Автоматичний sessionId (генерується при завантаженні сторінки)
  session: true,

  // Або з кастомною конфігурацією
  session: {
    // Час неактивності до нової сесії (default: 30 хвилин)
    timeout: 30 * 60 * 1000,
    // Зберігати між вкладками
    crossTab: true,
    // Storage для sessionId
    storage: 'sessionStorage', // or 'localStorage' | 'memory'
  },

  // Опціональна ідентифікація користувача
  user: {
    id: 'user_123',           // Ваш user ID
    traits: {                 // Опціональні атрибути
      plan: 'premium',
      signupDate: '2024-01-15',
    },
  },
});

// Або динамічно встановити користувача пізніше
import { identify } from 'svoose';

identify({
  id: 'user_456',
  traits: { plan: 'free' },
});

// Скинути при logout
identify(null);
```

```typescript
// ✨ NEW: sendBeacon Transport — надійна відправка при закритті сторінки
import { createBeaconTransport } from 'svoose/transport';

observe({
  endpoint: '/api/metrics',

  // Автоматично використовує sendBeacon при unload
  transport: createBeaconTransport('/api/metrics', {
    // Fallback до fetch якщо beacon недоступний
    fallback: 'fetch',
    // Максимальний розмір payload (beacon має ліміт ~64KB)
    maxPayloadSize: 60000,
  }),
});

// Або комбінований транспорт
import { createHybridTransport } from 'svoose/transport';

observe({
  transport: createHybridTransport('/api/metrics', {
    // Використовувати fetch для звичайних подій
    default: 'fetch',
    // Але beacon для подій при закритті сторінки
    onUnload: 'beacon',
    // Retry конфігурація для fetch
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});
```

```typescript
// ✨ NEW: Privacy Utilities — GDPR/CCPA compliance
import { observe, configurePII } from 'svoose';

// Глобальна конфігурація PII scrubbing
configurePII({
  // Автоматично видаляти з URL
  scrubFromUrl: [
    'email',
    'token',
    'password',
    'api_key',
    /user_id=\d+/,  // Regex patterns
  ],

  // Маскувати в custom метриках
  maskFields: ['email', 'phone', 'creditCard'],

  // Кастомний sanitizer
  sanitize: (event) => {
    if (event.metadata?.email) {
      event.metadata.email = '[REDACTED]';
    }
    return event;
  },
});

observe({
  endpoint: '/api/metrics',
  vitals: true,

  // Privacy режим для конкретного observe
  privacy: {
    // Не відправляти повний URL (тільки pathname)
    stripQueryParams: true,
    // Не включати user-agent
    excludeUserAgent: true,
    // Хешувати IP на сервері
    hashIP: true,
  },
});
```

#### Технічні задачі

- [ ] Рефакторинг `observe.svelte.ts` для extensibility
- [ ] Додати `metric()` функцію в exports
- [ ] **Імплементувати `createTypedMetric<T>()` з generic типами**
- [ ] **Sampling engine з per-event-type конфігурацією**
- [ ] **Session manager (generation, timeout, cross-tab sync)**
- [ ] **User identification API (`identify()` function)**
- [ ] Імплементувати retry queue в transport
- [ ] **`createBeaconTransport()` з fallback логікою**
- [ ] **`createHybridTransport()` для fetch + beacon**
- [ ] Network status detection (navigator.onLine + events)
- [ ] LocalStorage adapter для offline events
- [ ] **PII scrubbing utilities (`configurePII()`)**
- [ ] **Privacy options в observe config**
- [ ] Оновити всі error contexts для multiple machines
- [ ] +50 нових тестів (sampling, session, privacy, beacon)
- [ ] Оновити README з новими API
- [ ] **Приклад: "Production Setup" guide**

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
| **Vite Plugin** | Автоматична інструментація load() без обгорток | ⬜ Todo |
| Server Hooks | handle(), handleError() | ⬜ Todo |
| Route Tracking | Автоматичний page view tracking | ⬜ Todo |
| **Soft Navigation Tracking** | SPA navigation з Core Web Vitals | ⬜ Todo |
| SSR Safety | Graceful server-side handling | ⬜ Todo |
| Load Function Tracking | Track load() performance | ⬜ Todo |
| **Attribution API** | Визначення джерела проблем (LCP element, CLS source) | ⬜ Todo |

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

```typescript
// ✨ NEW: Vite Plugin — Zero-config автоматична інструментація
// vite.config.ts
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svoosePlugin } from 'svoose/vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    svoosePlugin({
      // Автоматично обгортає всі load() функції
      autoInstrumentLoad: true,

      // Автоматично додає observe() в +layout.svelte
      autoInit: {
        endpoint: '/api/metrics',
        vitals: true,
        errors: true,
      },

      // Виключити певні роути з tracking
      exclude: ['/admin/*', '/internal/*'],

      // Включити source maps для error tracking
      sourceMaps: true,
    }),
  ],
});

// Тепер НЕ потрібно обгортати кожен load() вручну!
// +page.ts — звичайний код, svoose інструментує автоматично
export const load = async ({ fetch, params }) => {
  const data = await fetch(`/api/posts/${params.id}`);
  return { post: await data.json() };
};
```

```typescript
// ✨ NEW: Attribution API — зрозуміти ЧОМУ метрика погана
import { observe } from 'svoose/sveltekit';

observe({
  endpoint: '/api/metrics',
  vitals: {
    enabled: true,
    // Включити детальну атрибуцію
    attribution: true,
  },
});

// Тепер vitals включають attribution data:
// {
//   type: 'vital',
//   name: 'LCP',
//   value: 2500,
//   rating: 'needs-improvement',
//   attribution: {
//     element: 'img#hero-image',           // Який елемент викликав LCP
//     url: 'https://example.com/hero.jpg', // URL ресурсу
//     resourceLoadTime: 1200,              // Час завантаження
//     renderDelay: 300,                    // Затримка рендерингу
//   }
// }

// Для CLS:
// {
//   type: 'vital',
//   name: 'CLS',
//   value: 0.15,
//   attribution: {
//     largestShiftSource: 'div.ad-banner', // Елемент що зсунувся найбільше
//     largestShiftTime: 1500,              // Коли стався зсув
//     loadState: 'dom-content-loaded',     // Стан сторінки
//   }
// }

// Для INP:
// {
//   type: 'vital',
//   name: 'INP',
//   value: 350,
//   attribution: {
//     interactionTarget: 'button#submit',  // На що клікнули
//     interactionType: 'pointer',          // Тип взаємодії
//     inputDelay: 50,                      // Затримка до обробки
//     processingDuration: 200,             // Час обробки
//     presentationDelay: 100,              // Затримка відображення
//   }
// }
```

```typescript
// ✨ NEW: Soft Navigation Tracking — SPA navigation metrics
import { createClientHooks } from 'svoose/sveltekit';

export const { init } = createClientHooks({
  endpoint: '/api/metrics',

  navigation: {
    enabled: true,
    // Трекати soft navigations як окремі "page views"
    softNavigations: true,
    // Core Web Vitals для кожної soft navigation
    softNavVitals: ['LCP', 'CLS', 'INP'],
  },
});

// Результат: отримуєте Web Vitals не тільки для initial load,
// але й для кожного переходу між сторінками в SPA
```

#### Технічні задачі

- [ ] Створити `src/sveltekit/` директорію
- [ ] **Vite plugin (`svoose/vite`) з AST transformation**
- [ ] **Auto-instrumentation для load() функцій**
- [ ] Server hooks implementation
- [ ] Client hooks implementation
- [ ] Navigation tracking з `beforeNavigate`/`afterNavigate`
- [ ] **Soft navigation detection та metrics reset**
- [ ] `trackLoad()` wrapper (для manual usage)
- [ ] **Attribution API integration з web-vitals/attribution**
- [ ] SSR detection та graceful handling
- [ ] +30 нових тестів (потребує SvelteKit test setup)
- [ ] Документація: SvelteKit Quick Start guide
- [ ] **Документація: Vite Plugin configuration**
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

### 📋 v0.5.0 — Advanced FSM (Separate Entry Point)

**Статус**: Планується
**Пріоритет**: Середній
**Цільова дата**: Q4 2026

> ⚠️ **Архітектурне рішення**: Advanced FSM функції виносяться в окремий entry point
> `svoose/machine` щоб зберегти core bundle малим. Базовий `createMachine()` залишається
> в основному bundle (~0.8KB), а advanced features додають ~1KB окремо.

#### Нові функції

| Функція | Опис | Статус |
|---------|------|--------|
| `svoose/machine` entry | Окремий entry для advanced FSM | ⬜ Todo |
| `invoke()` | Async operations в станах | ⬜ Todo |
| `after()` | Delayed transitions | ⬜ Todo |
| `always()` | Transient transitions | ⬜ Todo |
| **`spawn()`** | Динамічне створення child machines | ⬜ Todo |
| Enhanced Types | Краща type inference | ⬜ Todo |

#### API Design

```typescript
// ✨ Окремий import для advanced features (tree-shakeable)
// Базовий createMachine залишається в 'svoose'
import { createMachine } from 'svoose';  // ~0.8KB — basic FSM

// Advanced features — окремий entry point
import { createAdvancedMachine } from 'svoose/machine';  // +~1KB

// Або selective imports для максимального tree-shaking
import { withInvoke, withAfter, withAlways } from 'svoose/machine';

const basicMachine = createMachine({ /* ... */ });  // Базовий — без invoke/after
const advancedMachine = createAdvancedMachine({ /* ... */ });  // Повний функціонал
```

```typescript
// invoke() - Async operations
const fetchMachine = createAdvancedMachine({
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
const notificationMachine = createAdvancedMachine({
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
const formMachine = createAdvancedMachine({
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

```typescript
// ✨ NEW: spawn() — динамічне створення child machines
const todoListMachine = createAdvancedMachine({
  id: 'todoList',
  initial: 'idle',
  context: {
    todos: [] as Array<{ id: string; ref: MachineRef }>,
  },
  states: {
    idle: {
      on: {
        ADD_TODO: {
          action: (ctx, event) => {
            // Створюємо child machine для кожного todo
            const todoRef = spawn(todoMachine, {
              id: `todo-${event.id}`,
              input: { text: event.text },
            });

            return {
              todos: [...ctx.todos, { id: event.id, ref: todoRef }],
            };
          },
        },
        REMOVE_TODO: {
          action: (ctx, event) => {
            const todo = ctx.todos.find((t) => t.id === event.id);
            if (todo) {
              // Зупиняємо child machine
              todo.ref.stop();
            }
            return {
              todos: ctx.todos.filter((t) => t.id !== event.id),
            };
          },
        },
      },
    },
  },
});

// Child machine
const todoMachine = createAdvancedMachine({
  id: 'todo',
  initial: 'active',
  context: { text: '', completed: false },
  states: {
    active: {
      on: { TOGGLE: 'completed' },
    },
    completed: {
      on: { TOGGLE: 'active' },
    },
  },
});
```

#### Технічні задачі

- [ ] **Створити `src/machine/` директорію для advanced features**
- [ ] **`createAdvancedMachine()` wrapper з plugins**
- [ ] `invoke()` implementation з Promise handling
- [ ] `after()` implementation з timer management
- [ ] `always()` implementation
- [ ] **`spawn()` implementation з lifecycle management**
- [ ] Cleanup timers on destroy
- [ ] Cancel invoke on exit
- [ ] **Stop spawned machines on parent destroy**
- [ ] Type inference для invoke events
- [ ] **Окремий package.json export для `svoose/machine`**
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

| Версія | Core Bundle | observe() | createMachine() | Додатково |
|--------|-------------|-----------|-----------------|-----------|
| v0.1.x | ~3.0 KB | ~2.1 KB | ~0.8 KB | — |
| v0.2.0 | ~3.5 KB | ~2.5 KB | ~0.8 KB | +transport: ~0.5KB |
| v0.3.0 | ~3.5 KB | ~2.5 KB | ~0.8 KB | +sveltekit: ~1.2KB, +vite: ~0.8KB |
| v0.4.0 | ~4.0 KB | ~2.5 KB | ~1.0 KB | +devtools: ~1.5KB |
| v0.5.0 | ~4.0 KB | ~2.5 KB | ~0.8 KB | +machine: ~1.2KB (advanced FSM) |

### Entry Points Summary (v0.5.0+)

| Entry Point | Розмір | Що включає |
|-------------|--------|------------|
| `svoose` | ~4.0 KB | Core: observe(), createMachine(), useMachine() |
| `svoose/transport` | ~0.5 KB | Retry, beacon, hybrid transports |
| `svoose/sveltekit` | ~1.2 KB | Server/client hooks, navigation |
| `svoose/vite` | ~0.8 KB | Vite plugin для auto-instrumentation |
| `svoose/machine` | ~1.2 KB | Advanced FSM: invoke, after, always, spawn |
| `svoose/devtools` | ~1.5 KB | Chrome extension connector |

> 💡 **Tree-shaking**: Всі entry points tree-shakeable. Імпортуйте тільки те, що потрібно.

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
| 2026-01-21 | 1.1 | **Розширений v0.2.0**: Typed Metrics API, Sampling, Session/User tracking, sendBeacon transport, Privacy utilities |
| | | **Розширений v0.3.0**: Vite plugin auto-instrumentation, Attribution API, Soft Navigation tracking |
| | | **Оновлений v0.5.0**: Окремий entry point `svoose/machine` для advanced FSM, spawn() |
| | | **Нова структура**: Entry Points Summary таблиця, оновлені bundle size targets |

---

*Цей документ оновлюється з кожним релізом.*

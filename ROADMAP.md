# svoose Roadmap

> Стратегія: **"Глибока Ніша"** — стати найкращим Svelte 5 observability рішенням

## Філософія Розвитку

1. **Svelte-first** — кожна функція оптимізована для Svelte 5 екосистеми
2. **Lightweight** — bundle size < 5KB залишається пріоритетом
3. **Zero dependencies** — ніяких runtime залежностей
4. **Observability focus** — FSM як легке доповнення, не конкурент XState
5. **Production-ready** — кожен реліз готовий до production
6. **Incremental delivery** — малі, часті релізи замість великих
7. **Framework-agnostic core** — core працює без Svelte, адаптери окремо
8. **Stay focused** — краще робити менше, але добре
9. **Docs-first releases** — README оновлюється з кожним релізом

---

## Documentation Strategy

### Принципи

1. **README = Single Source of Truth** — вся актуальна документація в README.md
2. **One feature = One example** — кожна нова фіча має мінімальний приклад
3. **Progressive complexity** — Quick Start → Basic → Advanced
4. **Copy-paste friendly** — приклади готові до використання

### README Structure

```
README.md
├── Quick Start (3 рядки коду)
├── Features (список)
├── Installation
├── API Reference
│   ├── observe()
│   │   ├── Basic
│   │   ├── Sampling (v0.1.3+)
│   │   ├── Sessions (v0.1.4+)
│   │   ├── Privacy (v0.1.9+)
│   │   └── Full Production Setup (v0.2.0+)
│   ├── Metrics (v0.1.5+)
│   │   ├── metric()
│   │   ├── counter(), gauge(), histogram() (v0.1.6+)
│   │   └── createTypedMetric() (v0.1.6+)
│   ├── Transport (v0.1.7+)
│   │   ├── Retry
│   │   ├── Beacon (v0.1.8+)
│   │   └── Hybrid (v0.1.8+)
│   ├── User Identification (v0.2.0+)
│   └── createMachine()
├── Svelte 5 Usage
├── Bundle Size
├── TypeScript
├── Roadmap (коротко)
└── License
```

### Release Checklist (Documentation)

Кожен реліз повинен включати:

- [ ] README.md оновлено з новим API
- [ ] Один простий приклад для кожної нової функції
- [ ] Bundle size table оновлено
- [ ] Roadmap section актуальний

---

## Продуктова Стратегія

### Один продукт — observability toolkit

```
svoose → "Svelte 5 observability toolkit"
         Web Vitals, errors, custom metrics, session tracking
         + lightweight state helper з auto-telemetry (bonus)
```

**FSM як bonus**: `createMachine()` / `useMachine()` — це lightweight helper для простих UI станів (loading, error, success). Не альтернатива XState. Для складних state machines — використовуйте XState.

### Конкурентне позиціонування

| Сегмент | Конкуренти | Перевага svoose |
|---------|------------|-----------------|
| Observability | Vercel Analytics, PostHog | Open source, self-hosted, Svelte-native |
| Web Vitals | web-vitals | Batching, transports, error context |

> **Note**: FSM не є сегментом конкуренції. Для advanced FSM — XState. svoose FSM = lightweight bonus.

### Ризики та страховки

| Ризик | Страховка |
|-------|-----------|
| Svelte ринок замалий | Core framework-agnostic, можна додати React adapter |
| Хтось займе нішу раніше | Пріоритет SvelteKit integration (v0.3.0) |
| Maintenance burden | Мінімальний API surface, автоматизовані тести |

---

## Версії

### ✅ v0.1.x — Foundation (Поточна)

**Статус**: Завершено

- [x] Web Vitals (CLS, LCP, FID, INP, FCP, TTFB)
- [x] Error tracking (global errors + unhandled rejections)
- [x] Lightweight state helper з TypeScript inference (bonus)
- [x] `useMachine()` hook для Svelte 5 (bonus)
- [x] Batching та sampling
- [x] Fetch/Console транспорти
- [x] 90 тестів

**Bundle**: ~3.0 KB gzipped

---

### ✅ v0.1.3 — Sampling

**Статус**: Випущено (з багом)
**Дата релізу**: Січень 2026

| Функція | Опис |
|---------|------|
| **Sampling** | Per-event-type rate limiting (vitals: 10%, errors: 100%) |

**Bundle**: 3.1 KB (+0.1 KB)

> ⚠️ **Відомий баг**: `sampling.js` не включений в npm пакет. Виправлено в v0.1.4.

---

### ✅ v0.1.4 — Hotfix: Missing sampling.js

**Статус**: Випущено
**Дата релізу**: 24 Січня 2026

| Функція | Опис |
|---------|------|
| **Bugfix** | Виправлено відсутній `sampling.js` в npm пакеті |

**Причина**: `src/observe/sampling.ts` не був включений в esbuild entryPoints в `scripts/build.js`.

---

### 📋 v0.1.5 — Session Tracking + Vitals Filter

**Статус**: Планується
**Пріоритет**: Critical
**Цільова дата**: Лютий 2026, Week 2

| Функція | Опис |
|---------|------|
| **Session Tracking** | Автоматичний sessionId з timeout |
| **vitalsFilter** | Callback для фільтрації Web Vitals (CLS noise від анімацій) |

**Bundle**: 3.2 KB (+0.1 KB)

**📝 README Update**:
- Додати в `observe()` секцію "Sessions"
- Додати в `observe()` секцію "Filtering Vitals"
- Приклад Session:
```typescript
observe({
  endpoint: '/api/metrics',
  session: {
    timeout: 30 * 60 * 1000,  // 30 min = new session
    storage: 'sessionStorage',
  },
});
// All events now include sessionId
```

- Приклад vitalsFilter (CLS noise filtering):
```typescript
observe({
  endpoint: '/api/metrics',
  vitals: true,
  vitalsFilter: (vital) => {
    // Ігнорувати мікро-CLS від CSS анімацій (< 0.01)
    if (vital.name === 'CLS' && vital.delta < 0.01) return false;
    return true;
  },
});
```

> **Чому потрібно?** CSS анімації (акордеони, модалки) генерують багато мікро-CLS подій з delta < 0.01.
> Поріг 0.01 — в 10 разів менше за Google "good" (< 0.1), надійно ловить реальні проблеми верстки.

---

### 📋 v0.1.6 — Basic Custom Metrics

**Статус**: Планується
**Пріоритет**: Critical
**Цільова дата**: Лютий 2026, Week 3

| Функція | Опис |
|---------|------|
| **metric()** | Базова функція для custom events |
| **Dev warnings** | Попередження якщо observe() не викликано |

**Bundle**: 3.25 KB (+0.05 KB)

**📝 README Update**:
- Додати нову секцію "### Custom Metrics"
- Приклад:
```typescript
import { observe, metric } from 'svoose';

observe({ endpoint: '/api/metrics' });

metric('checkout_started', { step: 1, cartTotal: 99.99 });
metric('feature_used', { name: 'dark_mode' });
```

---

### 📋 v0.1.7 — Extended Metrics + Typed API

**Статус**: Планується
**Пріоритет**: Critical
**Цільова дата**: Лютий 2026, Week 4

| Функція | Опис |
|---------|------|
| **counter()** | Інкременти (api_calls, button_clicks) |
| **gauge()** | Абсолютні значення (active_users, queue_size) |
| **histogram()** | Розподіли (response_time, payload_size) |
| **createTypedMetric<T>()** | TypeScript autocomplete для метрик |

**Bundle**: 3.4 KB (+0.15 KB)

**📝 README Update**:
- Розширити секцію "Custom Metrics"
- Приклад:
```typescript
import { counter, gauge, histogram, createTypedMetric } from 'svoose';

counter('api_calls', { endpoint: '/users' });
gauge('active_users', 42);
histogram('response_time', 234);

// Typed metrics (full autocomplete)
type AppMetrics = {
  checkout: { step: number; total: number };
};
const track = createTypedMetric<AppMetrics>();
track('checkout', { step: 1, total: 99 }); // ✅ autocomplete
```

---

### 📋 v0.1.8 — Retry Logic

**Статус**: Планується
**Пріоритет**: High
**Цільова дата**: Березень 2026, Week 1

| Функція | Опис |
|---------|------|
| **Retry Logic** | Exponential backoff (3 attempts, 1s → 30s) |
| **Backoff Strategies** | fixed, linear, exponential |
| **Jitter** | ±10% randomization для уникнення thundering herd |
| **Timeout** | AbortController timeout для fetch |

**Bundle**: 3.55 KB (+0.15 KB)

**📝 README Update**:
- Додати секцію "### Transport Options" → "Retry"
- Приклад:
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
```

---

### 📋 v0.1.9 — Beacon + Hybrid Transport

**Статус**: Планується
**Пріоритет**: High
**Цільова дата**: Березень 2026, Week 2

| Функція | Опис |
|---------|------|
| **sendBeacon Transport** | Надійна відправка при закритті сторінки |
| **Payload Chunking** | Auto-split для payloads > 60KB |
| **Hybrid Transport** | fetch + beacon auto-switch on unload |

**Bundle**: 3.7 KB (+0.15 KB)

**📝 README Update**:
- Розширити "Transport Options" → "Beacon & Hybrid"
- Приклад:
```typescript
import { createHybridTransport } from 'svoose/transport';

// Recommended for production
observe({
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',  // reliable on page close
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});
```

---

### 📋 v0.1.10 — Privacy Utilities

**Статус**: Планується
**Пріоритет**: High
**Цільова дата**: Березень 2026, Week 3

| Функція | Опис |
|---------|------|
| **URL Scrubbing** | Видалення токенів з URL (strings + regex) |
| **Field Masking** | Маскування PII (показ останніх 4 символів) |
| **Custom Sanitizer** | Кастомна санітизація events |
| **Privacy Options** | stripQueryParams, stripHash, excludeUserAgent |

**Bundle**: 3.85 KB (+0.15 KB)

**📝 README Update**:
- Додати нову секцію "### Privacy"
- Disclaimer: "Privacy-focused utilities, not legal compliance guarantees"
- Приклад:
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

### 🚧 v0.2.0 — Production-Ready Observability ⭐

**Статус**: В розробці
**Пріоритет**: Critical
**Цільова дата**: Березень 2026, Week 4

> 📋 Детальний план: [.claude/v0.2.0-plan.md](.claude/v0.2.0-plan.md)
>
> **Major release**: Повний production-ready observability stack

| Функція | Опис |
|---------|------|
| **Network Detection** | Pause/resume на offline/online |
| **Offline Queue** | localStorage queue з FIFO eviction |
| **User Identification** | `identify()` для аналітики |
| **Multiple Machine Context** | Всі активні машини в error events |

**Bundle**: 4.1 KB (+0.25 KB)

**📝 README Update** (Major):
- Додати секцію "### User Identification"
- Додати секцію "### Network Resilience"
- Додати "## Production Setup" з повним прикладом
- Оновити Bundle Size table
- Приклад identify():
```typescript
import { observe, identify } from 'svoose';

observe({ endpoint: '/api/metrics', networkAware: true });

// After login
identify({ id: 'user_123', traits: { plan: 'premium' } });

// After logout
identify(null);
```
- Приклад Production Setup:
```typescript
import { observe, configurePII, identify } from 'svoose';
import { createHybridTransport } from 'svoose/transport';

configurePII({ scrubFromUrl: ['token'], maskFields: ['email'] });

observe({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,
  sampling: { vitals: 0.1, errors: 1.0 },
  session: { timeout: 30 * 60 * 1000 },
  networkAware: true,
  offlineStorage: 'localStorage',
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});
```

**Milestone Summary (v0.1.3 → v0.2.0)**:
- ✅ Sampling (per-event-type)
- ✅ Session Tracking (timeout, storage options)
- ✅ Custom Metrics (metric, counter, gauge, histogram)
- ✅ Typed Metrics (createTypedMetric<T>)
- ✅ Retry + Beacon Transport
- ✅ Privacy Utilities
- ✅ Network Awareness + Offline Queue
- ✅ User Identification

---

### 🎯 v0.3.0 — SvelteKit Integration (ПРІОРИТЕТ)

**Статус**: Планується
**Пріоритет**: **КРИТИЧНИЙ** — ключова конкурентна перевага
**Цільова дата**: Травень-Червень 2026 (8 тижнів)

> **Чому пріоритет?** SvelteKit — де 80% Svelte розробників. Zero-config integration = adoption.

#### Нові функції

| Функція | Опис | Пріоритет |
|---------|------|-----------|
| `svoose/sveltekit` entry | Server/client hooks | Critical |
| **Vite Plugin** | Auto-instrumentation для load() | Critical |
| Route Tracking | Автоматичний page view tracking | Critical |
| SSR Safety | Graceful server-side handling | Critical |
| **Soft Navigation** | SPA navigation metrics | High |
| **Attribution API** | LCP element, CLS source identification | Medium |

#### API Design

```typescript
// vite.config.ts — Zero-config auto-instrumentation
import { svoosePlugin } from 'svoose/vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    svoosePlugin({
      autoInstrumentLoad: true,
      autoInit: {
        endpoint: '/api/metrics',
        vitals: true,
      },
    }),
  ],
});
```

```typescript
// hooks.server.ts
import { createSvooseHooks } from 'svoose/sveltekit';

const svoose = createSvooseHooks({
  endpoint: '/api/metrics',
  serverErrors: true,
  requestTiming: true,
});

export const handle = svoose.handle;
export const handleError = svoose.handleError;
```

```typescript
// hooks.client.ts — автоматична ініціалізація
import { initSvoose } from 'svoose/sveltekit';

initSvoose({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,
  routeTracking: true,  // auto page views
});
```

```typescript
// Attribution API — зрозуміти ЧОМУ метрика погана
// Окремий import: svoose/attribution (+1.5KB)
import { observe } from 'svoose';
import { withAttribution } from 'svoose/attribution';

observe(withAttribution({
  endpoint: '/api/metrics',
  vitals: true,
}));

// Result:
// {
//   type: 'vital',
//   name: 'LCP',
//   value: 2500,
//   attribution: {
//     element: 'img#hero-image',
//     url: 'https://example.com/hero.jpg',
//     resourceLoadTime: 1200,
//   }
// }
```

#### Технічні ризики

| Ризик | Mitigation |
|-------|------------|
| Vite plugin AST transformation | **Primary**: manual `trackLoad()` wrapper; plugin як opt-in |
| Attribution API bundle size | Окремий entry point `svoose/attribution` (+1.5KB) |
| Soft Navigation API experimental | Feature detection + graceful degradation |

**Bundle**: +1.5 KB для sveltekit entry

---

### 📋 v0.4.0 — Developer Experience

**Статус**: Планується
**Пріоритет**: Середній
**Цільова дата**: Q3-Q4 2026

| Функція | Опис | Пріоритет |
|---------|------|-----------|
| **CLI Tool** | `npx svoose check` — валідація конфігу | High |
| **Dashboard Template** | Grafana/простий HTML dashboard | High |

> ⚠️ **Scope обмежений свідомо**. FSM visualization, devtools extensions — це XState territory. Ми фокусуємося на observability.

---

### 🔮 v1.0.0 — Stable Release

**Статус**: Планується
**Цільова дата**: Q1 2027

**Критерії для v1.0:**
- [ ] 6+ місяців без breaking changes
- [ ] 1000+ weekly npm downloads
- [ ] Production use cases documented
- [ ] Full SvelteKit integration
- [ ] Community contributions

---

## Bundle Size Targets

| Версія | Core | Transport | SvelteKit | Attribution |
|--------|------|-----------|-----------|-------------|
| v0.1.2 | 3.0 KB | — | — | — |
| v0.1.3 | 3.1 KB | — | — | — |
| v0.1.4 | 3.1 KB | — | — | — | (hotfix)
| v0.1.5 | 3.2 KB | — | — | — |
| v0.1.6 | 3.25 KB | — | — | — |
| v0.1.7 | 3.4 KB | — | — | — |
| v0.1.8 | 3.55 KB | — | — | — |
| v0.1.9 | 3.7 KB | — | — | — |
| v0.1.10 | 3.85 KB | — | — | — |
| **v0.2.0** | **4.1 KB** | — | — | — |
| v0.3.0 | 4.1 KB | — | +1.5 KB | +1.5 KB |

> Tree-shaking дозволяє імпортувати тільки потрібне. Реальний bundle залежить від використаних features.

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

## API Examples (v0.2.0)

```typescript
// Sampling (v0.1.3)
observe({
  endpoint: '/api/metrics',
  sampling: {
    vitals: 0.1,      // 10% Web Vitals
    errors: 1.0,      // 100% помилок
    custom: 0.5,      // 50% custom метрик
    transitions: 0.0, // state helper transitions disabled
  },
});
```

```typescript
// Session Tracking (v0.1.4)
observe({
  endpoint: '/api/metrics',
  session: {
    timeout: 30 * 60 * 1000,  // 30 хв = нова сесія
    storage: 'sessionStorage',
  },
});
```

```typescript
// Custom Metrics (v0.1.5 - v0.1.6)
import { observe, metric, counter, gauge, histogram, createTypedMetric } from 'svoose';

observe({ endpoint: '/api/metrics', vitals: true, errors: true });

// Basic metric (v0.1.5)
metric('checkout_started', { step: 1, cartTotal: 99.99 });

// Extended metrics (v0.1.6)
counter('api_calls', { endpoint: '/users' });
gauge('active_users', 42);
histogram('response_time', 234);

// Typed Metrics (v0.1.6 - повний autocomplete)
type AppMetrics = {
  checkout_started: { step: number; cartTotal: number };
  feature_used: { name: string; enabled: boolean };
};

const track = createTypedMetric<AppMetrics>();
track('checkout_started', { step: 1, cartTotal: 99.99 }); // ✅ autocomplete
track('checkout_started', { wrong: 'field' });            // ❌ TS error
```

```typescript
// Retry + Beacon Transport (v0.1.7 - v0.1.8)
import { createHybridTransport } from 'svoose/transport';

observe({
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});
```

```typescript
// Privacy Utilities (v0.1.9)
import { observe, configurePII } from 'svoose';

configurePII({
  scrubFromUrl: ['token', 'api_key', 'email'],
  maskFields: ['email', 'phone'],
});
```

```typescript
// Full Production Setup (v0.2.0)
import { observe, configurePII, identify } from 'svoose';
import { createHybridTransport } from 'svoose/transport';

configurePII({
  scrubFromUrl: ['token', 'api_key'],
  maskFields: ['email', 'phone'],
});

observe({
  endpoint: '/api/metrics',
  vitals: true,
  errors: true,
  sampling: { vitals: 0.1, errors: 1.0, custom: 0.5 },
  session: { timeout: 30 * 60 * 1000, storage: 'sessionStorage' },
  networkAware: true,
  offlineStorage: 'localStorage',
  maxOfflineEvents: 1000,
  transport: createHybridTransport('/api/metrics', {
    default: 'fetch',
    onUnload: 'beacon',
    retry: { attempts: 3, backoff: 'exponential' },
  }),
});

// User identification
identify({ id: 'user_123', traits: { plan: 'premium' } });
identify(null); // logout
```

---

## Competitor Positioning

### svoose + XState = Complementary Tools

| Потреба | Рішення |
|---------|---------|
| **Observability** (vitals, errors, metrics) | svoose ✅ |
| **Simple UI states** (loading → success → error) | svoose FSM ✅ |
| **Complex state machines** (invoke, spawn, parallel) | XState ✅ |
| **Both observability + complex FSM** | svoose + XState разом |

> **Філософія**: svoose FSM — це "Svelte $state() з transitions". Для серйозних state machines — XState. Ми не конкуруємо, ми доповнюємо.

### vs web-vitals

| Feature | svoose | web-vitals |
|---------|--------|------------|
| Web Vitals | ✅ | ✅ |
| Batching | ✅ | Manual |
| Error tracking | ✅ | — |
| Custom metrics | v0.2 | Manual |
| SvelteKit integration | v0.3 | — |

**Стратегія**: Інтегроване рішення для Svelte, не просто vitals wrapper.

### vs Vercel Analytics / PostHog

| Feature | svoose | Vercel Analytics | PostHog |
|---------|--------|------------------|---------|
| Open source | ✅ | ❌ | ✅ |
| Self-hosted | ✅ | ❌ | ✅ |
| Svelte-native | ✅ | ❌ | ❌ |
| Bundle size | 4KB | ~5KB | ~30KB+ |
| Free tier | ∞ | Limited | Limited |
| Setup complexity | Low | Zero | Medium |

**Стратегія**: Open source альтернатива з Svelte-first DX.

---

## Release Process

1. **Feature development** — 2-week sprints
2. **Testing phase** — all tests pass, coverage > 80%
3. **Beta release** — `npm publish --tag beta`
4. **Feedback period** — 1 week minimum
5. **Stable release** — `npm publish`
6. **Announcement** — GitHub, Svelte Discord

### Versioning

- **Patch** (0.x.y): Bug fixes, docs
- **Minor** (0.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes (not before v1.0)

---

## Contributing

1. Перегляньте Issues з лейблом `help wanted`
2. Виберіть задачу з поточної версії
3. Створіть PR з тестами
4. Документація обов'язкова для нових API

---

## Timeline Overview

```
2026
├── Jan          v0.1.2 ✅
├── Jan          v0.1.3 ✅ — Sampling (з багом)
├── Jan 24       v0.1.4 ✅ — Hotfix: sampling.js (current)
│
├── Feb Week 2   v0.1.5 — Session Tracking + Vitals Filter
├── Feb Week 3   v0.1.6 — Basic Custom Metrics
├── Feb Week 4   v0.1.7 — Extended Metrics + Typed API
│
├── Mar Week 1   v0.1.8 — Retry Logic
├── Mar Week 2   v0.1.9 — Beacon + Hybrid Transport
├── Mar Week 3   v0.1.10 — Privacy Utilities
├── Mar Week 4   v0.2.0 — Production-Ready Observability ⭐ (major)
│
├── May-Jun      v0.3.0 — SvelteKit Integration ⭐⭐
│
├── Q3-Q4        v0.4.0 — DX (CLI, Dashboard)
│
2027
└── Q1-Q2        v1.0.0 — Stable Release 🎉
```

---

## Revision History

| Дата | Версія | Зміни |
|------|--------|-------|
| 2026-01-20 | 1.0 | Початковий план |
| 2026-01-21 | 1.1 | Розширений v0.2.0, v0.3.0 |
| 2026-01-22 | 2.0 | Major revision: реалістичні targets, risk mitigations |
| 2026-01-22 | 3.0 | Restructure: v0.2.0 split → v0.2.0/v0.2.1/v0.2.2, продуктова стратегія |
| 2026-01-22 | 4.0 | Incremental releases: v0.1.3-v0.2.4 patch releases, 2-тижневі sprints |
| 2026-01-22 | 5.0 | Weekly releases: v0.1.3→v0.2.0, removed v0.5.0 Advanced FSM |
| 2026-01-22 | 6.0 | **FSM positioning**: FSM як "lightweight state helper (bonus)", не окремий продукт. XState = complementary tool, не конкурент |
| 2026-01-24 | 7.0 | **v0.1.4 hotfix**: виправлено missing sampling.js; **vitalsFilter** додано в v0.1.5 для CLS noise filtering |

---

*Цей документ оновлюється з кожним релізом.*

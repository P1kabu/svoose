# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-01-17

### Added

- **Observability**
  - `observe()` — main function to start collecting metrics
  - Web Vitals collection (CLS, LCP, FID, INP, FCP, TTFB) without external dependencies
  - Error tracking (global errors + unhandled promise rejections)
  - Automatic batching and flush on page visibility change
  - Sampling rate support

- **State Machines**
  - `createMachine()` — create finite state machines
  - Guards — conditional transitions
  - Actions — update context on transitions
  - Entry/Exit actions — run on state enter/exit
  - `matches()` / `matchesAny()` — check current state
  - `can()` — check if event is valid
  - Full TypeScript inference

- **Transport**
  - `createFetchTransport()` — fetch with sendBeacon fallback
  - `createConsoleTransport()` — console logging for development

- **Integration**
  - Machine context in error reports (machineId, machineState)
  - Transition events sent to observe()

### Technical

- Zero external dependencies
- Tree-shakeable ESM build
- ~2.9KB gzipped (full bundle)
- 33 tests passing

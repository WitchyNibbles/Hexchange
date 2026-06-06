# Intake Brief — Backlog: Strategy & Research, Monitoring & Alerting, Infrastructure
**Date:** 2026-06-06
**Run:** backlog-strategy-monitoring-infra-2026-06-06
**Type:** Feature implementation / backlog delivery

---

## Goal

Implement the scoped backlog items across three categories so the domain model stubs (slippageBps, paperDriftPct, regime) become live-computed values, the operator gets real monitoring signals, and the server has structured logging.

## Operating Assumptions

- "Research and start" means implement all tractable items, design-and-defer the large ones.
- SQLite migration explicitly gates on "multi-process pressure" — **deferred**.
- Portfolio optimizer and walk-forward UI require design review — **deferred to next session**.
- Domain model already has placeholder fields (`slippageBps`, `paperDriftPct`, `regime`) — they are currently hardcoded in strategy-registry.ts.

---

## Delivery Plan

### Infrastructure
1. **Structured logging** (`src/server/utils/logger.ts`) — zero-dep JSON logger; replace console.log in server hot paths; add request middleware in app.ts.

### Strategy & Research
2. **Slippage model** (`src/server/market/slippage-model.ts`) — half-spread + simplified market impact; replace crude 0.1% markup in `executePaperOrder`; track actual `slippageBps` per strategy.
3. **Regime classifier** (`src/server/strategies/regime-classifier.ts`) — rule-based trend/ranging/volatile detection from candles; make `SignalExplanation.regime` dynamic.

### Monitoring & Alerting
4. **Drift report service** (`src/server/monitoring/drift-report-service.ts`) — compute `paperDriftPct` from actual paper trades vs backtest expected return; update StrategyState on each fill.
5. **Anomaly detector** (`src/server/monitoring/anomaly-detector.ts`) — detect P&L anomaly, slippage spike, risk proximity; emit events.
6. **Execution metrics** (`src/server/monitoring/execution-metrics-service.ts`) — track fills, slippage, rejection rate; expose via `/api/monitoring/execution-metrics`.

### Deferred
- Walk-forward rolling-window validation UI
- Portfolio-level optimizer
- SQLite migration

---

## Success Criteria

1. `slippageBps` in strategy validation reflects actual computed slippage, not hardcoded 12/18.
2. `paperDriftPct` in strategy validation reflects actual paper-vs-backtest deviation, not hardcoded 2.3/3.4.
3. `regime` in `SignalExplanation` is computed from candles, not a hardcoded string.
4. Server hot paths use structured JSON logs, no raw console.log.
5. Anomaly events appear in the ritual log when thresholds are crossed.
6. `/api/monitoring/execution-metrics` returns live fill statistics.
7. All new modules have unit tests; `npm test` passes.

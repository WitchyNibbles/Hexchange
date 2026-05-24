# Hexchange Nautilus Migration Design

> Date: 2026-05-24
> Scope: migrate the execution engine from the stubbed LEAN boundary to a local-first NautilusTrader runtime with Interactive Brokers for stocks and Kraken for crypto

## Summary

Hexchange should stop pretending the current LEAN boundary is a real engine. The platform now needs a self-hosted execution core that can run locally, support realistic research and live execution flows, and fit a single-operator setup without depending on QuantConnect's paid CLI path.

The approved direction is:

- Hexchange remains the local operator console and risk-control layer
- NautilusTrader becomes the execution engine
- Interactive Brokers becomes the primary stock venue
- Kraken becomes the primary crypto venue
- the UI and API contracts stay as stable as possible during the migration

## Why This Change

### Problems with the current engine path

- the current `LeanAdapter` is a stub, not a real engine
- the easiest official LEAN local workflow depends on QuantConnect's paid CLI path
- Alpaca no longer fits the desired long-term architecture
- the platform needs a truly local-first engine that can support live venue adapters directly

### Why NautilusTrader

- open-source and local-first
- designed for backtesting, simulation, and live execution in one system
- official integrations for Interactive Brokers and Kraken
- better alignment with a self-hosted workstation than a hosted or paid workflow controller

## Product Impact

The operator experience should not materially change. Hexchange should still feel like the same magical observatory:

- dashboard still shows current activity, profit, drawdown, exposure, and warnings
- strategies still move through validation states
- audit logs still explain signals, orders, fills, and halts in plain language
- kill-switch and risk controls still remain authoritative

The major change is behind the scenes: execution authority moves from a fake TypeScript adapter to a Python-driven Nautilus runtime.

## Architectural Direction

## 1. Hexchange stays the control plane

Hexchange continues to own:

- operator UI
- local API server
- persistent runtime state
- event and explanation log
- strategy catalog and lifecycle state
- promotion gates
- risk settings and kill-switch policy

Hexchange should not become the engine itself. It should orchestrate and supervise a separate execution subsystem.

## 2. Nautilus becomes the execution plane

NautilusTrader should own:

- historical backtests
- deterministic simulation runs
- market data subscriptions
- live order routing
- fill and position reconciliation
- venue-specific client behavior

Hexchange should invoke Nautilus through a local runtime boundary and ingest normalized artifacts, status, and event streams.

## 3. Venue split

### Stocks

- Interactive Brokers

### Crypto

- Kraken

This keeps both markets under one engine while avoiding the split-brain design of separate broker stacks.

## Runtime Model

The new engine runtime should be a local Python workspace inside the repo, versioned alongside the app:

- `engine/nautilus/` for Python package code and runner entry points
- `engine/nautilus/config/` for environment-driven venue configs
- `engine/nautilus/strategies/` for first migration strategy definitions
- `engine/nautilus/runs/` for local output artifacts and execution state

Hexchange's Node service should use a `NautilusAdapter` that:

- spawns Python runner commands for backtests
- starts and stops long-lived paper or live sessions
- reads structured JSON artifacts back from the engine runtime
- normalizes venue-native orders, fills, and positions to app-level types

## API and Contract Stability

The existing app contracts should change as little as possible.

Stable contracts to preserve:

- `GET /api/engine/status`
- `POST /api/strategies/:strategyId/backtest`
- `POST /api/strategies/:strategyId/paper-session`
- strategy summaries with `lastBacktest`
- portfolio and trades endpoints

Necessary contract extensions:

- engine status should expose `mode: "simulated" | "nautilus"`
- engine status should include runtime health and venue connectivity
- paper session payloads should include external runtime identifiers
- trade and event logs should capture originating venue and Nautilus run metadata

## Configuration Model

LEAN-specific configuration should be retired in favor of Nautilus-specific env vars.

New configuration groups:

- runtime paths
  - `HEXCHANGE_ENGINE_MODE=nautilus`
  - `HEXCHANGE_NAUTILUS_PYTHON`
  - `HEXCHANGE_NAUTILUS_PROJECT_DIR`
  - `HEXCHANGE_NAUTILUS_RUNS_DIR`
- Interactive Brokers
  - host, port, client id, account id
- Kraken
  - API key, secret, account mode, product scopes

Alpaca should be treated as deprecated for the primary execution path.

## Strategy Migration

The reference strategies should be moved from app-side placeholder logic into engine-side strategy definitions.

Phase 1 strategy scope:

- one stock momentum strategy on Interactive Brokers
- one crypto breakout strategy on Kraken

The Hexchange UI can still display strategy metadata and explanations from the app layer, but execution evidence should originate from Nautilus runs.

## Data and Artifact Flow

### Backtests

1. operator requests a backtest from Hexchange
2. `NautilusAdapter` launches a local Python backtest runner
3. runner writes a structured JSON result artifact
4. Hexchange parses it into `BacktestResult`
5. Hexchange persists the result and emits an audit event

### Paper or simulation sessions

1. operator starts a session from the UI
2. Hexchange performs local policy checks
3. `NautilusAdapter` starts a managed runner process
4. runtime identifiers are stored in local state
5. orders, fills, and positions are periodically reconciled into Hexchange
6. audit events are appended with operator-readable explanations

## Risk Ownership

Hexchange remains the final policy authority even if Nautilus is doing execution work.

Policy should stay in Hexchange for:

- kill switch
- max position notional
- max daily loss
- live rollout cap
- promotion gates
- operator arming requirements

Nautilus can enforce venue and order-level constraints, but Hexchange remains the product-level supervisor.

## Testing Strategy

The migration should preserve trust through layered tests:

- unit tests for the new adapter and result translation
- fixture-based tests for backtest artifact parsing
- service tests for engine mode and session lifecycle
- UI tests for engine status and venue visibility
- smoke tests that launch the local Python runtime in simulated mode

Live venue integration should remain opt-in and credential-gated.

## Risks and Mitigations

### Python runtime complexity

Risk:
- adds a second language and toolchain

Mitigation:
- keep the Python workspace narrow and engine-focused
- make the Node side invoke a few stable entry points only

### Venue setup complexity

Risk:
- Interactive Brokers and Kraken both require operational setup and credential hygiene

Mitigation:
- build env validation early
- keep simulation mode available even when live credentials are absent

### Contract drift

Risk:
- engine outputs may not match app expectations

Mitigation:
- use artifact fixtures and explicit translation tests
- preserve normalized app-level types at the boundary

## Done Criteria

The migration is complete when:

- Hexchange no longer depends on the LEAN boundary
- `EngineStatus` reports a real Nautilus runtime mode
- backtests run through a local Nautilus runner and return structured results
- paper or simulated sessions can be started and tracked through Nautilus
- Interactive Brokers and Kraken configuration exists behind env-gated adapters
- existing operator views still show transparent status, trades, and explanations

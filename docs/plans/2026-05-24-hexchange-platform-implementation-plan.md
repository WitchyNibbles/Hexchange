# Hexchange Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first trading workstation that validates and executes stock and crypto strategies with transparent paper-trading and tightly guarded live-trading controls.

**Architecture:** Use a custom local operator console and orchestration layer around a proven strategy/execution core. Start with a single connector path that supports both stocks and crypto, then add richer venue coverage only after the paper-validation loop is trustworthy.

**Tech Stack:** TypeScript, local web app, Node services, LEAN adapter boundary, Alpaca integration, SQLite or Postgres for local state, event-driven audit log, market data connectors

---

## Delivery Order

1. Product skeleton and local runtime
2. Execution-engine boundary
3. Market data and paper-trading path
4. Risk and promotion controls
5. Witchy operator UX
6. Live-trading guardrails

### Task 1: Establish the app skeleton

**Files:**
- Create: `README.md`
- Create: `docs/architecture/runtime-overview.md`
- Create: `src/`
- Create: `app/`
- Create: `tests/`
- Modify: `package.json`

**Step 1: Define workspace commands**

Add scripts for local app boot, test runs, linting, and a single-command development start.

**Step 2: Choose the first persistence model**

Prefer SQLite for the first local operator slice unless live multi-process pressure forces Postgres.

**Step 3: Create runtime overview docs**

Document the local processes, ports, env vars, secret boundaries, and startup flow.

**Step 4: Add smoke tests**

Verify the project boots and exposes a health endpoint or equivalent local readiness signal.

**Step 5: Commit**

`git commit -m "chore: scaffold local runtime foundation"`

### Task 2: Build the execution-engine adapter boundary

**Files:**
- Create: `src/server/engine/engine-adapter.ts`
- Create: `src/server/engine/types.ts`
- Create: `src/server/engine/lean-adapter.ts`
- Create: `tests/server/engine/engine-adapter.test.ts`

**Step 1: Write failing contract tests**

Test normalized methods for:

- `runBacktest`
- `startPaperSession`
- `stopSession`
- `getOrders`
- `getPositions`
- `getStrategyStatus`

**Step 2: Run the failing tests**

Use the smallest test target for the adapter contract and verify missing implementation failures.

**Step 3: Implement the normalized adapter**

Make the app depend on the adapter contract, not directly on LEAN.

**Step 4: Add fixture-based translation tests**

Verify raw engine output is transformed into app-level domain objects consistently.

**Step 5: Commit**

`git commit -m "feat: add engine adapter boundary"`

### Task 3: Add local domain models for trading state

**Files:**
- Create: `src/server/domain/strategy.ts`
- Create: `src/server/domain/order.ts`
- Create: `src/server/domain/position.ts`
- Create: `src/server/domain/trade-log.ts`
- Create: `tests/server/domain/trading-domain.test.ts`

**Step 1: Define normalized entities**

Create strict types for:

- strategy lifecycle stage
- signal explanation
- order intent
- fill event
- realized and unrealized PnL snapshots

**Step 2: Add validation rules**

Reject impossible state transitions such as promoting a strategy directly from draft to live.

**Step 3: Add tests for lifecycle and invariants**

Cover mode transitions, halted states, and stale-event rejection.

**Step 4: Commit**

`git commit -m "feat: add trading domain models"`

### Task 4: Implement Alpaca paper-trading integration

**Files:**
- Create: `src/server/brokers/alpaca/alpaca-client.ts`
- Create: `src/server/brokers/alpaca/alpaca-paper-broker.ts`
- Create: `tests/server/brokers/alpaca/alpaca-paper-broker.test.ts`
- Create: `.env.example`

**Step 1: Write integration-facing tests with mocked responses**

Cover account status, order submission, order polling, positions, and account PnL retrieval.

**Step 2: Implement the broker client**

Keep HTTP transport, auth, and response mapping separate from strategy logic.

**Step 3: Add paper-mode guardrails**

Require explicit environment flags so live credentials cannot be used accidentally in paper mode.

**Step 4: Verify stock and crypto symbol handling**

Test at least one equity symbol and one crypto symbol path.

**Step 5: Commit**

`git commit -m "feat: add alpaca paper broker"`

### Task 5: Build the market-data normalization layer

**Files:**
- Create: `src/server/market/market-data-service.ts`
- Create: `src/server/market/symbol-registry.ts`
- Create: `src/server/market/candles-cache.ts`
- Create: `tests/server/market/market-data-service.test.ts`

**Step 1: Normalize symbol identity**

Prevent ambiguity between stock tickers and crypto pairs.

**Step 2: Implement historical and current data fetch paths**

Support the first strategies without locking the app to one venue forever.

**Step 3: Add stale-data protection**

Reject or flag decisions based on stale market snapshots.

**Step 4: Commit**

`git commit -m "feat: add market data normalization"`

### Task 6: Implement the strategy lifecycle and promotion gates

**Files:**
- Create: `src/server/strategies/strategy-registry.ts`
- Create: `src/server/strategies/promotion-gates.ts`
- Create: `src/server/strategies/validation-report.ts`
- Create: `tests/server/strategies/promotion-gates.test.ts`

**Step 1: Encode lifecycle states**

Use `draft`, `backtest`, `paper`, `candidate_live`, `live`, `halted`, and `retired`.

**Step 2: Define measurable promotion gates**

Include minimum sample size, drawdown cap, fee-adjusted return, slippage tolerance, and paper-vs-backtest drift.

**Step 3: Generate validation reports**

The operator should see exactly why a strategy is promoted or blocked.

**Step 4: Commit**

`git commit -m "feat: add strategy promotion gates"`

### Task 7: Add the risk-control service

**Files:**
- Create: `src/server/risk/risk-engine.ts`
- Create: `src/server/risk/kill-switch.ts`
- Create: `src/server/risk/exposure-limits.ts`
- Create: `tests/server/risk/risk-engine.test.ts`

**Step 1: Write tests for blocking conditions**

Cover:

- max position size breaches
- max daily loss breaches
- venue unavailable
- stale market data
- duplicate order attempts

**Step 2: Implement pre-trade and post-trade checks**

No order leaves the app without passing the risk engine.

**Step 3: Add a global kill switch**

The operator must be able to halt all new trading immediately.

**Step 4: Commit**

`git commit -m "feat: add risk controls"`

### Task 8: Build the event log and audit trail

**Files:**
- Create: `src/server/audit/event-store.ts`
- Create: `src/server/audit/explanation-builder.ts`
- Create: `src/server/api/events.ts`
- Create: `tests/server/audit/explanation-builder.test.ts`

**Step 1: Define event types**

Record signals, orders, fills, rejections, pauses, and operator overrides.

**Step 2: Build human-readable explanations**

Every action should produce a concise explanation card for the UI.

**Step 3: Verify restart durability**

The event trail must remain available after app restarts.

**Step 4: Commit**

`git commit -m "feat: add audit event trail"`

### Task 9: Build the Witchy operator dashboard

**Files:**
- Create: `app/routes/dashboard.tsx`
- Create: `app/routes/strategies.tsx`
- Create: `app/routes/trades.tsx`
- Create: `app/components/observatory-panel.tsx`
- Create: `app/components/familiar-status.tsx`
- Create: `app/components/ritual-log.tsx`
- Create: `app/styles/theme.css`
- Create: `tests/app/dashboard.test.tsx`

**Step 1: Establish the visual system**

Use a midnight-blue base, luminous cyan accents, glass panels, and sparse occult motifs.

**Step 2: Build the top-level observability layout**

Always show:

- mode: research, paper, or live
- current activity
- portfolio PnL
- drawdown
- exposure
- active warnings

**Step 3: Build strategy and trade views**

Expose validation stage, current reasoning, and per-trade attribution.

**Step 4: Add UI tests**

Verify critical state labels and kill-switch affordances render clearly.

**Step 5: Commit**

`git commit -m "feat: add operator dashboard"`

### Task 10: Add one stock and one crypto reference strategy

**Files:**
- Create: `src/server/strategies/stock-momentum.ts`
- Create: `src/server/strategies/crypto-breakout.ts`
- Create: `tests/server/strategies/stock-momentum.test.ts`
- Create: `tests/server/strategies/crypto-breakout.test.ts`

**Step 1: Implement simple, auditable strategies**

Avoid large opaque ML systems in the first slice.

**Step 2: Run backtest and paper validation hooks**

Wire each strategy into the lifecycle and reporting system.

**Step 3: Capture operator-facing explanations**

Explain entries, exits, and invalidations in plain language.

**Step 4: Commit**

`git commit -m "feat: add reference trading strategies"`

### Task 11: Add live-trading guardrails

**Files:**
- Create: `src/server/live/live-trading-controller.ts`
- Create: `src/server/live/live-armament-policy.ts`
- Create: `tests/server/live/live-trading-controller.test.ts`

**Step 1: Require explicit arming**

No strategy can go live automatically from a passing paper state.

**Step 2: Add tiny-size rollout policy**

Force limited capital allocation for first live deployments.

**Step 3: Add automatic de-risking**

Pause or demote strategies on live drift, repeated errors, or risk breaches.

**Step 4: Commit**

`git commit -m "feat: add live trading safeguards"`

### Task 12: Verification and operator acceptance

**Files:**
- Create: `docs/qa/paper-to-live-checklist.md`
- Create: `docs/qa/venue-readiness.md`
- Create: `tests/e2e/operator-flow.test.ts`

**Step 1: Verify the local operator journey**

Test:

- start app
- inspect strategy
- start paper trading
- review explanations
- arm live mode
- trigger halt

**Step 2: Produce a readiness checklist**

Document what must be true before enabling real funds.

**Step 3: Run full verification**

At minimum:

- unit tests
- integration tests
- UI tests
- operator-flow test

**Step 4: Commit**

`git commit -m "test: verify paper to live operator flow"`

## Quality Gates

- No live path without passing promotion gates
- No order path without risk-engine approval
- No dashboard state without plain-language explanation support
- No broker secret stored in plaintext logs
- No performance claim shown without fee/slippage context

## Initial Backlog After First Slice

- add Interactive Brokers connector
- add Coinbase Advanced Trade connector
- add Kraken connector
- add richer slippage models
- add regime classifier experiments
- add portfolio-level optimizer
- add anomaly alerts and notification channels

Plan complete and saved to `docs/plans/2026-05-24-hexchange-platform-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?

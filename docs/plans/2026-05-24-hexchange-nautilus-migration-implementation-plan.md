# Hexchange Nautilus Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the stubbed LEAN execution boundary with a local NautilusTrader runtime that supports Interactive Brokers for stocks and Kraken for crypto while preserving Hexchange's operator UX and risk-control model.

**Architecture:** Keep Hexchange as the control plane and add a Python-based Nautilus workspace as the execution plane. The Node service should orchestrate backtests and sessions through a `NautilusAdapter`, parse structured artifacts, and continue exposing the same app-level API contracts wherever possible.

**Tech Stack:** TypeScript, React, Express, Vitest, Python 3.11+, NautilusTrader, Interactive Brokers, Kraken, local JSON state, subprocess-based engine orchestration

---

## Delivery Order

1. Document and validate the new runtime contract
2. Replace engine boundary types and env contract
3. Add a local Nautilus workspace scaffold
4. Implement the Node-to-Python adapter path
5. Migrate app services and UI from LEAN language to Nautilus language
6. Deprecate Alpaca from the primary execution path
7. Add runtime smoke coverage for simulated Nautilus flows

### Task 1: Replace the engine runtime contract

**Files:**
- Modify: `src/server/engine/types.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `tests/server/engine/engine-runtime-status.test.ts`
- Modify: `tests/app/strategy-cockpit.test.tsx`

**Step 1: Write the failing test**

Add expectations that engine mode uses `nautilus` instead of `lean_cli`, and that engine status can report runtime health and venue connectivity.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/engine/engine-runtime-status.test.ts tests/app/strategy-cockpit.test.tsx`

Expected: FAIL because the current engine mode enum and UI labels are LEAN-shaped.

**Step 3: Write minimal implementation**

Update the engine and shared contracts to use:

- `mode: "simulated" | "nautilus"`
- runtime health metadata
- venue connectivity summaries

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/engine/engine-runtime-status.test.ts tests/app/strategy-cockpit.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: update engine contract for nautilus runtime"
```

### Task 2: Replace LEAN configuration with Nautilus env validation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/architecture/runtime-overview.md`
- Create: `src/server/config/runtime-config.ts`
- Create: `tests/server/config/runtime-config.test.ts`

**Step 1: Write the failing test**

Add env-parsing tests for:

- `HEXCHANGE_ENGINE_MODE`
- `HEXCHANGE_NAUTILUS_PYTHON`
- `HEXCHANGE_NAUTILUS_PROJECT_DIR`
- `HEXCHANGE_NAUTILUS_RUNS_DIR`
- IB and Kraken settings

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/config/runtime-config.test.ts`

Expected: FAIL because the config module does not exist.

**Step 3: Write minimal implementation**

Create a runtime config helper that validates the new env contract and keeps live venue config opt-in.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/config/runtime-config.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: add nautilus runtime configuration"
```

### Task 3: Scaffold the local Nautilus workspace

**Files:**
- Create: `engine/nautilus/README.md`
- Create: `engine/nautilus/pyproject.toml`
- Create: `engine/nautilus/hexchange_nautilus/__init__.py`
- Create: `engine/nautilus/hexchange_nautilus/cli.py`
- Create: `engine/nautilus/hexchange_nautilus/models.py`
- Create: `engine/nautilus/hexchange_nautilus/config.py`
- Create: `engine/nautilus/hexchange_nautilus/runners/__init__.py`
- Create: `tests/fixtures/nautilus/`

**Step 1: Write the failing test**

Add a TypeScript-side adapter test that expects a Python workspace path and artifact directory to exist.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/engine/engine-adapter.test.ts`

Expected: FAIL because no Nautilus workspace exists.

**Step 3: Write minimal implementation**

Add the Python package scaffold with a CLI entry point that can later support `backtest`, `start-session`, and `stop-session`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/engine/engine-adapter.test.ts`

Expected: PASS for scaffold expectations

**Step 5: Commit**

```bash
git commit -m "feat: scaffold nautilus runtime workspace"
```

### Task 4: Implement artifact-based backtest execution

**Files:**
- Modify: `src/server/engine/engine-adapter.ts`
- Replace: `src/server/engine/lean-adapter.ts`
- Create: `src/server/engine/nautilus-adapter.ts`
- Create: `src/server/engine/process-runner.ts`
- Create: `src/server/engine/result-parser.ts`
- Create: `tests/server/engine/nautilus-adapter.test.ts`
- Create: `tests/fixtures/nautilus/backtest-result.json`
- Modify: `tests/server/engine/engine-adapter.test.ts`

**Step 1: Write the failing test**

Add adapter tests that expect:

- a subprocess invocation in `nautilus` mode
- parsing of a JSON artifact into `BacktestResult`
- fallback to simulated mode when the runtime is unavailable

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/engine/engine-adapter.test.ts tests/server/engine/nautilus-adapter.test.ts`

Expected: FAIL because the Nautilus adapter and parser do not exist.

**Step 3: Write minimal implementation**

Implement:

- `createEngineAdapter()` returning `NautilusAdapter`
- process spawning helpers
- artifact parsing helpers
- simulated fallback behavior behind the same contract

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/engine/engine-adapter.test.ts tests/server/engine/nautilus-adapter.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: add nautilus backtest adapter"
```

### Task 5: Add managed session lifecycle support

**Files:**
- Modify: `src/server/engine/types.ts`
- Modify: `src/server/engine/nautilus-adapter.ts`
- Modify: `src/server/services/hexchange-service.ts`
- Modify: `src/server/state/runtime-state-store.ts`
- Create: `tests/server/services/nautilus-session-lifecycle.test.ts`
- Modify: `tests/server/services/hexchange-service.test.ts`

**Step 1: Write the failing test**

Add coverage for:

- starting a Nautilus-managed paper or simulation session
- storing external runtime ids
- stopping a session by runtime id
- restoring session metadata after restart

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/services/hexchange-service.test.ts tests/server/services/nautilus-session-lifecycle.test.ts`

Expected: FAIL because current sessions are in-memory stubs only.

**Step 3: Write minimal implementation**

Persist session metadata and wire the service to managed Nautilus sessions.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/services/hexchange-service.test.ts tests/server/services/nautilus-session-lifecycle.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: add nautilus session lifecycle"
```

### Task 6: Migrate the UI copy and engine observability

**Files:**
- Modify: `app/routes/strategies.tsx`
- Modify: `app/routes/trades.tsx`
- Modify: `app/lib/api.ts`
- Modify: `tests/app/strategy-cockpit.test.tsx`
- Modify: `tests/app/trades-control-center.test.tsx`

**Step 1: Write the failing test**

Add UI expectations for:

- Nautilus engine labels
- runtime health status
- venue connectivity visibility for IB and Kraken

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/strategy-cockpit.test.tsx tests/app/trades-control-center.test.tsx`

Expected: FAIL because the UI still presents LEAN-shaped engine status.

**Step 3: Write minimal implementation**

Update the UI to present the Nautilus runtime state while preserving the existing operator workflow.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/strategy-cockpit.test.tsx tests/app/trades-control-center.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: update ui for nautilus runtime"
```

### Task 7: Add the Python runner CLI and simulated artifact mode

**Files:**
- Modify: `engine/nautilus/hexchange_nautilus/cli.py`
- Create: `engine/nautilus/hexchange_nautilus/runners/backtest.py`
- Create: `engine/nautilus/hexchange_nautilus/runners/session.py`
- Create: `engine/nautilus/hexchange_nautilus/artifacts.py`
- Create: `tests/fixtures/nautilus/session-status.json`

**Step 1: Write the failing test**

Add adapter-facing tests that expect stable JSON output from the Python CLI for:

- `backtest`
- `start-session`
- `stop-session`
- `status`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/engine/nautilus-adapter.test.ts`

Expected: FAIL because the Python CLI has no supported commands yet.

**Step 3: Write minimal implementation**

Implement CLI subcommands that emit deterministic JSON in simulated mode, keeping the artifact contract stable for the Node side.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/engine/nautilus-adapter.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: add nautilus runner cli"
```

### Task 8: Deprecate Alpaca from the primary runtime path

**Files:**
- Modify: `src/server/services/hexchange-service.ts`
- Modify: `README.md`
- Modify: `docs/architecture/runtime-overview.md`
- Modify: `docs/qa/venue-readiness.md`
- Modify: `tests/e2e/operator-flow.test.ts`

**Step 1: Write the failing test**

Add expectations that the default engine venue posture is `IB + Kraken`, not Alpaca.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/e2e/operator-flow.test.ts`

Expected: FAIL because docs or flow text still point to Alpaca as the primary path.

**Step 3: Write minimal implementation**

Update runtime copy and service messaging to make Alpaca non-primary or deprecated.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/e2e/operator-flow.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "docs: switch primary venue guidance to ib and kraken"
```

### Task 9: Add end-to-end verification for the local Nautilus path

**Files:**
- Modify: `tests/e2e/operator-flow.test.ts`
- Create: `tests/e2e/nautilus-runtime-smoke.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

Add a smoke test that exercises:

- engine status
- backtest request
- session start
- runtime status persistence

in simulated Nautilus mode.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/e2e/nautilus-runtime-smoke.test.ts`

Expected: FAIL because the runtime path does not exist yet.

**Step 3: Write minimal implementation**

Wire the remaining service and adapter behavior so the smoke test passes in local simulated Nautilus mode.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/e2e/nautilus-runtime-smoke.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "test: add nautilus runtime smoke coverage"
```

### Task 10: Run full verification and prepare the branch

**Files:**
- Modify as needed from prior tasks

**Step 1: Run focused tests**

Run all task-specific tests and repair any failures before broad verification.

**Step 2: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass

**Step 3: Verify the local app boots**

Run:

```bash
npm start
```

Then verify:

```bash
curl http://localhost:5174/api/health
curl http://localhost:5174/api/engine/status
```

Expected: healthy responses with Nautilus runtime metadata

**Step 4: Commit**

```bash
git commit -m "feat: migrate engine runtime to nautilus"
```

# Intake Brief — Hexchange Audit
**Date:** 2026-06-06  
**Run:** audit-hexchange-2026-06-06  
**Type:** Audit / gap analysis  
**Requested by:** operator  

---

## Goal

Understand Hexchange's current correctness posture, identify bugs, gaps, and improvement opportunities, and produce a prioritised remediation plan.

## Operating Assumptions

- User wants a planning-level audit report, not immediate implementation.
- "Working correctly" means: main tests pass, TypeScript clean, no critical runtime bugs in main branch.
- Worktree branches (`nautilus-ib-kraken`, `engine-backtest-cockpit`, `persistent-control-center`) are active development branches, not broken code the user is unaware of.

---

## First-Pass Facts

### Project Identity
- **Name:** Hexchange — local-first trading workstation for stocks and crypto
- **Stack:** React 19 + React Router 7 (frontend), Express 4 (backend API), Vitest (tests), Vite (build), TypeScript 5
- **Architecture:** layered — domain → service → adapter (LEAN/simulated) → broker (Alpaca paper)
- **Storage:** file-backed — `.hexchange/events.json` + `.hexchange/state.json`
- **Mode lifecycle:** `research → paper → candidate_live → live → halted`

### What Works (main branch)
- TypeScript: **clean** (no errors)
- Main project tests: **all pass** (tests/, not worktrees)
- Core service layers: HexchangeService, RiskEngine, KillSwitch, PromotionGates, EventStore, AlpacaPaperBroker — logic sound
- Frontend dashboard with polling, strategy cockpit, trades control center — functional
- Demo mode with seeded simulation works without Alpaca credentials

### Test Failures (36 of 125)
**Root cause: vite.config.ts has no `exclude` for `.worktrees/`, so vitest picks up tests from all 3 worktrees.**
All 36 failures are in worktrees, not in main project code.

Worktree-specific failures:
1. **nautilus-ib-kraken**: Missing fixture files (`tests/fixtures/nautilus/backtest-result.json`, `session-status.json`); React multi-copy issue in test environment (duplicate React instance → hook failure)
2. **persistent-control-center**: EventStore race condition — file exists but empty → `JSON.parse("")` → `Unexpected end of JSON input`; React multi-copy same issue
3. **engine-backtest-cockpit**: React multi-copy in test env

---

## Confirmed Bugs (main branch)

### CRITICAL
| # | Location | Bug |
|---|----------|-----|
| C1 | `hexchange-service.ts:95` | `dailyDrawdownPct` is hardcoded to `1.4`. Never computed from real daily P&L. The risk gate at `riskEngine.evaluateOrder()` uses this value — it can never trip from actual losses. |
| C2 | `event-store.ts:19` | `JSON.parse("")` throws if file exists but is empty (interrupted write). `ensureReady()` only guards against file-not-found, not empty/corrupt content. |

### HIGH
| # | Location | Bug |
|---|----------|-----|
| H1 | `hexchange-service.ts:337` | Simulated paper fill always records positive P&L (`fillPrice * qty * 0.012`). Paper trading can never show a loss in simulation mode. |
| H2 | `hexchange-service.ts:163–169` | `updateRiskSettings` mutates `this.riskSettings` in-place, violating immutability. Also: no input validation (negative values, NaN accepted). |
| H3 | `vite.config.ts` (test section) | No `exclude` pattern for `.worktrees/**` — 36 worktree tests fail on every `npm test` run, masking real signal. |

### MEDIUM
| # | Location | Bug |
|---|----------|-----|
| M1 | `hexchange-service.ts:94` | `totalProfitPct` uses hardcoded $10k denominator (`totalProfitUsd / 10000`). Should be derived from capital deployed or risk settings. |
| M2 | `lean-adapter.ts:23–33` | `runBacktest()` returns hardcoded baseline returns (11.8% stock, 15.4% crypto). No variance, no realism. Always "passes" promotion. |
| M3 | `hexchange-service.ts:59` | Constructor default `appDir = ".hexchange"` means the committed `.hexchange/` directory in the repo gets used as the live data store unless `HEXCHANGE_APP_DIR` is explicitly set. |

---

## Architecture Gaps

| # | Gap | Impact |
|---|-----|--------|
| G1 | No stop-session endpoint/UI | Cannot halt a paper session without using kill switch |
| G2 | No real price feed / tick progression | Market data stays static; paper fills are meaningless over time |
| G3 | No pagination on `/api/events` | Returns all 200 events on every poll; no time-range filter |
| G4 | LEAN CLI mode not implemented | `HEXCHANGE_ENGINE_MODE=lean_cli` sets the label but no real LEAN subprocess is launched |
| G5 | No CSRF protection or rate limiting on API | All POST endpoints are unprotected |
| G6 | Frontend polling has no backoff | `usePollingJson` fires on fixed interval regardless of server latency; requests can pile up |
| G7 | Single in-memory instance | All state is in `HexchangeService` fields; horizontal scaling / restart-resilience limited by file-backed store only |

---

## Worktree Branches (in-flight)

| Worktree | Intent | Status |
|----------|--------|--------|
| `nautilus-ib-kraken` | Nautilus Python engine integration + IB/Kraken broker support, process-level session runner | Active dev; fixture files missing for 2 tests; React dup in test env |
| `engine-backtest-cockpit` | Enhanced backtest UI (strategy cockpit) | Active dev; React dup in test env |
| `persistent-control-center` | Persistent settings (risk config survives restart) | Active dev; EventStore empty-file bug surfaces here |

---

## Success Criteria for Remediation

1. `npm test` passes with 0 failures (fix vitest config + worktree-specific bugs)
2. `dailyDrawdownPct` is computed from actual daily trades
3. EventStore handles empty/corrupt file gracefully
4. Paper fill simulation can show losses
5. `updateRiskSettings` validates inputs and uses immutable update
6. `totalProfitPct` uses a meaningful denominator
7. Architecture gaps G1 (stop session), G5 (rate limit), G6 (polling backoff) addressed

---

## Routing

- **solution_architect** → design fixes for C1, C2, H1, H2, H3, M1, M2, G1, G5, G6
- **security_reviewer** → gaps G5 (CSRF, rate limiting), H2 (input validation)
- **planner** → phased task breakdown for remediation

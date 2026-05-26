# Validation Campaign Runbook

This runbook covers the final acceptance step for the Hexchange MVP: gathering real forward evidence from Kraken paper validation.

## Goal

Do not treat the MVP as validated until the paper-validation campaign reaches both targets:

- `24 observed hours`
- `10 completed paper cycles`

Those targets are visible in the dashboard, Control Center, and `/api/control/validation-campaign`.

## Prerequisites

- `npm install` completed
- local `.env` configured with:
  - `HEXCHANGE_ENGINE_MODE=nautilus`
  - `HEXCHANGE_NAUTILUS_PYTHON`
  - `HEXCHANGE_NAUTILUS_PROJECT_DIR`
  - `HEXCHANGE_NAUTILUS_RUNS_DIR`
  - `KRAKEN_API_KEY`
  - `KRAKEN_API_SECRET`
- local Nautilus runtime bootstrapped with `bash scripts/setup-nautilus-runtime.sh`
- Kraken credentials verified in the app as connected

## Start The Campaign

1. Start Hexchange:

```bash
npm run dev
```

2. Open the Strategy library.
3. Enable `Auto paper` for the crypto strategy you want to validate.
4. Start `Kraken paper` for that strategy.
5. Confirm the validation campaign moves from `idle` to `collecting`.

## What To Watch

Use all three views together:

- `Dashboard`
  - campaign status
  - observed hours versus target
  - completed cycles versus target
  - next action
- `Control Center`
  - campaign status and summary
  - live-readiness gates
  - warnings if validation stalls
- `Strategy library`
  - paper cycle ledger
  - cumulative paper PnL
  - win rate
  - average return
  - per-strategy evidence progress

For API-based monitoring, check:

- `/api/control/validation-campaign`
- `/api/control/live-readiness`
- `/api/system/status`

## Campaign States

- `idle`
  - no forward evidence has started yet
  - action: start a Kraken paper session
- `collecting`
  - forward evidence is actively accumulating
  - action: keep Hexchange running
- `stalled`
  - evidence has stopped progressing for too long
  - action: inspect the runtime, review warnings, and restart Kraken paper validation
- `ready`
  - the campaign target has been reached
  - action: review the evidence before even considering live armament

## If The Campaign Stalls

1. Check the top-level activity message and warnings.
2. Confirm the Kraken paper session still exists in the Strategy library.
3. Inspect recent event-log entries for stall or restart messages.
4. Restart the affected Kraken paper session if needed.
5. Confirm the campaign returns to `collecting`.

Do not arm live if the campaign is oscillating between `stalled` and `collecting` without producing clean completed cycles.

## Evidence Review Before Live

Reaching the target window is necessary, not sufficient. Review:

- cumulative paper PnL is positive
- average paper-cycle return is positive
- win rate meets the live-evidence threshold shown in the strategy view
- the cycle ledger does not show unexplained dead periods or broken restarts
- live-readiness for the crypto strategy is `pass`
- the operator can explain the strategy behavior from the event log and journal

Use [paper-to-live-checklist.md](/home/eimi/projects/hexchange/.worktrees/nautilus-ib-kraken/docs/qa/paper-to-live-checklist.md) together with this runbook before live armament.

## Scope Notes

- `Kraken` is the only venue that can currently advance through paper toward live execution.
- `Stocks` remain `simulation-only` and must not block the crypto validation campaign.
- This runbook is for validation, not profit guarantees. The campaign proves observed behavior over time; it does not promise future profitability.

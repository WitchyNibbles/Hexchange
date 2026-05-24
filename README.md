# Hexchange

Hexchange is a local-first trading workstation for stocks and crypto. It is designed to make autonomous trading understandable instead of opaque: every strategy, order, and profit contribution is visible, explainable, and gated behind paper-trading and live-risk controls.

## What ships in this MVP

- local operator console with a WitchyNibbles-inspired visual system
- transparent dashboard for mode, PnL, exposure, and current activity
- Nautilus migration branch for backtest and paper/live orchestration
- Interactive Brokers plus Kraken as the target venue path
- sample stock momentum and crypto breakout strategies
- promotion gates, kill switch, and live-armament policy
- file-backed event log and trade journal for auditability
- persistent control-center settings for notional, drawdown, and rollout caps

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Bootstrap the local Nautilus runtime when you want the real Python engine path:

```bash
bash scripts/setup-nautilus-runtime.sh
```

3. Start the backend and frontend:

```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173).

The app runs in a seeded local demo mode if the Nautilus runtime and live venue credentials are not configured. That keeps the full product usable while preserving the engine integration boundary for real paper or live trading.

## Environment

Copy the example file and fill in Nautilus and venue settings when you want to connect the local execution runtime:

```bash
cp .env.example .env
```

Key variables:

- `HEXCHANGE_APP_DIR` local storage path for audit and state files
- `HEXCHANGE_ENGINE_MODE` set to `nautilus` to enable the local engine runtime
- `HEXCHANGE_NAUTILUS_PYTHON`
- `HEXCHANGE_NAUTILUS_PROJECT_DIR`
- `HEXCHANGE_NAUTILUS_RUNS_DIR`
- `IB_GATEWAY_HOST`, `IB_GATEWAY_PORT`, `IB_CLIENT_ID`
- `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`

For the recommended local runtime bootstrap, see [engine/nautilus/README.md](/home/eimi/projects/hexchange/.worktrees/nautilus-ib-kraken/engine/nautilus/README.md).

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Product posture

Hexchange is built around validation rather than hype:

- paper before live
- explicit risk gates
- no guarantee language
- profit always shown with exposure and drawdown context

See [runtime-overview.md](/home/eimi/projects/hexchange/docs/architecture/runtime-overview.md), [paper-to-live-checklist.md](/home/eimi/projects/hexchange/docs/qa/paper-to-live-checklist.md), and [venue-readiness.md](/home/eimi/projects/hexchange/docs/qa/venue-readiness.md).

# Hexchange

Hexchange is a local-first trading workstation for stocks and crypto. It is designed to make autonomous trading understandable instead of opaque: every strategy, order, and profit contribution is visible, explainable, and gated behind paper-trading and live-risk controls.

## What ships in this MVP

- local operator console with a WitchyNibbles-inspired visual system
- transparent dashboard for mode, PnL, exposure, and current activity
- LEAN adapter boundary for backtest and paper/live session orchestration
- Alpaca paper-broker client with stock and crypto symbol support
- sample stock momentum and crypto breakout strategies
- promotion gates, kill switch, and live-armament policy
- file-backed event log and trade journal for auditability

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Start the backend and frontend:

```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173).

The app runs in a seeded local demo mode if Alpaca paper credentials are not configured. That keeps the full product usable while preserving the broker integration boundary for real paper trading.

## Environment

Copy the example file and fill in paper credentials when you want to connect Alpaca:

```bash
cp .env.example .env
```

Key variables:

- `HEXCHANGE_APP_DIR` local storage path for audit and state files
- `HEXCHANGE_ENABLE_ALPACA_PAPER` set to `true` to enable broker-backed paper mode
- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `ALPACA_PAPER_BASE_URL`

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

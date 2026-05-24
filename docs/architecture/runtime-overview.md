# Runtime Overview

## Processes

- `vite` on port `5173` for the local operator console
- `express` on port `5174` for APIs, seeded simulation services, and control actions

## Startup flow

1. The backend loads `.env` variables.
2. Hexchange creates `.hexchange/` or the path defined by `HEXCHANGE_APP_DIR`.
3. The event store initializes persisted audit records.
4. Market data seeds the local candles cache for the reference strategies.
5. The strategy registry builds the first stock and crypto strategy snapshots.
6. The frontend polls `/api` endpoints and renders the current state.

## Local storage

- `.hexchange/events.json` persistent audit and ritual log
- `.hexchange/state.json` reserved for future durable portfolio state

## Environment variables

- `PORT` backend port, defaults to `5174`
- `HEXCHANGE_APP_DIR` runtime data directory
- `HEXCHANGE_ENABLE_ALPACA_PAPER` opt-in switch for broker-backed paper mode
- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `ALPACA_PAPER_BASE_URL`

## Trust boundaries

- browser UI reads backend APIs only
- risk engine gates all order intents before execution
- kill switch blocks all new paper/live orders when engaged
- Alpaca live access is never enabled by default

## Demo mode

If Alpaca paper credentials are not configured, Hexchange stays fully usable in local seeded mode:

- the LEAN adapter still emits backtest and paper-session evidence
- the broker boundary falls back to simulated fills
- the UI continues to show risk, trades, and explainability

This keeps development and evaluation unblocked while preserving the real connector architecture.

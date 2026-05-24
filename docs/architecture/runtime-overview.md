# Runtime Overview

## Processes

- `vite` on port `5173` for the local operator console
- `express` on port `5174` for APIs, seeded simulation services, and control actions
- local Python runtime for NautilusTrader orchestration when `HEXCHANGE_ENGINE_MODE=nautilus`

## Startup flow

1. The backend loads `.env` variables.
2. Hexchange creates `.hexchange/` or the path defined by `HEXCHANGE_APP_DIR`.
3. The event store initializes persisted audit records.
4. Market data seeds the local candles cache for the reference strategies.
5. The strategy registry builds the first stock and crypto strategy snapshots.
6. The frontend polls `/api` endpoints and renders the current state.

## Local storage

- `.hexchange/events.json` persistent audit and ritual log
- `.hexchange/state.json` persistent strategies, orders, positions, trades, risk settings, and kill-switch state

## Environment variables

- `PORT` backend port, defaults to `5174`
- `HEXCHANGE_APP_DIR` runtime data directory
- `HEXCHANGE_ENGINE_MODE` engine runtime mode: `simulated` or `nautilus`
- `HEXCHANGE_NAUTILUS_PYTHON` python executable for the local Nautilus runtime
- `HEXCHANGE_NAUTILUS_PROJECT_DIR` local Nautilus project directory
- `HEXCHANGE_NAUTILUS_RUNS_DIR` local artifact and session directory
- `IB_GATEWAY_HOST`
- `IB_GATEWAY_PORT`
- `IB_CLIENT_ID`
- `IB_ACCOUNT_ID`
- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`
- `KRAKEN_ACCOUNT_TYPE`

## Trust boundaries

- browser UI reads backend APIs only
- risk engine gates all order intents before execution
- kill switch blocks all new paper/live orders when engaged
- live venue credentials remain opt-in and local-only

## Demo mode

If Nautilus runtime settings or live venue credentials are not configured, Hexchange stays fully usable in local seeded mode:

- the current engine adapter still emits backtest and paper-session evidence
- the broker boundary falls back to simulated fills
- the UI continues to show risk, trades, and explainability

This keeps development and evaluation unblocked while preserving the real connector architecture.

# Hexchange Nautilus Runtime

This directory holds the local Python runtime that Hexchange will use to orchestrate NautilusTrader backtests and managed trading sessions.

The first migration slices establish:

- a local Python package and CLI entry point
- file-based backtest and session artifacts
- a subprocess bridge from the Node control plane

## Bootstrap

Use the project bootstrap script from the repo root:

```bash
bash scripts/setup-nautilus-runtime.sh
```

That script installs `uv`, creates `engine/nautilus/.venv`, installs this local package, and installs `nautilus_trader[ib,docker]` for the Interactive Brokers adapter path described in the official NautilusTrader docs.

## Runtime paths

The bootstrap script prints the recommended `.env` values:

- `HEXCHANGE_ENGINE_MODE=nautilus`
- `HEXCHANGE_NAUTILUS_PYTHON=<repo>/engine/nautilus/.venv/bin/python`
- `HEXCHANGE_NAUTILUS_PROJECT_DIR=<repo>/engine/nautilus`
- `HEXCHANGE_NAUTILUS_RUNS_DIR=<repo>/engine/nautilus/runs`

# Venue Readiness

## Interactive Brokers

- local gateway or TWS reachable
- host, port, and client id configured
- account id configured if required by the deployment
- first stock symbol path validated through the Nautilus runtime
- Control Center should show `Interactive Brokers · pass` before real funds are enabled

## Kraken

- API key and secret configured locally
- account type confirmed: `spot` or `futures`
- first crypto symbol path validated through the Nautilus runtime
- Control Center should show `Kraken · pass` before real funds are enabled

## Runtime

- `HEXCHANGE_ENGINE_MODE=nautilus`
- `nautilus_trader` importable in the configured Python runtime
- Control Center live readiness panel shows the Nautilus runtime as `pass` or, at worst, `warn` with a known reason

## Operator checks

- `/api/control/live-readiness` returns a structured report with venue checks and per-strategy blockers
- no strategy should be considered live-ready if its venue is offline
- stock strategies depend on Interactive Brokers readiness
- crypto strategies depend on Kraken readiness

## Deprecated primary path

- retained only as legacy MVP scaffolding
- not the primary venue target for the Nautilus migration

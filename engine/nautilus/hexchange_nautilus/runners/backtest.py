from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from ..artifacts import write_json_artifact


def run_backtest(strategy_id: str, symbol: str, market: str, runs_dir: str) -> str:
    baseline = 11.8 if market == "stock" else 15.4
    drawdown = 4.8 if market == "stock" else 6.2
    trades = 43 if market == "stock" else 37

    artifact_path = Path(runs_dir) / f"backtest-{strategy_id}.json"
    return write_json_artifact(
        artifact_path,
        {
            "strategyId": strategy_id,
            "runId": f"backtest-{strategy_id}",
            "feeAdjustedReturnPct": baseline,
            "maxDrawdownPct": drawdown,
            "trades": trades,
            "executedAt": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "market": market,
        },
    )

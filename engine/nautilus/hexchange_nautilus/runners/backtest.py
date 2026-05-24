from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd

from ..artifacts import write_json_artifact


def run_backtest(strategy_id: str, symbol: str, market: str, runs_dir: str) -> str:
    artifact_path = Path(runs_dir) / f"backtest-{strategy_id}.json"

    try:
        payload = _run_nautilus_backtest(strategy_id, symbol, market)
    except ModuleNotFoundError:
        payload = _build_synthetic_backtest(strategy_id, symbol, market)

    return write_json_artifact(artifact_path, payload)


def _run_nautilus_backtest(strategy_id: str, symbol: str, market: str) -> dict[str, Any]:
    from nautilus_trader.backtest.config import BacktestEngineConfig
    from nautilus_trader.backtest.engine import BacktestEngine
    from nautilus_trader.config import LoggingConfig
    from nautilus_trader.config import RiskEngineConfig
    from nautilus_trader.examples.strategies.ema_cross import EMACross
    from nautilus_trader.examples.strategies.ema_cross import EMACrossConfig
    from nautilus_trader.model import BarType
    from nautilus_trader.model import Money
    from nautilus_trader.model import Venue
    from nautilus_trader.model.currencies import USD
    from nautilus_trader.model.currencies import USDT
    from nautilus_trader.model.enums import AccountType
    from nautilus_trader.model.enums import OmsType
    from nautilus_trader.persistence.wranglers import BarDataWrangler
    from nautilus_trader.test_kit.providers import TestInstrumentProvider

    config = BacktestEngineConfig(
        trader_id=f"HEXCHANGE-{strategy_id.upper()}",
        logging=LoggingConfig(log_level="ERROR"),
        risk_engine=RiskEngineConfig(bypass=True),
    )
    engine = BacktestEngine(config=config)

    if market == "stock":
        venue = Venue("SIM")
        engine.add_venue(
            venue=venue,
            oms_type=OmsType.HEDGING,
            account_type=AccountType.CASH,
            starting_balances=[Money(100_000, USD)],
        )
        instrument = TestInstrumentProvider.equity(symbol=symbol, venue="SIM")
        bar_type = BarType.from_str(f"{symbol}.SIM-1-MINUTE-LAST-EXTERNAL")
        bars = BarDataWrangler(bar_type=bar_type, instrument=instrument).process(_build_stock_frame(symbol))
        strategy = EMACross(
            config=EMACrossConfig(
                instrument_id=instrument.id,
                bar_type=bar_type,
                fast_ema_period=5,
                slow_ema_period=10,
                trade_size=Decimal(100),
                request_bars=False,
                subscribe_trade_ticks=False,
            ),
        )
    else:
        venue = Venue("BINANCE")
        engine.add_venue(
            venue=venue,
            oms_type=OmsType.NETTING,
            account_type=AccountType.MARGIN,
            starting_balances=[Money(100_000, USDT)],
            allow_cash_borrowing=True,
        )
        instrument = TestInstrumentProvider.btcusdt_binance()
        bar_type = BarType.from_str("BTCUSDT.BINANCE-1-MINUTE-LAST-EXTERNAL")
        bars = BarDataWrangler(bar_type=bar_type, instrument=instrument).process(_build_crypto_frame())
        strategy = EMACross(
            config=EMACrossConfig(
                instrument_id=instrument.id,
                bar_type=bar_type,
                fast_ema_period=8,
                slow_ema_period=21,
                trade_size=Decimal("0.1"),
                request_bars=False,
                subscribe_trade_ticks=False,
            ),
        )

    engine.add_instrument(instrument)
    engine.add_data(bars)
    engine.add_strategy(strategy)
    engine.run()

    result = engine.get_result()
    account_report = engine.trader.generate_account_report(venue)
    order_fills = engine.trader.generate_order_fills_report()
    return_pct = _extract_total_return_pct(result)
    drawdown_pct = _calculate_max_drawdown_pct(account_report)

    return {
        "strategyId": strategy_id,
        "runId": f"backtest-{strategy_id}-{str(result.run_id)[:8]}",
        "feeAdjustedReturnPct": round(return_pct, 4),
        "maxDrawdownPct": round(drawdown_pct, 4),
        "trades": int(len(order_fills.index)),
        "executedAt": datetime.now(timezone.utc).isoformat(),
        "runtimeSource": "nautilus_trader",
        "dataSource": "Locally generated sample bars via NautilusTrader.",
    }


def _build_stock_frame(symbol: str) -> pd.DataFrame:
    base = pd.Timestamp("2024-01-01T00:00:00Z")
    price = 100.0 if symbol.upper() == "AAPL" else 80.0
    rows: list[dict[str, float | pd.Timestamp]] = []

    for minute in range(120):
        price += 0.25 if minute < 60 else -0.15
        rows.append(
            {
                "timestamp": base + pd.Timedelta(minutes=minute),
                "open": price - 0.2,
                "high": price + 0.4,
                "low": price - 0.5,
                "close": price,
                "volume": 1_000 + minute,
            },
        )

    return pd.DataFrame(rows).set_index("timestamp")


def _build_crypto_frame() -> pd.DataFrame:
    base = pd.Timestamp("2024-01-01T00:00:00Z")
    price = 42_000.0
    rows: list[dict[str, float | pd.Timestamp]] = []
    phases = [(35, 110), (30, -190), (45, 140), (25, -85), (35, 120)]
    minute = 0

    for length, delta in phases:
        for _ in range(length):
            price += delta
            rows.append(
                {
                    "timestamp": base + pd.Timedelta(minutes=minute),
                    "open": price - 25,
                    "high": price + 50,
                    "low": price - 60,
                    "close": price,
                    "volume": 3 + minute / 100,
                },
            )
            minute += 1

    return pd.DataFrame(rows).set_index("timestamp")


def _extract_total_return_pct(result: Any) -> float:
    stats_pnls = getattr(result, "stats_pnls", {})
    for stats in stats_pnls.values():
        total = stats.get("PnL% (total)")
        if total is not None:
            return float(total)
    return 0.0


def _calculate_max_drawdown_pct(account_report: pd.DataFrame) -> float:
    totals = [float(str(total).replace("_", "")) for total in account_report["total"].tolist()]
    if not totals:
        return 0.0

    peak = totals[0]
    max_drawdown = 0.0
    for total in totals:
        peak = max(peak, total)
        if peak == 0:
            continue
        drawdown = ((peak - total) / peak) * 100
        max_drawdown = max(max_drawdown, drawdown)
    return max_drawdown


def _build_synthetic_backtest(strategy_id: str, symbol: str, market: str) -> dict[str, Any]:
    baseline = 11.8 if market == "stock" else 15.4
    drawdown = 4.8 if market == "stock" else 6.2
    trades = 43 if market == "stock" else 37

    return {
        "strategyId": strategy_id,
        "runId": f"backtest-{strategy_id}",
        "feeAdjustedReturnPct": baseline,
        "maxDrawdownPct": drawdown,
        "trades": trades,
        "executedAt": datetime.now(timezone.utc).isoformat(),
        "symbol": symbol,
        "market": market,
        "runtimeSource": "synthetic",
        "dataSource": "Hexchange seeded demo model.",
    }

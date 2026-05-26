from __future__ import annotations

from datetime import datetime, timezone
import base64
import hashlib
import hmac
from importlib import metadata as importlib_metadata
import importlib.util
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
from typing import Any
import urllib.parse
import urllib.request
import uuid

from ..artifacts import write_json_artifact

HEARTBEAT_INTERVAL_SECONDS = 0.5
HEARTBEAT_STALE_AFTER_SECONDS = 2.5
KRAKEN_AUTH_CACHE_TTL_SECONDS = 30
TEST_CYCLE_CLOSE_TICK = 3
REAL_CYCLE_SCALE_TICK = 12
REAL_CYCLE_SOFT_TIMEOUT_TICK = 180
REAL_CYCLE_HARD_TIMEOUT_TICK = 300
REAL_CYCLE_SCALE_TARGET_MULTIPLIER = 1.0018
REAL_CYCLE_CLOSE_TARGET_MULTIPLIER = 1.0045
REAL_CYCLE_STOP_MULTIPLIER = 0.9968
REAL_CYCLE_PROTECTIVE_STOP_MULTIPLIER = 1.0003
REAL_CYCLE_TRAILING_STOP_MULTIPLIER = 0.9988
REAL_CYCLE_SOFT_TIMEOUT_PROFIT_MULTIPLIER = 1.0004


def start_session(strategy_id: str, runs_dir: str) -> tuple[str, str]:
    runs_path = Path(runs_dir)
    artifact_path = _session_artifact_path(strategy_id, runs_path)
    telemetry_path = _session_telemetry_artifact_path(strategy_id, runs_path)
    existing = _read_json(artifact_path)
    if existing and _is_process_alive(existing.get("processId")) and existing.get("state") in {"paper", "live"}:
        if telemetry_path.exists():
            return str(existing.get("sessionId") or f"paper-{strategy_id}"), str(artifact_path)
        _terminate_process(int(existing.get("processId")))

    runs_path.mkdir(parents=True, exist_ok=True)
    log_path = runs_path / f"session-{strategy_id}.log"
    with log_path.open("a", encoding="utf-8") as log_file:
        session_id = _new_session_id(strategy_id)
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "hexchange_nautilus.cli",
                "session-worker",
                "--strategy-id",
                strategy_id,
                "--runs-dir",
                str(runs_path),
                "--session-id",
                session_id,
            ],
            stdout=log_file,
            stderr=log_file,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    _wait_for_session_bootstrap(artifact_path, process.pid)
    return session_id, str(artifact_path)


def stop_session(strategy_id: str, runs_dir: str) -> str:
    runs_path = Path(runs_dir)
    artifact_path = _session_artifact_path(strategy_id, runs_path)
    parsed = _read_json(artifact_path) or {}
    process_id = parsed.get("processId")
    if process_id is not None:
        _terminate_process(int(process_id))

    payload = {
        "sessionId": parsed.get("sessionId") or f"paper-{strategy_id}",
        "strategyId": strategy_id,
        "startedAt": parsed.get("startedAt") or datetime.now(timezone.utc).isoformat(),
        "lastHeartbeatAt": parsed.get("lastHeartbeatAt"),
        "processId": process_id,
        "runtimeSource": parsed.get("runtimeSource") or _runtime_source(),
        "executionMode": parsed.get("executionMode") or _execution_mode(_build_venue_statuses(runs_path)),
        "state": "stopped",
        "alive": False,
        "stoppedAt": datetime.now(timezone.utc).isoformat(),
    }
    return write_json_artifact(artifact_path, payload)


def runtime_status(runs_dir: str) -> str:
    runs_path = Path(runs_dir)
    sessions: list[dict[str, Any]] = []
    nautilus_installed = importlib.util.find_spec("nautilus_trader") is not None
    nautilus_version = None

    if nautilus_installed:
        try:
            nautilus_version = importlib_metadata.version("nautilus_trader")
        except importlib_metadata.PackageNotFoundError:
            nautilus_version = None

    degraded = not nautilus_installed
    for session_file in sorted(runs_path.glob("session-*.json")):
        if session_file.name.endswith("-telemetry.json") or session_file.name.endswith("-state.json"):
            continue
        parsed = _read_json(session_file)
        if not parsed:
            continue

        process_id = parsed.get("processId")
        alive = _is_process_alive(process_id)
        last_heartbeat_at = parsed.get("lastHeartbeatAt")
        stale = _heartbeat_stale(last_heartbeat_at) if alive else False
        state = str(parsed.get("state", "unknown"))
        if alive and stale:
            state = "stale"
            degraded = True
        elif state in {"paper", "live"} and not alive:
            state = "stopped"
            degraded = True

        sessions.append(
            {
                "sessionId": parsed.get("sessionId"),
                "strategyId": parsed.get("strategyId"),
                "state": state,
                "startedAt": parsed.get("startedAt"),
                "lastHeartbeatAt": last_heartbeat_at,
                "processId": process_id,
                "runtimeSource": parsed.get("runtimeSource"),
                "executionMode": parsed.get("executionMode"),
                "alive": alive and not stale,
            }
        )

    venue_statuses = _build_venue_statuses(runs_path)
    runtime_health = "degraded" if degraded else "ready"
    artifact_path = runs_path / "runtime-status.json"
    return write_json_artifact(
        artifact_path,
        {
            "runtimeHealth": runtime_health,
            "nautilusInstalled": nautilus_installed,
            "nautilusVersion": nautilus_version,
            "venues": venue_statuses,
            "sessions": sessions,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )


def session_worker(strategy_id: str, runs_dir: str, session_id: str) -> None:
    runs_path = Path(runs_dir)
    artifact_path = _session_artifact_path(strategy_id, runs_path)
    state_path = _session_state_artifact_path(strategy_id, runs_path)
    started_at = datetime.now(timezone.utc).isoformat()
    process_id = os.getpid()
    runtime_source = _runtime_source()
    venue_statuses = _build_venue_statuses(runs_path)
    execution_mode = _execution_mode(venue_statuses)
    running = True
    state = _load_or_initialize_session_state(strategy_id, runs_path, started_at, session_id)

    def handle_stop(_signum: int, _frame: object) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        now = datetime.now(timezone.utc).isoformat()
        state = _advance_session_state(strategy_id, state, runs_path, now)
        write_json_artifact(state_path, state)
        write_json_artifact(
            artifact_path,
            {
                "sessionId": session_id,
                "strategyId": strategy_id,
                "startedAt": started_at,
                "lastHeartbeatAt": now,
                "processId": process_id,
                "runtimeSource": runtime_source,
                "executionMode": execution_mode,
                "state": "paper",
                "alive": True,
            },
        )
        telemetry_path = _session_telemetry_artifact_path(strategy_id, runs_path)
        write_json_artifact(
            telemetry_path,
            _build_session_telemetry(
                state=state,
                session_id=session_id,
                updated_at=now,
            ),
        )
        if str(state.get("phase")) == "closed":
            running = False
            continue
        time.sleep(_heartbeat_interval_seconds())

    write_json_artifact(
        artifact_path,
        {
            "sessionId": session_id,
            "strategyId": strategy_id,
            "startedAt": started_at,
            "lastHeartbeatAt": datetime.now(timezone.utc).isoformat(),
            "processId": process_id,
            "runtimeSource": runtime_source,
            "executionMode": execution_mode,
            "state": "stopped",
            "alive": False,
            "stoppedAt": datetime.now(timezone.utc).isoformat(),
        },
    )


def _session_artifact_path(strategy_id: str, runs_path: Path) -> Path:
    return runs_path / f"session-{strategy_id}.json"


def _session_telemetry_artifact_path(strategy_id: str, runs_path: Path) -> Path:
    return runs_path / f"session-{strategy_id}-telemetry.json"


def _session_state_artifact_path(strategy_id: str, runs_path: Path) -> Path:
    return runs_path / f"session-{strategy_id}-state.json"


def _new_session_id(strategy_id: str) -> str:
    return f"paper-{strategy_id}-{uuid.uuid4().hex[:8]}"


def _wait_for_session_bootstrap(artifact_path: Path, process_id: int) -> None:
    deadline = time.time() + 3
    while time.time() < deadline:
        parsed = _read_json(artifact_path)
        if parsed and parsed.get("processId") == process_id and parsed.get("lastHeartbeatAt"):
            return
        time.sleep(0.1)
    raise RuntimeError(f"Session worker failed to bootstrap for {artifact_path.name}")


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _runtime_source() -> str:
    return "nautilus_trader" if importlib.util.find_spec("nautilus_trader") is not None else "synthetic"


def _is_process_alive(process_id: Any) -> bool:
    if not isinstance(process_id, int) or process_id <= 0:
        return False
    try:
        os.kill(process_id, 0)
    except OSError:
        return False
    return True


def _terminate_process(process_id: int) -> None:
    if not _is_process_alive(process_id):
        return

    os.kill(process_id, signal.SIGTERM)
    deadline = time.time() + 2
    while time.time() < deadline:
        if not _is_process_alive(process_id):
            return
        time.sleep(0.1)

    os.kill(process_id, signal.SIGKILL)


def _heartbeat_stale(last_heartbeat_at: Any) -> bool:
    if not isinstance(last_heartbeat_at, str):
        return True
    try:
        heartbeat = datetime.fromisoformat(last_heartbeat_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - heartbeat).total_seconds() > HEARTBEAT_STALE_AFTER_SECONDS


def _heartbeat_interval_seconds() -> float:
    return 0.2 if _read_test_price_series() else HEARTBEAT_INTERVAL_SECONDS


def _heartbeat_stale_for_ttl(timestamp_value: Any, ttl_seconds: int) -> bool:
    if not isinstance(timestamp_value, str):
        return True
    try:
        timestamp = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - timestamp).total_seconds() > ttl_seconds


def _build_venue_statuses(runs_path: Path) -> list[dict[str, Any]]:
    ib_adapter = importlib.util.find_spec("nautilus_trader.adapters.interactive_brokers") is not None
    kraken_adapter = importlib.util.find_spec("nautilus_trader.adapters.kraken") is not None

    ib_host = os.getenv("IB_GATEWAY_HOST")
    ib_port = os.getenv("IB_GATEWAY_PORT")
    ib_client_id = os.getenv("IB_CLIENT_ID")
    ib_account_id = os.getenv("IB_ACCOUNT_ID")
    ib_configured = all([ib_host, ib_port, ib_client_id, ib_account_id])
    ib_connected = False
    if ib_adapter and ib_configured:
        try:
            with socket.create_connection((str(ib_host), int(str(ib_port))), timeout=0.25):
                ib_connected = True
        except OSError:
            ib_connected = False

    kraken_api_key = os.getenv("KRAKEN_API_KEY")
    kraken_api_secret = os.getenv("KRAKEN_API_SECRET")
    kraken_configured = bool(kraken_api_key and kraken_api_secret)
    kraken_connected = False
    kraken_details = "Kraken API credentials missing."
    if kraken_adapter and kraken_configured:
        kraken_connected, kraken_details = _get_cached_kraken_auth_status(
            runs_path,
            str(kraken_api_key),
            str(kraken_api_secret),
        )

    return [
        {
            "venue": "interactive_brokers",
            "connected": ib_connected,
            "scope": "stocks",
            "details": (
                "Gateway reachable."
                if ib_connected
                else "Adapter unavailable." if not ib_adapter else "Gateway credentials or socket unavailable."
            ),
        },
        {
            "venue": "kraken",
            "connected": kraken_connected,
            "scope": "crypto",
            "details": kraken_details if kraken_adapter else "Adapter unavailable.",
        },
    ]


def _get_cached_kraken_auth_status(runs_path: Path, api_key: str, api_secret: str) -> tuple[bool, str]:
    cache_path = runs_path / "kraken-auth-status.json"
    cached = _read_json(cache_path)
    if cached:
        checked_at = cached.get("checkedAt")
        if isinstance(checked_at, str) and not _heartbeat_stale_for_ttl(checked_at, KRAKEN_AUTH_CACHE_TTL_SECONDS):
            return bool(cached.get("connected")), str(cached.get("details") or "Kraken auth status cached.")

    connected, details = _check_kraken_private_auth(runs_path, api_key, api_secret)
    write_json_artifact(
        cache_path,
        {
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "connected": connected,
            "details": details,
        },
    )
    return connected, details


def _check_kraken_private_auth(runs_path: Path, api_key: str, api_secret: str) -> tuple[bool, str]:
    url_path = "/0/private/Balance"
    for _attempt in range(2):
        nonce = _next_kraken_nonce(runs_path)
        payload = {"nonce": nonce}
        encoded_payload = urllib.parse.urlencode(payload)

        try:
            message = url_path.encode() + hashlib.sha256((nonce + encoded_payload).encode()).digest()
            signature = base64.b64encode(
                hmac.new(base64.b64decode(api_secret), message, hashlib.sha512).digest()
            ).decode()
        except Exception:
            return False, "Kraken API secret could not be decoded for request signing."

        request = urllib.request.Request(
            f"https://api.kraken.com{url_path}",
            data=encoded_payload.encode(),
            method="POST",
            headers={
                "API-Key": api_key,
                "API-Sign": signature,
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Hexchange readiness probe",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                raw = response.read().decode()
        except Exception as error:
            return False, f"Kraken auth probe failed: {error}"

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return False, "Kraken auth probe returned malformed JSON."

        errors = parsed.get("error") or []
        if not errors:
            return True, "Credentials verified against Kraken private API."

        error_text = ", ".join(str(item) for item in errors)
        if any("Invalid nonce" in str(item) for item in errors):
            continue

        return False, f"Kraken rejected the configured credentials: {error_text}"

    return False, "Kraken rejected the configured credentials: EAPI:Invalid nonce"


def _next_kraken_nonce(runs_path: Path) -> str:
    nonce_path = runs_path / "kraken-auth-nonce.json"
    cached = _read_json(nonce_path) or {}
    last_nonce = int(cached.get("lastNonce", 0)) if str(cached.get("lastNonce", "0")).isdigit() else 0
    current_nonce = int(time.time() * 1000)
    nonce = max(current_nonce, last_nonce + 1)
    write_json_artifact(
        nonce_path,
        {
            "lastNonce": nonce,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    return str(nonce)


def _execution_mode(venue_statuses: list[dict[str, Any]]) -> str:
    ib_connected = any(item["venue"] == "interactive_brokers" and item["connected"] for item in venue_statuses)
    kraken_connected = any(item["venue"] == "kraken" and item["connected"] for item in venue_statuses)

    if ib_connected and kraken_connected:
        return "dual_venue_ready"
    if ib_connected:
        return "ib_ready"
    if kraken_connected:
        return "kraken_ready"
    return "simulated"


def _build_session_telemetry(
    *,
    state: dict[str, Any],
    session_id: str,
    updated_at: str,
) -> dict[str, Any]:
    mark_price = float(state["currentPrice"])
    average_entry_price = float(state["entryPrice"])
    quantity = float(state["remainingQuantity"])
    realized_pnl = float(state["realizedPnlUsd"])
    unrealized_pnl = round((mark_price - average_entry_price) * quantity, 2)

    return {
        "sessionId": session_id,
        "strategyId": state["strategyId"],
        "updatedAt": updated_at,
        "orders": state["orders"],
        "positions": []
        if quantity <= 0
        else [
            {
                "symbol": state["symbol"],
                "market": state["market"],
                "quantity": quantity,
                "averageEntryPrice": average_entry_price,
                "markPrice": mark_price,
                "unrealizedPnlUsd": unrealized_pnl,
                "realizedPnlUsd": realized_pnl,
            }
        ],
        "trades": state["trades"],
    }


def _load_or_initialize_session_state(
    strategy_id: str,
    runs_path: Path,
    started_at: str,
    session_id: str,
) -> dict[str, Any]:
    existing = _read_json(_session_state_artifact_path(strategy_id, runs_path))
    if existing and existing.get("sessionId") == session_id:
        return existing

    seed = _session_telemetry_seed(strategy_id)
    entry_price = _read_market_price(strategy_id, runs_path, 0, float(seed["markPrice"]))
    quantity = float(seed["quantity"])
    entry_fee = round(entry_price * quantity * 0.001, 2)

    if strategy_id == "crypto-breakout" and _crypto_breakout_requires_confirmed_entry():
        return {
            "strategyId": strategy_id,
            "sessionId": session_id,
            "symbol": seed["symbol"],
            "market": seed["market"],
            "phase": "waiting_entry",
            "tick": 0,
            "startedAt": started_at,
            "referencePrice": entry_price,
            "entryPrice": entry_price,
            "currentPrice": entry_price,
            "initialQuantity": quantity,
            "remainingQuantity": 0.0,
            "plannedQuantity": quantity,
            "realizedPnlUsd": 0.0,
            "entryTick": 0,
            "highestPrice": entry_price,
            "priceWindow": [entry_price],
            "expectedEdgeBps": seed["expectedEdgeBps"],
            "entryExplanation": seed["explanation"],
            "orders": [],
            "trades": [],
        }

    return {
        "strategyId": strategy_id,
        "sessionId": session_id,
        "symbol": seed["symbol"],
        "market": seed["market"],
        "phase": "open",
        "tick": 0,
        "startedAt": started_at,
        "entryPrice": entry_price,
        "currentPrice": entry_price,
        "initialQuantity": quantity,
        "remainingQuantity": quantity,
        "realizedPnlUsd": 0.0,
        "entryTick": 0,
        "highestPrice": entry_price,
        "expectedEdgeBps": seed["expectedEdgeBps"],
        "entryExplanation": seed["explanation"],
        "orders": [
            {
                "id": f"runtime-order-entry-{strategy_id}",
                "strategyId": strategy_id,
                "symbol": seed["symbol"],
                "market": seed["market"],
                "side": "buy",
                "quantity": quantity,
                "submittedAt": started_at,
                "rationale": seed["explanation"],
                "status": "filled",
                "averageFillPrice": entry_price,
            }
        ],
        "trades": [
            {
                "id": f"runtime-trade-entry-{strategy_id}-{session_id}",
                "strategyId": strategy_id,
                "symbol": seed["symbol"],
                "market": seed["market"],
                "venue": _trade_venue(str(seed["market"])),
                "executionMode": "paper",
                "runtimeSource": _runtime_source(),
                "sessionId": session_id,
                "side": "buy",
                "quantity": quantity,
                "price": entry_price,
                "feeUsd": entry_fee,
                "realizedPnlUsd": 0.0,
                "expectedEdgeBps": seed["expectedEdgeBps"],
                "explanation": seed["explanation"],
                "createdAt": started_at,
            }
        ],
    }


def _advance_session_state(
    strategy_id: str,
    state: dict[str, Any],
    runs_path: Path,
    updated_at: str,
) -> dict[str, Any]:
    next_state = dict(state)
    tick = int(next_state.get("tick", 0))
    if tick == 0:
        current_price = float(next_state["currentPrice"])
    else:
        current_price = _read_market_price(strategy_id, runs_path, tick, float(next_state["currentPrice"]))

    next_state["currentPrice"] = current_price
    next_state["tick"] = tick + 1

    if strategy_id != "crypto-breakout":
        return next_state

    phase = str(next_state.get("phase", "open"))

    if phase == "waiting_entry":
        price_window = [float(value) for value in list(next_state.get("priceWindow", [])) if isinstance(value, (float, int))]
        price_window.append(current_price)
        price_window = price_window[-4:]
        next_state["priceWindow"] = price_window
        reference_price = float(next_state.get("referencePrice", current_price))
        breakout_trigger = max(price_window[:-1], default=reference_price)
        confirmation_ready = (
            len(price_window) >= 4
            and current_price >= reference_price * 1.0004
            and current_price >= breakout_trigger * 1.00035
        )
        if confirmation_ready:
            _append_entry_fill(next_state, float(next_state.get("plannedQuantity", next_state["initialQuantity"])), current_price, updated_at)
            next_state["entryTick"] = int(next_state["tick"])
            next_state["highestPrice"] = current_price
            next_state["phase"] = "open"
        elif int(next_state["tick"]) >= 90:
            next_state["referencePrice"] = current_price
            next_state["priceWindow"] = [current_price]
        return next_state

    entry_price = float(next_state["entryPrice"])
    remaining_quantity = float(next_state["remainingQuantity"])
    fast_test_cycle = bool(_read_test_price_series())
    entry_tick = int(next_state.get("entryTick", 0))
    holding_ticks = max(int(next_state["tick"]) - entry_tick, 0)
    highest_price = max(float(next_state.get("highestPrice", entry_price)), current_price)
    next_state["highestPrice"] = highest_price

    if (
        phase == "open"
        and remaining_quantity > 0
        and current_price >= entry_price * (1.004 if fast_test_cycle else REAL_CYCLE_SCALE_TARGET_MULTIPLIER)
        and (fast_test_cycle or holding_ticks >= REAL_CYCLE_SCALE_TICK)
    ):
        partial_quantity = round(float(next_state["initialQuantity"]) / 2, 6)
        _append_exit_fill(next_state, partial_quantity, current_price, updated_at, "Scaled half the Kraken paper leg.")
        phase = "scaled"

    remaining_quantity = float(next_state["remainingQuantity"])
    close_stop_multiplier = 0.995 if fast_test_cycle else REAL_CYCLE_STOP_MULTIPLIER
    close_target_multiplier = 1.008 if fast_test_cycle else REAL_CYCLE_CLOSE_TARGET_MULTIPLIER
    close_soft_timeout_tick = TEST_CYCLE_CLOSE_TICK if fast_test_cycle else REAL_CYCLE_SOFT_TIMEOUT_TICK
    close_hard_timeout_tick = TEST_CYCLE_CLOSE_TICK if fast_test_cycle else REAL_CYCLE_HARD_TIMEOUT_TICK
    protective_stop_price = (
        entry_price * 0.9995
        if fast_test_cycle
        else max(
            entry_price * REAL_CYCLE_PROTECTIVE_STOP_MULTIPLIER,
            highest_price * REAL_CYCLE_TRAILING_STOP_MULTIPLIER,
        )
    )
    close_timeout_ready = (
        holding_ticks >= TEST_CYCLE_CLOSE_TICK
        if fast_test_cycle
        else (
            (
                holding_ticks >= close_soft_timeout_tick
                and current_price >= entry_price * REAL_CYCLE_SOFT_TIMEOUT_PROFIT_MULTIPLIER
            )
            or holding_ticks >= close_hard_timeout_tick
        )
    )

    if phase in {"open", "scaled"} and remaining_quantity > 0 and (
        current_price <= (protective_stop_price if phase == "scaled" else entry_price * close_stop_multiplier)
        or current_price >= entry_price * close_target_multiplier
        or close_timeout_ready
    ):
        _append_exit_fill(next_state, remaining_quantity, current_price, updated_at, "Closed the Kraken paper leg.")
        phase = "closed"

    next_state["phase"] = phase
    return next_state


def _append_exit_fill(
    state: dict[str, Any],
    quantity: float,
    price: float,
    created_at: str,
    explanation: str,
) -> None:
    if quantity <= 0:
        return

    remaining_quantity = round(max(float(state["remainingQuantity"]) - quantity, 0.0), 6)
    entry_price = float(state["entryPrice"])
    realized_pnl = round((price - entry_price) * quantity, 2)
    fee_usd = round(price * quantity * 0.001, 2)
    fill_index = len(state["trades"]) + 1
    session_id = str(state["sessionId"])

    state["remainingQuantity"] = remaining_quantity
    state["realizedPnlUsd"] = round(float(state["realizedPnlUsd"]) + realized_pnl, 2)
    state["orders"] = list(state["orders"]) + [
        {
            "id": f"runtime-order-exit-{state['strategyId']}-{fill_index}",
            "strategyId": state["strategyId"],
            "symbol": state["symbol"],
            "market": state["market"],
            "side": "sell",
            "quantity": quantity,
            "submittedAt": created_at,
            "rationale": explanation,
            "status": "filled",
            "averageFillPrice": price,
        }
    ]
    state["trades"] = list(state["trades"]) + [
        {
            "id": f"runtime-trade-exit-{state['strategyId']}-{session_id}-{fill_index}",
            "strategyId": state["strategyId"],
            "symbol": state["symbol"],
            "market": state["market"],
            "venue": _trade_venue(str(state["market"])),
            "executionMode": "paper",
            "runtimeSource": _runtime_source(),
            "sessionId": session_id,
            "side": "sell",
            "quantity": quantity,
            "price": price,
            "feeUsd": fee_usd,
            "realizedPnlUsd": realized_pnl,
            "expectedEdgeBps": state["expectedEdgeBps"],
            "explanation": explanation,
            "createdAt": created_at,
        }
    ]


def _append_entry_fill(
    state: dict[str, Any],
    quantity: float,
    price: float,
    created_at: str,
) -> None:
    if quantity <= 0:
        return

    fee_usd = round(price * quantity * 0.001, 2)
    state["entryPrice"] = price
    state["currentPrice"] = price
    state["initialQuantity"] = quantity
    state["remainingQuantity"] = quantity
    state["entryTick"] = int(state.get("tick", 0))
    state["highestPrice"] = price
    state["orders"] = [
        {
            "id": f"runtime-order-entry-{state['strategyId']}",
            "strategyId": state["strategyId"],
            "symbol": state["symbol"],
            "market": state["market"],
            "side": "buy",
            "quantity": quantity,
            "submittedAt": created_at,
            "rationale": state["entryExplanation"],
            "status": "filled",
            "averageFillPrice": price,
        }
    ]
    state["trades"] = [
        {
            "id": f"runtime-trade-entry-{state['strategyId']}-{state['sessionId']}",
            "strategyId": state["strategyId"],
            "symbol": state["symbol"],
            "market": state["market"],
            "venue": _trade_venue(str(state["market"])),
            "executionMode": "paper",
            "runtimeSource": _runtime_source(),
            "sessionId": state["sessionId"],
            "side": "buy",
            "quantity": quantity,
            "price": price,
            "feeUsd": fee_usd,
            "realizedPnlUsd": 0.0,
            "expectedEdgeBps": state["expectedEdgeBps"],
            "explanation": state["entryExplanation"],
            "createdAt": created_at,
        }
    ]


def _trade_venue(market: str) -> str:
    return "kraken" if market == "crypto" else "simulation"


def _read_market_price(strategy_id: str, runs_path: Path, tick: int, fallback_price: float) -> float:
    if strategy_id == "crypto-breakout":
        series = _read_test_price_series()
        if series:
            return series[min(tick, len(series) - 1)]
        live_price = _read_cached_kraken_public_price(runs_path)
        if live_price is not None:
            return live_price
    elif strategy_id == "stock-momentum":
        return round(fallback_price + min(tick, 4) * 0.35, 2)

    return fallback_price


def _read_test_price_series() -> list[float]:
    raw = os.getenv("HEXCHANGE_KRAKEN_TEST_PRICE_SERIES")
    if not raw:
        return []
    values: list[float] = []
    for item in raw.split(","):
        try:
            parsed = float(item.strip())
        except ValueError:
            continue
        if parsed > 0:
            values.append(parsed)
    return values


def _crypto_breakout_requires_confirmed_entry() -> bool:
    if _read_test_price_series():
        return False
    return os.getenv("HEXCHANGE_CRYPTO_PAPER_CONFIRMED_ENTRY", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _read_cached_kraken_public_price(runs_path: Path) -> float | None:
    cache_path = runs_path / "kraken-public-price.json"
    cached = _read_json(cache_path)
    if cached:
        checked_at = cached.get("checkedAt")
        price = cached.get("price")
        if (
            isinstance(price, (float, int))
            and isinstance(checked_at, str)
            and not _heartbeat_stale_for_ttl(checked_at, 2)
        ):
            return float(price)

    request = urllib.request.Request(
        "https://api.kraken.com/0/public/Ticker?pair=BTCUSD",
        method="GET",
        headers={
            "User-Agent": "Hexchange paper ticker",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read().decode()
        parsed = json.loads(raw)
        ticker = parsed.get("result")
        first = list(ticker.values())[0] if isinstance(ticker, dict) and ticker else None
        price = float(first.get("c", [None])[0]) if isinstance(first, dict) else None
        if price and price > 0:
            write_json_artifact(
                cache_path,
                {
                    "checkedAt": datetime.now(timezone.utc).isoformat(),
                    "price": price,
                },
            )
            return price
    except Exception:
        return None
    return None


def _session_telemetry_seed(strategy_id: str) -> dict[str, Any]:
    if strategy_id == "crypto-breakout":
        return {
            "symbol": "BTCUSD",
            "market": "crypto",
            "side": "buy",
            "quantity": 0.021,
            "averageEntryPrice": 64688.0,
            "markPrice": 64724.0,
            "feeUsd": 1.36,
            "realizedPnlUsd": 4.18,
            "expectedEdgeBps": 148,
            "explanation": "Kraken runtime telemetry executed the active crypto validation leg.",
        }

    return {
        "symbol": "AAPL",
        "market": "stock",
        "side": "buy",
        "quantity": 3,
        "averageEntryPrice": 219.1,
        "markPrice": 219.85,
        "feeUsd": 0.66,
        "realizedPnlUsd": 1.92,
        "expectedEdgeBps": 62,
        "explanation": "Runtime telemetry executed the active stock validation leg.",
    }

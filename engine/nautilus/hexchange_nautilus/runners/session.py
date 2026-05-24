from __future__ import annotations

from datetime import datetime, timezone
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

from ..artifacts import write_json_artifact

HEARTBEAT_INTERVAL_SECONDS = 0.5
HEARTBEAT_STALE_AFTER_SECONDS = 2.5


def start_session(strategy_id: str, runs_dir: str) -> tuple[str, str]:
    runs_path = Path(runs_dir)
    artifact_path = _session_artifact_path(strategy_id, runs_path)
    existing = _read_json(artifact_path)
    if existing and _is_process_alive(existing.get("processId")) and existing.get("state") in {"paper", "live"}:
        return str(existing.get("sessionId") or f"paper-{strategy_id}"), str(artifact_path)

    runs_path.mkdir(parents=True, exist_ok=True)
    log_path = runs_path / f"session-{strategy_id}.log"
    with log_path.open("a", encoding="utf-8") as log_file:
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
            ],
            stdout=log_file,
            stderr=log_file,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    _wait_for_session_bootstrap(artifact_path, process.pid)
    return f"paper-{strategy_id}", str(artifact_path)


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
                "alive": alive and not stale,
            }
        )

    runtime_health = "degraded" if degraded else "ready"
    artifact_path = runs_path / "runtime-status.json"
    return write_json_artifact(
        artifact_path,
        {
            "runtimeHealth": runtime_health,
            "nautilusInstalled": nautilus_installed,
            "nautilusVersion": nautilus_version,
            "venues": _build_venue_statuses(),
            "sessions": sessions,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )


def session_worker(strategy_id: str, runs_dir: str) -> None:
    runs_path = Path(runs_dir)
    artifact_path = _session_artifact_path(strategy_id, runs_path)
    started_at = datetime.now(timezone.utc).isoformat()
    process_id = os.getpid()
    runtime_source = _runtime_source()
    running = True

    def handle_stop(_signum: int, _frame: object) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        now = datetime.now(timezone.utc).isoformat()
        write_json_artifact(
            artifact_path,
            {
                "sessionId": f"paper-{strategy_id}",
                "strategyId": strategy_id,
                "startedAt": started_at,
                "lastHeartbeatAt": now,
                "processId": process_id,
                "runtimeSource": runtime_source,
                "state": "paper",
                "alive": True,
            },
        )
        time.sleep(HEARTBEAT_INTERVAL_SECONDS)

    write_json_artifact(
        artifact_path,
        {
            "sessionId": f"paper-{strategy_id}",
            "strategyId": strategy_id,
            "startedAt": started_at,
            "lastHeartbeatAt": datetime.now(timezone.utc).isoformat(),
            "processId": process_id,
            "runtimeSource": runtime_source,
            "state": "stopped",
            "alive": False,
            "stoppedAt": datetime.now(timezone.utc).isoformat(),
        },
    )


def _session_artifact_path(strategy_id: str, runs_path: Path) -> Path:
    return runs_path / f"session-{strategy_id}.json"


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


def _build_venue_statuses() -> list[dict[str, Any]]:
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
            "connected": kraken_adapter and kraken_configured,
            "scope": "crypto",
            "details": (
                "Credentials loaded for Kraken adapter."
                if kraken_adapter and kraken_configured
                else "Adapter unavailable." if not kraken_adapter else "Kraken API credentials missing."
            ),
        },
    ]

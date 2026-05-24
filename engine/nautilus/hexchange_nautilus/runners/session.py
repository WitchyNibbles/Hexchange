from __future__ import annotations

from datetime import datetime, timezone
from importlib import metadata as importlib_metadata
import importlib.util
from pathlib import Path
import json

from ..artifacts import write_json_artifact


def start_session(strategy_id: str, runs_dir: str) -> tuple[str, str]:
    session_id = f"paper-{strategy_id}"
    artifact_path = Path(runs_dir) / f"session-{strategy_id}.json"
    write_json_artifact(
        artifact_path,
        {
            "sessionId": session_id,
            "strategyId": strategy_id,
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "state": "paper",
        },
    )
    return session_id, str(artifact_path)


def stop_session(strategy_id: str, runs_dir: str) -> str:
    artifact_path = Path(runs_dir) / f"session-{strategy_id}.json"
    return write_json_artifact(
        artifact_path,
        {
            "sessionId": f"paper-{strategy_id}",
            "strategyId": strategy_id,
            "state": "stopped",
            "stoppedAt": datetime.now(timezone.utc).isoformat(),
        },
    )


def runtime_status(runs_dir: str) -> str:
    runs_path = Path(runs_dir)
    sessions = []
    nautilus_installed = importlib.util.find_spec("nautilus_trader") is not None
    nautilus_version = None

    if nautilus_installed:
        try:
            nautilus_version = importlib_metadata.version("nautilus_trader")
        except importlib_metadata.PackageNotFoundError:
            nautilus_version = None

    for session_file in sorted(runs_path.glob("session-*.json")):
        try:
            parsed = json.loads(session_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

        sessions.append(
            {
                "sessionId": parsed.get("sessionId"),
                "strategyId": parsed.get("strategyId"),
                "state": parsed.get("state", "unknown"),
            }
        )

    artifact_path = runs_path / "runtime-status.json"
    return write_json_artifact(
        artifact_path,
        {
            "runtimeHealth": "ready" if nautilus_installed else "degraded",
            "nautilusInstalled": nautilus_installed,
            "nautilusVersion": nautilus_version,
            "sessions": sessions,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )

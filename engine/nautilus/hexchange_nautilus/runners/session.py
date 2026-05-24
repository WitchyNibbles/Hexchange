from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

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

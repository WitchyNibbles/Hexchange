from __future__ import annotations

from pathlib import Path
import json


def write_json_artifact(target: Path, payload: dict) -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return str(target)

from __future__ import annotations

from pathlib import Path
import json
import os
import tempfile


def write_json_artifact(target: Path, payload: dict) -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as temp_file:
        json.dump(payload, temp_file, indent=2)
        temp_file.flush()
        os.fsync(temp_file.fileno())
        temp_path = Path(temp_file.name)

    temp_path.replace(target)
    return str(target)

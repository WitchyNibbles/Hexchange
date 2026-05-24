from dataclasses import dataclass
from pathlib import Path


@dataclass
class RuntimePaths:
    project_dir: Path
    runs_dir: Path

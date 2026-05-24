from dataclasses import asdict, dataclass
import json


@dataclass
class CliResult:
    status: str
    message: str
    artifactPath: str | None = None
    sessionId: str | None = None

    def to_json(self) -> str:
        return json.dumps(asdict(self))

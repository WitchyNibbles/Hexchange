from .models import CliResult


def main() -> None:
    result = CliResult(status="ok", message="Hexchange Nautilus runtime scaffold ready.")
    print(result.to_json())

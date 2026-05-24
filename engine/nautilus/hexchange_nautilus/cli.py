from __future__ import annotations

import argparse

from .models import CliResult
from .runners.backtest import run_backtest
from .runners.session import runtime_status, start_session, stop_session


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="hexchange-nautilus")
    subcommands = parser.add_subparsers(dest="command", required=True)

    backtest = subcommands.add_parser("backtest")
    backtest.add_argument("--strategy-id", required=True)
    backtest.add_argument("--symbol", required=True)
    backtest.add_argument("--market", required=True)
    backtest.add_argument("--runs-dir", required=True)

    start = subcommands.add_parser("start-session")
    start.add_argument("--strategy-id", required=True)
    start.add_argument("--runs-dir", required=True)

    stop = subcommands.add_parser("stop-session")
    stop.add_argument("--strategy-id", required=True)
    stop.add_argument("--runs-dir", required=True)

    status = subcommands.add_parser("status")
    status.add_argument("--runs-dir", required=True)

    worker = subcommands.add_parser("session-worker")
    worker.add_argument("--strategy-id", required=True)
    worker.add_argument("--runs-dir", required=True)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "backtest":
        artifact_path = run_backtest(args.strategy_id, args.symbol, args.market, args.runs_dir)
        result = CliResult(status="ok", message="Backtest artifact generated.", artifactPath=artifact_path)
    elif args.command == "start-session":
        session_id, artifact_path = start_session(args.strategy_id, args.runs_dir)
        result = CliResult(status="ok", message="Session started.", artifactPath=artifact_path, sessionId=session_id)
    elif args.command == "stop-session":
        artifact_path = stop_session(args.strategy_id, args.runs_dir)
        result = CliResult(status="ok", message="Session stopped.", artifactPath=artifact_path)
    elif args.command == "session-worker":
        from .runners.session import session_worker

        session_worker(args.strategy_id, args.runs_dir)
        return
    else:
        artifact_path = runtime_status(args.runs_dir)
        result = CliResult(status="ok", message=f"Runtime ready for {args.runs_dir}.", artifactPath=artifact_path)

    print(result.to_json())


if __name__ == "__main__":
    main()

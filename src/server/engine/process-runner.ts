import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface ProcessRunnerResult {
  ok: boolean;
  artifactPath?: string;
  sessionId?: string;
  error?: string;
}

export interface ProcessRunnerRequest {
  command: "backtest" | "start-session" | "stop-session" | "status";
  payload: Record<string, unknown>;
}

export type ProcessRunner = (request: ProcessRunnerRequest) => Promise<ProcessRunnerResult>;

const execFileAsync = promisify(execFile);

export function createProcessRunner(): ProcessRunner {
  return async (request) => {
    const pythonPath =
      typeof request.payload.pythonPath === "string" && request.payload.pythonPath.length > 0
        ? request.payload.pythonPath
        : null;
    const projectDir =
      typeof request.payload.projectDir === "string" && request.payload.projectDir.length > 0
        ? request.payload.projectDir
        : null;
    const runsDir =
      typeof request.payload.runsDir === "string" && request.payload.runsDir.length > 0
        ? request.payload.runsDir
        : null;

    if (!pythonPath || !projectDir || !runsDir) {
      return {
        ok: false,
        error: "Missing python path, project dir, or runs dir.",
      };
    }

    const args = ["-m", "hexchange_nautilus.cli", request.command, "--runs-dir", runsDir];

    if (typeof request.payload.strategyId === "string") {
      args.push("--strategy-id", request.payload.strategyId);
    }
    if (typeof request.payload.symbol === "string") {
      args.push("--symbol", request.payload.symbol);
    }
    if (typeof request.payload.market === "string") {
      args.push("--market", request.payload.market);
    }

    try {
      const { stdout } = await execFileAsync(pythonPath, args, {
        cwd: projectDir,
      });
      const parsed = JSON.parse(stdout) as {
        status: string;
        message: string;
        artifactPath?: string | null;
        sessionId?: string | null;
      };

      return {
        ok: parsed.status === "ok",
        artifactPath: parsed.artifactPath ?? undefined,
        sessionId: parsed.sessionId ?? undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown process runner error.",
      };
    }
  };
}

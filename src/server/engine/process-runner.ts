export interface ProcessRunnerResult {
  ok: boolean;
  artifactPath?: string;
  error?: string;
}

export interface ProcessRunnerRequest {
  command: "backtest" | "start-session" | "stop-session";
  payload: Record<string, unknown>;
}

export type ProcessRunner = (request: ProcessRunnerRequest) => Promise<ProcessRunnerResult>;

export function createProcessRunner(): ProcessRunner {
  return async () => ({
    ok: false,
    error: "Nautilus runtime process execution is not wired yet.",
  });
}

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NautilusAdapter } from "../../../src/server/engine/nautilus-adapter";

describe("nautilus adapter", () => {
  it("uses a runner artifact to produce a normalized backtest result", async () => {
    const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", "nautilus", "backtest-result.json");
    const adapter = new NautilusAdapter({
      mode: "nautilus",
      pythonPath: "/usr/bin/python3",
      projectDir: "/tmp/engine/nautilus",
      runsDir: "/tmp/engine/runs",
      runner: async () => ({
        ok: true,
        artifactPath: fixturePath,
      }),
    });

    const result = await adapter.runBacktest({
      strategyId: "stock-momentum",
      symbol: "AAPL",
      market: "stock",
    });

    expect(result).toEqual({
      strategyId: "stock-momentum",
      runId: "nautilus-backtest-stock-momentum",
      feeAdjustedReturnPct: 9.7,
      maxDrawdownPct: 3.8,
      trades: 28,
      executedAt: "2026-05-24T10:00:00.000Z",
      runtimeSource: "nautilus_trader",
      dataSource: "Locally generated sample bars via NautilusTrader.",
    });
  });

  it("falls back to simulated backtests when the nautilus runtime is unavailable", async () => {
    const adapter = new NautilusAdapter({
      mode: "nautilus",
      pythonPath: "/usr/bin/python3",
      projectDir: "/tmp/engine/nautilus",
      runsDir: "/tmp/engine/runs",
      runner: async () => ({
        ok: false,
        error: "python runtime unavailable",
      }),
    });

    const result = await adapter.runBacktest({
      strategyId: "crypto-breakout",
      symbol: "BTC/USD",
      market: "crypto",
    });

    expect(result.strategyId).toBe("crypto-breakout");
    expect(result.feeAdjustedReturnPct).toBeGreaterThan(0);
    expect(result.runId).toContain("backtest-crypto-breakout");
    expect(result.runtimeSource).toBe("synthetic");
  });

  it("uses a runner artifact to start and stop managed paper sessions", async () => {
    const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", "nautilus", "session-status.json");
    const runnerCalls: string[] = [];
    const adapter = new NautilusAdapter({
      mode: "nautilus",
      pythonPath: "/usr/bin/python3",
      projectDir: "/tmp/engine/nautilus",
      runsDir: "/tmp/engine/runs",
      runner: async (request) => {
        runnerCalls.push(request.command);
        return {
          ok: true,
          artifactPath: fixturePath,
          sessionId: "paper-stock-momentum",
        };
      },
    });

    const session = await adapter.startPaperSession("stock-momentum");
    expect(session).toEqual({
      sessionId: "paper-stock-momentum",
      strategyId: "stock-momentum",
      startedAt: "2026-05-24T11:30:00.000Z",
      lastHeartbeatAt: "2026-05-24T11:31:00.000Z",
      processId: 4242,
      runtimeSource: "nautilus_trader",
      executionMode: "kraken_ready",
    });

    const status = await adapter.getStrategyStatus("stock-momentum");
    expect(status.state).toBe("paper");

    await adapter.stopSession(session.sessionId);

    const finalStatus = await adapter.getStrategyStatus("stock-momentum");
    expect(finalStatus.state).toBe("idle");
    expect(runnerCalls).toEqual(["start-session", "stop-session"]);
  });

  it("prefers fresh runtime-status heartbeats over stale in-memory session metadata", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "hexchange-nautilus-adapter-"));
    const startFixturePath = path.resolve(process.cwd(), "tests", "fixtures", "nautilus", "session-status.json");
    const runtimeStatusPath = path.join(tempDir, "runtime-status.json");

    await writeFile(
      runtimeStatusPath,
      JSON.stringify(
        {
          runtimeHealth: "ready",
          nautilusInstalled: true,
          nautilusVersion: "1.220.0",
          venues: [],
          sessions: [
            {
              sessionId: "paper-stock-momentum",
              strategyId: "stock-momentum",
              state: "paper",
              startedAt: "2026-05-24T11:30:00.000Z",
              lastHeartbeatAt: "2026-05-24T11:35:00.000Z",
              processId: 4242,
              alive: true,
              runtimeSource: "nautilus_trader",
              executionMode: "kraken_ready",
            },
          ],
          updatedAt: "2026-05-24T11:35:00.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    const adapter = new NautilusAdapter({
      mode: "nautilus",
      pythonPath: "/usr/bin/python3",
      projectDir: tempDir,
      runsDir: tempDir,
      runner: async (request) => ({
        ok: true,
        artifactPath: request.command === "status" ? runtimeStatusPath : startFixturePath,
        sessionId: "paper-stock-momentum",
      }),
    });

    try {
      await adapter.startPaperSession("stock-momentum");
      const status = await adapter.getStrategyStatus("stock-momentum");
      expect(status).toEqual({
        strategyId: "stock-momentum",
        state: "paper",
        lastHeartbeatAt: "2026-05-24T11:35:00.000Z",
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reuses an already-live runtime session instead of spawning a duplicate worker", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "hexchange-nautilus-adapter-"));
    const runtimeStatusPath = path.join(tempDir, "runtime-status.json");
    const runnerCalls: string[] = [];

    await writeFile(
      runtimeStatusPath,
      JSON.stringify(
        {
          runtimeHealth: "ready",
          nautilusInstalled: true,
          nautilusVersion: "1.220.0",
          venues: [],
          sessions: [
            {
              sessionId: "paper-crypto-breakout-runtime",
              strategyId: "crypto-breakout",
              state: "paper",
              startedAt: "2026-05-26T01:10:00.000Z",
              lastHeartbeatAt: "2026-05-26T01:10:30.000Z",
              processId: 4243,
              alive: true,
              runtimeSource: "nautilus_trader",
              executionMode: "kraken_ready",
            },
          ],
          updatedAt: "2026-05-26T01:10:30.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    const adapter = new NautilusAdapter({
      mode: "nautilus",
      pythonPath: "/usr/bin/python3",
      projectDir: tempDir,
      runsDir: tempDir,
      runner: async (request) => {
        runnerCalls.push(request.command);
        return {
          ok: true,
          artifactPath: runtimeStatusPath,
          sessionId: "paper-crypto-breakout-runtime",
        };
      },
    });

    try {
      const session = await adapter.startPaperSession("crypto-breakout");
      expect(session).toEqual({
        sessionId: "paper-crypto-breakout-runtime",
        strategyId: "crypto-breakout",
        startedAt: "2026-05-26T01:10:00.000Z",
        lastHeartbeatAt: "2026-05-26T01:10:30.000Z",
        processId: 4243,
        runtimeSource: "nautilus_trader",
        executionMode: "kraken_ready",
      });
      expect(runnerCalls).toEqual(["status"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to the direct live session artifact when runtime status lags behind", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "hexchange-nautilus-adapter-"));
    const runtimeStatusPath = path.join(tempDir, "runtime-status.json");
    const directSessionPath = path.join(tempDir, "session-crypto-breakout.json");

    await writeFile(
      runtimeStatusPath,
      JSON.stringify(
        {
          runtimeHealth: "degraded",
          nautilusInstalled: true,
          nautilusVersion: "1.220.0",
          venues: [],
          sessions: [
            {
              sessionId: "paper-crypto-breakout-runtime",
              strategyId: "crypto-breakout",
              state: "stale",
              startedAt: "2026-05-26T01:10:00.000Z",
              lastHeartbeatAt: "2026-05-26T01:10:30.000Z",
              processId: process.pid,
              alive: false,
              runtimeSource: "nautilus_trader",
              executionMode: "kraken_ready",
            },
          ],
          updatedAt: "2026-05-26T01:10:30.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      directSessionPath,
      JSON.stringify(
        {
          sessionId: "paper-crypto-breakout-runtime",
          strategyId: "crypto-breakout",
          startedAt: "2026-05-26T01:10:00.000Z",
          lastHeartbeatAt: new Date().toISOString(),
          processId: process.pid,
          runtimeSource: "nautilus_trader",
          executionMode: "kraken_ready",
          state: "paper",
          alive: true,
          phase: "waiting_entry",
          currentPrice: 76580.5,
          referencePrice: 76580.4,
          entryTriggerPrice: 76611.0,
          entryDistanceUsd: 30.5,
        },
        null,
        2,
      ),
      "utf8",
    );

    const adapter = new NautilusAdapter({
      mode: "nautilus",
      pythonPath: "/usr/bin/python3",
      projectDir: tempDir,
      runsDir: tempDir,
      runner: async (request) => ({
        ok: true,
        artifactPath: request.command === "status" ? runtimeStatusPath : directSessionPath,
        sessionId: "paper-crypto-breakout-runtime",
      }),
    });

    try {
      const session = await adapter.getPaperSession("crypto-breakout");
      const status = await adapter.getStrategyStatus("crypto-breakout");

      expect(session).toEqual({
        sessionId: "paper-crypto-breakout-runtime",
        strategyId: "crypto-breakout",
        startedAt: "2026-05-26T01:10:00.000Z",
        lastHeartbeatAt: expect.any(String),
        processId: process.pid,
        runtimeSource: "nautilus_trader",
        executionMode: "kraken_ready",
        phase: "waiting_entry",
        currentPrice: 76580.5,
        referencePrice: 76580.4,
        entryTriggerPrice: 76611,
        entryDistanceUsd: 30.5,
      });
      expect(status).toEqual({
        strategyId: "crypto-breakout",
        state: "paper",
        lastHeartbeatAt: expect.any(String),
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

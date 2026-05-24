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
  });
});

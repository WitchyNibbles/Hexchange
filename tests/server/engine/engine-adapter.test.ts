import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEngineAdapter } from "../../../src/server/engine/engine-adapter";

describe("engine adapter", () => {
  it("runs backtests and starts paper sessions through the engine boundary", async () => {
    const adapter = createEngineAdapter();
    const workspaceRoot = path.resolve(process.cwd(), "engine", "nautilus");

    const backtest = await adapter.runBacktest({
      strategyId: "stock-momentum",
      symbol: "AAPL",
      market: "stock",
    });

    expect(backtest.feeAdjustedReturnPct).toBeGreaterThan(0);
    expect(existsSync(workspaceRoot)).toBe(true);
    expect(existsSync(path.join(workspaceRoot, "pyproject.toml"))).toBe(true);
    expect(existsSync(path.join(workspaceRoot, "hexchange_nautilus", "cli.py"))).toBe(true);

    const session = await adapter.startPaperSession("stock-momentum");
    const status = await adapter.getStrategyStatus("stock-momentum");

    expect(session.sessionId).toContain("paper-stock-momentum");
    expect(status.state).toBe("paper");
  });
});

import type {
  EngineStatus,
  LiveReadinessCheck,
  LiveReadinessReport,
  PaperValidationStats,
  RiskSettings,
  StrategyLiveReadiness,
} from "../../shared/contracts";
import type { StrategyState } from "../domain/strategy";
import type { BacktestResult, PaperSession } from "../engine/types";
import type { PaperCycleEvidence } from "./live-armament-policy";
import { buildValidationReport } from "../strategies/validation-report";

const MAX_SAFE_LIVE_ROLLOUT_USD = 1000;

interface BuildLiveReadinessReportInput {
  engineStatus: EngineStatus;
  strategies: StrategyState[];
  backtests: BacktestResult[];
  managedSessions: Map<string, PaperSession>;
  paperValidationStatsByStrategy: Map<string, PaperValidationStats>;
  lastPaperCycleByStrategy: Map<string, PaperCycleEvidence | null>;
  riskSettings: RiskSettings;
  killSwitchEngaged: boolean;
}

function buildRuntimeCheck(engineStatus: EngineStatus): LiveReadinessCheck {
  if (engineStatus.mode !== "nautilus" || !engineStatus.available || engineStatus.runtimeHealth === "offline") {
    return {
      id: "nautilus-runtime",
      label: "Nautilus runtime",
      status: "fail",
      summary: "The Nautilus runtime is not currently available for live execution.",
      details: engineStatus.runtimeDetails ?? "Switch to Nautilus mode and load a working Python runtime.",
    };
  }

  if (engineStatus.runtimeHealth === "degraded") {
    return {
      id: "nautilus-runtime",
      label: "Nautilus runtime",
      status: "warn",
      summary: "The Nautilus runtime is available but degraded.",
      details: engineStatus.runtimeDetails ?? "Review runtime warnings before enabling live trading.",
    };
  }

  return {
    id: "nautilus-runtime",
    label: "Nautilus runtime",
    status: "pass",
    summary: "The Nautilus runtime is available for local execution.",
    details: engineStatus.runtimeDetails ?? null,
  };
}

function buildVenueCheck(
  engineStatus: EngineStatus,
  venueName: "interactive_brokers" | "kraken",
  label: string,
  options?: {
    optional?: boolean;
    optionalSummary?: string;
  },
): LiveReadinessCheck {
  const venue = engineStatus.venues.find((entry) => entry.venue === venueName);
  if (!venue || !venue.connected) {
    if (options?.optional) {
      return {
        id: `${venueName}-connectivity`,
        label,
        status: "pass",
        summary: options.optionalSummary ?? `${label} is not configured yet.`,
        details: venue?.details ?? `The ${label} adapter has not reported a live-ready connection.`,
      };
    }

    return {
      id: `${venueName}-connectivity`,
      label,
      status: "fail",
      summary: `${label} is not ready for live execution.`,
      details: venue?.details ?? `The ${label} adapter has not reported a live-ready connection.`,
    };
  }

  return {
    id: `${venueName}-connectivity`,
    label,
    status: "pass",
    summary: `${label} is connected and ready.`,
    details: venue.details ?? null,
  };
}

function buildKillSwitchCheck(killSwitchEngaged: boolean): LiveReadinessCheck {
  return killSwitchEngaged
    ? {
        id: "kill-switch",
        label: "Kill switch",
        status: "fail",
        summary: "The kill switch is engaged.",
        details: "Reset the kill switch before arming any strategy for live trading.",
      }
    : {
        id: "kill-switch",
        label: "Kill switch",
        status: "pass",
        summary: "The kill switch is clear.",
        details: "Live trading can be armed once the other gates pass.",
      };
}

function buildRolloutCapCheck(riskSettings: RiskSettings): LiveReadinessCheck {
  return riskSettings.liveRolloutCapUsd > MAX_SAFE_LIVE_ROLLOUT_USD
    ? {
        id: "live-rollout-cap",
        label: "Live rollout cap",
        status: "fail",
        summary: `Live rollout cap is too high at $${riskSettings.liveRolloutCapUsd.toFixed(0)}.`,
        details: `Lower the cap to $${MAX_SAFE_LIVE_ROLLOUT_USD.toFixed(0)} or less before using real funds.`,
      }
    : {
        id: "live-rollout-cap",
        label: "Live rollout cap",
        status: "pass",
        summary: `Live rollout cap is constrained to $${riskSettings.liveRolloutCapUsd.toFixed(0)}.`,
        details: "Tiny-size rollout policy is still in effect.",
      };
}

function buildStrategyReadiness(
  strategy: StrategyState,
  backtests: BacktestResult[],
  managedSessions: Map<string, PaperSession>,
  paperValidationStatsByStrategy: Map<string, PaperValidationStats>,
  lastPaperCycleByStrategy: Map<string, PaperCycleEvidence | null>,
  engineStatus: EngineStatus,
  killSwitchEngaged: boolean,
): StrategyLiveReadiness {
  const blockers: string[] = [];
  const paperValidationStats = paperValidationStatsByStrategy.get(strategy.id) ?? {
    cycles: 0,
    completedCycles: 0,
    cumulativeRealizedPnlUsd: 0,
    averageReturnPct: 0,
    winRatePct: 0,
  };
  const validation = buildValidationReport(strategy, paperValidationStats);
  const lastBacktest = backtests.find((item) => item.strategyId === strategy.id) ?? null;
  const paperSession = managedSessions.get(strategy.id) ?? null;
  const lastPaperCycle = lastPaperCycleByStrategy.get(strategy.id) ?? null;
  const deploymentMode = strategy.market === "stock" ? "simulation_only" : "kraken_live_candidate";

  if (strategy.market === "stock") {
    return {
      strategyId: strategy.id,
      name: strategy.name,
      market: strategy.market,
      stage: strategy.stage,
      deploymentMode,
      ready: false,
      blocking: false,
      blockers: ["Simulation only: stock execution is disabled until a real stock broker is added."],
      lastBacktestSource: lastBacktest?.runtimeSource ?? null,
      paperSessionMode: paperSession?.executionMode ?? null,
    };
  }

  if (!validation.passed) {
    blockers.push(...validation.reasons);
  }

  if (!lastBacktest || lastBacktest.runtimeSource !== "nautilus_trader") {
    blockers.push("Run a real Nautilus backtest first.");
  }

  if ((!paperSession || !strategy.paperSessionActive) && lastPaperCycle?.status !== "completed") {
    blockers.push("Run at least one completed Kraken paper cycle first.");
  }

  if (killSwitchEngaged) {
    blockers.push("Reset the kill switch before arming live.");
  }

  const venue = engineStatus.venues.find((item) => item.venue === "kraken");
  if (!venue?.connected) {
    blockers.push("Kraken must be connected for crypto execution.");
  }

  return {
    strategyId: strategy.id,
    name: strategy.name,
    market: strategy.market,
    stage: strategy.stage,
    deploymentMode,
    ready: blockers.length === 0,
    blocking: blockers.length > 0,
    blockers,
    lastBacktestSource: lastBacktest?.runtimeSource ?? null,
    paperSessionMode: paperSession?.executionMode ?? null,
  };
}

export function buildLiveReadinessReport(input: BuildLiveReadinessReportInput): LiveReadinessReport {
  const checks = [
    buildRuntimeCheck(input.engineStatus),
    buildVenueCheck(input.engineStatus, "interactive_brokers", "Interactive Brokers", {
      optional: true,
      optionalSummary: "Interactive Brokers is optional for now because stock strategies are simulation-only.",
    }),
    buildVenueCheck(input.engineStatus, "kraken", "Kraken"),
    buildKillSwitchCheck(input.killSwitchEngaged),
    buildRolloutCapCheck(input.riskSettings),
  ];

  const strategies = input.strategies.map((strategy) =>
    buildStrategyReadiness(
      strategy,
      input.backtests,
      input.managedSessions,
      input.paperValidationStatsByStrategy,
      input.lastPaperCycleByStrategy,
      input.engineStatus,
      input.killSwitchEngaged,
    ),
  );

  const failedChecks = checks.filter((check) => check.status === "fail").length;
  const warnedChecks = checks.filter((check) => check.status === "warn").length;
  const readyStrategies = strategies.filter((strategy) => strategy.ready).length;
  const blockedStrategies = strategies.filter((strategy) => strategy.blocking).length;
  const simulationOnlyStrategies = strategies.filter((strategy) => strategy.deploymentMode === "simulation_only").length;

  const overallStatus =
    failedChecks > 0 || blockedStrategies > 0 ? "blocked" : warnedChecks > 0 ? "attention" : "ready";

  const summary =
    overallStatus === "ready"
      ? `All global gates pass. ${readyStrategies} strategy${readyStrategies === 1 ? " is" : "ies are"} ready for guarded live rollout.`
      : `${blockedStrategies} ${blockedStrategies === 1 ? "strategy is" : "strategies are"} still blocking live rollout. ${simulationOnlyStrategies > 0 ? `${simulationOnlyStrategies} ${simulationOnlyStrategies === 1 ? "stock strategy remains" : "stock strategies remain"} simulation-only.` : ""} Resolve the failing runtime, Kraken, or safety checks before using real funds.`;

  return {
    updatedAt: new Date().toISOString(),
    overallStatus,
    summary,
    checks,
    strategies,
  };
}

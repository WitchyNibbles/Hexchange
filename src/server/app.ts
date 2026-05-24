import express, { type Express } from "express";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerEventRoutes } from "./api/events";
import type { HexchangeService } from "./services/hexchange-service";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..", "..", "..");

function asyncRoute<Req, Res>(
  handler: (request: express.Request, response: express.Response) => Promise<unknown>,
): (request: express.Request, response: express.Response, next: express.NextFunction) => void {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response)).catch(next);
  };
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function createServerApp(service: HexchangeService): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", asyncRoute(async (_request, response) => {
    response.json(await service.getHealth());
  }));

  app.get("/api/system/status", (_request, response) => {
    response.json(service.getSystemStatus());
  });

  app.get("/api/system/portfolio", (_request, response) => {
    response.json(service.getPortfolioSnapshot());
  });

  app.get("/api/engine/status", asyncRoute(async (_request, response) => {
    response.json(await service.getEngineStatus());
  }));

  app.get("/api/strategies", (_request, response) => {
    response.json(service.listStrategies());
  });

  app.post("/api/strategies/:strategyId/backtest", asyncRoute(async (request, response) => {
    response.json(await service.runStrategyBacktest(getRouteParam(request.params.strategyId)));
  }));

  app.post("/api/strategies/:strategyId/paper-session", asyncRoute(async (request, response) => {
    response.json(await service.startPaperSession(getRouteParam(request.params.strategyId)));
  }));

  app.post("/api/strategies/:strategyId/arm-live", asyncRoute(async (request, response) => {
    response.json(await service.armLiveStrategy(getRouteParam(request.params.strategyId)));
  }));

  app.get("/api/trades", (_request, response) => {
    response.json(service.listTrades());
  });

  app.post("/api/control/kill-switch", asyncRoute(async (request, response) => {
    const reason =
      typeof request.body?.reason === "string" && request.body.reason.trim().length > 0
        ? request.body.reason
        : "Operator manually halted all trading.";
    response.json(await service.engageKillSwitch(reason));
  }));

  app.post("/api/control/kill-switch/reset", asyncRoute(async (_request, response) => {
    response.json(await service.resetKillSwitch());
  }));

  app.get("/api/control/settings", (_request, response) => {
    response.json(service.getRiskSettings());
  });

  app.patch("/api/control/settings", asyncRoute(async (request, response) => {
    response.json(await service.updateRiskSettings(request.body ?? {}));
  }));

  registerEventRoutes(app, service);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(400).json({ error: message });
  });

  const distIndex = path.join(rootDir, "dist", "index.html");
  if (existsSync(distIndex)) {
    app.use(express.static(path.join(rootDir, "dist")));
    app.get("*", (_request, response) => {
      response.type("html").send(readFileSync(distIndex, "utf8"));
    });
  }

  return app;
}

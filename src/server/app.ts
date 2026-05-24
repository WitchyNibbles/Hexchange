import express, { type Express } from "express";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerEventRoutes } from "./api/events";
import type { HexchangeService } from "./services/hexchange-service";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..", "..", "..");

export function createServerApp(service: HexchangeService): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    response.json(await service.getHealth());
  });

  app.get("/api/system/status", (_request, response) => {
    response.json(service.getSystemStatus());
  });

  app.get("/api/system/portfolio", (_request, response) => {
    response.json(service.getPortfolioSnapshot());
  });

  app.get("/api/strategies", (_request, response) => {
    response.json(service.listStrategies());
  });

  app.post("/api/strategies/:strategyId/paper-session", async (request, response) => {
    response.json(await service.startPaperSession(request.params.strategyId));
  });

  app.post("/api/strategies/:strategyId/arm-live", async (request, response) => {
    response.json(await service.armLiveStrategy(request.params.strategyId));
  });

  app.get("/api/trades", (_request, response) => {
    response.json(service.listTrades());
  });

  app.post("/api/control/kill-switch", async (request, response) => {
    const reason =
      typeof request.body?.reason === "string" && request.body.reason.trim().length > 0
        ? request.body.reason
        : "Operator manually halted all trading.";
    response.json(await service.engageKillSwitch(reason));
  });

  app.post("/api/control/kill-switch/reset", async (_request, response) => {
    response.json(await service.resetKillSwitch());
  });

  app.get("/api/control/settings", (_request, response) => {
    response.json(service.getRiskSettings());
  });

  app.patch("/api/control/settings", async (request, response) => {
    response.json(await service.updateRiskSettings(request.body ?? {}));
  });

  registerEventRoutes(app, service);

  const distIndex = path.join(rootDir, "dist", "index.html");
  if (existsSync(distIndex)) {
    app.use(express.static(path.join(rootDir, "dist")));
    app.get("*", (_request, response) => {
      response.type("html").send(readFileSync(distIndex, "utf8"));
    });
  }

  return app;
}

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerEventRoutes } from "./api/events";
import type { HexchangeService } from "./services/hexchange-service";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..", "..", "..");

const LOCALHOST_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

const mutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

function requireLocalOrigin(request: Request, response: Response, next: NextFunction): void {
  const origin = request.headers.origin;
  const originStr = Array.isArray(origin) ? origin[0] : origin;
  if (originStr && !LOCALHOST_ORIGINS.has(originStr)) {
    response.status(403).json({ error: "Cross-origin requests are not permitted." });
    return;
  }
  next();
}

export function createServerApp(service: HexchangeService): Express {
  const app = express();
  app.use(express.json());

  // Rate limiting and origin enforcement for all mutating requests
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      mutateLimiter(request, response, (err) => {
        if (err) { next(err); return; }
        requireLocalOrigin(request, response, next);
      });
    } else {
      next();
    }
  });

  app.get("/api/health", async (_request, response) => {
    response.json(await service.getHealth());
  });

  app.get("/api/system/status", (_request, response) => {
    response.json(service.getSystemStatus());
  });

  app.get("/api/system/portfolio", (_request, response) => {
    response.json(service.getPortfolioSnapshot());
  });

  app.get("/api/engine/status", async (_request, response) => {
    response.json(await service.getEngineStatus());
  });

  app.get("/api/strategies", (_request, response) => {
    response.json(service.listStrategies());
  });

  app.post("/api/strategies/:strategyId/backtest", async (request, response) => {
    response.json(await service.runStrategyBacktest(request.params.strategyId));
  });

  app.post("/api/strategies/:strategyId/paper-session", async (request, response) => {
    response.json(await service.startPaperSession(request.params.strategyId));
  });

  app.post("/api/strategies/:strategyId/stop-session", async (request, response) => {
    response.json(await service.stopPaperSession(request.params.strategyId));
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
    try {
      response.json(await service.updateRiskSettings(request.body ?? {}));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "invalid settings" });
    }
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

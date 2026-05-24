import type { Express } from "express";
import type { HexchangeService } from "../services/hexchange-service";

export function registerEventRoutes(app: Express, service: HexchangeService): void {
  app.get("/api/events", async (_request, response) => {
    response.json(await service.listEvents());
  });
}

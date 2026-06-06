import { createServerApp } from "./app";
import { createHexchangeService } from "./services/hexchange-service";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT ?? "5174");

const service = await createHexchangeService();
const app = createServerApp(service);

app.listen(port, () => {
  logger.info("Hexchange API ready", { port });
});

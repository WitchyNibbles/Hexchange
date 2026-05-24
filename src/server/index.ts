import { createServerApp } from "./app";
import { createHexchangeService } from "./services/hexchange-service";

process.loadEnvFile?.();

const port = Number(process.env.PORT ?? "5174");

const service = await createHexchangeService();
const app = createServerApp(service);

app.listen(port, () => {
  console.log(`Hexchange API listening on http://localhost:${port}`);
});

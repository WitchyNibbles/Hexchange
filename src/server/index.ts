import { createServerApp } from "./app";
import { createHexchangeService } from "./services/hexchange-service";

process.loadEnvFile?.();

const port = Number(process.env.PORT ?? "5174");
const telemetryHeartbeatMs = Number(process.env.HEXCHANGE_RUNTIME_HEARTBEAT_MS ?? "1000");

const service = await createHexchangeService();
service.startRuntimeHeartbeat(telemetryHeartbeatMs);
const app = createServerApp(service);

app.listen(port, () => {
  console.log(`Hexchange API listening on http://localhost:${port}`);
});

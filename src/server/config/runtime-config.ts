export interface RuntimeConfig {
  appDir: string;
  port: number;
  engine: {
    mode: "simulated" | "nautilus";
    pythonPath: string | null;
    projectDir: string | null;
    runsDir: string | null;
  };
  venues: {
    interactiveBrokers: {
      enabled: boolean;
      host: string | null;
      port: number | null;
      clientId: number | null;
      accountId: string | null;
    };
    kraken: {
      enabled: boolean;
      apiKey: string | null;
      apiSecret: string | null;
      accountType: "spot" | "futures";
    };
  };
}

type EnvSource = Record<string, string | undefined>;

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function loadRuntimeConfig(env: EnvSource = process.env): RuntimeConfig {
  const mode = env.HEXCHANGE_ENGINE_MODE === "nautilus" ? "nautilus" : "simulated";
  const pythonPath = env.HEXCHANGE_NAUTILUS_PYTHON ?? null;
  const projectDir = env.HEXCHANGE_NAUTILUS_PROJECT_DIR ?? null;
  const runsDir = env.HEXCHANGE_NAUTILUS_RUNS_DIR ?? null;

  if (mode === "nautilus" && (!pythonPath || !projectDir || !runsDir)) {
    throw new Error("Nautilus mode requires python path, project dir, and runs dir.");
  }

  const ibHost = env.IB_GATEWAY_HOST ?? null;
  const ibPort = parseNumber(env.IB_GATEWAY_PORT);
  const ibClientId = parseNumber(env.IB_CLIENT_ID);
  const krakenApiKey = env.KRAKEN_API_KEY ?? null;
  const krakenApiSecret = env.KRAKEN_API_SECRET ?? null;

  return {
    appDir: env.HEXCHANGE_APP_DIR ?? ".hexchange",
    port: parseNumber(env.PORT) ?? 5174,
    engine: {
      mode,
      pythonPath,
      projectDir,
      runsDir,
    },
    venues: {
      interactiveBrokers: {
        enabled: Boolean(ibHost && ibPort !== null && ibClientId !== null),
        host: ibHost,
        port: ibPort,
        clientId: ibClientId,
        accountId: env.IB_ACCOUNT_ID ?? null,
      },
      kraken: {
        enabled: Boolean(krakenApiKey && krakenApiSecret),
        apiKey: krakenApiKey,
        apiSecret: krakenApiSecret,
        accountType: env.KRAKEN_ACCOUNT_TYPE === "futures" ? "futures" : "spot",
      },
    },
  };
}

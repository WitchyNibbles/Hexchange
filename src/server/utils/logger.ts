const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

function activeLevel(): Level {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  return env && env in LEVELS ? (env as Level) : "info";
}

function write(level: Level, msg: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[activeLevel()]) return;
  const entry = { time: new Date().toISOString(), level, msg, ...data };
  (level === "error" ? console.error : console.log)(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
  info:  (msg: string, data?: Record<string, unknown>) => write("info",  msg, data),
  warn:  (msg: string, data?: Record<string, unknown>) => write("warn",  msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};

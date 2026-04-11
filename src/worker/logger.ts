// Logger del worker — prefijo [worker] para filtrar facil en docker logs
type Level = "info" | "warn" | "error" | "debug";

function ts(): string {
  return new Date().toISOString();
}

function fmt(level: Level, scope: string, msg: string, meta?: Record<string, unknown>): string {
  const base = `[worker] ${ts()} [${level}] [${scope}] ${msg}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
}

export function logger(scope: string) {
  return {
    info(msg: string, meta?: Record<string, unknown>) {
      // eslint-disable-next-line no-console
      console.log(fmt("info", scope, msg, meta));
    },
    warn(msg: string, meta?: Record<string, unknown>) {
      // eslint-disable-next-line no-console
      console.warn(fmt("warn", scope, msg, meta));
    },
    error(msg: string, meta?: Record<string, unknown>) {
      // eslint-disable-next-line no-console
      console.error(fmt("error", scope, msg, meta));
    },
    debug(msg: string, meta?: Record<string, unknown>) {
      if (process.env.WORKER_DEBUG === "1") {
        // eslint-disable-next-line no-console
        console.log(fmt("debug", scope, msg, meta));
      }
    },
  };
}

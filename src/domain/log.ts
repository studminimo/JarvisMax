export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  message: string;
  at: string;
};

const SECRET =
  /sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function redactSecrets(message: string): string {
  return message.replace(SECRET, "[redacted]");
}

export function createLogger(sink: (entry: LogEntry) => void, now: () => Date = () => new Date()) {
  const write = (level: LogLevel, message: string) => {
    sink({
      level,
      message: redactSecrets(message),
      at: now().toISOString(),
    });
  };

  return {
    debug: (message: string) => write("debug", message),
    info: (message: string) => write("info", message),
    warn: (message: string) => write("warn", message),
    error: (message: string) => write("error", message),
  };
}

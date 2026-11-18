import { createLogger } from "@/domain/log";

export const logger = createLogger((entry) => {
  const line = `${entry.at} [${entry.level}] ${entry.message}`;
  if (entry.level === "error") {
    console.error(line);
    return;
  }
  if (entry.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
});

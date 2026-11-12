import { LOG_DISPLAY_LIMIT } from "../constants";
import type { LogEntry } from "../types";

export function formatLogLines(entries: LogEntry[], limit = LOG_DISPLAY_LIMIT): string {
  return entries
    .slice(-limit)
    .map((entry) => `[${entry.ts}] [${entry.level}] ${entry.message}`)
    .join("\n");
}


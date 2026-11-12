import type { LogEntry } from "../types";
import { formatLogLines } from "../utils";

export function LogViewer({ entries }: { entries: LogEntry[] }) {
  return (
    <footer className="log">
      <strong>LOG</strong>
      <pre>{formatLogLines(entries)}</pre>
    </footer>
  );
}


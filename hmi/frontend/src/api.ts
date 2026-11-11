import type { HvConfirmDetail } from "./types";

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && detail.message) return String(detail.message);
    return res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function parseHvConflict(res: Response): Promise<HvConfirmDetail | null> {
  if (res.status !== 409) return null;
  try {
    const body = await res.json();
    const detail = body.detail;
    if (detail && typeof detail === "object" && detail.needs_confirm) {
      return detail as HvConfirmDetail;
    }
  } catch {
    return null;
  }
  return null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const hv = await parseHvConflict(res.clone());
    if (hv) {
      const err = new Error(hv.message || "High voltage confirmation required") as Error & {
        hv?: HvConfirmDetail;
        status?: number;
      };
      err.hv = hv;
      err.status = 409;
      throw err;
    }
    throw new Error(await parseError(res));
  }
  return (await res.json()) as T;
}

export function telemetryWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws/telemetry`;
}

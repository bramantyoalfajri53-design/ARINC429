import { API_ENDPOINTS } from "../constants";

export function telemetryWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${API_ENDPOINTS.system.telemetryWs}`;
}


import { API_ENDPOINTS } from "../constants";
import type {
  ArincBusSpeed,
  ArincCoordinatorSnapshot,
  ArincOperatingMode,
} from "../types/arinc429";
import { api } from "./httpClient";

export const arincApi = {
  fetchStatus: () => api<ArincCoordinatorSnapshot>(API_ENDPOINTS.arinc429.status),

  acquireMode: (mode: ArincOperatingMode) =>
    api<ArincCoordinatorSnapshot>(API_ENDPOINTS.arinc429.mode, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),

  updateBus: (payload: {
    running?: boolean;
    speed?: ArincBusSpeed;
    simulation_mode?: boolean;
  }) =>
    api<ArincCoordinatorSnapshot>(API_ENDPOINTS.arinc429.bus, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  configureChannel: (payload: {
    channel: string;
    speed?: ArincBusSpeed;
    enabled?: boolean;
    trap_label?: string;
    trap_active?: boolean;
  }) =>
    api<ArincCoordinatorSnapshot>(API_ENDPOINTS.arinc429.channels, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  exportUrl: (fmt: "json" | "csv") => `${API_ENDPOINTS.arinc429.exportLogs}?fmt=${fmt}`,
};


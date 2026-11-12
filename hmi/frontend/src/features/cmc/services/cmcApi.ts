import { api } from "../../../shared";
import type {
  BoeingLruDefinition,
  CmcFunctionName,
  CmcSimResponseMode,
  CmcStateResponse,
} from "../types";
import { getCmcApiPath } from "../utils";

export const cmcApi = {
  fetchState: () => api<CmcStateResponse>(getCmcApiPath("/state")),

  selectLru: (lru: BoeingLruDefinition) =>
    api<CmcStateResponse>(getCmcApiPath("/lru"), {
      method: "POST",
      body: JSON.stringify({ lru_id: lru.id, name: lru.name, code: lru.code }),
    }),

  sendCommand: (payload: {
    function: CmcFunctionName;
    ground_test_en: boolean;
    inflight_test_en: boolean;
    sensor_code: string;
    channel?: string;
  }) =>
    api<CmcStateResponse>(getCmcApiPath("/command"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFaultBit: (payload: { bit: number; fault: boolean; command_ack?: boolean }) =>
    api<CmcStateResponse>(getCmcApiPath("/fault-summary"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  requestConfigData: (payload: { channel?: string; simulate_mode: CmcSimResponseMode }) =>
    api<CmcStateResponse>(getCmcApiPath("/request-config-data"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  requestShopFaults: (payload: { channel?: string; simulate_mode: CmcSimResponseMode }) =>
    api<CmcStateResponse>(getCmcApiPath("/request-shop-faults"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

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
      body: JSON.stringify({
        lru_id: lru.id,
        name: lru.name,
        code: lru.code,
        time_constant: lru.time_constant ?? "OFF",
      }),
    }),

  updateTransmitData: (payload: {
    date: string;
    time: string;
    flt_num: string;
    city_pairs: string;
    flt_phase: number;
    aircraft_id: string;
    config_word_bits: Record<string, boolean>;
    channel?: string;
  }) =>
    api<CmcStateResponse>(getCmcApiPath("/transmit-data"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  sendCommand: (payload: {
    function: CmcFunctionName;
    eq_id?: string;
    pad?: number;
    sdi?: string;
    rate_ms?: number;
    parity?: string;
    channel?: string;
    ground_test_en?: boolean;
    inflight_test_en?: boolean;
    sensor_code?: string;
  }) =>
    api<CmcStateResponse>(getCmcApiPath("/command"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFaultBit: (payload: {
    bit: number;
    fault: boolean;
    command_ack?: boolean;
    bite_inhibit?: boolean;
    label?: string;
    sdi?: string;
    ssm?: string;
    has_words?: boolean;
  }) =>
    api<CmcStateResponse>(getCmcApiPath("/fault-summary"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  switchFaultPage: (label: "350" | "351") =>
    api<CmcStateResponse>(getCmcApiPath("/fault-page"), {
      method: "POST",
      body: JSON.stringify({ label }),
    }),

  sendTerminalAction: (payload: {
    action: string;
    key?: string;
    view?: string;
    channel?: string;
    simulate_mode?: CmcSimResponseMode;
  }) =>
    api<CmcStateResponse>(getCmcApiPath("/terminal-action"), {
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

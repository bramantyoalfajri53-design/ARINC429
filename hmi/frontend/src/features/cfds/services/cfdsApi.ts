import { api, type ArincBusSpeed } from "../../../shared";
import type {
  AircraftConfigWord,
  CfdsBackendStateResponse,
  CfdsLruItem,
  CfdsModeState,
  CfdsTxParameters,
} from "../types";
import { getCfdsApiPath } from "../utils";

export const cfdsApi = {
  fetchStatus: () => api<CfdsModeState>(getCfdsApiPath("/status")),

  fetchState: () => api<CfdsBackendStateResponse>(getCfdsApiPath("/state")),

  selectLru: (lru: CfdsLruItem) =>
    api<CfdsBackendStateResponse>(getCfdsApiPath("/lru"), {
      method: "POST",
      body: JSON.stringify({
        code: lru.code,
        name: lru.name,
        description: lru.description,
      }),
    }),

  updateTxParams: (params: CfdsTxParameters, aircraftConfig?: AircraftConfigWord) =>
    api<CfdsBackendStateResponse>(getCfdsApiPath("/tx-params"), {
      method: "POST",
      body: JSON.stringify({
        date: params.date,
        time: params.time,
        flightNumber: params.flightNumber,
        cityPairs: params.cityPairs,
        aircraftId: params.aircraftId,
        flightPhase: params.flightPhase,
        ...(aircraftConfig ? { aircraftConfig } : {}),
      }),
    }),

  sendCommand: (payload: {
    equipment_code: string;
    command_code: number;
    sdi?: number;
    ready?: boolean;
    bit12?: boolean;
    channel?: string;
    submode?: "NORMAL" | "MENU" | "INTERACTIVE" | "DISCRETE" | "CONFIGURE";
    action_label?: string;
  }) =>
    api<CfdsBackendStateResponse>(getCfdsApiPath("/command"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  simulateNormal: (scenario: "FIGURE_58_PASS" | "COUNT_ERROR" | "CLEAR", channel = "RX-A") =>
    api<CfdsBackendStateResponse>(getCfdsApiPath("/normal/simulate"), {
      method: "POST",
      body: JSON.stringify({ scenario, channel }),
    }),

  simulateDiscrete: (scenario: "SINGLE_FIG73" | "MULTI_FIG74" | "CLEAR", channel = "RX-A") =>
    api<CfdsBackendStateResponse>(getCfdsApiPath("/discrete/simulate"), {
      method: "POST",
      body: JSON.stringify({ scenario, channel }),
    }),

  configureChannel: (payload: {
    channel: string;
    speed?: ArincBusSpeed;
    enabled?: boolean;
    trap_label?: string;
    trap_active?: boolean;
  }) =>
    api<CfdsBackendStateResponse>(getCfdsApiPath("/channels/configure"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

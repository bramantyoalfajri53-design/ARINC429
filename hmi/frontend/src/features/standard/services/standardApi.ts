import { api } from "../../../shared";
import {
  LruDefinition,
  LruSingleTransmitPayload,
  LruSingleTransmitResult,
} from "../types/lruTypes";
import { getStandardApiPath } from "../utils";

export interface StandardTxPayload {
  channel: string;
  slot: {
    slot: number;
    label: string;
    sdi: string;
    data: string;
    ssm: "NO" | "NCD" | "FT" | "FW" | "NML";
    parity: "ODD" | "EVEN";
    rate: number;
    enabled: boolean;
  };
}

export const standardApi = {
  fetchStatus: <T>() => api<T>(getStandardApiPath("/status")),

  fetchLrus: () => api<{ lrus: LruDefinition[] }>(getStandardApiPath("/lrus")),

  fetchLruDetail: (lruId: string) =>
    api<LruDefinition>(getStandardApiPath(`/lrus/${encodeURIComponent(lruId)}`)),

  transmitSlot: (payload: StandardTxPayload) =>
    api<{ ok: boolean; source: string; raw_hex: string; label: string }>(
      getStandardApiPath("/transmit"),
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  transmitLruSingleMode: (payload: LruSingleTransmitPayload) =>
    api<LruSingleTransmitResult>(getStandardApiPath("/transmit-lru"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

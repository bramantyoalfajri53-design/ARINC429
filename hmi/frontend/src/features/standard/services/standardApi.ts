import { api } from "../../../shared";
import { getStandardApiPath } from "../utils";

export interface StandardTxPayload {
  channel: string;
  slot: {
    slot: number;
    label: string;
    sdi: string;
    data: string;
    ssm: "NO" | "NCD" | "FT" | "FW";
    parity: "ODD" | "EVEN";
    rate: number;
    enabled: boolean;
  };
}

export const standardApi = {
  fetchStatus: <T>() => api<T>(getStandardApiPath("/status")),

  transmitSlot: (payload: StandardTxPayload) =>
    api<{ ok: boolean; source: string; raw_hex: string; label: string }>(
      getStandardApiPath("/transmit"),
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
};

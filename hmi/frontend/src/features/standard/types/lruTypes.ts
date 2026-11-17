export interface LruParamField {
  id: string;
  name: string;
  param_type: string;
  bit_start: number;
  bit_end: number;
  default: string | number;
  unit?: string;
  options?: string[];
  min_val?: number;
  max_val?: number;
  regex?: string;
  description?: string;
}

export interface LruTxSlotData {
  slot: number;
  channel: "TX-A" | "TX-B" | "TX-C" | "TX-D";
  function: string;
  label: string;
  data: string;
  sdi: string;
  pad: string;
  ssm: string;
  parity: "ODD" | "EVEN";
  rate: number;
  [key: string]: any;
}

export interface LruRxWordData {
  slot?: number;
  channel: "RX-A" | "RX-B" | "RX-C" | "RX-D";
  function: string;
  label: string;
  data: string;
  sdi: string;
  pad: string;
  ssm: string;
  parity: "ODD" | "EVEN";
  rate: number;
  bnr_dist?: string;
  bcd_dist?: string;
  speed_kts?: string;
  reply_eff?: string;
  rf_level?: string;
  status?: string;
}

export interface LruDefinition {
  id: string;
  code: string;
  name: string;
  standard_lru: string;
  modes_supported: Array<"SINGLE" | "MULTI" | "STANDARD_NAV">;
  default_tx_channel: "TX-A" | "TX-B" | "TX-C" | "TX-D";
  default_rx_channel: "RX-A" | "RX-B" | "RX-C" | "RX-D";
  default_bit_rate: string;
  tx_template: LruTxSlotData;
  rx_template: LruRxWordData;
  fields: LruParamField[];
}

export interface LruSingleTransmitPayload {
  lru_id: string;
  channel: string;
  slot: number;
  label: string;
  function: string;
  data: string;
  sdi: string;
  pad: string;
  ssm: string;
  parity: "ODD" | "EVEN";
  rate: number;
  extra_params?: Record<string, any>;
}

export interface LruSingleTransmitResult {
  ok: boolean;
  source: string;
  raw_hex: string;
  label: string;
  channel: string;
  lru_id: string;
  slot: number;
  function: string;
  data_eng: string;
  pad: string;
  payload_19: string;
  rx_simulation?: LruRxWordData;
}

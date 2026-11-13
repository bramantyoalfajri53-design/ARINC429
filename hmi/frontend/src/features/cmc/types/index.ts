import type { ArincDataSource, RxChannelState, TxChannelState } from "../../../shared";

export type CmcScreenMode =
  | "TRANSMIT_DATA"
  | "FAULT_SUMMARY"
  | "EDIT_CMD"
  | "SHOP_CONFIG"
  | "CHANNELS"
  // Legacy aliases
  | "BITE_MAIN"
  | "CONFIG_DATA"
  | "SHOP_FAULTS"
  | "TX_RX_SETUP";

export type CmcFunctionName =
  | "NO REQUEST"
  | "BITE TEST"
  | "SHOP FAULTS"
  | "NEW FLIGHT"
  | "LOGOFF"
  | "CONFIG DATA"
  // Legacy aliases
  | "BITE TEST (IN-FLIGHT)"
  | "NEW FLIGHT LEG"
  | "LOGOFF / TERMINATE"
  | "CONFIG DATA REQUEST";

export type CmcSimResponseMode =
  | "SUCCESS"
  | "NO_ACK"
  | "NO_MAINTENANCE_DATA"
  | "TIMEOUT_12S"
  | "BLOCK_COUNT_ERR";

export interface BoeingLruDefinition {
  id: string;
  name: string;
  code: string;
  tc_capable?: boolean;
  time_constant?: string;
}

export interface CmcFaultBitView {
  bit: number;
  label: string;
  is_spare: boolean;
  status: string;
  fault: boolean;
}

export interface CmcTransmitData {
  date: string;
  time: string;
  flt_num: string;
  city_pairs: string;
  flt_phase: number;
  aircraft_id: string;
  config_word_bits: Record<string, boolean>;
  words_hex: Record<string, string>;
}

export interface CmcCommandSummary {
  label: string;
  eq_id: string;
  function: CmcFunctionName;
  function_code: number;
  function_hex: string;
  pad: string;
  sdi: string;
  rate_ms: number;
  parity: string;
  raw_hex: string;
  handshake_status?: string;
  warning?: string | null;
  // Legacy fields
  ground_test_en?: boolean;
  inflight_test_en?: boolean;
  tx_rate_ms?: number;
  rx_timeout_secs?: number;
}

export interface CmcFaultWordDecoded {
  label: string;
  raw_hex: string;
  sdi_bin: string;
  sdi_name: string;
  ssm_bin: string;
  ssm_name: string;
  active_fault_bits: number[];
  bite_test_inhibit: boolean;
  bit_29_ack: boolean;
  parity_ok?: boolean;
}

export interface CmcFaultSummary {
  current_page: "350" | "351";
  has_words_received: boolean;
  word_350: CmcFaultWordDecoded;
  word_351: CmcFaultWordDecoded;
  bit_29_ack: boolean;
  bite_test_inhibit: boolean;
  bits: CmcFaultBitView[];
}

export interface CmcTerminalState {
  view: string;
  page: number;
  lines: string[];
  message: string;
  error?: string | null;
  words_hex: string[];
}

export interface CmcShopFaultRecord {
  leg: string;
  code: string;
  severity: string;
  description: string;
}

export interface CmcOrderedWord {
  word_order: number;
  seq_ctrl: number;
  raw_hex: string;
  chars: string;
}

export interface CmcStateResponse {
  mode: "CMC";
  source: ArincDataSource;
  simulation_mode: boolean;
  active_mode: string;
  bus_running: boolean;
  channels: {
    tx: Record<string, TxChannelState>;
    rx: Record<string, RxChannelState>;
  };
  standard_lrus: BoeingLruDefinition[];
  selected_lru: BoeingLruDefinition;
  transmit_data: CmcTransmitData;
  command_summary: CmcCommandSummary;
  fault_summary: CmcFaultSummary;
  terminal: CmcTerminalState;
  config_data: {
    status: string;
    message: string;
    valid: boolean;
    source: ArincDataSource;
    part_number: string;
    sw_version: string;
    hw_mod: string;
    decoded_text?: string;
    raw_words_hex: string[];
  };
  shop_faults: {
    status: string;
    message: string;
    valid: boolean;
    source: ArincDataSource;
    decoded_text?: string;
    records: CmcShopFaultRecord[];
    ordered_words: CmcOrderedWord[];
  };
  rx_history?: unknown[];
}

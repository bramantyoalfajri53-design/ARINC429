import type { ArincDataSource, RxChannelState, TxChannelState } from "../../../shared";

export type CmcScreenMode =
  | "BITE_MAIN"
  | "EDIT_CMD"
  | "CONFIG_DATA"
  | "SHOP_FAULTS"
  | "CHANNELS";

export type CmcFunctionName =
  | "NO REQUEST"
  | "BITE TEST (IN-FLIGHT)"
  | "SHOP FAULTS"
  | "NEW FLIGHT LEG"
  | "LOGOFF / TERMINATE"
  | "CONFIG DATA REQUEST";

export type CmcSimResponseMode =
  | "SUCCESS"
  | "NO_ACK"
  | "NO_MAINTENANCE_DATA"
  | "TIMEOUT_12S";

export interface BoeingLruDefinition {
  id: string;
  name: string;
  code: string;
}

export interface CmcFaultBit {
  bit: number;
  label: string;
  fault: boolean;
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
  selected_lru: BoeingLruDefinition;
  command_summary: {
    function: CmcFunctionName;
    function_code: number;
    ground_test_en: boolean;
    inflight_test_en: boolean;
    tx_rate_ms: number;
    rx_timeout_secs: number;
  };
  fault_summary: {
    word_350: {
      label: string;
      raw_hex: string;
      active_fault_bits: number[];
      bit_29_ack: boolean;
      ssm: string;
    };
    word_351: {
      label: string;
      raw_hex: string;
      active_fault_bits: number[];
      bit_29_ack: boolean;
      ssm: string;
    };
    bit_29_ack: boolean;
    bits: CmcFaultBit[];
  };
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
  rx_history: Array<{
    timestamp: string;
    source: ArincDataSource;
    channel: string;
    label: string;
    raw_hex: string;
    detail: string;
  }>;
}

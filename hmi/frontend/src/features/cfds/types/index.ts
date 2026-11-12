import type { ArincBusSpeed, ArincDataSource, RxChannelState, TxChannelState } from "../../../shared";

export type CfdsStandard = "ABD0018" | "ABD0048";

export interface CfdsModeState {
  mode: "cfds";
  status: "active";
  standards: string[];
}

export interface CfdsLruItem {
  code: string;        // 3-digit hexadecimal equipment code
  name: string;        // LRU acronym
  description: string; // Full avionics equipment name
}

export interface CfdsTxParameters {
  date: string;           // DDMMYY or display date
  time: string;           // HHMMSS (6 digits)
  flightNumber: string;   // Alpha-numeric (up to 6 chars)
  cityPairs: string;      // 6 chars (e.g. "CGKDPS")
  flightPhase: number;    // 0 to 12
  aircraftId: string;     // Alpha-numeric (e.g. "PK-GIA" / Shop Code)
  aircraftType: string;   // e.g. "A320"
}

export interface AircraftConfigWord {
  printer: boolean;
  link: boolean;
  aids: boolean;
  rmp3: boolean;
  vhf3: boolean;
  hf1: boolean;
  hf2: boolean;
  adf2: boolean;
  mls1: boolean;
  mls2: boolean;
  wbs1: boolean;
  radar2: boolean;
  tpis: boolean;
  aftCrgHt: boolean;
  fwdCrgHt: boolean;
  crgSmoke: boolean;
  wbs2: boolean;
}

export interface CfdsLabelMapping {
  labelOctal: string;
  name: string;
  format: "BCD" | "BNR" | "DISCRETE" | "ISO ALPHABET";
  refreshRateMs: number;
  description: string;
}

export type CfdsView =
  | "LRU_SELECTION"
  | "MODE_SELECT"
  | "EDIT_TX"
  | "OPERATION_MODE"
  | "CONFIGURE_CHANNELS"
  | "NORMAL_MODE_ABD0018"
  | "NORMAL_MODE_ABD0048"
  | "MENU_MODE_ABD0018"
  | "INTERACTIVE_MODE_ABD0048"
  | "DISCRETE_MODE_ABD0048";

export type CfdsSubmodeMenuKey =
  | "NORMAL_ABD0018"
  | "MENU_ABD0018"
  | "NORMAL_ABD0048"
  | "INTERACTIVE_ABD0048"
  | "DISCRETE_ABD0048";

export interface CfdsTxCommandRecord {
  submode: string;
  action_label: string;
  equipment_code: string;
  command_code: number;
  command_hex: string;
  sdi: number;
  ready: boolean;
  bit12: boolean;
  channel: string;
  raw_word: number;
  raw_hex: string;
  source: ArincDataSource;
  timestamp: string;
}

export interface CfdsBackendStateResponse {
  mode: "CFDS";
  source: ArincDataSource;
  simulation_mode: boolean;
  active_mode: string;
  bus_running: boolean;
  global_speed: ArincBusSpeed;
  channels: {
    tx: Record<string, TxChannelState>;
    rx: Record<string, RxChannelState>;
  };
  selected_lru: CfdsLruItem;
  tx_params: Omit<CfdsTxParameters, "aircraftType"> & { aircraftType?: string };
  aircraft_config: AircraftConfigWord;
  last_tx_command: CfdsTxCommandRecord | null;
  normal_rx: {
    status: string;
    source: ArincDataSource;
    decoded_text: string;
    error: string | null;
    words: Array<{ slot: number; label: "356"; dataHex: string; desc?: string }>;
  };
  discrete_rx: {
    status: string;
    source: ArincDataSource;
    records: Array<{
      failureNumber: string;
      failureTypeCode: string;
      failureTypeString: string;
      witnessPosition: string;
      witnessSide: string;
      suspect1Position: string;
      suspect1Side: string;
      suspect2Position: string;
      suspect2Side: string;
      suspect3Position: string;
      suspect3Side: string;
      source: ArincDataSource;
      receivedAt?: string;
    }>;
  };
}

export type ArincOperatingMode = "STANDARD" | "CFDS" | "CMC";
export type ArincBusSpeed = "100k" | "12.5k";
export type ArincDataSource = "HARDWARE" | "SIMULATION";

export interface TxChannelState {
  speed: ArincBusSpeed;
  enabled: boolean;
}

export interface RxChannelState {
  speed: ArincBusSpeed;
  trap_label: string;
  trap_active: boolean;
}

export interface ArincLogItem {
  timestamp: string;
  mode: ArincOperatingMode;
  source: ArincDataSource;
  direction: "TX" | "RX" | "SYS";
  channel: string;
  label: string;
  raw_hex: string;
  detail: string;
}

export interface ArincCoordinatorSnapshot {
  source: ArincDataSource;
  simulation_mode: boolean;
  hardware_driver_installed: boolean;
  hardware_connected: boolean;
  active_mode: ArincOperatingMode;
  bus_running: boolean;
  global_speed: ArincBusSpeed;
  word_count: number;
  channels: {
    tx: Record<string, TxChannelState>;
    rx: Record<string, RxChannelState>;
  };
  logs: ArincLogItem[];
  rx_recent: ArincLogItem[];
}


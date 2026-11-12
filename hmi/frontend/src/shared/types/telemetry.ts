export type LogEntry = {
  ts: string;
  level: string;
  message: string;
};

export type LeaseInfo = {
  held: boolean;
  session_id: string | null;
  age_s: number;
  you_control: boolean;
};

export type DcTelemetry = {
  voltage: number;
  current: number;
  power: number;
  output_on: boolean;
  fault: boolean;
  fault_msg: string;
  status: string;
  set_voltage: number;
  set_current: number;
  set_ovp: number;
  resource: string;
  simulation: boolean;
  connected_ok: boolean;
  idn: string;
};

export type AcTelemetry = {
  v_rms: number;
  i_rms: number;
  i_peak: number;
  power_watts: number;
  power_va: number;
  power_factor: number;
  frequency: number;
  output_on: boolean;
  fault: boolean;
  fault_msg: string;
  set_voltage: number;
  set_frequency: number;
  set_current: number;
  resource: string;
  simulation: boolean;
  connected_ok: boolean;
  idn: string;
};

export type TelemetryFrame = {
  dc: DcTelemetry;
  ac: AcTelemetry;
  log: LogEntry[];
  lease: LeaseInfo;
  simulation: boolean;
  ts: number;
  error?: string;
};

export type HvConfirmDetail = {
  needs_confirm?: boolean;
  kind?: string;
  message?: string;
  set_voltage?: number;
};


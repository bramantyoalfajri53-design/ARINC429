import { CFDS_TIMEOUTS_MS } from "../config";

/**
 * Discrete Mode (ABD0048) Service
 * Reference: Aeroflex JcAIR T1200B Operation Manual Section 4.F, Figures 71-74 (pp. 1-4-111 to 1-4-115)
 */

export const DISCRETE_RX_LABEL = "355";
export const DISCRETE_TIMEOUT_1S_MS = CFDS_TIMEOUTS_MS.DISCRETE_NO_DATA_1S;
export const DISCRETE_NO_DATA_MSG = "NO MAINTENANCE DATA RECEIVED";

export type DiscreteDataSource = "HARDWARE" | "SIMULATION";

export type DiscreteMonitorStatus =
  | "WAITING"
  | "NO_MAINT_DATA_1S"
  | "DATA_ACTIVE";

export interface DiscreteFailureRecord {
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
  source: DiscreteDataSource;
  receivedAt?: string;
}

export interface DiscreteHardwareStatus {
  rxLabel: typeof DISCRETE_RX_LABEL;
  connected: false;
  note: string;
}

export function getDiscreteHardwareStatus(): DiscreteHardwareStatus {
  return {
    rxLabel: DISCRETE_RX_LABEL,
    connected: false,
    note: "Physical ARINC 429 Label 355 RX interface is not connected (monitoring fallback only).",
  };
}

export function getSimulatedSingleFailure(): DiscreteFailureRecord[] {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  return [
    {
      failureNumber: "002",
      failureTypeCode: "005",
      failureTypeString: "CHECK SUSPECT 1 SYSTEM",
      witnessPosition: "012",
      witnessSide: "024",
      suspect1Position: "048",
      suspect1Side: "013",
      suspect2Position: "026",
      suspect2Side: "052",
      suspect3Position: "010",
      suspect3Side: "020",
      source: "SIMULATION",
      receivedAt: ts,
    },
  ];
}

export function getSimulatedMultipleFailures(): DiscreteFailureRecord[] {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  return [
    ...getSimulatedSingleFailure(),
    {
      failureNumber: "007",
      failureTypeCode: "011",
      failureTypeString: "[SIM] CHECK BUS INPUT A",
      witnessPosition: "014",
      witnessSide: "001",
      suspect1Position: "031",
      suspect1Side: "002",
      suspect2Position: "000",
      suspect2Side: "000",
      suspect3Position: "000",
      suspect3Side: "000",
      source: "SIMULATION",
      receivedAt: ts,
    },
    {
      failureNumber: "014",
      failureTypeCode: "003",
      failureTypeString: "[SIM] INTERNAL MEMORY TEST",
      witnessPosition: "012",
      witnessSide: "024",
      suspect1Position: "012",
      suspect1Side: "024",
      suspect2Position: "000",
      suspect2Side: "000",
      suspect3Position: "000",
      suspect3Side: "000",
      source: "SIMULATION",
      receivedAt: ts,
    },
  ];
}


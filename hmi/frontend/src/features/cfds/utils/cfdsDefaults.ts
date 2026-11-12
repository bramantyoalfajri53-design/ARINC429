import type {
  AircraftConfigWord,
  CfdsLabelMapping,
  CfdsTxParameters,
} from "../types";

export type { AircraftConfigWord, CfdsLabelMapping, CfdsTxParameters };

/**
 * 18 Verified CFDS Labels from Manual pp. 1-4-86 - 1-4-90
 */
export const CFDS_TRANSMIT_LABELS: CfdsLabelMapping[] = [
  { labelOctal: "040", name: "City Pairs (Char 1-2)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Origin departure city letters 1 & 2" },
  { labelOctal: "041", name: "City Pairs (Char 3-4)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Origin departure city letter 3 & destination letter 1" },
  { labelOctal: "042", name: "City Pairs (Char 5-6)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Destination arrival city letters 2 & 3" },
  { labelOctal: "125", name: "UTC Time", format: "BCD", refreshRateMs: 1000, description: "Current GMT/UTC Time (HH:MM:SS)" },
  { labelOctal: "126", name: "Flight Phase", format: "DISCRETE", refreshRateMs: 1000, description: "Airbus Flight Phase (0=Ground, 5/6=Air, 0-12 range)" },
  { labelOctal: "155", name: "Aircraft Configuration Word", format: "DISCRETE", refreshRateMs: 1000, description: "17 Equipment subsystem status bits" },
  { labelOctal: "156", name: "Aircraft Type Word", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Aircraft Model Identifier (e.g. A320)" },
  { labelOctal: "227", name: "BITE Command Word", format: "DISCRETE", refreshRateMs: 100, description: "Target LRU Equipment Code & Command Code (100 ms)" },
  { labelOctal: "233", name: "Flight Number (Char 1)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Airline code character 1" },
  { labelOctal: "234", name: "Flight Number (Char 2)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Airline code character 2" },
  { labelOctal: "235", name: "Flight Number (Char 3)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Flight number digit 1" },
  { labelOctal: "236", name: "Flight Number (Char 4)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Flight number digit 2" },
  { labelOctal: "237", name: "Flight Number (Char 5-6)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Flight number digits 3 & 4" },
  { labelOctal: "260", name: "Flight Date", format: "BCD", refreshRateMs: 1000, description: "Date of operation (DDMMYY)" },
  { labelOctal: "301", name: "Aircraft Tail ID (Char 1-2)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Aircraft registration letters 1 & 2" },
  { labelOctal: "302", name: "Aircraft Tail ID (Char 3-4)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Aircraft registration letters 3 & 4" },
  { labelOctal: "303", name: "Aircraft Tail ID (Char 5-6)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Aircraft registration letters 5 & 6" },
  { labelOctal: "304", name: "Aircraft Tail ID (Char 7-8)", format: "ISO ALPHABET", refreshRateMs: 1000, description: "Aircraft registration letters 7 & 8" },
];

export const FLIGHT_PHASE_NAMES: Record<number, string> = {
  0: "Phase 0 - Power-Up / Pre-Flight (Ground)",
  1: "Phase 1 - Engine Start",
  2: "Phase 2 - Taxi Out",
  3: "Phase 3 - Takeoff Run",
  4: "Phase 4 - Initial Climb",
  5: "Phase 5 - Climb",
  6: "Phase 6 - Cruise (Air)",
  7: "Phase 7 - Descent",
  8: "Phase 8 - Approach",
  9: "Phase 9 - Touchdown / Rollout",
  10: "Phase 10 - Taxi In",
  11: "Phase 11 - Engine Shutdown",
  12: "Phase 12 - Maintenance & Test",
};

export const DEFAULT_CFDS_TX_PARAMS: CfdsTxParameters = {
  date: "111126",
  time: "120000",
  flightNumber: "GA429",
  cityPairs: "CGKDPS",
  flightPhase: 0,
  aircraftId: "PK-GIA",
  aircraftType: "A320",
};

export const DEFAULT_AIRCRAFT_CONFIG: AircraftConfigWord = {
  printer: true,
  link: true,
  aids: false,
  rmp3: true,
  vhf3: true,
  hf1: false,
  hf2: false,
  adf2: false,
  mls1: false,
  mls2: false,
  wbs1: false,
  radar2: true,
  tpis: false,
  aftCrgHt: false,
  fwdCrgHt: false,
  crgSmoke: false,
  wbs2: false,
};


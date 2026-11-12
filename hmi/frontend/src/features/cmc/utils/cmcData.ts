import type { BoeingLruDefinition, CmcFunctionName } from "../types";

export const BOEING_LRU_DATABASE: BoeingLruDefinition[] = [
  { id: "AIMS", name: "Airplane Information Management System", code: "0x1A" },
  { id: "EICAS", name: "Engine Indicating & Crew Alerting", code: "0x2B" },
  { id: "FMC-1", name: "Flight Management Computer 1", code: "0x3C" },
  { id: "EEC-L", name: "Electronic Engine Controller Left", code: "0x4D" },
  { id: "IRU-L", name: "Inertial Reference Unit Left", code: "0x5E" },
  { id: "MCP", name: "Mode Control Panel", code: "0x6F" },
  { id: "TCAS", name: "Traffic Collision Avoidance System", code: "0x70" },
  { id: "WXR", name: "Weather Radar Receiver / XMTR", code: "0x81" },
];

export const CMC_FUNCTION_OPTIONS: CmcFunctionName[] = [
  "NO REQUEST",
  "BITE TEST (IN-FLIGHT)",
  "SHOP FAULTS",
  "NEW FLIGHT LEG",
  "LOGOFF / TERMINATE",
  "CONFIG DATA REQUEST",
];

export function getCmcApiPath(endpoint: string): string {
  return `/api/cmc${endpoint}`;
}


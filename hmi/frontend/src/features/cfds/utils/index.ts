import { CFDS_MODE_CONFIG } from "../config";

export function getCfdsApiPath(endpoint: string): string {
  return `${CFDS_MODE_CONFIG.apiPrefix}${endpoint}`;
}

export * from "./lruDefinitions";
export * from "./cfdsDefaults";
export * from "./cfdsProtocol";
export * from "./normalModeParser";
export * from "./interactiveModeParser";
export * from "./discreteModeParser";

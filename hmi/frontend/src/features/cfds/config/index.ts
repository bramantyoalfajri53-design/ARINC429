export const CFDS_MODE_CONFIG = {
  id: "cfds",
  label: "CFDS Mode",
  apiPrefix: "/api/cfds",
  standards: ["ABD0018", "ABD0048"] as const,
} as const;

export const CFDS_TIMEOUTS_MS = {
  MENU_NO_RESPONSE_3S: 3000,
  MENU_LRU_ERROR_30S: 30000,
  INTERACTIVE_NO_RESPONSE_3S: 3000,
  INTERACTIVE_LRU_ERROR_30S: 30000,
  DISCRETE_NO_DATA_1S: 1000,
  AIR_TRANSITION_100MS: 100,
} as const;

export const CFDS_VERIFIED_COMMANDS = {
  NORMAL_GROUND: 0x00,
  NORMAL_AIR_TRANSITION: 0x12,
  NORMAL_AIR_STEADY: 0x11,
  INTERACTIVE_CLR: 0x08,
  PRV: 0x76,
  NXT: 0x77,
} as const;

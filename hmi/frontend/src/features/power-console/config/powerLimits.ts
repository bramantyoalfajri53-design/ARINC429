export const HISTORY_BUFFER_LEN = 100;

export const DC_CHART_COLORS = {
  voltage: "#00f0ff",
  current: "#f59e0b",
} as const;

export const AC_CHART_COLORS = {
  vRms: "#38bdf8",
  powerWatts: "#10b981",
} as const;

export const DC_LIMITS = {
  voltage: { step: "0.5", min: 0, max: 40, defaultVal: 0 },
  current: { step: "0.5", min: 0, max: 19, defaultVal: 0 },
  ovp: { step: "1", min: 1, max: 45, defaultVal: 35 },
} as const;

export const AC_LIMITS = {
  voltage: { step: "1", min: 0, max: 270, defaultVal: 0 },
  frequency: { step: "5", min: 45, max: 500, defaultVal: 400 },
  current: { step: "0.5", min: 0, max: 20, defaultVal: 10 },
} as const;


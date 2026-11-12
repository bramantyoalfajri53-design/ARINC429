export const API_ENDPOINTS = {
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    session: "/api/auth/session",
  },
  control: {
    acquire: "/api/control/acquire",
    heartbeat: "/api/control/heartbeat",
    release: "/api/control/release",
  },
  system: {
    state: "/api/state",
    estop: "/api/estop",
    rescan: "/api/gpib/rescan",
    simulationMode: "/api/mode/simulation",
    telemetryWs: "/ws/telemetry",
  },
  power: {
    dcSetpoint: "/api/dc/setpoint",
    dcOutput: "/api/dc/output",
    dcPreset: "/api/dc/preset",
    acSetpoint: "/api/ac/setpoint",
    acOutput: "/api/ac/output",
    acPreset: "/api/ac/preset",
  },
  arinc429: {
    status: "/api/arinc429/status",
    mode: "/api/arinc429/mode",
    bus: "/api/arinc429/bus",
    channels: "/api/arinc429/channels",
    exportLogs: "/api/arinc429/export",
  },
} as const;

export const CONTROL_HEARTBEAT_INTERVAL_MS = 5000;
export const WS_RECONNECT_DELAY_MS = 1000;
export const LOG_DISPLAY_LIMIT = 12;

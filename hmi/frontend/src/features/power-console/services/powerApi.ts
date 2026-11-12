import { API_ENDPOINTS } from "../../../shared";

export type CommandFn = (path: string, body: unknown) => Promise<boolean>;

export function createPowerActions(command: CommandFn) {
  return {
    setDcSetpoint: (payload: { voltage?: number; current?: number; ovp?: number }) =>
      command(API_ENDPOINTS.power.dcSetpoint, payload),
    applyDcPreset: (voltage: number) =>
      command(API_ENDPOINTS.power.dcPreset, { voltage }),
    setAcSetpoint: (payload: { voltage?: number; frequency?: number; current?: number }) =>
      command(API_ENDPOINTS.power.acSetpoint, payload),
    applyAcPreset: (voltage: number, frequency: number) =>
      command(API_ENDPOINTS.power.acPreset, { voltage, frequency }),
  };
}


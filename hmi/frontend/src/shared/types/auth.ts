import type { LeaseInfo } from "./telemetry";

export type LoginPayload = {
  pin: string;
};

export type SessionResponse = {
  ok: boolean;
  lease: LeaseInfo;
};


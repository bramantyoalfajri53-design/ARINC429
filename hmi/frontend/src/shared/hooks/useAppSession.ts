import { createContext, useContext } from "react";
import type { HvConfirmDetail, PendingOutputRequest, TelemetryFrame } from "../types";
import type { TelemetryListener } from "./useTelemetryStream";

export type AppSessionContextValue = {
  authed: boolean;
  loginError: string;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  frame: TelemetryFrame | null;
  canControl: boolean;
  status: string;
  confirm: HvConfirmDetail | null;
  pendingOutput: PendingOutputRequest | null;
  command: (path: string, body: unknown) => Promise<boolean>;
  requestOutput: (kind: "dc" | "ac", enabled: boolean) => void;
  confirmHv: () => void;
  cancelHv: () => void;
  subscribeTelemetry: (listener: TelemetryListener) => () => void;
};

export const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function useAppSession(): AppSessionContextValue {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used inside AppSessionProvider");
  }
  return ctx;
}


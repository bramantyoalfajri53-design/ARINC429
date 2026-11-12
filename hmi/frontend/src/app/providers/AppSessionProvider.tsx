import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  API_ENDPOINTS,
  AppSessionContext,
  useAuthSession,
  useCommandAction,
  useControlLease,
  useTelemetryStream,
  type PendingOutputRequest,
} from "../../shared";

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const { authed, loginError, login, logout } = useAuthSession();
  const { frame, subscribe: subscribeTelemetry } = useTelemetryStream(authed);
  const { command, status, confirm, clearConfirm } = useCommandAction();
  const [pendingOutput, setPendingOutput] = useState<PendingOutputRequest | null>(null);

  const canControl = Boolean(frame?.lease.you_control);
  useControlLease(canControl);

  const requestOutput = useCallback(
    (kind: "dc" | "ac", enabled: boolean) => {
      setPendingOutput({ kind, enabled });
      const path = kind === "dc" ? API_ENDPOINTS.power.dcOutput : API_ENDPOINTS.power.acOutput;
      void command(path, { enabled, confirm_high_voltage: false }).then((ok) => {
        if (ok) {
          setPendingOutput(null);
        }
      });
    },
    [command],
  );

  const confirmHv = useCallback(() => {
    if (!pendingOutput) {
      clearConfirm();
      return;
    }
    const path =
      pendingOutput.kind === "dc" ? API_ENDPOINTS.power.dcOutput : API_ENDPOINTS.power.acOutput;
    void command(path, { enabled: pendingOutput.enabled, confirm_high_voltage: true });
    clearConfirm();
    setPendingOutput(null);
  }, [clearConfirm, command, pendingOutput]);

  const cancelHv = useCallback(() => {
    clearConfirm();
    setPendingOutput(null);
  }, [clearConfirm]);

  const value = useMemo(
    () => ({
      authed,
      loginError,
      login,
      logout,
      frame,
      canControl,
      status,
      confirm,
      pendingOutput,
      command,
      requestOutput,
      confirmHv,
      cancelHv,
      subscribeTelemetry,
    }),
    [
      authed,
      cancelHv,
      canControl,
      command,
      confirm,
      confirmHv,
      frame,
      login,
      loginError,
      logout,
      pendingOutput,
      requestOutput,
      status,
      subscribeTelemetry,
    ],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}


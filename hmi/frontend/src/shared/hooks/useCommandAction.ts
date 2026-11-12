import { useCallback, useState } from "react";
import { api, type ApiCommandError } from "../services";
import type { HvConfirmDetail } from "../types";

export function useCommandAction() {
  const [confirm, setConfirm] = useState<HvConfirmDetail | null>(null);
  const [status, setStatus] = useState("");

  const command = useCallback(async (path: string, body: unknown): Promise<boolean> => {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setStatus("");
      return true;
    } catch (err) {
      const e = err as ApiCommandError;
      if (e.hv) {
        setConfirm(e.hv);
        return false;
      }
      setStatus(e.message);
      return false;
    }
  }, []);

  const clearConfirm = useCallback(() => {
    setConfirm(null);
  }, []);

  return { command, status, confirm, clearConfirm };
}


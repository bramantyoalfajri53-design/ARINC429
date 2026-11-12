import { useEffect } from "react";
import { API_ENDPOINTS, CONTROL_HEARTBEAT_INTERVAL_MS } from "../constants";
import { api } from "../services";

export function useControlLease(canControl: boolean) {
  useEffect(() => {
    if (!canControl) return;
    const id = window.setInterval(() => {
      void api(API_ENDPOINTS.control.heartbeat, { method: "POST", body: "{}" }).catch(() => undefined);
    }, CONTROL_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [canControl]);
}


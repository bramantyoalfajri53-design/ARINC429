import { useCallback, useEffect, useRef, useState } from "react";
import { WS_RECONNECT_DELAY_MS } from "../constants";
import { telemetryWsUrl } from "../services";
import type { TelemetryFrame } from "../types";

export type TelemetryListener = (frame: TelemetryFrame) => void;

export function useTelemetryStream(authed: boolean) {
  const [frame, setFrame] = useState<TelemetryFrame | null>(null);
  const listenersRef = useRef<Set<TelemetryListener>>(new Set());

  const subscribe = useCallback((listener: TelemetryListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setFrame(null);
      return;
    }
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(telemetryWsUrl());
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as TelemetryFrame;
          if (data.error) return;
          setFrame(data);
          listenersRef.current.forEach((listener) => listener(data));
        } catch {
          // Ignore malformed telemetry frames
        }
      };
      ws.onclose = () => {
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, [authed]);

  return { frame, subscribe };
}


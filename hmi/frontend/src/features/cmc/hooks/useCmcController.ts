import { useCallback, useEffect, useRef, useState } from "react";
import { arincApi, type ArincBusSpeed } from "../../../shared";
import { cmcApi } from "../services";
import type {
  BoeingLruDefinition,
  CmcFunctionName,
  CmcScreenMode,
  CmcSimResponseMode,
  CmcStateResponse,
} from "../types";

export function useCmcController() {
  const [state, setState] = useState<CmcStateResponse | null>(null);
  const [screen, setScreen] = useState<CmcScreenMode>("EDIT_CMD");
  const [simMode, setSimMode] = useState<CmcSimResponseMode>("SUCCESS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [handshakeMessage, setHandshakeMessage] = useState<string | null>(null);

  const ackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l350TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await cmcApi.fetchState();
      setState(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      if (ackTimeoutRef.current) clearTimeout(ackTimeoutRef.current);
      if (l350TimeoutRef.current) clearTimeout(l350TimeoutRef.current);
    };
  }, [refresh]);

  const selectLru = async (lru: BoeingLruDefinition) => {
    setError("");
    try {
      const next = await cmcApi.selectLru(lru);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveTransmitData = async (payload: {
    date: string;
    time: string;
    flt_num: string;
    city_pairs: string;
    flt_phase: number;
    aircraft_id: string;
    config_word_bits: Record<string, boolean>;
    channel?: string;
  }) => {
    setLoading(true);
    setError("");
    try {
      const next = await cmcApi.updateTransmitData(payload);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendCommandSummary = async (payload: {
    function: CmcFunctionName;
    eq_id?: string;
    pad?: number;
    sdi?: string;
    rate_ms?: number;
    parity?: string;
    channel?: string;
  }) => {
    setLoading(true);
    setError("");
    setHandshakeMessage(null);

    if (ackTimeoutRef.current) clearTimeout(ackTimeoutRef.current);
    if (l350TimeoutRef.current) clearTimeout(l350TimeoutRef.current);

    try {
      const next = await cmcApi.sendCommand(payload);
      setState(next);

      // Auto-switch screen for SHOP FAULTS or CONFIG DATA
      if (payload.function === "SHOP FAULTS" || payload.function === "CONFIG DATA") {
        setScreen("SHOP_CONFIG");
      }

      // Handshaking timer logic per manual:
      // If function is not NO REQUEST, monitor Bit 29 ACK and Label 350
      if (payload.function !== "NO REQUEST") {
        // 3-second timer: Check Bit 29 ACK
        ackTimeoutRef.current = setTimeout(() => {
          setState((prev) => {
            if (prev && !prev.fault_summary.bit_29_ack) {
              setHandshakeMessage("WARNING: NO CMND WORD ACK RCVD");
            }
            return prev;
          });
        }, 3000);

        // 5-second timer: Check Label 350 received; if timeout revert to NO REQUEST
        l350TimeoutRef.current = setTimeout(async () => {
          setState((prev) => {
            if (prev && !prev.fault_summary.has_words_received) {
              setHandshakeMessage("NO MAINTENANCE DATA RECEIVED");
            }
            return prev;
          });
          // Revert to NO REQUEST
          try {
            const reverted = await cmcApi.sendCommand({
              ...payload,
              function: "NO REQUEST",
            });
            setState(reverted);
          } catch {
            // ignore
          }
        }, 5000);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaultBit = async (
    bit: number,
    fault: boolean,
    commandAck?: boolean,
    biteInhibit?: boolean,
    label?: string,
    sdi?: string,
    ssm?: string,
    hasWords?: boolean
  ) => {
    setError("");
    try {
      const next = await cmcApi.updateFaultBit({
        bit,
        fault,
        command_ack: commandAck,
        bite_inhibit: biteInhibit,
        label: label ?? state?.fault_summary.current_page ?? "350",
        sdi,
        ssm,
        has_words: hasWords,
      });
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const switchFaultPage = async (page: "350" | "351") => {
    setError("");
    try {
      const next = await cmcApi.switchFaultPage(page);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const sendTerminalAction = async (payload: {
    action: string;
    key?: string;
    view?: string;
    simulate_mode?: CmcSimResponseMode;
  }) => {
    setLoading(true);
    setError("");
    try {
      const next = await cmcApi.sendTerminalAction({
        ...payload,
        simulate_mode: simMode,
      });
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigData = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await cmcApi.requestConfigData({ simulate_mode: simMode });
      setState(next);
      setScreen("SHOP_CONFIG");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopFaults = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await cmcApi.requestShopFaults({ simulate_mode: simMode });
      setState(next);
      setScreen("SHOP_CONFIG");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const configureSharedChannel = async (payload: {
    channel: string;
    speed?: ArincBusSpeed;
    enabled?: boolean;
    trap_label?: string;
  }) => {
    try {
      await arincApi.configureChannel(payload);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return {
    state,
    screen,
    setScreen,
    simMode,
    setSimMode,
    loading,
    error,
    handshakeMessage,
    selectLru,
    saveTransmitData,
    sendCommandSummary,
    toggleFaultBit,
    switchFaultPage,
    sendTerminalAction,
    fetchConfigData,
    fetchShopFaults,
    configureSharedChannel,
  };
}

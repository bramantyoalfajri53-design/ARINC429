import { useCallback, useEffect, useState } from "react";
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
  const [screen, setScreen] = useState<CmcScreenMode>("BITE_MAIN");
  const [simMode, setSimMode] = useState<CmcSimResponseMode>("SUCCESS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const sendCommandSummary = async (payload: {
    function: CmcFunctionName;
    ground_test_en: boolean;
    inflight_test_en: boolean;
    sensor_code: string;
  }) => {
    setLoading(true);
    setError("");
    try {
      const next = await cmcApi.sendCommand(payload);
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaultBit = async (bit: number, fault: boolean, commandAck?: boolean) => {
    setError("");
    try {
      const next = await cmcApi.updateFaultBit({ bit, fault, command_ack: commandAck });
      setState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fetchConfigData = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await cmcApi.requestConfigData({ simulate_mode: simMode });
      setState(next);
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
    trap_active?: boolean;
  }) => {
    setError("");
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
    selectLru,
    sendCommandSummary,
    toggleFaultBit,
    fetchConfigData,
    fetchShopFaults,
    configureSharedChannel,
  };
}


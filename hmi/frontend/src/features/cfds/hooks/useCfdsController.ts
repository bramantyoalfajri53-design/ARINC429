import { useCallback, useEffect, useState } from "react";
import { arincApi, type ArincDataSource, type RxChannelState, type TxChannelState } from "../../../shared";
import { cfdsApi } from "../services";
import type {
  AircraftConfigWord,
  CfdsBackendStateResponse,
  CfdsLruItem,
  CfdsSubmodeMenuKey,
  CfdsTxParameters,
  CfdsView,
} from "../types";
import {
  CFDS_LRU_TABLE,
  DEFAULT_AIRCRAFT_CONFIG,
  DEFAULT_CFDS_TX_PARAMS,
} from "../utils";

function getInitialCfdsState(): { view: CfdsView; lru: CfdsLruItem | null } {
  try {
    const p = new URLSearchParams(window.location.search);
    const m = p.get("mode")?.toUpperCase();
    const defaultLru = CFDS_LRU_TABLE[12]; // TCAS 735
    if (m === "CFDS_SELECT") return { view: "MODE_SELECT", lru: defaultLru };
    if (m === "CFDS_EDIT_TX") return { view: "EDIT_TX", lru: defaultLru };
    if (m === "CFDS_CHANNELS") return { view: "CONFIGURE_CHANNELS", lru: defaultLru };
    if (m === "CFDS_OP") return { view: "OPERATION_MODE", lru: defaultLru };
    if (m === "CFDS_NORMAL_18") return { view: "NORMAL_MODE_ABD0018", lru: defaultLru };
    if (m === "CFDS_NORMAL_48") return { view: "NORMAL_MODE_ABD0048", lru: defaultLru };
    if (m === "CFDS_MENU_18") return { view: "MENU_MODE_ABD0018", lru: defaultLru };
    if (m === "CFDS_INTERACTIVE_48") return { view: "INTERACTIVE_MODE_ABD0048", lru: defaultLru };
    if (m === "CFDS_DISCRETE_48") return { view: "DISCRETE_MODE_ABD0048", lru: defaultLru };
  } catch {
    // Fallback when running in non-DOM test environments
  }
  return { view: "LRU_SELECTION", lru: null };
}

export function useCfdsController() {
  const initial = getInitialCfdsState();
  const [currentView, setCurrentView] = useState<CfdsView>(initial.view);
  const [selectedLru, setSelectedLru] = useState<CfdsLruItem | null>(initial.lru);
  const [txParams, setTxParams] = useState<CfdsTxParameters>({ ...DEFAULT_CFDS_TX_PARAMS });
  const [aircraftConfig, setAircraftConfig] = useState<AircraftConfigWord>({ ...DEFAULT_AIRCRAFT_CONFIG });
  const [dataSource, setDataSource] = useState<ArincDataSource>("SIMULATION");
  const [busRunning, setBusRunning] = useState<boolean>(false);
  const [sharedChannels, setSharedChannels] = useState<{
    tx: Record<string, TxChannelState>;
    rx: Record<string, RxChannelState>;
  } | null>(null);

  const applyBackendSnapshot = useCallback((snap: CfdsBackendStateResponse) => {
    setDataSource(snap.source);
    setBusRunning(snap.bus_running);
    setSharedChannels(snap.channels);
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await arincApi.acquireMode("CFDS");
        const snap = await cfdsApi.fetchState();
        if (!active) return;
        applyBackendSnapshot(snap);
      } catch {
        // Offline / unit-test graceful fallback: local state stays SIMULATION
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [applyBackendSnapshot]);

  const handleSelectLru = useCallback(
    (lru: CfdsLruItem) => {
      setSelectedLru(lru);
      void cfdsApi
        .selectLru(lru)
        .then(applyBackendSnapshot)
        .catch(() => undefined);
    },
    [applyBackendSnapshot]
  );

  const handleProceedToModeSelect = useCallback(() => {
    if (selectedLru) {
      setCurrentView("MODE_SELECT");
    }
  }, [selectedLru]);

  const handleSaveTxData = useCallback(
    (newParams: CfdsTxParameters, newConfig: AircraftConfigWord) => {
      setTxParams(newParams);
      setAircraftConfig(newConfig);
      void cfdsApi
        .updateTxParams(newParams, newConfig)
        .then(applyBackendSnapshot)
        .catch(() => undefined);
    },
    [applyBackendSnapshot]
  );

  const handleUpdateDateShopCode = useCallback(
    (newDate: string, newShopCode: string) => {
      setTxParams((prev) => {
        const updated: CfdsTxParameters = {
          ...prev,
          date: newDate,
          aircraftId: newShopCode,
        };
        void cfdsApi
          .updateTxParams(updated, aircraftConfig)
          .then(applyBackendSnapshot)
          .catch(() => undefined);
        return updated;
      });
    },
    [aircraftConfig, applyBackendSnapshot]
  );

  const handleOpenSubmode = useCallback((submode: CfdsSubmodeMenuKey) => {
    const map: Record<CfdsSubmodeMenuKey, CfdsView> = {
      NORMAL_ABD0018: "NORMAL_MODE_ABD0018",
      MENU_ABD0018: "MENU_MODE_ABD0018",
      NORMAL_ABD0048: "NORMAL_MODE_ABD0048",
      INTERACTIVE_ABD0048: "INTERACTIVE_MODE_ABD0048",
      DISCRETE_ABD0048: "DISCRETE_MODE_ABD0048",
    };
    setCurrentView(map[submode]);
  }, []);

  const emitBiteCommand = useCallback(
    (payload: {
      equipment_code: string;
      command_code: number;
      sdi?: number;
      ready?: boolean;
      bit12?: boolean;
      channel?: string;
      submode?: "NORMAL" | "MENU" | "INTERACTIVE" | "DISCRETE" | "CONFIGURE";
      action_label?: string;
    }) => {
      void cfdsApi
        .sendCommand(payload)
        .then(applyBackendSnapshot)
        .catch(() => undefined);
    },
    [applyBackendSnapshot]
  );

  const notifyNormalSimulation = useCallback(
    (scenario: "FIGURE_58_PASS" | "COUNT_ERROR" | "CLEAR") => {
      void cfdsApi
        .simulateNormal(scenario)
        .then(applyBackendSnapshot)
        .catch(() => undefined);
    },
    [applyBackendSnapshot]
  );

  const notifyDiscreteSimulation = useCallback(
    (scenario: "SINGLE_FIG73" | "MULTI_FIG74" | "CLEAR") => {
      void cfdsApi
        .simulateDiscrete(scenario)
        .then(applyBackendSnapshot)
        .catch(() => undefined);
    },
    [applyBackendSnapshot]
  );

  const configureSharedChannel = useCallback(
    (payload: {
      channel: string;
      speed?: "100k" | "12.5k";
      enabled?: boolean;
      trap_label?: string;
      trap_active?: boolean;
    }) => {
      void cfdsApi
        .configureChannel(payload)
        .then(applyBackendSnapshot)
        .catch(() => undefined);
    },
    [applyBackendSnapshot]
  );

  return {
    currentView,
    setCurrentView,
    selectedLru,
    txParams,
    aircraftConfig,
    dataSource,
    busRunning,
    sharedChannels,
    handleSelectLru,
    handleProceedToModeSelect,
    handleSaveTxData,
    handleUpdateDateShopCode,
    handleOpenSubmode,
    emitBiteCommand,
    notifyNormalSimulation,
    notifyDiscreteSimulation,
    configureSharedChannel,
  };
}


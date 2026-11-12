import { ChannelConfigPanel } from "../../../shared";
import { useCmcController } from "../hooks";
import type { CmcScreenMode } from "../types";
import { CmcBiteMainPanel } from "./CmcBiteMainPanel";
import { CmcConfigDataPanel } from "./CmcConfigDataPanel";
import { CmcEditCommandPanel } from "./CmcEditCommandPanel";
import { CmcShopFaultsPanel } from "./CmcShopFaultsPanel";

const CMC_TABS: Array<{ id: CmcScreenMode; label: string }> = [
  { id: "BITE_MAIN", label: "CMC / Sensor BITE" },
  { id: "EDIT_CMD", label: "Edit Command Word (227) & TX/RX" },
  { id: "CONFIG_DATA", label: "Config Data (356)" },
  { id: "SHOP_FAULTS", label: "Shop Faults Screen" },
  { id: "CHANNELS", label: "Channels A-D" },
];

export function CmcMode() {
  const {
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
  } = useCmcController();

  if (!state) {
    return (
      <section className="panel">
        <p className="section-sub">Loading Boeing CMC mode state from shared coordinator...</p>
      </section>
    );
  }

  const activeFaultCount = state.fault_summary.bits.filter((b) => b.fault).length;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Overview Metrics Strip */}
      <div className="meters">
        <div className="meter">
          <div className="meter-label">Data Source</div>
          <div className="meter-value" style={{ fontSize: "16px" }}>
            <span className={state.source === "HARDWARE" ? "badge-hw" : "badge-sim"}>
              {state.source}
            </span>
          </div>
          <div className="meter-unit">
            {state.source === "SIMULATION" ? "Simulated Boeing LRU" : "Live Ballard Card"}
          </div>
        </div>

        <div className="meter">
          <div className="meter-label">Target Boeing LRU</div>
          <div className="meter-value" style={{ color: "var(--teal-primary)" }}>
            {state.selected_lru.id}
          </div>
          <div className="meter-unit">{state.selected_lru.name}</div>
        </div>

        <div className="meter">
          <div className="meter-label">Fault Summary (350)</div>
          <div
            className="meter-value"
            style={{ color: activeFaultCount > 0 ? "var(--fault)" : "var(--ok)", fontSize: "17px" }}
          >
            {activeFaultCount > 0 ? `${activeFaultCount} FAULTS` : "ALL NOMINAL"}
          </div>
          <div className="meter-unit">
            Bit 29 ACK: {state.fault_summary.bit_29_ack ? "VALID" : "NAK"}
          </div>
        </div>

        <div className="meter">
          <div className="meter-label">Command Word (227)</div>
          <div className="meter-value" style={{ fontSize: "16px" }}>
            {state.command_summary.function}
          </div>
          <div className="meter-unit">
            Timeout: {state.command_summary.rx_timeout_secs}s
          </div>
        </div>
      </div>

      {/* Screen Navigation Strip */}
      <div className="panel" style={{ padding: "10px 14px" }}>
        <div className="presets">
          {CMC_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={screen === tab.id ? "btn-sm primary" : "btn-sm"}
              onClick={() => setScreen(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {screen === "BITE_MAIN" && (
        <CmcBiteMainPanel
          state={state}
          onSelectLru={(lru) => void selectLru(lru)}
          onToggleFaultBit={(bit, fault, ack) => void toggleFaultBit(bit, fault, ack)}
        />
      )}

      {screen === "EDIT_CMD" && (
        <CmcEditCommandPanel
          state={state}
          loading={loading}
          onSendCommand={(payload) => void sendCommandSummary(payload)}
        />
      )}

      {screen === "CONFIG_DATA" && (
        <CmcConfigDataPanel
          state={state}
          simMode={simMode}
          loading={loading}
          onChangeSimMode={setSimMode}
          onRequestConfigData={() => void fetchConfigData()}
        />
      )}

      {screen === "SHOP_FAULTS" && (
        <CmcShopFaultsPanel
          state={state}
          simMode={simMode}
          loading={loading}
          onChangeSimMode={setSimMode}
          onRequestShopFaults={() => void fetchShopFaults()}
        />
      )}

      {screen === "CHANNELS" && (
        <ChannelConfigPanel
          txChannels={state.channels.tx}
          rxChannels={state.channels.rx}
          onConfigure={(payload) => void configureSharedChannel(payload)}
          title="CMC ARINC 429 CHANNELS (SHARED HARDWARE A, B, C, D)"
        />
      )}
    </div>
  );
}

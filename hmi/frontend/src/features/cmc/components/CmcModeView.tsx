import { useState } from "react";
import { ChannelConfigPanel } from "../../../shared";
import { useCmcController } from "../hooks";
import type { CmcScreenMode } from "../types";
import { BOEING_LRU_DATABASE, TIME_CONSTANT_OPTIONS } from "../utils";
import { CmcEditCommandPanel } from "./CmcEditCommandPanel";
import { CmcFaultSummaryPanel } from "./CmcFaultSummaryPanel";
import { CmcShopConfigTerminalPanel } from "./CmcShopConfigTerminalPanel";
import { CmcTransmitDataPanel } from "./CmcTransmitDataPanel";

const CMC_5_TABS: Array<{ id: CmcScreenMode; label: string }> = [
  { id: "TRANSMIT_DATA", label: "Edit CMC Transmit Data" },
  { id: "FAULT_SUMMARY", label: "Display Fault Summary Word(s) (350/351)" },
  { id: "EDIT_CMD", label: "Edit Command Summary Word (227)" },
  { id: "SHOP_CONFIG", label: "Shop Faults & Config Data (356)" },
  { id: "CHANNELS", label: "Configure TX/RX Channels A-D" },
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
  } = useCmcController();

  const [manualCode, setManualCode] = useState("000");
  const [timeConstant, setTimeConstant] = useState("OFF");

  if (!state) {
    return (
      <section className="panel">
        <p className="section-sub">Loading Boeing CMC Mode from shared coordinator...</p>
      </section>
    );
  }

  const selectedLru = state.selected_lru;
  const isManual = selectedLru.id === "MANUAL ENTRY";
  const activeFaultCount = state.fault_summary.bits.filter((b) => b.fault && b.bit <= 27).length;

  // Determine if Time Constant filter is applicable (for VOR, ILS, ADF or Manual)
  const isTimeConstantApplicable =
    selectedLru.code === "010" || // 710 ILS
    selectedLru.code === "011" || // 711 VOR
    selectedLru.code === "012" || // 712 ADF
    isManual;

  const handleLruChange = (lruId: string) => {
    const found = BOEING_LRU_DATABASE.find((item) => item.id === lruId);
    if (!found) return;

    if (found.id === "MANUAL ENTRY") {
      void selectLru({
        id: "MANUAL ENTRY",
        name: "Manual Equipment Code",
        code: manualCode,
        time_constant: timeConstant,
      });
    } else {
      void selectLru({
        ...found,
        time_constant: timeConstant,
      });
    }
  };

  const handleManualCodeSubmit = () => {
    const clean = manualCode.replace(/[^0-9a-fA-F]/g, "").toUpperCase().padStart(3, "0").slice(-3);
    setManualCode(clean);
    void selectLru({
      id: "MANUAL ENTRY",
      name: `Manual Eq (${clean})`,
      code: clean,
      time_constant: timeConstant,
    });
  };

  const handleTimeConstantChange = (tc: string) => {
    setTimeConstant(tc);
    void selectLru({
      ...selectedLru,
      time_constant: tc,
    });
  };

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Overview Status Metrics Strip */}
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
          <div className="meter-label">Target LRU &amp; Eq Code</div>
          <div className="meter-value" style={{ color: "var(--teal-primary)", fontSize: "16px" }}>
            {selectedLru.id} ({selectedLru.code})
          </div>
          <div className="meter-unit">{selectedLru.name}</div>
        </div>

        <div className="meter">
          <div className="meter-label">Time Constant (Filter)</div>
          <div className="meter-value" style={{ fontSize: "16px" }}>
            {selectedLru.time_constant || "OFF"} s
          </div>
          <div className="meter-unit">
            {isTimeConstantApplicable ? "VOR/ILS/ADF Active" : "Bypass (OFF)"}
          </div>
        </div>

        <div className="meter">
          <div className="meter-label">Fault Summary (350/351)</div>
          <div
            className="meter-value"
            style={{ color: activeFaultCount > 0 ? "var(--fault)" : "var(--ok)", fontSize: "16px" }}
          >
            {state.fault_summary.has_words_received
              ? activeFaultCount > 0
                ? `${activeFaultCount} FAULT(S)`
                : "ALL NOMINAL (OK)"
              : "NO WORDS RECEIVED"}
          </div>
          <div className="meter-unit">
            Bit 29 ACK: {state.fault_summary.bit_29_ack ? "VALID (ACK)" : "NAK"}
          </div>
        </div>

        <div className="meter">
          <div className="meter-label">Command Word (227)</div>
          <div className="meter-value" style={{ fontSize: "15px" }}>
            {state.command_summary.function} ({state.command_summary.function_hex})
          </div>
          <div className="meter-unit">Rate: {state.command_summary.rate_ms} ms</div>
        </div>
      </div>

      {/* LRU Selection & Time Constant Filter Strip */}
      <section className="panel" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* LRU Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "13px" }}>LRU SELECTION:</span>
            <select
              className="category-select"
              value={selectedLru.id}
              onChange={(e) => handleLruChange(e.target.value)}
              style={{ fontWeight: 600, minWidth: "220px" }}
            >
              {BOEING_LRU_DATABASE.map((lru) => (
                <option key={lru.id} value={lru.id}>
                  {lru.id} (Eq Code: {lru.code}) — {lru.name}
                </option>
              ))}
            </select>

            {/* Manual Entry 3-digit Hex Input (000-FFF) */}
            {isManual && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>HEX (000–FFF):</span>
                <input
                  type="text"
                  maxLength={3}
                  className="category-select"
                  style={{ width: "70px", fontFamily: "monospace", fontWeight: 700, textTransform: "uppercase" }}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onBlur={handleManualCodeSubmit}
                  onKeyDown={(e) => e.key === "Enter" && handleManualCodeSubmit()}
                />
                <button type="button" className="btn-sm" onClick={handleManualCodeSubmit}>
                  SET
                </button>
              </div>
            )}
          </div>

          {/* Time Constant Filter Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700, fontSize: "13px" }}>TIME CONSTANT:</span>
            <select
              className="category-select"
              value={selectedLru.time_constant || timeConstant}
              onChange={(e) => handleTimeConstantChange(e.target.value)}
              style={{ fontFamily: "monospace" }}
            >
              {TIME_CONSTANT_OPTIONS.map((tc) => (
                <option key={tc} value={tc}>
                  {tc === "OFF" ? "OFF (Bypass Filter)" : `${tc} s Filter`}
                </option>
              ))}
            </select>
            {!isTimeConstantApplicable && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                (Applies to VOR/ILS/ADF)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main 5-Submenu Navigation Strip per T1200B Menu Tree */}
      <div className="panel" style={{ padding: "8px 12px" }}>
        <div className="presets" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {CMC_5_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={screen === tab.id ? "btn-sm primary" : "btn-sm"}
              onClick={() => setScreen(tab.id)}
              style={{ fontWeight: screen === tab.id ? 700 : 500 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* TAB 1: Edit CMC Transmit Data */}
      {screen === "TRANSMIT_DATA" && (
        <CmcTransmitDataPanel
          state={state}
          loading={loading}
          onSaveTransmitData={(payload) => void saveTransmitData(payload)}
        />
      )}

      {/* TAB 2: Display Fault Summary Word(s) (350/351) */}
      {screen === "FAULT_SUMMARY" && (
        <CmcFaultSummaryPanel
          state={state}
          onSwitchPage={(page) => void switchFaultPage(page)}
          onToggleFaultBit={(bit, fault, ack, inhibit, label, sdi, ssm, hasWords) =>
            void toggleFaultBit(bit, fault, ack, inhibit, label, sdi, ssm, hasWords)
          }
        />
      )}

      {/* TAB 3: Edit Command Summary Word (227) */}
      {screen === "EDIT_CMD" && (
        <CmcEditCommandPanel
          state={state}
          loading={loading}
          handshakeMessage={handshakeMessage}
          onSendCommand={(payload) => void sendCommandSummary(payload)}
        />
      )}

      {/* TAB 4: Shop Faults & Config Data (356) */}
      {screen === "SHOP_CONFIG" && (
        <CmcShopConfigTerminalPanel
          state={state}
          loading={loading}
          simMode={simMode}
          onChangeSimMode={setSimMode}
          onSendTerminalAction={(payload) => void sendTerminalAction(payload)}
          onRequestShopFaults={() => void fetchShopFaults()}
          onRequestConfigData={() => void fetchConfigData()}
        />
      )}

      {/* TAB 5: Configure TX/RX Channels A-D */}
      {screen === "CHANNELS" && (
        <ChannelConfigPanel
          txChannels={state.channels.tx}
          rxChannels={state.channels.rx}
          onConfigure={(payload) => void configureSharedChannel(payload)}
          title="CMC ARINC 429 CHANNELS (SHARED HARDWARE CHANNELS A, B, C, D)"
        />
      )}
    </div>
  );
}

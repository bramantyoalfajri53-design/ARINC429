import { useState, useEffect, type FC } from "react";
import type { CfdsLruItem } from "../../utils/lruDefinitions";
import type { CfdsTxParameters } from "../../utils/cfdsDefaults";
import {
  MENU_LEFT_KEYS,
  MENU_RIGHT_KEYS,
  MENU_PAGE_KEY,
  MENU_TIMEOUT_3S_MS,
  MENU_TIMEOUT_30S_MS,
  MENU_NO_RESPONSE_3S_MSG,
  MENU_LRU_ERROR_30S_MSG,
  MENU_LRU_ERROR_30S_PROSE,
  buildMenuCommandWord,
  getSimulatedMenuPages,
  type MenuDisplayStatus,
  type MenuKeyId,
  type MenuTxFrame,
} from "../../services/menuModeService";

export interface MenuModeViewProps {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; actionLabel?: string }) => void;
}

/**
 * Menu Mode (ABD0018) View Component
 * Reference: Aeroflex JcAIR T1200B Manual Section 4.F, Figures 59-61 (pp. 1-4-101 to 1-4-103)
 */
export const MenuModeView: FC<MenuModeViewProps> = ({
  selectedLru,
  txParams,
  onBack,
  onEmitBiteCommand,
}) => {
  const accentColor = "#0d9488"; // ABD0018 teal accent matching NormalModeView

  const [sdi, setSdi] = useState<number>(0);
  const [displayStatus, setDisplayStatus] = useState<MenuDisplayStatus>("WAITING");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [nxtReverseVideo, setNxtReverseVideo] = useState<boolean>(false);
  const [simPageIdx, setSimPageIdx] = useState<number>(0);
  const [waitOriginMs, setWaitOriginMs] = useState<number>(() => Date.now());

  const [lastTxFrame, setLastTxFrame] = useState<MenuTxFrame>(() =>
    buildMenuCommandWord(selectedLru.code, "1", 0, false)
  );
  const [txHistory, setTxHistory] = useState<MenuTxFrame[]>([]);

  const simPages = getSimulatedMenuPages(selectedLru.name, selectedLru.code);
  const activeSimPage = simPages[simPageIdx % simPages.length];

  // Real-time 3s and 30s timeout monitoring driven by waitOriginMs when not overridden by Simulation Data
  useEffect(() => {
    if (displayStatus === "SIM_DATA_ACTIVE") return;

    const syncFromElapsed = () => {
      const elapsedMs = Math.max(0, Date.now() - waitOriginMs);
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
      if (elapsedMs >= MENU_TIMEOUT_30S_MS) {
        setDisplayStatus("TIMEOUT_30S");
      } else if (elapsedMs >= MENU_TIMEOUT_3S_MS) {
        setDisplayStatus("TIMEOUT_3S");
      } else {
        setDisplayStatus("WAITING");
      }
    };

    syncFromElapsed();
    const interval = setInterval(syncFromElapsed, 250);
    return () => clearInterval(interval);
  }, [waitOriginMs, displayStatus === "SIM_DATA_ACTIVE"]);

  const handlePressMenuKey = (key: MenuKeyId) => {
    const frame = buildMenuCommandWord(selectedLru.code, key, sdi, false);
    setLastTxFrame(frame);
    setTxHistory((prev) => [frame, ...prev].slice(0, 8));
    onEmitBiteCommand?.({
      commandCode: frame.commandCode,
      sdi,
      ready: false,
      actionLabel: `MENU_${key}`,
    });

    if (key === "PAGE") {
      // Manual p. 1-4-102: "Pressing this key will cause the word NXT in the upper right corner
      // of the display to appear in reverse video and a new menu page will appear on the screen."
      setNxtReverseVideo(true);
      if (displayStatus === "SIM_DATA_ACTIVE") {
        setSimPageIdx((prev) => (prev + 1) % simPages.length);
      } else {
        // Without HW RX, another key press restarts the response wait timer
        setWaitOriginMs(Date.now());
        setDisplayStatus("WAITING");
        setElapsedSeconds(0);
      }
      return;
    }

    // Keys 1..6 or A..F
    setNxtReverseVideo(false);
    if (displayStatus !== "SIM_DATA_ACTIVE") {
      // Manual Fig 61: "LRU ERROR - HIT <PRIOR PAGE> OR ANOTHER KEY"
      setWaitOriginMs(Date.now());
      setDisplayStatus("WAITING");
      setElapsedSeconds(0);
    }
  };

  const handleSdiChange = (newSdi: number) => {
    setSdi(newSdi);
    setLastTxFrame(buildMenuCommandWord(selectedLru.code, lastTxFrame.key, newSdi, false));
  };

  const handleActivateSimulationMenu = () => {
    setDisplayStatus("SIM_DATA_ACTIVE");
    setSimPageIdx(0);
    setNxtReverseVideo(false);
  };

  const handleResetToNoHwMonitoring = () => {
    setNxtReverseVideo(false);
    setWaitOriginMs(Date.now());
    setDisplayStatus("WAITING");
    setElapsedSeconds(0);
  };

  const handleTriggerSimulatedTimeout = (timeoutMs: number, status: "TIMEOUT_3S" | "TIMEOUT_30S") => {
    setNxtReverseVideo(false);
    setWaitOriginMs(Date.now() - timeoutMs);
    setElapsedSeconds(Math.floor(timeoutMs / 1000));
    setDisplayStatus(status);
  };

  const isTimeout = displayStatus === "TIMEOUT_3S" || displayStatus === "TIMEOUT_30S";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header Bar */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                background: accentColor,
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "9999px",
                letterSpacing: "0.04em",
              }}
            >
              ABD0018
            </span>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
              MENU MODE (ABD0018)
            </h2>
            {displayStatus === "SIM_DATA_ACTIVE" ? (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#b45309",
                  border: "1px solid #fcd34d",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                SIMULATION MODE (NO HW RX)
              </span>
            ) : (
              <span
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                NO HW RX — MONITORING ({elapsedSeconds}s)
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "5px" }}>
            Selected LRU: <strong style={{ color: "#0f172a" }}>{selectedLru.name}</strong> (Eq Code:{" "}
            <code>{selectedLru.code}h</code>) &nbsp;|&nbsp; Date: <code>{txParams.date}</code>{" "}
            &nbsp;|&nbsp; Shop Code: <code>{txParams.aircraftId}</code> &nbsp;|&nbsp; Manual Figures 59–61
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#f8fafc",
            color: "#334155",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          &larr; PRIOR PAGE
        </button>
      </div>

      {/* Main Content Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(480px, 1.35fr) minmax(320px, 1fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {/* Left Column: T1200B Menu Mode CRT Screen + Label 227 Inspector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  T1200B MENU DISPLAY &amp; KEYPAD (FIGURE 59–61)
                </h3>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Press keys <code>1–6</code>, <code>A–F</code>, or <code>PAGE</code> (below <code>F</code>) to encode Label 227 Bits 25–31
                </div>
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: accentColor }}>
                TX Label 227 @ 100 ms
              </span>
            </div>

            {/* CRT Screen Box matching Figures 59-61 */}
            <div
              style={{
                background: "#050b14",
                border: `2px solid ${isTimeout ? "#d97706" : "#1e293b"}`,
                borderRadius: "8px",
                padding: "16px",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                color: "#22c55e",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                minHeight: "340px",
                justifyContent: "space-between",
              }}
            >
              {/* Top line inside CRT: Title/Prompt + NXT indicator in upper right */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #14532d",
                  paddingBottom: "8px",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "#86efac" }}>
                  {displayStatus === "SIM_DATA_ACTIVE"
                    ? activeSimPage.title
                    : `MENU MODE (ABD0018) — ${selectedLru.name} [${selectedLru.code}h]`}
                </span>
                <span
                  data-testid="crt-nxt-indicator"
                  style={{
                    padding: "2px 8px",
                    borderRadius: "3px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    background: nxtReverseVideo ? "#22c55e" : "transparent",
                    color: nxtReverseVideo ? "#050b14" : "#22c55e",
                    border: nxtReverseVideo ? "1px solid #22c55e" : "1px solid #14532d",
                  }}
                >
                  NXT
                </span>
              </div>

              {/* Boxed-in area with 1..6 on Left, Menu Text Center, A..F on Right */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, justifyContent: "center" }}>
                {MENU_LEFT_KEYS.map((leftDef, idx) => {
                  const rightDef = MENU_RIGHT_KEYS[idx];
                  const simRow = displayStatus === "SIM_DATA_ACTIVE" ? activeSimPage.rows[idx] : null;
                  const isLeftSelected = lastTxFrame.key === leftDef.key;
                  const isRightSelected = lastTxFrame.key === rightDef.key;

                  return (
                    <div
                      key={leftDef.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "56px 1fr 56px",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {/* Left Key 1-6 */}
                      <button
                        type="button"
                        onClick={() => handlePressMenuKey(leftDef.key)}
                        title={`Key ${leftDef.key} -> Label 227 Cmd ${leftDef.hexLabel}h`}
                        style={{
                          background: isLeftSelected ? "#14532d" : "#0b1526",
                          color: "#22c55e",
                          border: isLeftSelected ? "1px solid #4ade80" : "1px solid #166534",
                          borderRadius: "4px",
                          padding: "6px 8px",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {leftDef.key}
                      </button>

                      {/* Center Boxed Menu Row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 10px",
                          background: "#07101d",
                          border: "1px dashed #14532d",
                          borderRadius: "4px",
                          minHeight: "32px",
                          fontSize: "0.82rem",
                        }}
                      >
                        <span style={{ color: simRow?.leftText ? "#4ade80" : "#1e3a2f" }}>
                          {simRow ? simRow.leftText : idx === 0 && displayStatus === "WAITING" ? "(AWAITING LRU MENU DATA...)" : ""}
                        </span>
                        <span style={{ color: simRow?.rightText ? "#4ade80" : "#1e3a2f", textAlign: "right" }}>
                          {simRow ? simRow.rightText : ""}
                        </span>
                      </div>

                      {/* Right Key A-F */}
                      <button
                        type="button"
                        onClick={() => handlePressMenuKey(rightDef.key)}
                        title={`Key ${rightDef.key} -> Label 227 Cmd ${rightDef.hexLabel}h`}
                        style={{
                          background: isRightSelected ? "#14532d" : "#0b1526",
                          color: "#22c55e",
                          border: isRightSelected ? "1px solid #4ade80" : "1px solid #166534",
                          borderRadius: "4px",
                          padding: "6px 8px",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          textAlign: "right",
                        }}
                      >
                        {rightDef.key}
                      </button>
                    </div>
                  );
                })}

                {/* PAGE key directly below "F" key per Manual p. 1-4-102 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr 78px",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "2px",
                  }}
                >
                  <div />
                  <div style={{ fontSize: "0.72rem", color: "#64748b", textAlign: "right", paddingRight: "4px" }}>
                    {displayStatus === "SIM_DATA_ACTIVE"
                      ? "[SIM] Press PAGE for next page (NXT reverse video) ->"
                      : "PAGE key located directly below F ->"}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePressMenuKey("PAGE")}
                    title={`PAGE Key -> Label 227 Cmd ${MENU_PAGE_KEY.hexLabel}h`}
                    style={{
                      background: lastTxFrame.key === "PAGE" ? "#14532d" : "#0b1526",
                      color: "#22c55e",
                      border: lastTxFrame.key === "PAGE" ? "1px solid #4ade80" : "1px solid #166534",
                      borderRadius: "4px",
                      padding: "6px 8px",
                      fontFamily: "inherit",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    PAGE
                  </button>
                </div>
              </div>

              {/* Bottom CRT Error / Status Line (Figures 60 & 61) */}
              <div
                data-testid="crt-status-line"
                style={{
                  borderTop: "1px solid #14532d",
                  paddingTop: "10px",
                  minHeight: "24px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color:
                    displayStatus === "TIMEOUT_30S"
                      ? "#f87171"
                      : displayStatus === "TIMEOUT_3S"
                      ? "#fbbf24"
                      : displayStatus === "SIM_DATA_ACTIVE"
                      ? "#38bdf8"
                      : "#86efac",
                }}
              >
                {displayStatus === "TIMEOUT_3S" && MENU_NO_RESPONSE_3S_MSG}
                {displayStatus === "TIMEOUT_30S" && MENU_LRU_ERROR_30S_MSG}
                {displayStatus === "WAITING" &&
                  `WAITING FOR LRU MENU RESPONSE... (${elapsedSeconds}s / 3s timeout)`}
                {displayStatus === "SIM_DATA_ACTIVE" &&
                  `[SIMULATION SAMPLE] PAGE ${activeSimPage.pageNumber}/${activeSimPage.totalPages} ACTIVE (NO HW RX)`}
              </div>
            </div>
          </div>

          {/* Label 227 Live Command Word Encoder Inspector */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#0f172a" }}>
                LABEL 227 BITE COMMAND ENCODER (BITS 25–31)
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>SDI:</span>
                {[0, 1, 2, 3].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSdiChange(val)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: "4px",
                      border: sdi === val ? `1px solid ${accentColor}` : "1px solid #cbd5e1",
                      background: sdi === val ? "#ccfbf1" : "#f8fafc",
                      color: sdi === val ? "#0f766e" : "#475569",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    {val.toString(2).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(110px, 1fr))",
                gap: "10px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Last Key</div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                  {lastTxFrame.key}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Bits 25–31 (Cmd)</div>
                <div style={{ fontWeight: 700, color: accentColor, fontFamily: "monospace" }}>
                  {lastTxFrame.commandHex}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Eq Code (Bits 13–24)</div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                  0x{lastTxFrame.wordSpec.equipmentCode}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>32-Bit Word (Odd Par)</div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                  {lastTxFrame.encodedHex32}
                </div>
              </div>
            </div>

            {txHistory.length > 0 && (
              <div style={{ fontSize: "0.76rem", color: "#475569" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                  Recent Menu Key Encodings (UI State Only — Not Hardware Bus TX):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {txHistory.map((item, idx) => (
                    <span
                      key={`${item.timestamp}-${idx}`}
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        padding: "2px 7px",
                        fontFamily: "monospace",
                      }}
                    >
                      [{item.timestamp}] {item.key} &rarr; {item.commandHex} ({item.encodedHex32})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Manual Reference & Isolated Simulation Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Isolated Simulation Helper */}
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: "10px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#92400e" }}>
              SIMULATION MODE — TEST HELPERS (NO HW RX)
            </div>
            <div style={{ fontSize: "0.78rem", color: "#78350f", lineHeight: 1.45 }}>
              Hardware ARINC 429 RX is not connected. Use these isolated controls to test Figure 60
              (3s timeout), Figure 61 (30s timeout), or preview a simulated 2-page LRU menu.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={handleActivateSimulationMenu}
                style={{
                  background: "#0d9488",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Inject Sim Menu (2 Pages)
              </button>
              <button
                type="button"
                onClick={handleResetToNoHwMonitoring}
                style={{
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset Wait Timer (0s)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSimulatedTimeout(MENU_TIMEOUT_3S_MS, "TIMEOUT_3S")}
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Trigger 3s Timeout (Fig 60)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSimulatedTimeout(MENU_TIMEOUT_30S_MS, "TIMEOUT_30S")}
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Trigger 30s Error (Fig 61)
              </button>
            </div>
          </div>

          {/* Manual Command Mapping & Verification Notes */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#0f172a" }}>
              MANUAL COMMAND CODES (PP. 1-4-101 – 1-4-103)
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.78rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                    <th style={{ padding: "5px 8px", border: "1px solid #e2e8f0" }}>Key</th>
                    <th style={{ padding: "5px 8px", border: "1px solid #e2e8f0" }}>Bits 25–31</th>
                  </tr>
                </thead>
                <tbody>
                  {MENU_LEFT_KEYS.map((k) => (
                    <tr key={k.key}>
                      <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontWeight: 700 }}>{k.key}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>
                        {k.hexLabel}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                    <th style={{ padding: "5px 8px", border: "1px solid #e2e8f0" }}>Key</th>
                    <th style={{ padding: "5px 8px", border: "1px solid #e2e8f0" }}>Bits 25–31</th>
                  </tr>
                </thead>
                <tbody>
                  {MENU_RIGHT_KEYS.map((k) => (
                    <tr key={k.key}>
                      <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontWeight: 700 }}>{k.key}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>
                        {k.hexLabel}h
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontWeight: 700 }}>PAGE</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>
                      {MENU_PAGE_KEY.hexLabel}h
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "0.76rem",
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              <div>
                <strong>3s Timeout (Fig 60):</strong> <code>{MENU_NO_RESPONSE_3S_MSG}</code>
              </div>
              <div>
                <strong>30s Error (Fig 61):</strong> <code>{MENU_LRU_ERROR_30S_PROSE}</code>
              </div>
              <div style={{ marginTop: "6px", color: "#b45309" }}>
                <strong>NEEDS VERIFICATION:</strong> Exact ARINC 429 RX label/framing for LRU menu text lines inside
                the boxed area is not specified in Manual Section 4.F (pp. 1-4-101–103). Only ABD0018 Menu Mode exists
                in the manual (ABD0048 uses Interactive Mode instead).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


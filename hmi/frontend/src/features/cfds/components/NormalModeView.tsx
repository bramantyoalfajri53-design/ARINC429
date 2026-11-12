import { useState, useEffect, useRef, type FC } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";
import type { CfdsTxParameters } from "../utils/cfdsDefaults";
import { encodeBiteCommandWord, formatHex32 } from "../utils/cfdsProtocol";
import {
  parseLabel356Block,
  getFlightPhaseCommandCode,
  FIGURE_58_TEST_BURST,
  FIGURE_58_COUNT_ERR_BURST,
  type Label356SlotWord,
  type ParseResult,
} from "../utils/normalModeParser";

export interface NormalModeViewProps {
  standard: "ABD0018" | "ABD0048";
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; actionLabel?: string }) => void;
  onSimulateNormal?: (scenario: "FIGURE_58_PASS" | "COUNT_ERROR" | "CLEAR") => void;
}

export const NormalModeView: FC<NormalModeViewProps> = ({
  standard,
  selectedLru,
  txParams,
  onBack,
  onEmitBiteCommand,
  onSimulateNormal,
}) => {
  // Per Manual pp. 1-4-98: GROUND is the default mode (0x00)
  const [flightPhase, setFlightPhase] = useState<"GROUND" | "AIR">("GROUND");
  const [biteCmdCode, setBiteCmdCode] = useState<string>("00");
  const [phaseNote, setPhaseNote] = useState<string>("GROUND (0x00 transmitted continuously)");
  const phaseTimerRef = useRef<number | null>(null);

  // Label 356 Maintenance Data burst state (Simulation Only; no physical hardware RX attached)
  const [currentBurst, setCurrentBurst] = useState<Label356SlotWord[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult>({
    valid: false,
    source: "SIMULATION",
    text: "",
    error: "NO_DATA",
    errorMessage: "NO MAINTENANCE DATA RECEIVED",
  });

  // 3-second timeout state per Figure 57 (manual pp. 1-4-98)
  const [hasReceivedBurst, setHasReceivedBurst] = useState<boolean>(false);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [timeoutActive, setTimeoutActive] = useState<boolean>(false);

  // Encode actual 32-bit ARINC 429 Label 227 BITE Command Word for current Flight Phase & LRU
  const encodedLabel227Word = encodeBiteCommandWord({
    label: "227",
    sdi: 0,
    ready: false, // Bit 11 spare/0 in standard BITE command word per Manual pp. 1-4-96
    equipmentCode: selectedLru.code,
    commandCode: parseInt(biteCmdCode, 16),
  });

  // Cleanup any pending 100ms AIR transition timer on unmount
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current !== null) {
        window.clearTimeout(phaseTimerRef.current);
      }
    };
  }, []);

  // Flight phase toggle strictly adhering to manual pp. 1-4-98:
  // "When GROUND is selected (default mode), a code of 00 (hex) is transmitted.
  // When AIR is selected, a code of 12 (hex) is transmitted for 100 ms,
  // then changed to 11 (hex) for the remainder of the time that AIR is selected."
  const handleSelectFlightPhase = (phase: "GROUND" | "AIR") => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }

    setFlightPhase(phase);
    if (phase === "GROUND") {
      const info = getFlightPhaseCommandCode("GROUND");
      setBiteCmdCode(info.codeHex);
      setPhaseNote(info.description);
      onEmitBiteCommand?.({
        commandCode: 0x00,
        sdi: 0,
        ready: false,
        actionLabel: `${standard} GROUND (0x00)`,
      });
    } else {
      const transInfo = getFlightPhaseCommandCode("AIR", true);
      setBiteCmdCode(transInfo.codeHex);
      setPhaseNote(transInfo.description);
      onEmitBiteCommand?.({
        commandCode: 0x12,
        sdi: 0,
        ready: false,
        actionLabel: `${standard} AIR_TRANSITION (0x12)`,
      });
      phaseTimerRef.current = window.setTimeout(() => {
        const steadyInfo = getFlightPhaseCommandCode("AIR", false);
        setBiteCmdCode(steadyInfo.codeHex);
        setPhaseNote(steadyInfo.description);
        onEmitBiteCommand?.({
          commandCode: 0x11,
          sdi: 0,
          ready: false,
          actionLabel: `${standard} AIR_STEADY (0x11)`,
        });
        phaseTimerRef.current = null;
      }, 100);
    }
  };

  // 3-second timeout timer simulation (Figure 57)
  useEffect(() => {
    if (!hasReceivedBurst) {
      const timer = window.setInterval(() => {
        setSecondsElapsed((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setTimeoutActive(true);
            return 3;
          }
          return next;
        });
      }, 1000);
      return () => window.clearInterval(timer);
    }
  }, [hasReceivedBurst]);

  // Simulation Test Injector 1: Inject Figure 58 Test Message ('JcAIR - CFDS TEST')
  const handleInjectTestBurst = () => {
    setHasReceivedBurst(true);
    setTimeoutActive(false);
    setCurrentBurst(FIGURE_58_TEST_BURST);
    const res = parseLabel356Block(FIGURE_58_TEST_BURST, "SIMULATION");
    setParseResult(res);
    onSimulateNormal?.("FIGURE_58_PASS");
  };

  // Simulation Test Injector 2: Inject Figure 58 Count Error ('BLOCK WORD COUNT ERR')
  const handleInjectCountError = () => {
    setHasReceivedBurst(true);
    setTimeoutActive(false);
    setCurrentBurst(FIGURE_58_COUNT_ERR_BURST);
    const res = parseLabel356Block(FIGURE_58_COUNT_ERR_BURST, "SIMULATION");
    setParseResult(res);
    onSimulateNormal?.("COUNT_ERROR");
  };

  // Simulation Test Injector 3: Reset to Idle to observe 3-second timeout (Figure 57)
  const handleResetToIdle = () => {
    setHasReceivedBurst(false);
    setCurrentBurst([]);
    setSecondsElapsed(0);
    setTimeoutActive(false);
    setParseResult({
      valid: false,
      source: "SIMULATION",
      text: "",
      error: "NO_DATA",
      errorMessage: "NO MAINTENANCE DATA RECEIVED",
    });
    onSimulateNormal?.("CLEAR");
  };

  const accentColor = standard === "ABD0018" ? "#0d9488" : "#0284c7";

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", display: "grid", gap: "20px" }}>
      {/* Top Breadcrumb Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            color: "#475569",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          &laquo; Prior Page (Enter Date &amp; Shop Code - Fig 55)
        </button>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Reference: <strong style={{ color: accentColor }}>Figure 56–58 &bull; Normal Mode ({standard})</strong> (Manual pp. 1-4-98 – 1-4-103)
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: "20px" }}>
        {/* Left Column: Figure 56 Controls (Flight Phase & Simulation Injectors) */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: accentColor, textTransform: "uppercase", marginBottom: "6px" }}>
              Figure 56 Control
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              FLIGHT PHASE
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
              Encodes into bits 25–31 of Label 227 (BITE Command Word).
            </p>

            {/* Flight Phase Toggle Buttons */}
            <div style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => handleSelectFlightPhase("GROUND")}
                style={{
                  background: flightPhase === "GROUND" ? accentColor : "#f8fafc",
                  color: flightPhase === "GROUND" ? "#ffffff" : "#334155",
                  border: flightPhase === "GROUND" ? `1px solid ${accentColor}` : "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <span>GROUND (Default)</span>
                <span style={{ fontSize: "11px", opacity: 0.85 }}>0x00</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFlightPhase("AIR")}
                style={{
                  background: flightPhase === "AIR" ? accentColor : "#f8fafc",
                  color: flightPhase === "AIR" ? "#ffffff" : "#334155",
                  border: flightPhase === "AIR" ? `1px solid ${accentColor}` : "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <span>AIR</span>
                <span style={{ fontSize: "11px", opacity: 0.85 }}>0x12 / 0x11</span>
              </button>
            </div>

            {/* Encoded Label 227 32-bit Word Inspection */}
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "10px",
                fontSize: "11.5px",
                fontFamily: "monospace",
                color: "#1e293b",
                marginBottom: "14px",
              }}
            >
              <div>TX L227 Bits 25-31: <strong>0x{biteCmdCode}</strong></div>
              <div style={{ marginTop: "3px" }}>
                32-bit Word: <strong>{formatHex32(encodedLabel227Word)}</strong>
              </div>
              <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "4px" }}>
                {phaseNote}
              </div>
            </div>

            {/* Session Parameters from Figure 55 */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px", fontSize: "11.5px", color: "#475569", marginBottom: "16px" }}>
              <div>DATE: <strong>{txParams.date || "11-11-26"}</strong></div>
              <div style={{ marginTop: "4px" }}>SHOP CODE: <strong>{txParams.aircraftId || "N12345"}</strong></div>
            </div>
          </div>

          {/* Simulation Test Injectors (Strictly Isolated from Hardware RX) */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#b45309", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Simulation Test Injector (No HW RX):
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <button
                type="button"
                onClick={handleInjectTestBurst}
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + Simulate Test Msg (Fig 58)
              </button>

              <button
                type="button"
                onClick={handleInjectCountError}
                style={{
                  background: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #fca5a5",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + Simulate Count Err (Fig 58)
              </button>

              <button
                type="button"
                onClick={handleResetToIdle}
                style={{
                  background: "#f8fafc",
                  color: "#64748b",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Reset to Idle (Test 3s Timeout)
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Figure 56-58 Terminal Display */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Section Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, textTransform: "uppercase" }}>
                T1200B Receiver Display &bull; Label 356 &bull; {standard === "ABD0048" ? "Identical to ABD0018 (Manual pp. 1-4-103)" : "Standard CFDS"}
              </div>
              <h1 style={{ margin: "2px 0 0", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
                NORMAL MODE ({standard})
              </h1>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fcd34d",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "10.5px",
                  fontWeight: 800,
                  color: "#92400e",
                }}
              >
                SIMULATION MODE (NO HW RX)
              </span>
              <span
                style={{
                  background: standard === "ABD0018" ? "#f0fdfa" : "#f0f9ff",
                  border: standard === "ABD0018" ? "1px solid #ccfbf1" : "1px solid #e0f2fe",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: accentColor,
                }}
              >
                TARGET: {selectedLru.name} (0x{selectedLru.code})
              </span>
            </div>
          </div>

          {/* Terminal Box (Green-on-Black Monospace CRT Style) */}
          <div
            style={{
              background: "#050b14",
              borderRadius: "10px",
              padding: "24px",
              minHeight: "300px",
              fontFamily: "Consolas, Menlo, Monaco, monospace",
              color: "#22c55e",
              border: "2px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.7)",
            }}
          >
            {/* Top Display Area */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "12px", borderBottom: "1px dashed #1e293b", paddingBottom: "8px", marginBottom: "20px" }}>
                <span>NORMAL MODE</span>
                <span>FLIGHT PHASE: {flightPhase}</span>
              </div>

              {/* Main Decoded Message Display (Figure 58) */}
              {hasReceivedBurst && parseResult.valid && parseResult.text && (
                <div style={{ textAlign: "center", margin: "32px 0" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <span
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid #f59e0b",
                        color: "#fbbf24",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      SOURCE: {parseResult.source} BURST (NOT HARDWARE RX)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      background: "rgba(34, 197, 94, 0.1)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      borderRadius: "6px",
                      padding: "12px 28px",
                      fontSize: "20px",
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: "#4ade80",
                    }}
                  >
                    {parseResult.text}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "8px" }}>
                    Message decoded from Label 356 burst ({parseResult.actualWordCount} words verified)
                  </div>
                </div>
              )}

              {/* Idle Listening Prompt before 3s timeout */}
              {!hasReceivedBurst && !timeoutActive && (
                <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "13px", padding: "20px 0" }}>
                  [Waiting for Label 356 burst from {selectedLru.name}... Elapsed: {secondsElapsed}s / 3s]
                </div>
              )}
            </div>

            {/* Bottom Alert / Error Banner (Figure 57 & Figure 58) */}
            <div>
              {/* Figure 57: NO MAINTENANCE DATA RECEIVED (after 3-second timeout) */}
              {timeoutActive && !hasReceivedBurst && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    color: "#f87171",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 800,
                    textAlign: "center",
                    letterSpacing: "0.08em",
                  }}
                >
                  NO MAINTENANCE DATA RECEIVED
                </div>
              )}

              {/* Parse Errors including Figure 58 BLOCK WORD COUNT ERR */}
              {hasReceivedBurst && parseResult.error && (
                <div
                  style={{
                    background: "rgba(234, 179, 8, 0.15)",
                    border: "1px solid #eab308",
                    color: "#fde047",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 800,
                    textAlign: "center",
                    letterSpacing: "0.08em",
                  }}
                >
                  [{parseResult.source}] {parseResult.errorMessage}
                  {parseResult.expectedWordCount !== undefined &&
                    ` (Expected: ${parseResult.expectedWordCount}, Actual: ${parseResult.actualWordCount})`}
                </div>
              )}
            </div>
          </div>

          {/* Raw Label 356 Words Table (Figure 58 Slot Table) */}
          {currentBurst.length > 0 && (
            <div style={{ marginTop: "18px" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", marginBottom: "8px", textTransform: "uppercase" }}>
                Decoded Label 356 Simulated Burst ({parseResult.source} &bull; Figure 58 Slot Table):
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px", color: "#64748b" }}>SLOT</th>
                      <th style={{ padding: "6px 8px", color: "#64748b" }}>LABEL</th>
                      <th style={{ padding: "6px 8px", color: "#64748b" }}>DATA (HEX)</th>
                      <th style={{ padding: "6px 8px", color: "#64748b" }}>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBurst.map((w) => (
                      <tr key={w.slot} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "5px 8px", fontWeight: 700, color: "#1e293b" }}>{w.slot}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", color: accentColor, fontWeight: 700 }}>
                          {w.label}
                        </td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, color: "#0284c7" }}>
                          {w.dataHex}
                        </td>
                        <td style={{ padding: "5px 8px", color: "#475569" }}>{w.desc || "DATA WORD"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Status */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11.5px",
              color: "#64748b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
              <span>
                Simulation Active (No Hardware Link) &bull; Timeout Threshold: 3.0s &bull; Standard: {standard}
              </span>
            </div>
            <div>Aeroflex Operation Manual Figure 56–58</div>
          </div>
        </section>
      </div>
    </div>
  );
};

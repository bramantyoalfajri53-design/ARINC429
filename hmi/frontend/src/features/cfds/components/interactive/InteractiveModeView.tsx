import { useState, useEffect, type FC } from "react";
import type { CfdsLruItem } from "../../utils/lruDefinitions";
import type { CfdsTxParameters } from "../../utils/cfdsDefaults";
import {
  INTERACTIVE_KEY_MATRIX,
  INTERACTIVE_TIMEOUT_3S_MS,
  INTERACTIVE_TIMEOUT_30S_MS,
  INTERACTIVE_MSG_NO_RESPONSE_BOX,
  INTERACTIVE_MSG_LRU_ERR_BOX,
  INTERACTIVE_MSG_NAK_1,
  INTERACTIVE_MSG_NAK_3,
  INTERACTIVE_MSG_NO_ACK_NAK,
  resolveMatrixChar,
  buildInteractiveMenuCommand,
  buildInteractiveCharCommand,
  buildInteractiveClearCommand,
  buildInteractiveUnverifiedMenuKeyFrame,
  getSimulatedInteractivePages,
  type InteractiveMatrixCell,
  type InteractiveTxFrame,
} from "../../services/interactiveModeService";
import {
  createInitialInteractiveInputState,
  beginPendingInputOp,
  applyLruAck,
  applyLruNak,
  type InteractiveInputState,
} from "../../utils/interactiveModeParser";

export interface InteractiveModeViewProps {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; bit12?: boolean; actionLabel?: string }) => void;
}

type InteractiveWaitPhase = "WAITING" | "TIMEOUT_3S" | "TIMEOUT_30S" | "SIM_ACTIVE";

/**
 * Interactive Mode (ABD0048) View Component
 * Reference: Aeroflex JcAIR T1200B Manual Section 4.F, Figures 62-70 (pp. 1-4-104 to 1-4-111)
 */
export const InteractiveModeView: FC<InteractiveModeViewProps> = ({
  selectedLru,
  txParams,
  onBack,
  onEmitBiteCommand,
}) => {
  const accentColor = "#0284c7"; // ABD0048 blue accent consistent with NormalModeABD0048

  const [sdi, setSdi] = useState<number>(0);
  const [shiftActive, setShiftActive] = useState<boolean>(false);
  const [waitPhase, setWaitPhase] = useState<InteractiveWaitPhase>("WAITING");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [waitOriginMs, setWaitOriginMs] = useState<number>(() => Date.now());
  const [simPageId, setSimPageId] = useState<string>("SIM_MENU_P1");
  const [inputState, setInputState] = useState<InteractiveInputState>(() =>
    createInitialInteractiveInputState()
  );

  const [lastTxFrame, setLastTxFrame] = useState<InteractiveTxFrame>(() =>
    buildInteractiveMenuCommand(selectedLru.code, "1L", 0, false)
  );
  const [txHistory, setTxHistory] = useState<InteractiveTxFrame[]>([]);

  const simPages = getSimulatedInteractivePages(selectedLru.name, selectedLru.code);
  const activeSimPage = simPages.find((p) => p.id === simPageId) ?? simPages[0];
  const isMonitoringNoHw = waitPhase !== "SIM_ACTIVE";

  // Real-time 3s / 30s monitoring for either initial menu wait (Fig 63-64) or pending char ACK/NAK (Fig 69-70)
  useEffect(() => {
    const awaitingAckNak =
      inputState.handshakeStatus === "AWAITING_ACK_NAK" ||
      inputState.handshakeStatus === "NAK_RETRY" ||
      inputState.handshakeStatus === "NO_ACK_NAK_3S";
    if (!isMonitoringNoHw && !awaitingAckNak) return;

    const syncTimer = () => {
      const elapsedMs = Math.max(0, Date.now() - waitOriginMs);
      setElapsedSeconds(Math.floor(elapsedMs / 1000));

      if (awaitingAckNak) {
        if (elapsedMs >= INTERACTIVE_TIMEOUT_30S_MS) {
          setInputState((prev) => ({ ...prev, handshakeStatus: "LRU_ERR_30S" }));
        } else if (elapsedMs >= INTERACTIVE_TIMEOUT_3S_MS) {
          setInputState((prev) => ({ ...prev, handshakeStatus: "NO_ACK_NAK_3S" }));
        }
      } else if (isMonitoringNoHw) {
        if (elapsedMs >= INTERACTIVE_TIMEOUT_30S_MS) {
          setWaitPhase("TIMEOUT_30S");
        } else if (elapsedMs >= INTERACTIVE_TIMEOUT_3S_MS) {
          setWaitPhase("TIMEOUT_3S");
        } else {
          setWaitPhase("WAITING");
        }
      }
    };

    syncTimer();
    const interval = setInterval(syncTimer, 250);
    return () => clearInterval(interval);
  }, [waitOriginMs, isMonitoringNoHw, inputState.handshakeStatus]);

  const recordTxFrame = (frame: InteractiveTxFrame) => {
    setLastTxFrame(frame);
    setTxHistory((prev) => [frame, ...prev].slice(0, 8));
    if (frame.commandCode !== null) {
      onEmitBiteCommand?.({
        commandCode: frame.commandCode,
        sdi,
        ready: frame.wordSpec?.ready ?? false,
        bit12: frame.bit12,
        actionLabel: frame.actionLabel,
      });
    }
  };

  const handleMatrixCellClick = (cell: InteractiveMatrixCell) => {
    if (cell.kind === "CONTROL" && cell.id === "SHFT") {
      // Manual p. 1-4-111: SHFT toggles inverse high intensity to access shifted chars or SHFT+CLR
      setShiftActive((s) => !s);
      return;
    }

    if (cell.kind === "CONTROL" && cell.id === "MENU") {
      setShiftActive(false);
      recordTxFrame(buildInteractiveUnverifiedMenuKeyFrame());
      return;
    }

    if (cell.kind === "LSK" || cell.kind === "PAGE") {
      const frame = buildInteractiveMenuCommand(selectedLru.code, cell.id, sdi, false);
      recordTxFrame(frame);
      setShiftActive(false);

      if (waitPhase === "SIM_ACTIVE") {
        if (cell.id === "NXT" && activeSimPage.id === "SIM_MENU_P1") {
          setSimPageId("SIM_MENU_P2");
        } else if (cell.id === "PRV" && activeSimPage.id === "SIM_MENU_P2") {
          setSimPageId("SIM_MENU_P1");
        } else if (cell.id === "3R" && activeSimPage.mode === "MENU_LIST") {
          setSimPageId("SIM_INPUT_FIG65");
          setInputState(createInitialInteractiveInputState());
        } else if (cell.id === "6L" && activeSimPage.mode === "INPUT_PROMPT") {
          setSimPageId("SIM_MENU_P1");
        }
      } else {
        setWaitOriginMs(Date.now());
        setElapsedSeconds(0);
        setWaitPhase("WAITING");
      }
      return;
    }

    if (cell.kind === "CONTROL" && cell.id === "CLR") {
      const isShiftClr = shiftActive;
      const frame = buildInteractiveClearCommand(selectedLru.code, isShiftClr, sdi, false);
      recordTxFrame(frame);
      setShiftActive(false);
      setWaitOriginMs(Date.now());
      setElapsedSeconds(0);
      setInputState((prev) =>
        beginPendingInputOp(prev, { type: isShiftClr ? "CLR_LINE" : "CLR_CHAR" })
      );
      return;
    }

    // Alphanumeric char or SP (' ')
    const charToSend =
      cell.kind === "CONTROL" && cell.id === "SP"
        ? " "
        : cell.kind === "CHAR"
        ? resolveMatrixChar(cell, shiftActive)
        : " ";

    const frame = buildInteractiveCharCommand(selectedLru.code, charToSend, sdi, false);
    recordTxFrame(frame);
    setShiftActive(false);
    setWaitOriginMs(Date.now());
    setElapsedSeconds(0);
    setInputState((prev) => beginPendingInputOp(prev, { type: "CHAR", char: charToSend }));
  };

  const handleSdiChange = (newSdi: number) => {
    setSdi(newSdi);
    if (!lastTxFrame.wordSpec) return;
    if (lastTxFrame.actionLabel.startsWith("CLR") || lastTxFrame.actionLabel.startsWith("SHFT")) {
      setLastTxFrame(buildInteractiveClearCommand(selectedLru.code, lastTxFrame.bit12, newSdi, false));
    } else if (lastTxFrame.actionLabel.startsWith("CHAR") || lastTxFrame.actionLabel.startsWith("SP")) {
      const ch = lastTxFrame.actionLabel.startsWith("SP") ? " " : String.fromCharCode(lastTxFrame.commandCode ?? 0x41);
      setLastTxFrame(buildInteractiveCharCommand(selectedLru.code, ch, newSdi, false));
    } else if (lastTxFrame.commandCode !== null && lastTxFrame.commandCode >= 0x70) {
      const key = lastTxFrame.actionLabel as Parameters<typeof buildInteractiveMenuCommand>[1];
      setLastTxFrame(buildInteractiveMenuCommand(selectedLru.code, key, newSdi, false));
    }
  };

  const handleInjectSimMenu = () => {
    setWaitPhase("SIM_ACTIVE");
    setSimPageId("SIM_MENU_P1");
    setInputState(createInitialInteractiveInputState());
  };

  const handleLoadFig65InputPrompt = () => {
    setWaitPhase("SIM_ACTIVE");
    setSimPageId("SIM_INPUT_FIG65");
    setInputState(createInitialInteractiveInputState());
  };

  const handleResetWait = () => {
    setShiftActive(false);
    setWaitOriginMs(Date.now());
    setElapsedSeconds(0);
    setWaitPhase("WAITING");
    setInputState(createInitialInteractiveInputState());
  };

  const handleTrigger3sTimeout = () => {
    if (inputState.pendingOp) {
      setWaitOriginMs(Date.now() - INTERACTIVE_TIMEOUT_3S_MS);
      setElapsedSeconds(3);
      setInputState((prev) => ({ ...prev, handshakeStatus: "NO_ACK_NAK_3S" }));
    } else {
      setWaitOriginMs(Date.now() - INTERACTIVE_TIMEOUT_3S_MS);
      setElapsedSeconds(3);
      setWaitPhase("TIMEOUT_3S");
    }
  };

  const handleTrigger30sError = () => {
    if (inputState.pendingOp || inputState.handshakeStatus === "NO_ACK_NAK_3S") {
      setWaitOriginMs(Date.now() - INTERACTIVE_TIMEOUT_30S_MS);
      setElapsedSeconds(30);
      setInputState((prev) => ({ ...prev, handshakeStatus: "LRU_ERR_30S" }));
    } else {
      setWaitOriginMs(Date.now() - INTERACTIVE_TIMEOUT_30S_MS);
      setElapsedSeconds(30);
      setWaitPhase("TIMEOUT_30S");
    }
  };

  // Determine bottom CRT boxed status message matching Fig 63, 64, 67, 68, 69, 70
  let crtAlertMessage: string | null = null;
  let crtAlertSeverity: "amber" | "red" = "amber";
  if (inputState.handshakeStatus === "NAK_RETRY") {
    crtAlertMessage = INTERACTIVE_MSG_NAK_1;
    crtAlertSeverity = "amber";
  } else if (inputState.handshakeStatus === "NAK_MAX") {
    crtAlertMessage = INTERACTIVE_MSG_NAK_3;
    crtAlertSeverity = "red";
  } else if (inputState.handshakeStatus === "NO_ACK_NAK_3S") {
    crtAlertMessage = INTERACTIVE_MSG_NO_ACK_NAK;
    crtAlertSeverity = "amber";
  } else if (inputState.handshakeStatus === "LRU_ERR_30S" || waitPhase === "TIMEOUT_30S") {
    crtAlertMessage = INTERACTIVE_MSG_LRU_ERR_BOX;
    crtAlertSeverity = "red";
  } else if (waitPhase === "TIMEOUT_3S") {
    crtAlertMessage = INTERACTIVE_MSG_NO_RESPONSE_BOX;
    crtAlertSeverity = "amber";
  }

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
              ABD0048
            </span>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
              INTERACTIVE MODE (ABD0048)
            </h2>
            {waitPhase === "SIM_ACTIVE" ? (
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
            &nbsp;|&nbsp; Shop Code: <code>{txParams.aircraftId}</code> &nbsp;|&nbsp; Manual Figures 62–70
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
          gridTemplateColumns: "minmax(540px, 1.55fr) minmax(300px, 1fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {/* Left/Main Column: CRT Interactive Screen (Fig 62-70) + Label 227 Inspector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  T1200B INTERACTIVE SCREEN &amp; MENU KEYS (FIGURE 62–70)
                </h3>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Left: Boxed-in LRU Display Area &nbsp;|&nbsp; Right: 6&times;7 Touch Matrix (<code>1L–6L</code>,{" "}
                  <code>1R–6R</code>, <code>NXT/PRV</code>, <code>CLR</code>, <code>SP</code>, <code>SHFT</code>)
                </div>
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: accentColor }}>
                TX Label 227 @ 100 ms
              </span>
            </div>

            {/* Dual-Pane CRT matching Figures 62-70 */}
            <div
              style={{
                background: "#050b14",
                border: `2px solid ${crtAlertMessage ? (crtAlertSeverity === "red" ? "#dc2626" : "#d97706") : "#1e293b"}`,
                borderRadius: "8px",
                padding: "14px",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                color: "#22c55e",
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1fr) minmax(295px, 1.32fr)",
                gap: "14px",
                minHeight: "340px",
              }}
            >
              {/* Left Half: Boxed-In Display Area */}
              <div
                style={{
                  border: "1px solid #166534",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  background: "#07101d",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                  {waitPhase === "SIM_ACTIVE" && activeSimPage.mode === "MENU_LIST" && (
                    <>
                      <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#86efac", borderBottom: "1px solid #14532d", paddingBottom: "4px" }}>
                        {activeSimPage.title}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.74rem" }}>
                        {activeSimPage.rows.map((r) => (
                          <div key={r.lskLeft} style={{ display: "flex", justifyContent: "space-between", minHeight: "18px" }}>
                            <span style={{ color: "#4ade80" }}>{r.leftText}</span>
                            <span style={{ color: "#4ade80", textAlign: "right" }}>{r.rightText}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {waitPhase === "SIM_ACTIVE" && activeSimPage.mode === "INPUT_PROMPT" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                      <div style={{ textAlign: "center", fontSize: "0.84rem", fontWeight: 700, color: "#86efac" }}>
                        {activeSimPage.title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#4ade80", whiteSpace: "pre" }}>
                        {activeSimPage.inputPromptHeader}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#86efac", letterSpacing: "0.08em" }}>
                        {activeSimPage.inputPromptMask}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "6px" }}>
                        Committed Input: <span style={{ color: "#22c55e", fontWeight: 700 }}>{inputState.buffer || "(empty)"}</span>
                      </div>
                    </div>
                  )}

                  {waitPhase !== "SIM_ACTIVE" && (
                    <div style={{ fontSize: "0.75rem", color: "#1e4631", paddingTop: "8px" }}>
                      {`[BOXED-IN LRU DISPLAY — ${selectedLru.name}]`}
                      <div style={{ marginTop: "8px", color: "#166534" }}>
                        {waitPhase === "WAITING" && `Awaiting LRU menu data (${elapsedSeconds}s / 3s)...`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Echo line for operator character input (Figure 66) */}
                {(inputState.pendingEchoChar || inputState.buffer) && (
                  <div
                    data-testid="interactive-input-echo"
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      color: "#4ade80",
                      borderTop: "1px dashed #14532d",
                      paddingTop: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {inputState.pendingOp?.type === "CHAR"
                        ? inputState.pendingOp.char === " "
                          ? "' '"
                          : inputState.pendingOp.char
                        : inputState.pendingOp?.type === "CLR_LINE"
                        ? "[SHFT+CLR]"
                        : inputState.pendingOp?.type === "CLR_CHAR"
                        ? "[CLR]"
                        : inputState.buffer.slice(-16)}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#38bdf8" }}>
                      {inputState.handshakeStatus === "AWAITING_ACK_NAK" && "TX (WAIT ACK/NAK)"}
                      {inputState.handshakeStatus === "ACK_DONE" && "ACK OK"}
                      {inputState.handshakeStatus === "NAK_RETRY" && `RETRY ${inputState.nakCount}/3`}
                    </span>
                  </div>
                )}

                {/* Boxed Status/Error Message (Figures 63, 64, 67, 68, 69, 70) */}
                {crtAlertMessage && (
                  <div
                    data-testid="interactive-crt-alert"
                    style={{
                      border: `1px solid ${crtAlertSeverity === "red" ? "#f87171" : "#fbbf24"}`,
                      padding: "6px 8px",
                      textAlign: "center",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: crtAlertSeverity === "red" ? "#f87171" : "#fbbf24",
                      background: crtAlertSeverity === "red" ? "#1f0808" : "#1c1304",
                    }}
                  >
                    {crtAlertMessage}
                  </div>
                )}
              </div>

              {/* Right Half: MENU KEYS Touch Matrix (6x7 per Figures 62-70) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#86efac",
                    borderBottom: "1px solid #14532d",
                    paddingBottom: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ textDecoration: "underline" }}>MENU KEYS</span>
                  <span style={{ fontSize: "0.7rem", color: shiftActive ? "#22c55e" : "#64748b" }}>
                    {shiftActive ? "SHFT: ACTIVE (INVERSE)" : "SHFT: OFF"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, justifyContent: "space-between" }}>
                  {INTERACTIVE_KEY_MATRIX.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 36px 52px repeat(4, minmax(38px, 1fr))",
                        gap: "5px",
                      }}
                    >
                      {row.map((cell, cIdx) => {
                        if (cell.kind !== "CHAR") {
                          const isShftKey = cell.kind === "CONTROL" && cell.id === "SHFT";
                          const isShftActive = isShftKey && shiftActive;
                          const isMenuUnverified = cell.kind === "CONTROL" && cell.id === "MENU";

                          return (
                            <button
                              key={`${rIdx}-${cIdx}`}
                              type="button"
                              onClick={() => handleMatrixCellClick(cell)}
                              data-testid={`key-${cell.id}`}
                              title={cell.note ?? `Key ${cell.label}`}
                              style={{
                                background: isShftActive ? "#22c55e" : "#0b1526",
                                color: isShftActive
                                  ? "#050b14"
                                  : isMenuUnverified
                                  ? "#fbbf24"
                                  : "#22c55e",
                                border: isShftActive
                                  ? "1px solid #4ade80"
                                  : isMenuUnverified
                                  ? "1px dashed #d97706"
                                  : "1px solid #166534",
                                borderRadius: "4px",
                                padding: "6px 2px",
                                fontFamily: "inherit",
                                fontWeight: 700,
                                fontSize: "0.74rem",
                                cursor: "pointer",
                                textAlign: "center",
                              }}
                            >
                              {cell.label}
                            </button>
                          );
                        }

                        const activeChar = resolveMatrixChar(cell, shiftActive);
                        return (
                          <button
                            key={`${rIdx}-${cIdx}`}
                            type="button"
                            onClick={() => handleMatrixCellClick(cell)}
                            data-testid={`char-${cell.primary}${cell.shifted ?? ""}`}
                            title={
                              cell.shifted
                                ? `Unshifted: '${cell.primary}' | Shifted: '${cell.shifted}' (Press left side)`
                                : `Character '${cell.primary}'`
                            }
                            style={{
                              background: "#0b1526",
                              color: "#22c55e",
                              border: "1px solid #166534",
                              borderRadius: "4px",
                              padding: "6px 3px",
                              fontFamily: "inherit",
                              fontWeight: 700,
                              fontSize: "0.76rem",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {cell.shifted ? (
                              <>
                                <span style={{ opacity: shiftActive ? 0.4 : 1 }}>{cell.primary}</span>
                                <span
                                  style={{
                                    color: shiftActive ? "#4ade80" : "#86efac",
                                    opacity: shiftActive ? 1 : 0.72,
                                    textDecoration: shiftActive ? "underline" : "none",
                                  }}
                                >
                                  {cell.shifted}
                                </span>
                              </>
                            ) : (
                              <span>{activeChar}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Label 227 Live BITE Command Inspector */}
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
                LABEL 227 BITE COMMAND ENCODER (BITS 25–31 &amp; BIT 12)
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
                      background: sdi === val ? "#e0f2fe" : "#f8fafc",
                      color: sdi === val ? "#0369a1" : "#475569",
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
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Last Action</div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                  {lastTxFrame.actionLabel}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Bits 25–31 (Cmd/Char)</div>
                <div
                  style={{
                    fontWeight: 700,
                    color: lastTxFrame.commandCode === null ? "#b45309" : accentColor,
                    fontFamily: "monospace",
                  }}
                >
                  {lastTxFrame.commandHex}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Bit 12 (CLR / SHFT+CLR)</div>
                <div style={{ fontWeight: 700, color: lastTxFrame.bit12 ? "#b45309" : "#0f172a", fontFamily: "monospace" }}>
                  {lastTxFrame.bit12 ? "1 (Line Clear)" : "0"}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.72rem" }}>32-Bit Word (Odd Par)</div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                  {lastTxFrame.encodedHex32}
                </div>
              </div>
            </div>

            {lastTxFrame.needsVerification && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "0.76rem",
                  color: "#92400e",
                }}
              >
                <strong>NEEDS VERIFICATION:</strong> {lastTxFrame.needsVerification}
              </div>
            )}

            {txHistory.length > 0 && (
              <div style={{ fontSize: "0.76rem", color: "#475569" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                  Recent Interactive Key Encodings (UI State Only — Not Hardware Bus TX):
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
                      [{item.timestamp}] {item.actionLabel} &rarr; {item.commandHex}
                      {item.bit12 ? " [B12=1]" : ""} ({item.encodedHex32})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Simulation Test Controls & Manual Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
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
              Hardware ARINC 429 RX is not connected. Test menu navigation (<code>1L–6L</code>,{" "}
              <code>1R–6R</code>, <code>NXT</code>/<code>PRV</code>), Figure 65 alphanumeric input,{" "}
              <code>ACK</code>/<code>NAK</code> handshake, and Figure 63–70 timeouts cleanly here.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={handleInjectSimMenu}
                style={{
                  background: accentColor,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Inject Sim Menu (2 Pages)
              </button>
              <button
                type="button"
                onClick={handleLoadFig65InputPrompt}
                style={{
                  background: "#0f766e",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Load Input Prompt (Fig 65)
              </button>
              <button
                type="button"
                onClick={() => setInputState((prev) => applyLruAck(prev))}
                style={{
                  background: "#dcfce7",
                  color: "#166534",
                  border: "1px solid #4ade80",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sim LRU ACK (Commit)
              </button>
              <button
                type="button"
                onClick={() => setInputState((prev) => applyLruNak(prev))}
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sim LRU NAK (Fig 67/68)
              </button>
              <button
                type="button"
                onClick={handleTrigger3sTimeout}
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Trigger 3s Timeout (Fig 63/69)
              </button>
              <button
                type="button"
                onClick={handleTrigger30sError}
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Trigger 30s Error (Fig 64/70)
              </button>
              <button
                type="button"
                onClick={handleResetWait}
                style={{
                  gridColumn: "1 / -1",
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset Wait Timer (0s / No HW RX)
              </button>
            </div>
          </div>

          {/* Manual Specification & Verification Summary */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontSize: "0.76rem",
              color: "#475569",
              lineHeight: 1.5,
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
              MANUAL SPEC (PP. 1-4-104 – 1-4-111)
            </h3>
            <div>
              <strong>LSK &amp; Page Commands (Bits 25–31):</strong> <code>1L–6L = 70–75h</code>,{" "}
              <code>PRV = 76h</code>, <code>NXT = 77h</code>, <code>1R–6R = 78–7Dh</code>.
            </div>
            <div>
              <strong>Character Entry &amp; Clear:</strong> Char inserted into Bits 25–31 (7-bit ISO #5/ASCII).{" "}
              <code>CLR</code>: <code>08h</code> with Bit 12 = <code>0</code>; <code>SHFT+CLR</code>: <code>08h</code>{" "}
              with Bit 12 = <code>1</code> (line erase; requires LRU ACK).
            </div>
            <div>
              <strong>Manual Ergonomic Note (p. 1-4-108):</strong> Touch fields are dense and not centered above
              hardware switches — on physical T1200B, press left side of touch field.
            </div>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "9px 11px",
                color: "#b45309",
              }}
            >
              <strong>NEEDS VERIFICATION:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                <li><code>MENU</code> key Bits 25–31 hex code (not listed in pp. 1-4-104–111).</li>
                <li>Exact ARINC 429 RX Label/bit position for ABD0048 ACK/NAK &amp; boxed menu text.</li>
                <li>Manual Fig 62–70 prints &quot;2R&quot; on row 3 col 2 as typo; table confirms <code>3R = 7Ah</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


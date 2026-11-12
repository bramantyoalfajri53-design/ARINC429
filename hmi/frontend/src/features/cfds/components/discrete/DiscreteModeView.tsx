import { useState, useEffect, type FC } from "react";
import type { CfdsLruItem } from "../../utils/lruDefinitions";
import type { CfdsTxParameters } from "../../utils/cfdsDefaults";
import {
  DISCRETE_RX_LABEL,
  DISCRETE_TIMEOUT_1S_MS,
  DISCRETE_NO_DATA_MSG,
  getDiscreteHardwareStatus,
  getSimulatedSingleFailure,
  getSimulatedMultipleFailures,
  type DiscreteFailureRecord,
  type DiscreteMonitorStatus,
} from "../../services/discreteModeService";
import {
  parseDiscreteFailureBatch,
  stepFailureIndex,
} from "../../utils/discreteModeParser";

export interface DiscreteModeViewProps {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onSimulateDiscrete?: (scenario: "SINGLE_FIG73" | "MULTI_FIG74" | "CLEAR") => void;
}

const CRT_FIELD_ROWS: ReadonlyArray<{
  label: string;
  key: keyof Omit<DiscreteFailureRecord, "source" | "receivedAt">;
  gapBefore?: boolean;
}> = [
  { label: "FAILURE NUMBER     ", key: "failureNumber" },
  { label: "FAILURE TYPE CODE  ", key: "failureTypeCode" },
  { label: "FAILURE TYPE STRING", key: "failureTypeString" },
  { label: "WITNESS POSITION   ", key: "witnessPosition", gapBefore: true },
  { label: "WITNESS SIDE       ", key: "witnessSide" },
  { label: "SUSPECT 1 POSITION ", key: "suspect1Position" },
  { label: "SUSPECT 1 SIDE     ", key: "suspect1Side" },
  { label: "SUSPECT 2 POSITION ", key: "suspect2Position" },
  { label: "SUSPECT 2 SIDE     ", key: "suspect2Side" },
  { label: "SUSPECT 3 POSITION ", key: "suspect3Position" },
  { label: "SUSPECT 3 SIDE     ", key: "suspect3Side" },
];

/**
 * Discrete Mode (ABD0048) View Component
 * Reference: Aeroflex JcAIR T1200B Manual Section 4.F, Figures 71-74 (pp. 1-4-111 to 1-4-115)
 */
export const DiscreteModeView: FC<DiscreteModeViewProps> = ({
  selectedLru,
  txParams,
  onBack,
  onSimulateDiscrete,
}) => {
  const accentColor = "#0284c7"; // ABD0048 blue accent matching NormalModeABD0048 & InteractiveModeABD0048
  const hwStatus = getDiscreteHardwareStatus();

  const [monitorStatus, setMonitorStatus] = useState<DiscreteMonitorStatus>("WAITING");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [waitOriginMs, setWaitOriginMs] = useState<number>(() => Date.now());
  const [failures, setFailures] = useState<DiscreteFailureRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Real-time 1 second (1000 ms) Label 355 watchdog per Manual p. 1-4-112 / Figure 72
  useEffect(() => {
    if (monitorStatus === "DATA_ACTIVE") return;

    const syncTimer = () => {
      const elapsed = Math.max(0, Date.now() - waitOriginMs);
      setElapsedMs(elapsed);
      if (elapsed >= DISCRETE_TIMEOUT_1S_MS) {
        setMonitorStatus("NO_MAINT_DATA_1S");
      } else {
        setMonitorStatus("WAITING");
      }
    };

    syncTimer();
    const interval = setInterval(syncTimer, 100);
    return () => clearInterval(interval);
  }, [waitOriginMs, monitorStatus === "DATA_ACTIVE"]);

  const activeRecord: DiscreteFailureRecord | null =
    failures.length > 0 ? failures[activeIndex] ?? failures[0] : null;
  const hasMultipleFailures = failures.length > 1;
  const isSimulationActive = activeRecord?.source === "SIMULATION";

  const handleInjectFailures = (rawBatch: DiscreteFailureRecord[]) => {
    const parsed = parseDiscreteFailureBatch(rawBatch);
    if (parsed.records.length > 0) {
      setFailures(parsed.records);
      setActiveIndex(0);
      setMonitorStatus("DATA_ACTIVE");
      onSimulateDiscrete?.(parsed.records.length > 1 ? "MULTI_FIG74" : "SINGLE_FIG73");
    }
  };

  const handleResetToNoHwMonitoring = () => {
    setFailures([]);
    setActiveIndex(0);
    setWaitOriginMs(Date.now());
    setElapsedMs(0);
    setMonitorStatus("WAITING");
    onSimulateDiscrete?.("CLEAR");
  };

  const handleTrigger1sTimeout = () => {
    setFailures([]);
    setActiveIndex(0);
    setWaitOriginMs(Date.now() - DISCRETE_TIMEOUT_1S_MS);
    setElapsedMs(DISCRETE_TIMEOUT_1S_MS);
    setMonitorStatus("NO_MAINT_DATA_1S");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header Card */}
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
              DISCRETE MODE (ABD0048)
            </h2>
            {isSimulationActive ? (
              <span
                data-testid="discrete-sim-badge"
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
                SIMULATION MODE — NO HW RX
              </span>
            ) : (
              <span
                data-testid="discrete-hw-badge"
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
                NO HW RX — MONITORING L{DISCRETE_RX_LABEL} ({(elapsedMs / 1000).toFixed(1)}s)
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "5px" }}>
            Selected LRU: <strong style={{ color: "#0f172a" }}>{selectedLru.name}</strong> (Eq Code:{" "}
            <code>{selectedLru.code}h</code>) &nbsp;|&nbsp; Date: <code>{txParams.date}</code>{" "}
            &nbsp;|&nbsp; Shop Code: <code>{txParams.aircraftId}</code> &nbsp;|&nbsp; Manual Figures 71–74
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
          gridTemplateColumns: "minmax(520px, 1.45fr) minmax(300px, 1fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {/* Left/Main Column: CRT Display (Figures 71-74) */}
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
                T1200B DISCRETE MODE SCREEN (FIGURE 71–74)
              </h3>
              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Passive ARINC 429 Label <code>{DISCRETE_RX_LABEL}</code> Failure Monitor (1 s RX Watchdog)
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: accentColor }}>
              {failures.length > 0
                ? `Failure ${activeIndex + 1} / ${failures.length} (${activeRecord?.source})`
                : `RX Label ${DISCRETE_RX_LABEL} • 1s Timeout`}
            </span>
          </div>

          {/* Dark CRT Layout matching Figures 71-74: Left Framed Failure Table + Right 2 Soft-Key Boxes */}
          <div
            style={{
              background: "#050b14",
              border: `2px solid ${monitorStatus === "NO_MAINT_DATA_1S" ? "#d97706" : "#1e293b"}`,
              borderRadius: "8px",
              padding: "16px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              color: "#22c55e",
              display: "grid",
              gridTemplateColumns: "1fr 145px",
              gap: "16px",
              alignItems: "stretch",
              minHeight: "360px",
            }}
          >
            {/* Left Framed Display Box */}
            <div
              style={{
                border: "1px solid #166534",
                borderRadius: "4px",
                padding: "14px 16px",
                background: "#07101d",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div
                  data-testid="discrete-crt-title"
                  style={{
                    textAlign: "center",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#86efac",
                    marginBottom: "14px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {`DISCRETE MODE FOR    ${selectedLru.name}`}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.82rem" }}>
                  {CRT_FIELD_ROWS.map((row) => {
                    const value = activeRecord ? activeRecord[row.key] : "";
                    return (
                      <div
                        key={row.key}
                        style={{
                          marginTop: row.gapBefore ? "10px" : "0px",
                          display: "flex",
                          gap: "8px",
                          whiteSpace: "pre",
                        }}
                      >
                        <span style={{ color: "#86efac" }}>{`${row.label} =`}</span>
                        <span
                          data-testid={`field-${row.key}`}
                          style={{ color: value ? "#4ade80" : "#1e3a2f", fontWeight: value ? 700 : 400 }}
                        >
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Message Box (Figure 72: NO MAINTENANCE DATA RECEIVED) */}
              {monitorStatus === "NO_MAINT_DATA_1S" && (
                <div
                  data-testid="discrete-no-data-box"
                  style={{
                    border: "1px solid #fbbf24",
                    background: "#1c1304",
                    color: "#fbbf24",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    letterSpacing: "0.03em",
                  }}
                >
                  {DISCRETE_NO_DATA_MSG}
                </div>
              )}

              {monitorStatus === "WAITING" && (
                <div
                  style={{
                    border: "1px dashed #14532d",
                    color: "#86efac",
                    padding: "6px 10px",
                    textAlign: "center",
                    fontSize: "0.78rem",
                  }}
                >
                  {`MONITORING LABEL ${DISCRETE_RX_LABEL}... (${(elapsedMs / 1000).toFixed(1)}s / 1.0s)`}
                </div>
              )}
            </div>

            {/* Right Column: Two Soft-Key Boxes (Blank/Inactive in Fig 71-73; Active PREV/NEXT FAILURE in Fig 74) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "24px",
              }}
            >
              <button
                type="button"
                disabled={!hasMultipleFailures}
                onClick={() => setActiveIndex((idx) => stepFailureIndex(idx, failures.length, "PREV"))}
                data-testid="btn-prev-failure"
                title={
                  hasMultipleFailures
                    ? "View previous failure message (Figure 74)"
                    : "Inactive until multiple failures received (Figures 71-73)"
                }
                style={{
                  minHeight: "64px",
                  borderRadius: "4px",
                  border: hasMultipleFailures ? "1px solid #4ade80" : "1px solid #166534",
                  background: hasMultipleFailures ? "#0f291e" : "#07101d",
                  color: hasMultipleFailures ? "#4ade80" : "#14532d",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  lineHeight: 1.3,
                  cursor: hasMultipleFailures ? "pointer" : "default",
                  padding: "8px",
                }}
              >
                {hasMultipleFailures ? "PREV\nFAILURE" : ""}
              </button>

              <button
                type="button"
                disabled={!hasMultipleFailures}
                onClick={() => setActiveIndex((idx) => stepFailureIndex(idx, failures.length, "NEXT"))}
                data-testid="btn-next-failure"
                title={
                  hasMultipleFailures
                    ? "View next failure message (Figure 74)"
                    : "Inactive until multiple failures received (Figures 71-73)"
                }
                style={{
                  minHeight: "64px",
                  borderRadius: "4px",
                  border: hasMultipleFailures ? "1px solid #4ade80" : "1px solid #166534",
                  background: hasMultipleFailures ? "#0f291e" : "#07101d",
                  color: hasMultipleFailures ? "#4ade80" : "#14532d",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  lineHeight: 1.3,
                  cursor: hasMultipleFailures ? "pointer" : "default",
                  padding: "8px",
                }}
              >
                {hasMultipleFailures ? "NEXT\nFAILURE" : ""}
              </button>
            </div>
          </div>

          {/* Passive RX Interface Status Strip */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "0.78rem",
              color: "#475569",
            }}
          >
            <div>
              <strong>RX Path:</strong> ARINC 429 Label <code>{hwStatus.rxLabel}</code> (Monitoring Only)
            </div>
            <div>
              <strong>Hardware State:</strong>{" "}
              <span style={{ color: "#b45309", fontWeight: 600 }}>Not Connected (UI Monitoring / Simulation)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Isolated Simulation Helpers & Manual Notes */}
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
              Physical ARINC 429 Label 355 RX is not connected. These controls inject isolated UI test records
              (Figure 73 single failure, Figure 74 multi-failure, Figure 72 1s timeout) without claiming hardware RX.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleInjectFailures(getSimulatedSingleFailure())}
                style={{
                  background: accentColor,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "9px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Inject Single Failure (Fig 73)
              </button>
              <button
                type="button"
                onClick={() => handleInjectFailures(getSimulatedMultipleFailures())}
                style={{
                  background: "#0f766e",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "9px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Inject Multiple Failures (Fig 74: PREV/NEXT)
              </button>
              <button
                type="button"
                onClick={handleTrigger1sTimeout}
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  borderRadius: "6px",
                  padding: "9px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Trigger 1s No-Data Timeout (Fig 72)
              </button>
              <button
                type="button"
                onClick={handleResetToNoHwMonitoring}
                style={{
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "9px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset Wait Timer (0s / No HW RX)
              </button>
            </div>
          </div>

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
              MANUAL SPEC (PP. 1-4-111 – 1-4-115)
            </h3>
            <div>
              <strong>Protocol Basis:</strong> Discrete Mode monitors ARINC 429 <strong>Label 355</strong> failure
              messages from the LRU (not discrete electrical pins/voltages).
            </div>
            <div>
              <strong>1s Watchdog (Fig 72):</strong> Displays <code>{DISCRETE_NO_DATA_MSG}</code> if no Label 355
              words arrive within <strong>1 second</strong>.
            </div>
            <div>
              <strong>Navigation (Fig 73 vs Fig 74):</strong> <code>PREV FAILURE</code> and <code>NEXT FAILURE</code>{" "}
              fields remain blank/inactive for 0 or 1 failure and become active only when multiple failures are detected.
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
                <li>Raw ARINC 429 Label 355 bit packing (bits 9–29) for Failure Number, Type Code, Witness, and Suspect 1–3 fields is not specified in Manual pp. 1-4-111–115.</li>
                <li>Failure Type Code-to-String lookup dictionary (<code>005</code> &rarr; <code>CHECK SUSPECT 1 SYSTEM</code>) is defined per ABD0048 / LRU CMM.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState } from "react";
import type { CmcSimResponseMode, CmcStateResponse } from "../types";

interface Props {
  state: CmcStateResponse;
  loading: boolean;
  simMode: CmcSimResponseMode;
  onChangeSimMode: (mode: CmcSimResponseMode) => void;
  onSendTerminalAction: (payload: {
    action: string;
    key?: string;
    view?: string;
    simulate_mode?: CmcSimResponseMode;
  }) => void;
  onRequestShopFaults: () => void;
  onRequestConfigData: () => void;
}

export function CmcShopConfigTerminalPanel({
  state,
  loading,
  simMode,
  onChangeSimMode,
  onSendTerminalAction,
  onRequestShopFaults,
  onRequestConfigData,
}: Props) {
  const tm = state.terminal;
  const cfg = state.config_data;
  const sf = state.shop_faults;
  const [activeTab, setActiveTab] = useState<"TERMINAL" | "TABLE_VIEW">("TERMINAL");

  const handleKey = (key: string) => {
    onSendTerminalAction({
      action: "KEY_PRESS",
      key,
      view: tm.view,
      simulate_mode: simMode,
    });
  };

  const LEFT_KEYS = ["1", "2", "3", "4", "5", "6"];
  const RIGHT_KEYS = ["A", "B", "C", "D", "E", "F"];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Simulation / Diagnostic Bar */}
      <section className="panel" style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>SIMULATION MODE:</span>
            <select
              className="category-select"
              value={simMode}
              onChange={(e) => onChangeSimMode(e.target.value as CmcSimResponseMode)}
            >
              <option value="SUCCESS">NORMAL (Valid STX/EOT Block)</option>
              <option value="NO_ACK">FAIL 3s: WARNING: NO CMND WORD ACK RCVD</option>
              <option value="NO_MAINTENANCE_DATA">FAIL 5s: NO MAINTENANCE DATA RECEIVED</option>
              <option value="TIMEOUT_12S">FAIL 12s: NO LRU RESPONSE IN 12 SECS</option>
              <option value="BLOCK_COUNT_ERR">FAIL COUNT: BLOCK WORD COUNT ERR</option>
            </select>
            <button
              type="button"
              className="btn-sm"
              disabled={loading}
              onClick={() => handleKey("RUN_SIM")}
              title="Test selected simulation scenario"
            >
              TRIGGER TEST
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className={activeTab === "TERMINAL" ? "btn-sm primary" : "btn-sm"}
              onClick={() => setActiveTab("TERMINAL")}
            >
              CDU TERMINAL
            </button>
            <button
              type="button"
              className={activeTab === "TABLE_VIEW" ? "btn-sm primary" : "btn-sm"}
              onClick={() => setActiveTab("TABLE_VIEW")}
            >
              TABLE &amp; WORDS
            </button>
          </div>
        </div>
      </section>

      {/* Error Message Display (Berjenjang Error Handling) */}
      {tm.error && (
        <div
          className="alert-error"
          style={{
            fontWeight: 700,
            fontSize: "14px",
            fontFamily: "monospace",
            letterSpacing: "0.5px",
            borderLeft: "4px solid var(--fault)",
          }}
        >
          🚨 {tm.error}
        </div>
      )}

      {activeTab === "TERMINAL" ? (
        /* CDU Terminal Visual Unit with Side Keys */
        <section
          className="panel"
          style={{
            backgroundColor: "#080c10",
            border: "2px solid #222d38",
            borderRadius: "10px",
            padding: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ color: "#9ca3af", fontSize: "11px", letterSpacing: "1px", fontWeight: 700 }}>
              AEROFLEX T1200B CDU — CMC MAINTENANCE TERMINAL (LABEL 356)
            </div>
            <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#6b7280" }}>
              <span>VIEW: <strong style={{ color: "#10b981" }}>{tm.view}</strong></span>
              <span>LRU: <strong style={{ color: "#10b981" }}>{state.selected_lru.id}</strong></span>
            </div>
          </div>

          {/* Interactive Bezel with Left/Right Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 50px", gap: "14px", alignItems: "center" }}>
            {/* Left Keys 1..6 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {LEFT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={loading}
                  onClick={() => handleKey(k)}
                  style={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    color: "#f3f4f6",
                    fontWeight: 700,
                    borderRadius: "4px",
                    padding: "8px 0",
                    cursor: "pointer",
                    fontSize: "12px",
                    textAlign: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                  title={`Menu select key <${k}`}
                >
                  &lt; {k}
                </button>
              ))}
            </div>

            {/* CRT Screen Display */}
            <div
              style={{
                backgroundColor: "#030a06",
                border: "2px solid #064e3b",
                borderRadius: "6px",
                padding: "16px 20px",
                minHeight: "360px",
                fontFamily: "'Courier New', Courier, monospace",
                color: "#10b981",
                fontSize: "13.5px",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
                boxShadow: "inset 0 0 20px rgba(16, 185, 129, 0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                {tm.lines.map((ln, i) => (
                  <div key={i} style={{ minHeight: "20px" }}>
                    {ln}
                  </div>
                ))}
              </div>

              {/* Terminal Bottom Status Bar */}
              <div
                style={{
                  borderTop: "1px dashed #064e3b",
                  paddingTop: "8px",
                  marginTop: "12px",
                  fontSize: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  color: tm.error ? "#ef4444" : "#34d399",
                }}
              >
                <span>MSG: {tm.error || tm.message}</span>
                <span>PAGE {tm.page}/2</span>
              </div>
            </div>

            {/* Right Keys A..F */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {RIGHT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={loading}
                  onClick={() => handleKey(k)}
                  style={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    color: "#f3f4f6",
                    fontWeight: 700,
                    borderRadius: "4px",
                    padding: "8px 0",
                    cursor: "pointer",
                    fontSize: "12px",
                    textAlign: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                  title={`Menu select key ${k}>`}
                >
                  {k} &gt;
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Terminal Navigation Bar (NXT, <RETURN) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "18px",
              paddingTop: "12px",
              borderTop: "1px solid #1f2937",
            }}
          >
            <button
              type="button"
              className="btn-sm"
              style={{
                backgroundColor: "#111827",
                borderColor: "#374151",
                color: "#e5e7eb",
                padding: "8px 18px",
                fontWeight: 700,
              }}
              onClick={() => handleKey("<RETURN")}
            >
              &lt; RETURN
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-sm"
                style={{ backgroundColor: "#111827", borderColor: "#374151", color: "#10b981" }}
                onClick={onRequestShopFaults}
              >
                1&lt; REQ SHOP FAULTS
              </button>
              <button
                type="button"
                className="btn-sm"
                style={{ backgroundColor: "#111827", borderColor: "#374151", color: "#10b981" }}
                onClick={onRequestConfigData}
              >
                2&lt; REQ CONFIG DATA
              </button>
            </div>

            <button
              type="button"
              className="btn-sm"
              style={{
                backgroundColor: "#111827",
                borderColor: "#374151",
                color: "#e5e7eb",
                padding: "8px 18px",
                fontWeight: 700,
              }}
              onClick={() => handleKey("NXT")}
            >
              NXT (PAGE) &gt;
            </button>
          </div>
        </section>
      ) : (
        /* Table View for Details & Label 356 Stream */
        <div style={{ display: "grid", gap: "16px" }}>
          {/* Config Data Details */}
          <section className="panel">
            <div className="panel-head">
              <h2>LRU CONFIGURATION DATA DETAILS (LABEL 356)</h2>
              <button type="button" className="btn-sm primary" onClick={onRequestConfigData}>
                POLL CONFIG DATA
              </button>
            </div>
            {cfg.valid ? (
              <div className="meters">
                <div className="meter">
                  <div className="meter-label">Part Number</div>
                  <div className="meter-value" style={{ fontSize: "16px" }}>{cfg.part_number}</div>
                  <div className="meter-unit">D243W201-1 Verified</div>
                </div>
                <div className="meter">
                  <div className="meter-label">Operational SW</div>
                  <div className="meter-value" style={{ fontSize: "16px" }}>{cfg.sw_version}</div>
                  <div className="meter-unit">ISO #5 Payload</div>
                </div>
                <div className="meter">
                  <div className="meter-label">Hardware Mod Level</div>
                  <div className="meter-value" style={{ fontSize: "16px" }}>{cfg.hw_mod}</div>
                  <div className="meter-unit">Mod State</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                {cfg.message || "No configuration data loaded."}
              </div>
            )}
          </section>

          {/* Shop Faults Records */}
          <section className="panel">
            <div className="panel-head">
              <h2>SHOP FAULTS LOG ENTRIES</h2>
              <button type="button" className="btn-sm primary" onClick={onRequestShopFaults}>
                POLL SHOP FAULTS
              </button>
            </div>
            {sf.valid && sf.records.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>LEG</th>
                      <th>FAULT CODE</th>
                      <th>SEVERITY</th>
                      <th>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sf.records.map((r) => (
                      <tr key={r.code}>
                        <td style={{ fontWeight: 700 }}>{r.leg}</td>
                        <td style={{ fontFamily: "monospace", color: "var(--teal-primary)", fontWeight: 700 }}>
                          {r.code}
                        </td>
                        <td>
                          <span className="pill fault">{r.severity}</span>
                        </td>
                        <td>{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                {sf.message || "No shop faults recorded."}
              </div>
            )}
          </section>

          {/* Ordered Label 356 Words */}
          {tm.words_hex.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h2>ORDERED ARINC 429 LABEL 356 WORD SEQUENCE (STX ➔ TEXT ➔ EOT)</h2>
                <span className="pill-category">{tm.words_hex.length} WORDS IN BLOCK</span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "12px" }}>
                {tm.words_hex.map((hex, idx) => (
                  <span
                    key={idx}
                    className="pill-category"
                    style={{
                      fontFamily: "monospace",
                      borderColor: idx === 0 || idx === tm.words_hex.length - 1 ? "var(--teal-primary)" : undefined,
                    }}
                  >
                    #{idx + 1}: <strong>{hex}</strong> {idx === 0 ? "(STX)" : idx === tm.words_hex.length - 1 ? "(EOT)" : ""}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

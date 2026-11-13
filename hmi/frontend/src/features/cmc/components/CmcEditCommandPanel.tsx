import { useEffect, useState } from "react";
import type { CmcFunctionName, CmcStateResponse } from "../types";
import { CMC_FUNCTION_SWITCHES } from "../utils";

interface Props {
  state: CmcStateResponse;
  loading: boolean;
  handshakeMessage: string | null;
  onSendCommand: (payload: {
    function: CmcFunctionName;
    eq_id?: string;
    pad?: number;
    sdi?: string;
    rate_ms?: number;
    parity?: string;
    channel?: string;
  }) => void;
}

export function CmcEditCommandPanel({
  state,
  loading,
  handshakeMessage,
  onSendCommand,
}: Props) {
  const cs = state.command_summary;
  const [eqId, setEqId] = useState(state.selected_lru.code ?? "007");
  const [pad, setPad] = useState(0);
  const [sdi, setSdi] = useState(cs.sdi ?? "00");
  const [rateMs, setRateMs] = useState(cs.rate_ms ?? 100);
  const [parity, setParity] = useState(cs.parity ?? "ODD");
  const [channel, setChannel] = useState("TX-A");

  useEffect(() => {
    setEqId(state.selected_lru.code ?? "007");
    setSdi(cs.sdi ?? "00");
    setRateMs(cs.rate_ms ?? 100);
    setParity(cs.parity ?? "ODD");
  }, [state.selected_lru.code, cs]);

  const handleFunctionClick = (fnId: CmcFunctionName) => {
    onSendCommand({
      function: fnId,
      eq_id: eqId,
      pad,
      sdi,
      rate_ms: rateMs,
      parity,
      channel,
    });
  };

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Handshake Warning / Alert Banner */}
      {handshakeMessage && (
        <div
          className={handshakeMessage.includes("WARNING") ? "alert-error" : "alert-error"}
          style={{ fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <span>⚠️ {handshakeMessage}</span>
        </div>
      )}

      {/* Main Parameters Panel */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>EDIT COMMAND SUMMARY WORD (LABEL 227)</h2>
            <p className="section-sub">
              Interrogation Command structure per Boeing D243W201-1 / ARINC 604-1
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="pill-category" style={{ fontFamily: "monospace", fontSize: "13px" }}>
              WORD: <strong style={{ color: "var(--teal-primary)" }}>{cs.raw_hex}</strong>
            </span>
            <select
              className="category-select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="TX-A">Transmit on TX-A</option>
              <option value="TX-B">Transmit on TX-B</option>
              <option value="TX-C">Transmit on TX-C</option>
              <option value="TX-D">Transmit on TX-D</option>
            </select>
          </div>
        </div>

        {/* Editable Parameters Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
            marginTop: "12px",
          }}
        >
          {/* LABEL (227) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>LABEL</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Bits 1..8 (Wire reversed)</div>
            <input
              type="text"
              readOnly
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace", backgroundColor: "var(--bg-panel)" }}
              value="227 (Octal)"
            />
          </div>

          {/* EQ ID (Hex 3-digit, Bit 13..24) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>EQ ID (Bits 13–24)</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>3-Digit Hex (000–FFF)</div>
            <input
              type="text"
              maxLength={3}
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace", fontWeight: 700 }}
              value={eqId}
              onChange={(e) => {
                const hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
                setEqId(hex);
              }}
            />
          </div>

          {/* FUNCTION (Bit 25..31) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>FUNCTION (Bits 25–31)</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Current Active Code</div>
            <div
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace", fontWeight: 700, color: "var(--teal-primary)" }}
            >
              {cs.function} ({cs.function_hex})
            </div>
          </div>

          {/* PAD (Bit 11..12, default 00) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>PAD (Bits 11–12)</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Default 00</div>
            <select
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={pad}
              onChange={(e) => setPad(Number(e.target.value))}
            >
              <option value={0}>00 (Binary 00)</option>
              <option value={1}>01 (Binary 01)</option>
              <option value={2}>10 (Binary 10)</option>
              <option value={3}>11 (Binary 11)</option>
            </select>
          </div>

          {/* SDI (ALL, 1, 2, 3) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>SDI (Bits 9–10)</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Source / Destination</div>
            <select
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={sdi}
              onChange={(e) => setSdi(e.target.value)}
            >
              <option value="00">ALL (00)</option>
              <option value="01">1 / LEFT (01)</option>
              <option value="10">2 / RIGHT (10)</option>
              <option value="11">3 / CENTER (11)</option>
            </select>
          </div>

          {/* RATE (ms) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>RATE (ms)</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Default 100 ms or 1000 ms</div>
            <select
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={rateMs}
              onChange={(e) => setRateMs(Number(e.target.value))}
            >
              <option value={100}>100 ms (Fast Interrogation)</option>
              <option value={1000}>1000 ms (Standard CMC Rate)</option>
              <option value={200}>200 ms</option>
              <option value={500}>500 ms</option>
            </select>
          </div>

          {/* PARITY (ODD/EVEN) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>PARITY (Bit 32)</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>ARINC 429 Odd/Even Mode</div>
            <select
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={parity}
              onChange={(e) => setParity(e.target.value)}
            >
              <option value="ODD">ODD (Default ARINC 429)</option>
              <option value="EVEN">EVEN</option>
            </select>
          </div>
        </div>
      </section>

      {/* 6 FUNCTION SELECT SWITCHES (Bits 25..31) */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>FUNCTION SELECT SWITCHES (BITS 25–31)</h2>
            <p className="section-sub">
              Clicking a function switch replaces NO REQUEST (00H) temporarily until LRU ACK (Bit 29=1) or 5s timeout
            </p>
          </div>
          <span className="pill-category">
            Bit 29 ACK: {state.fault_summary.bit_29_ack ? "VALID (ACK)" : "NAK"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "10px",
            marginTop: "12px",
          }}
        >
          {CMC_FUNCTION_SWITCHES.map((fn) => {
            const isActive = cs.function === fn.id;
            return (
              <button
                key={fn.id}
                type="button"
                className="channel-row"
                disabled={loading}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  borderColor: isActive ? "var(--teal-primary)" : undefined,
                  backgroundColor: isActive ? "var(--teal-bg)" : undefined,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => handleFunctionClick(fn.id)}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "13px",
                      color: isActive ? "var(--teal-primary)" : "var(--text-main)",
                    }}
                  >
                    {fn.label}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {fn.description}
                  </div>
                </div>
                <span
                  className={isActive ? "pill primary" : "pill"}
                  style={{ fontFamily: "monospace", fontWeight: 700 }}
                >
                  {fn.codeHex}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

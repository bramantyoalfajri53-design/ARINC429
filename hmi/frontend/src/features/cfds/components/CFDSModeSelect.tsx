import { type FC } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";

interface CFDSModeSelectProps {
  selectedLru: CfdsLruItem;
  onChangeLru: () => void;
  onSelectSubmode: (submode: "EDIT_TX" | "OPERATION_MODE" | "CONFIGURE_CHANNELS") => void;
  onBackToMain: () => void;
}

export const CFDSModeSelect: FC<CFDSModeSelectProps> = ({
  selectedLru,
  onChangeLru,
  onSelectSubmode,
  onBackToMain,
}) => {
  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gap: "24px" }}>
      {/* Navigation Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={onChangeLru}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#475569",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            &laquo; Change LRU (Fig 47)
          </button>
          <button
            type="button"
            onClick={onBackToMain}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#475569",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            &laquo; Return to Main Menu
          </button>
        </div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Reference: <strong style={{ color: "#0d9488" }}>Figure 48 &bull; CFDS Mode Select</strong> (Manual pp. 1-4-86)
        </div>
      </div>

      {/* Target Equipment Banner */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
            Active CFDS Configuration
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            CFDS Mode Select
          </h1>
          <div style={{ fontSize: "14px", color: "#475569" }}>
            Target LRU: <strong style={{ color: "#0f172a" }}>{selectedLru.name}</strong> &bull; {selectedLru.description}
          </div>
        </div>

        <div
          style={{
            background: "#f0fdfa",
            border: "1px solid #99f6e4",
            borderRadius: "8px",
            padding: "8px 16px",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: "11px", color: "#0d9488", fontWeight: 600, textTransform: "uppercase" }}>
            Equipment Code
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: 700, color: "#0f766e" }}>
            0x{selectedLru.code}
          </div>
        </div>
      </div>

      {/* 3 Main Choice Cards (Figure 48) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        {/* Option 1: EDIT CFDS TX DATA */}
        <div
          onClick={() => onSelectSubmode("EDIT_TX")}
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#0d9488";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(13,148,136,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
              Figure 49 &bull; Parameters
            </div>
            <h2 style={{ margin: "10px 0 8px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              1. EDIT CFDS TX DATA
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
              Configure T1200B transmission parameters: Date, Time, Flight Number, City Pairs, Flight Phase, Aircraft ID, and 17 Subsystem Configuration bits.
            </p>
          </div>
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488" }}>
              Open Editor &raquo;
            </span>
          </div>
        </div>

        {/* Option 2: CFDS OPERATION MODE */}
        <div
          onClick={() => onSelectSubmode("OPERATION_MODE")}
          style={{
            background: "#ffffff",
            border: "2px solid #0d9488",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 2px 6px rgba(13,148,136,0.08)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(13,148,136,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 2px 6px rgba(13,148,136,0.08)";
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
              Figure 55-74 &bull; Flight Deck BITE
            </div>
            <h2 style={{ margin: "10px 0 8px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              2. CFDS OPERATION MODE
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
              Enter Date &amp; Shop Code to access the 5 operational modes: Normal (ABD0018/0048), Menu Mode, Interactive Mode (MCDU 1L-6L / 1R-6R), and Discrete Mode (Label 355).
            </p>
          </div>
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <span
              style={{
                background: "#0d9488",
                color: "#ffffff",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Enter Operations &raquo;
            </span>
          </div>
        </div>

        {/* Option 3: CONFIGURE CHANNELS A, B, C, D */}
        <div
          onClick={() => onSelectSubmode("CONFIGURE_CHANNELS")}
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#0d9488";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(13,148,136,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
              Figure 53-54 &bull; Bus Channels
            </div>
            <h2 style={{ margin: "10px 0 8px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              3. CONFIGURE CHANNELS A, B, C, D
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
              Select and calibrate Transmitters (TX-A..D) and Receivers (RX-A..D), Bit Rate (100k / 12.5k), Display Mode (ENG, BIN, HEX), Parity, and Refresh Rates.
            </p>
          </div>
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488" }}>
              Configure Channels &raquo;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

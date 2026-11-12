import { useState, type FC, type FormEvent } from "react";
import { CFDS_LRU_TABLE, type CfdsLruItem } from "../utils/lruDefinitions";

interface LRUSelectionProps {
  selectedLru: CfdsLruItem | null;
  onSelectLru: (lru: CfdsLruItem) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const LRUSelection: FC<LRUSelectionProps> = ({
  selectedLru,
  onSelectLru,
  onProceed,
  onBack,
}) => {
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");

  const handleManualApply = (e: FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (!/^[0-9A-F]{3}$/.test(clean)) {
      setManualError("Equipment Code must be exactly 3 hexadecimal characters (000 - FFF).");
      return;
    }
    setManualError("");
    // Check if it matches a known LRU
    const known = CFDS_LRU_TABLE.find((item) => item.code.toUpperCase() === clean);
    if (known) {
      onSelectLru(known);
    } else {
      onSelectLru({
        code: clean,
        name: `LRU-${clean}`,
        description: `Custom Avionics LRU (Hex Code 0x${clean})`,
      });
    }
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "20px" }}>
      {/* Top Breadcrumb & Return Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
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
            }}
          >
            &laquo; Back to Mode Select
          </button>
        </div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Reference: <strong style={{ color: "#0d9488" }}>Figure 47 &bull; CFDS LRU Selection</strong> (Manual pp. 1-4-85)
        </div>
      </div>

      {/* Screen Header */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
          Aeroflex JcAIR T1200B &bull; Section 4.F
        </div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
          CFDS LRU Selection
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Select target Line Replaceable Unit (LRU) from verified manufacturer table, or enter 3-digit Hexadecimal Equipment Code manually.
        </p>
      </div>

      {/* Current Selection & Manual Entry Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        {/* Active Selection Indicator */}
        <div
          style={{
            background: "#ffffff",
            border: selectedLru ? "2px solid #0d9488" : "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
              Active Target LRU
            </div>
            {selectedLru ? (
              <div style={{ marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginRight: "10px" }}>
                  {selectedLru.name}
                </span>
                <span
                  style={{
                    background: "#f0fdfa",
                    color: "#0d9488",
                    border: "1px solid #99f6e4",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  CODE: 0x{selectedLru.code}
                </span>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  {selectedLru.description}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#94a3b8", fontStyle: "italic", marginTop: "4px" }}>
                No LRU selected yet. Choose from list or enter code below.
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedLru}
            onClick={onProceed}
            style={{
              background: selectedLru ? "#0d9488" : "#94a3b8",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: selectedLru ? "pointer" : "not-allowed",
              boxShadow: selectedLru ? "0 2px 4px rgba(13,148,136,0.25)" : "none",
            }}
          >
            Proceed to Mode Select &raquo;
          </button>
        </div>

        {/* Manual Equipment Code Entry (Manual Requirement) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
            Manual Equipment Code Entry (Hex 000 - FFF)
          </div>
          <form onSubmit={handleManualApply} style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <input
              type="text"
              maxLength={3}
              placeholder="e.g. 735"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              style={{
                width: "120px",
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "0.1em",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#0f172a",
                textAlign: "center",
              }}
            />
            <button
              type="submit"
              style={{
                background: "#1e293b",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Apply Manual Entry
            </button>
          </form>
          {manualError && (
            <div style={{ color: "#dc2626", fontSize: "11px", marginTop: "6px" }}>{manualError}</div>
          )}
        </div>
      </div>

      {/* Verified LRU Table (Figure 47) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
            Manufacturer Equipment Code Table (19 LRUs)
          </h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Click any row to select LRU
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700, width: "140px" }}>
                  Equipment Code
                </th>
                <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700, width: "160px" }}>
                  LRU Acronym
                </th>
                <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700 }}>
                  Equipment Description
                </th>
                <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700, width: "100px", textAlign: "center" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {CFDS_LRU_TABLE.map((item, idx) => {
                const isSelected = selectedLru?.code === item.code && selectedLru?.name === item.name;
                return (
                  <tr
                    key={`${item.code}-${item.name}-${idx}`}
                    onClick={() => onSelectLru(item)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: isSelected ? "#f0fdfa" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: "#0d9488" }}>
                      0x{item.code}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1e293b" }}>
                      {item.name}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>
                      {item.description}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLru(item);
                        }}
                        style={{
                          background: isSelected ? "#0d9488" : "#f1f5f9",
                          color: isSelected ? "#ffffff" : "#475569",
                          border: isSelected ? "1px solid #0d9488" : "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

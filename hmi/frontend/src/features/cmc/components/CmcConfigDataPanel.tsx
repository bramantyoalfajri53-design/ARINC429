import type { CmcSimResponseMode, CmcStateResponse } from "../types";

interface Props {
  state: CmcStateResponse;
  simMode: CmcSimResponseMode;
  loading: boolean;
  onChangeSimMode: (mode: CmcSimResponseMode) => void;
  onRequestConfigData: () => void;
}

export function CmcConfigDataPanel({
  state,
  simMode,
  loading,
  onChangeSimMode,
  onRequestConfigData,
}: Props) {
  const cfg = state.config_data;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>LRU CONFIGURATION DATA (LABEL 356)</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {state.simulation_mode && (
            <select
              className="category-select"
              value={simMode}
              onChange={(e) => onChangeSimMode(e.target.value as CmcSimResponseMode)}
            >
              <option value="SUCCESS">SIM: Valid Config Data (Label 356)</option>
              <option value="NO_ACK">SIM: NO COMMAND WORD ACK RCVD</option>
              <option value="NO_MAINTENANCE_DATA">SIM: NO MAINTENANCE DATA RECEIVED</option>
              <option value="TIMEOUT_12S">SIM: NO LRU RESPONSE IN 12 SECS</option>
            </select>
          )}
          <button
            type="button"
            className="btn-sm primary"
            disabled={loading}
            onClick={onRequestConfigData}
          >
            {loading ? "REQUESTING..." : "REQUEST CONFIG DATA"}
          </button>
        </div>
      </div>

      {/* Explicit Manual Error vs Valid Status Handling */}
      <div className={cfg.valid ? "alert-ok" : cfg.status === "IDLE" ? "pill view" : "alert-error"}>
        <span>[{cfg.source}] </span>
        {cfg.message}
      </div>

      {cfg.valid ? (
        <div className="meters">
          <div className="meter">
            <div className="meter-label">LRU Part Number</div>
            <div className="meter-value" style={{ fontSize: "17px" }}>{cfg.part_number}</div>
            <div className="meter-unit">Label 356 Verified</div>
          </div>
          <div className="meter">
            <div className="meter-label">Operational SW</div>
            <div className="meter-value" style={{ fontSize: "17px" }}>{cfg.sw_version}</div>
            <div className="meter-unit">ISO #5 Stream</div>
          </div>
          <div className="meter">
            <div className="meter-label">Hardware Mod Level</div>
            <div className="meter-value" style={{ fontSize: "17px" }}>{cfg.hw_mod}</div>
            <div className="meter-unit">{cfg.raw_words_hex.length} ARINC Words</div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
          Config Data unavailable unless Command Word ACK (Bit 29 = 1) and Label 356 Maintenance Words are both received within 12 seconds.
        </div>
      )}
    </section>
  );
}


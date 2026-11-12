import type { CmcSimResponseMode, CmcStateResponse } from "../types";

interface Props {
  state: CmcStateResponse;
  simMode: CmcSimResponseMode;
  loading: boolean;
  onChangeSimMode: (mode: CmcSimResponseMode) => void;
  onRequestShopFaults: () => void;
}

export function CmcShopFaultsPanel({
  state,
  simMode,
  loading,
  onChangeSimMode,
  onRequestShopFaults,
}: Props) {
  const sf = state.shop_faults;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>SHOP FAULTS SCREEN (ORDERED LABEL 356 STREAM)</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {state.simulation_mode && (
            <select
              className="category-select"
              value={simMode}
              onChange={(e) => onChangeSimMode(e.target.value as CmcSimResponseMode)}
            >
              <option value="SUCCESS">SIM: Valid Shop Faults Words</option>
              <option value="NO_ACK">SIM: NO COMMAND WORD ACK RCVD</option>
              <option value="NO_MAINTENANCE_DATA">SIM: NO MAINTENANCE DATA RECEIVED</option>
              <option value="TIMEOUT_12S">SIM: NO LRU RESPONSE IN 12 SECS</option>
            </select>
          )}
          <button
            type="button"
            className="btn-sm primary"
            disabled={loading}
            onClick={onRequestShopFaults}
          >
            {loading ? "POLLING..." : "READ SHOP FAULTS"}
          </button>
        </div>
      </div>

      <div className={sf.valid ? "alert-ok" : sf.status === "IDLE" ? "pill view" : "alert-error"}>
        <span>[{sf.source}] </span>
        {sf.message}
      </div>

      {sf.valid && (
        <>
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
                {sf.records.map((rec) => (
                  <tr key={rec.code}>
                    <td style={{ fontWeight: 700 }}>{rec.leg}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--teal-primary)", fontWeight: 700 }}>
                      {rec.code}
                    </td>
                    <td>
                      <span className="pill fault">{rec.severity}</span>
                    </td>
                    <td>{rec.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="channel-col-title">ORDERED ARINC 429 LABEL 356 WORD SEQUENCE</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {sf.ordered_words.map((w) => (
                <span key={w.word_order} className="pill-category" style={{ fontFamily: "monospace" }}>
                  #{w.word_order} [{w.seq_ctrl}]: {w.raw_hex} (&ldquo;{w.chars}&rdquo;)
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}


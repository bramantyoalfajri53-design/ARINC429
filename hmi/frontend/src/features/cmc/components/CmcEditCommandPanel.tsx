import { useEffect, useState } from "react";
import type { CmcFunctionName, CmcStateResponse } from "../types";
import { CMC_FUNCTION_OPTIONS } from "../utils";

interface Props {
  state: CmcStateResponse;
  loading: boolean;
  onSendCommand: (payload: {
    function: CmcFunctionName;
    ground_test_en: boolean;
    inflight_test_en: boolean;
    sensor_code: string;
  }) => void;
}

export function CmcEditCommandPanel({ state, loading, onSendCommand }: Props) {
  const [selectedFn, setSelectedFn] = useState<CmcFunctionName>(state.command_summary.function);
  const [groundEn, setGroundEn] = useState(state.command_summary.ground_test_en);
  const [inflightEn, setInflightEn] = useState(state.command_summary.inflight_test_en);

  useEffect(() => {
    setSelectedFn(state.command_summary.function);
    setGroundEn(state.command_summary.ground_test_en);
    setInflightEn(state.command_summary.inflight_test_en);
  }, [state.command_summary]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>EDIT COMMAND SUMMARY WORD (LABEL 227) &amp; SETUP TX/RX MENUS</h2>
        <button
          type="button"
          className="btn-sm primary"
          disabled={loading}
          onClick={() =>
            onSendCommand({
              function: selectedFn,
              ground_test_en: groundEn,
              inflight_test_en: inflightEn,
              sensor_code: state.selected_lru.code,
            })
          }
        >
          {loading ? "TRANSMITTING..." : "TRANSMIT COMMAND WORD (LABEL 227)"}
        </button>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        <div className="channel-col-title">BOEING BITE FUNCTION CODE</div>
        <div className="presets">
          {CMC_FUNCTION_OPTIONS.map((fn) => (
            <button
              key={fn}
              type="button"
              className={selectedFn === fn ? "btn-sm primary" : "btn-sm"}
              onClick={() => setSelectedFn(fn)}
            >
              {fn}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "8px" }}>
          <label className="channel-row" style={{ cursor: "pointer" }}>
            <span style={{ fontWeight: 600 }}>Ground Test Enable</span>
            <input type="checkbox" checked={groundEn} onChange={(e) => setGroundEn(e.target.checked)} />
          </label>

          <label className="channel-row" style={{ cursor: "pointer" }}>
            <span style={{ fontWeight: 600 }}>In-Flight Test Enable</span>
            <input type="checkbox" checked={inflightEn} onChange={(e) => setInflightEn(e.target.checked)} />
          </label>

          <div className="channel-row">
            <span style={{ fontWeight: 600 }}>Target Sensor ID</span>
            <code style={{ color: "var(--teal-primary)", fontWeight: 700 }}>{state.selected_lru.code}</code>
          </div>

          <div className="channel-row">
            <span style={{ fontWeight: 600 }}>TX Schedule Rate / Timeout</span>
            <span className="pill-category">
              {state.command_summary.tx_rate_ms}ms / {state.command_summary.rx_timeout_secs}s
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}


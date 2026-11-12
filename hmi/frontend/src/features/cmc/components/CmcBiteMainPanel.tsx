import type { BoeingLruDefinition, CmcStateResponse } from "../types";
import { BOEING_LRU_DATABASE } from "../utils";

interface Props {
  state: CmcStateResponse;
  onSelectLru: (lru: BoeingLruDefinition) => void;
  onToggleFaultBit: (bit: number, fault: boolean, commandAck?: boolean) => void;
}

export function CmcBiteMainPanel({ state, onSelectLru, onToggleFaultBit }: Props) {
  return (
    <div className="panels">
      {/* Left Panel: Boeing Equipment Selection */}
      <section className="panel">
        <div className="panel-head">
          <h2>BOEING CMC / SENSOR BITE SELECTION</h2>
          <span className="pill-category">D243W201-1 / ARINC 604-1</span>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          {BOEING_LRU_DATABASE.map((lru) => {
            const isSelected = state.selected_lru.id === lru.id;
            return (
              <button
                key={lru.id}
                type="button"
                className="channel-row"
                style={{
                  cursor: "pointer",
                  borderColor: isSelected ? "var(--teal-primary)" : undefined,
                  backgroundColor: isSelected ? "var(--teal-bg)" : undefined,
                }}
                onClick={() => onSelectLru(lru)}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, color: isSelected ? "var(--teal-primary)" : "var(--text-main)" }}>
                    {lru.id}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{lru.name}</div>
                </div>
                <span className="pill-category" style={{ fontFamily: "monospace" }}>
                  {lru.code}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Right Panel: Fault Summary Words #1 (Label 350) & #2 (Label 351) + Bit 29 ACK */}
      <section className="panel">
        <div className="panel-head">
          <h2>DISPLAY FAULT SUMMARY WORD (LABEL 350 / 351)</h2>
          <button
            type="button"
            className={state.fault_summary.bit_29_ack ? "btn-sm ok" : "btn-sm fault"}
            onClick={() =>
              onToggleFaultBit(11, state.fault_summary.bits[0]?.fault ?? false, !state.fault_summary.bit_29_ack)
            }
            title="Bit 29 Command Word Acknowledge (ACK=1, NAK=0)"
          >
            BIT 29 ACK: {state.fault_summary.bit_29_ack ? "VALID (1)" : "NAK (0)"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)" }}>
          <span>
            Word #1 (350): <code>{state.fault_summary.word_350.raw_hex}</code>
          </span>
          <span>
            Word #2 (351): <code>{state.fault_summary.word_351.raw_hex}</code>
          </span>
        </div>

        <div style={{ display: "grid", gap: "6px", maxHeight: "360px", overflowY: "auto" }}>
          {state.fault_summary.bits.map((b) => (
            <div key={b.bit} className="channel-row" style={{ padding: "6px 10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>
                <code style={{ color: "var(--teal-primary)", marginRight: "8px" }}>BIT {b.bit}</code>
                {b.label}
              </span>
              <button
                type="button"
                className={b.fault ? "btn-sm fault" : "btn-sm ok"}
                onClick={() => onToggleFaultBit(b.bit, !b.fault)}
              >
                {b.fault ? "FAULT (1)" : "OK (0)"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


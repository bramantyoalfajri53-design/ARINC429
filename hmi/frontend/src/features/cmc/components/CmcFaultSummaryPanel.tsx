import type { CmcStateResponse } from "../types";

interface Props {
  state: CmcStateResponse;
  onSwitchPage: (page: "350" | "351") => void;
  onToggleFaultBit: (
    bit: number,
    fault: boolean,
    commandAck?: boolean,
    biteInhibit?: boolean,
    label?: string,
    sdi?: string,
    ssm?: string,
    hasWords?: boolean
  ) => void;
}

export function CmcFaultSummaryPanel({
  state,
  onSwitchPage,
  onToggleFaultBit,
}: Props) {
  const fs = state.fault_summary;
  const isPage350 = fs.current_page === "350";
  const activeWord = isPage350 ? fs.word_350 : fs.word_351;
  const activeFaultCount = fs.bits.filter((b) => b.fault && b.bit <= 27).length;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Warning status if NO WORDS RECEIVED */}
      {!fs.has_words_received && (
        <div className="alert-error" style={{ fontWeight: 700, fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ WARNING: NO WORDS RECEIVED (Label {fs.current_page} Bus Inactive)</span>
          <button
            type="button"
            className="btn-sm"
            onClick={() => onToggleFaultBit(11, false, undefined, undefined, fs.current_page, undefined, undefined, true)}
          >
            RESTORE BUS RECEPTION
          </button>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>
              DISPLAY FAULT SUMMARY WORD (LABEL {fs.current_page})
            </h2>
            <p className="section-sub">
              Interrogating {state.selected_lru.id} (Eq Code: {state.selected_lru.code}) · Boeing D243W201-1
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Toggle Bus Received status for testing */}
            <button
              type="button"
              className={fs.has_words_received ? "btn-sm ok" : "btn-sm fault"}
              title="Toggle simulated bus transmission presence"
              onClick={() =>
                onToggleFaultBit(11, false, undefined, undefined, fs.current_page, undefined, undefined, !fs.has_words_received)
              }
            >
              BUS: {fs.has_words_received ? "RECEIVING" : "NO WORDS"}
            </button>

            {/* PAGE Switch Button */}
            <button
              type="button"
              className="btn-sm primary"
              onClick={() => onSwitchPage(isPage350 ? "351" : "350")}
            >
              PAGE: WORD #{isPage350 ? "1 (350)" : "2 (351)"} ⇄ #{isPage350 ? "2 (351)" : "1 (350)"}
            </button>
          </div>
        </div>

        {/* Header Indicators Strip */}
        <div className="meters" style={{ marginTop: "8px" }}>
          <div className="meter">
            <div className="meter-label">Active Word</div>
            <div className="meter-value" style={{ fontSize: "17px", color: "var(--teal-primary)" }}>
              LABEL {activeWord.label}
            </div>
            <div className="meter-unit"><code>{activeWord.raw_hex}</code></div>
          </div>

          {/* SDI (Bit 9-10): 00=ALL, 01=LEFT, 10=RIGHT, 11=CENTER */}
          <div className="meter">
            <div className="meter-label">SDI (Bit 9–10)</div>
            <div className="meter-value" style={{ fontSize: "17px" }}>
              {activeWord.sdi_name}
            </div>
            <div className="meter-unit">
              Binary: <code>{activeWord.sdi_bin}</code> (00=ALL, 01=L, 10=R, 11=C)
            </div>
          </div>

          {/* SSM (Bit 30-31): 00=VERIFIED, 01=NO COMPUTED DATA, 10=FUNCTIONAL TEST, 11=NOT DEFINED */}
          <div className="meter">
            <div className="meter-label">SSM (Bit 30–31)</div>
            <div
              className="meter-value"
              style={{
                fontSize: "15px",
                color: activeWord.ssm_bin === "00" ? "var(--ok)" : "var(--amber-warning)",
              }}
            >
              {activeWord.ssm_name}
            </div>
            <div className="meter-unit">
              Binary: <code>{activeWord.ssm_bin}</code>
            </div>
          </div>

          {/* Bit 28: BITE TEST INHIBIT */}
          <div className="meter">
            <div className="meter-label">Bit 28: BITE INHIBIT</div>
            <div
              className="meter-value"
              style={{
                fontSize: "16px",
                color: fs.bite_test_inhibit ? "var(--fault)" : "var(--ok)",
              }}
            >
              {fs.bite_test_inhibit ? "INHIBIT (1)" : "ENABLE (0)"}
            </div>
            <div className="meter-unit">Consistent all LRUs</div>
          </div>

          {/* Bit 29: CMND WORD ACKNOWLEDGE */}
          <div className="meter">
            <div className="meter-label">Bit 29: COMMAND ACK</div>
            <div
              className="meter-value"
              style={{
                fontSize: "16px",
                color: fs.bit_29_ack ? "var(--ok)" : "var(--fault)",
              }}
            >
              {fs.bit_29_ack ? "ACK (1)" : "NAK (0)"}
            </div>
            <div className="meter-unit">Consistent all LRUs</div>
          </div>
        </div>

        {/* Bit 11 to Bit 29 Complete Table */}
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div className="channel-col-title">
              COMPLETE FAULT BITS MATRIX (BIT 11 TO BIT 29) · {activeFaultCount} FAULT(S) ACTIVE
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Click any row toggle to simulate LRU hardware fault condition
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
            {fs.bits.map((b) => {
              const isAck = b.bit === 29;
              const isInhibit = b.bit === 28;
              const isSpare = b.is_spare;

              let btnClass = "btn-sm";
              if (isAck) {
                btnClass = fs.bit_29_ack ? "btn-sm ok" : "btn-sm fault";
              } else if (isInhibit) {
                btnClass = fs.bite_test_inhibit ? "btn-sm fault" : "btn-sm ok";
              } else if (isSpare) {
                btnClass = b.fault ? "btn-sm fault" : "btn-sm";
              } else {
                btnClass = b.fault ? "btn-sm fault" : "btn-sm ok";
              }

              return (
                <div
                  key={b.bit}
                  className="channel-row"
                  style={{
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: b.fault ? "rgba(239, 68, 68, 0.08)" : undefined,
                    borderColor: b.fault ? "var(--fault)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <code
                      style={{
                        color: "var(--teal-primary)",
                        fontWeight: 700,
                        fontSize: "12px",
                        minWidth: "48px",
                      }}
                    >
                      BIT {b.bit}
                    </code>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "12px",
                          color: isSpare ? "var(--text-muted)" : "var(--text-main)",
                        }}
                      >
                        {b.label}
                      </div>
                      <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                        {isAck ? "0=NAK, 1=ACK" : isInhibit ? "0=ENABLE, 1=INHIBIT" : isSpare ? "Unused spare bit" : "0=OK, 1=FAILURE"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={btnClass}
                    style={{ minWidth: "90px", fontSize: "11px" }}
                    onClick={() => {
                      if (isAck) {
                        onToggleFaultBit(29, false, !fs.bit_29_ack, undefined, fs.current_page);
                      } else if (isInhibit) {
                        onToggleFaultBit(28, !fs.bite_test_inhibit, undefined, !fs.bite_test_inhibit, fs.current_page);
                      } else {
                        onToggleFaultBit(b.bit, !b.fault, undefined, undefined, fs.current_page);
                      }
                    }}
                  >
                    {b.status}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}


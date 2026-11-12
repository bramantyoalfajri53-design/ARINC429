import type { ArincBusSpeed, RxChannelState, TxChannelState } from "../types/arinc429";

interface ChannelConfigPanelProps {
  txChannels: Record<string, TxChannelState>;
  rxChannels: Record<string, RxChannelState>;
  onConfigure: (payload: {
    channel: string;
    speed?: ArincBusSpeed;
    enabled?: boolean;
    trap_label?: string;
    trap_active?: boolean;
  }) => void;
  title?: string;
}

export function ChannelConfigPanel({
  txChannels,
  rxChannels,
  onConfigure,
  title = "SHARED ARINC 429 CHANNELS (A, B, C, D)",
}: ChannelConfigPanelProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="pill-category">Coordinated Single Hardware Link</span>
      </div>

      <div className="panels" style={{ padding: 0, gap: "16px" }}>
        <div>
          <div className="channel-col-title">TRANSMITTER CHANNELS</div>
          <div style={{ display: "grid", gap: "8px" }}>
            {Object.entries(txChannels).map(([ch, state]) => (
              <div key={ch} className="channel-row">
                <strong>{ch}</strong>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() =>
                      onConfigure({
                        channel: ch,
                        speed: state.speed === "100k" ? "12.5k" : "100k",
                      })
                    }
                  >
                    {state.speed === "100k" ? "100 kbps" : "12.5 kbps"}
                  </button>
                  <button
                    type="button"
                    className={state.enabled ? "btn-sm primary" : "btn-sm"}
                    onClick={() =>
                      onConfigure({
                        channel: ch,
                        enabled: !state.enabled,
                      })
                    }
                  >
                    {state.enabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="channel-col-title">RECEIVER CHANNELS (TRAPS)</div>
          <div style={{ display: "grid", gap: "8px" }}>
            {Object.entries(rxChannels).map(([ch, state]) => (
              <div key={ch} className="channel-row">
                <strong>{ch}</strong>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() =>
                      onConfigure({
                        channel: ch,
                        speed: state.speed === "100k" ? "12.5k" : "100k",
                      })
                    }
                  >
                    {state.speed === "100k" ? "100 kbps" : "12.5 kbps"}
                  </button>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: "68px", padding: "4px 6px", fontFamily: "monospace" }}
                    maxLength={3}
                    placeholder="Label"
                    value={state.trap_label}
                    onChange={(e) =>
                      onConfigure({
                        channel: ch,
                        trap_label: e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    className={state.trap_active ? "btn-sm fault" : "btn-sm"}
                    onClick={() =>
                      onConfigure({
                        channel: ch,
                        trap_active: !state.trap_active,
                      })
                    }
                  >
                    {state.trap_active ? "TRAP *" : "TRAP OFF"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


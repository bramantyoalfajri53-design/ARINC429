import { useState } from "react";
import { arincApi } from "../../../shared";
import { standardApi } from "../services";

export type ArincTxSlot = {
  slot: number;
  label: string; // octal
  sdi: string;   // "00", "01", "10", "11"
  data: string;  // hex 6 chars
  ssm: "NO" | "NCD" | "FT" | "FW";
  parity: "ODD" | "EVEN";
  rate: number;  // ms
  enabled: boolean;
};

const INITIAL_TX_SLOTS: ArincTxSlot[] = [
  { slot: 1, label: "270", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: true },
  { slot: 2, label: "350", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: true },
  { slot: 3, label: "351", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: true },
  { slot: 4, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
  { slot: 5, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
  { slot: 6, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
  { slot: 7, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
  { slot: 8, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
  { slot: 9, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
  { slot: 10, label: "000", sdi: "00", data: "000000", ssm: "NO", parity: "ODD", rate: 100, enabled: false },
];

export const AVIONICS_LRU_PRESETS = [
  { id: "ADIRU", name: "Air Data Inertial Reference Unit", labels: ["203", "204", "205", "206", "210", "310", "311"] },
  { id: "FMC", name: "Flight Management Computer", labels: ["012", "013", "014", "115", "116", "117"] },
  { id: "ILS", name: "Instrument Landing System", labels: ["173", "174"] },
  { id: "VOR", name: "VHF Omnidirectional Range", labels: ["222"] },
  { id: "DME", name: "Distance Measuring Equipment", labels: ["201", "202"] },
  { id: "TCAS", name: "Traffic Collision Avoidance System", labels: ["015", "016", "270"] },
  { id: "RADALT", name: "Radar Altimeter", labels: ["164"] },
  { id: "EICAS", name: "Engine Indicating & Crew Alerting", labels: ["350", "351", "352"] },
];

export function ArincStandardMode() {
  const [selectedTx, setSelectedTx] = useState<"TX-A" | "TX-B" | "TX-C" | "TX-D">("TX-A");
  const [selectedRx, setSelectedRx] = useState<"RX-A" | "RX-B" | "RX-C" | "RX-D">("RX-A");
  const [displayFormat, setDisplayFormat] = useState<"ENG" | "BIN" | "HEX">("ENG");
  const [txStatusMsg, setTxStatusMsg] = useState<string>("");
  const [channels, setChannels] = useState({
    "TX-A": { speed: "100k" as const, enabled: true },
    "TX-B": { speed: "100k" as const, enabled: false },
    "TX-C": { speed: "12.5k" as const, enabled: true },
    "TX-D": { speed: "100k" as const, enabled: false },
    "RX-A": { speed: "100k" as const, trapLabel: "350", trapActive: true },
    "RX-B": { speed: "100k" as const, trapLabel: "", trapActive: false },
    "RX-C": { speed: "12.5k" as const, trapLabel: "", trapActive: false },
    "RX-D": { speed: "100k" as const, trapLabel: "", trapActive: false },
  });
  const [txSlots, setTxSlots] = useState<ArincTxSlot[]>(INITIAL_TX_SLOTS);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);

  const toggleChannel = (ch: "TX-A" | "TX-B" | "TX-C" | "TX-D") => {
    const nextEnabled = !channels[ch].enabled;
    setChannels((prev) => ({
      ...prev,
      [ch]: { ...prev[ch], enabled: nextEnabled },
    }));
    void arincApi.configureChannel({ channel: ch, enabled: nextEnabled }).catch(() => undefined);
  };

  const toggleSpeed = (ch: "TX-A" | "TX-B" | "TX-C" | "TX-D") => {
    const nextSpeed = channels[ch].speed === "100k" ? "12.5k" : "100k";
    setChannels((prev) => ({
      ...prev,
      [ch]: { ...prev[ch], speed: nextSpeed },
    }));
    void arincApi.configureChannel({ channel: ch, speed: nextSpeed }).catch(() => undefined);
  };

  const updateSlot = <K extends keyof ArincTxSlot>(idx: number, field: K, val: ArincTxSlot[K]) => {
    const updated = [...txSlots];
    const nextSlot = { ...updated[idx], [field]: val };
    updated[idx] = nextSlot;
    setTxSlots(updated);

    if (field === "enabled" && val === true) {
      void standardApi
        .transmitSlot({ channel: selectedTx, slot: nextSlot })
        .then((res) => setTxStatusMsg(`[${res.source}] TX Slot ${nextSlot.slot} (${res.label}) -> ${res.raw_hex}`))
        .catch(() => undefined);
    }
  };

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      {/* Overview Status Meters */}
      <div className="meters">
        <div className="meter">
          <div className="meter-label">Active Transmitter</div>
          <div className="meter-value" style={{ color: "var(--teal-primary)" }}>{selectedTx}</div>
          <div className="meter-unit">Rate: {channels[selectedTx].speed}</div>
        </div>
        <div className="meter">
          <div className="meter-label">Active Receiver</div>
          <div className="meter-value" style={{ color: "var(--ok)" }}>{selectedRx}</div>
          <div className="meter-unit">Trap: {channels[selectedRx].trapLabel || "NONE"}</div>
        </div>
        <div className="meter">
          <div className="meter-label">Display Mode</div>
          <div className="meter-value">{displayFormat}</div>
          <div className="meter-unit">Engineering / Bin / Hex</div>
        </div>
        <div className="meter">
          <div className="meter-label">Active TX Slots</div>
          <div className="meter-value">{txSlots.filter((s) => s.enabled).length} / 10</div>
          <div className="meter-unit">Buffers Configured</div>
        </div>
      </div>

      {txStatusMsg && <div className="alert-ok">{txStatusMsg}</div>}

      {/* Main Grid: Channels Configuration & Transmit Table */}
      <div className="panels">
        {/* Panel 1: Channels Configuration */}
        <section className="panel">
          <div className="panel-head">
            <h2>ARINC 429 CHANNELS CONFIGURATION (4 TX / 4 RX)</h2>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className={displayFormat === "ENG" ? "btn-sm primary" : "btn-sm"}
                onClick={() => setDisplayFormat("ENG")}
              >
                ENG
              </button>
              <button
                type="button"
                className={displayFormat === "BIN" ? "btn-sm primary" : "btn-sm"}
                onClick={() => setDisplayFormat("BIN")}
              >
                BIN
              </button>
              <button
                type="button"
                className={displayFormat === "HEX" ? "btn-sm primary" : "btn-sm"}
                onClick={() => setDisplayFormat("HEX")}
              >
                HEX
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* Transmitters */}
            <div>
              <div className="channel-col-title">TRANSMITTER CHANNELS</div>
              {(["TX-A", "TX-B", "TX-C", "TX-D"] as const).map((ch) => (
                <div
                  key={ch}
                  className="channel-row"
                  style={{
                    marginBottom: "6px",
                    borderColor: selectedTx === ch ? "var(--teal-primary)" : undefined,
                    backgroundColor: selectedTx === ch ? "var(--teal-bg)" : undefined,
                  }}
                >
                  <span
                    style={{
                      fontWeight: "bold",
                      cursor: "pointer",
                      color: selectedTx === ch ? "var(--teal-primary)" : "inherit",
                    }}
                    onClick={() => setSelectedTx(ch)}
                  >
                    {ch}
                  </span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button type="button" className="btn-sm" onClick={() => toggleSpeed(ch)}>
                      {channels[ch].speed}
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${channels[ch].enabled ? "primary" : ""}`}
                      onClick={() => toggleChannel(ch)}
                    >
                      {channels[ch].enabled ? "ENABLED" : "OFF"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Receivers */}
            <div>
              <div className="channel-col-title">RECEIVER CHANNELS (TRAPS)</div>
              {(["RX-A", "RX-B", "RX-C", "RX-D"] as const).map((ch) => (
                <div
                  key={ch}
                  className="channel-row"
                  style={{
                    marginBottom: "6px",
                    borderColor: selectedRx === ch ? "var(--ok)" : undefined,
                    backgroundColor: selectedRx === ch ? "var(--teal-bg)" : undefined,
                  }}
                >
                  <span
                    style={{
                      fontWeight: "bold",
                      cursor: "pointer",
                      color: selectedRx === ch ? "var(--teal-primary)" : "inherit",
                    }}
                    onClick={() => setSelectedRx(ch)}
                  >
                    {ch}
                  </span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span className="pill" style={{ fontSize: "10px" }}>{channels[ch].speed}</span>
                    <span className={channels[ch].trapActive ? "pill fault" : "pill"} style={{ fontSize: "10px" }}>
                      TRAP: {channels[ch].trapLabel || "OFF"} {channels[ch].trapActive ? "*" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Panel 2: 10 Transmit Buffer Slots */}
        <section className="panel">
          <div className="panel-head">
            <h2>TRANSMIT BUFFER TABLE &bull; {selectedTx}</h2>
            <span className="pill sim">10 WORD SLOTS</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SLOT</th>
                  <th>LABEL</th>
                  <th>SDI</th>
                  <th>DATA</th>
                  <th>SSM</th>
                  <th>PARITY</th>
                  <th>RATE</th>
                  <th>STATE</th>
                </tr>
              </thead>
              <tbody>
                {txSlots.map((slot, idx) => (
                  <tr
                    key={slot.slot}
                    style={{ background: activeSlotIdx === idx ? "var(--teal-bg)" : undefined }}
                    onClick={() => setActiveSlotIdx(idx)}
                  >
                    <td><strong>L{String(slot.slot).padStart(2, "0")}</strong></td>
                    <td>
                      <input
                        className="search-input"
                        style={{ width: "56px", padding: "3px 6px", color: "var(--teal-primary)", fontWeight: "bold", fontFamily: "monospace" }}
                        value={slot.label}
                        onChange={(e) => updateSlot(idx, "label", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="category-select"
                        style={{ padding: "3px 6px", fontSize: "11px" }}
                        value={slot.sdi}
                        onChange={(e) => updateSlot(idx, "sdi", e.target.value)}
                      >
                        <option value="00">00</option>
                        <option value="01">01</option>
                        <option value="10">10</option>
                        <option value="11">11</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="search-input"
                        style={{ width: "80px", padding: "3px 6px", fontFamily: "monospace" }}
                        value={slot.data}
                        onChange={(e) => updateSlot(idx, "data", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="category-select"
                        style={{ padding: "3px 6px", fontSize: "11px" }}
                        value={slot.ssm}
                        onChange={(e) => updateSlot(idx, "ssm", e.target.value as ArincTxSlot["ssm"])}
                      >
                        <option value="NO">NO</option>
                        <option value="NCD">NCD</option>
                        <option value="FT">FT</option>
                        <option value="FW">FW</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() => updateSlot(idx, "parity", slot.parity === "ODD" ? "EVEN" : "ODD")}
                      >
                        {slot.parity}
                      </button>
                    </td>
                    <td>{slot.rate}ms</td>
                    <td>
                      <button
                        type="button"
                        className={`btn-sm ${slot.enabled ? "primary" : ""}`}
                        onClick={() => updateSlot(idx, "enabled", !slot.enabled)}
                      >
                        {slot.enabled ? "TX" : "OFF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Avionics LRU Presets Quick Access */}
      <section className="panel">
        <div className="panel-head">
          <h2>AVIONICS LRU QUICK SELECTION</h2>
          <span className="section-sub">Standard ARINC 429 Avionics Equipment Presets</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px" }}>
          {AVIONICS_LRU_PRESETS.map((lru) => (
            <div
              key={lru.id}
              className="mode-card"
              style={{ minHeight: "82px", padding: "12px 14px" }}
              onClick={() => {
                const updated = [...txSlots];
                lru.labels.slice(0, 5).forEach((lbl, i) => {
                  if (updated[i]) {
                    updated[i].label = lbl;
                    updated[i].enabled = true;
                  }
                });
                setTxSlots(updated);
              }}
            >
              <div style={{ fontWeight: "bold", color: "var(--teal-primary)", fontSize: "13px" }}>{lru.id}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 4px" }}>{lru.name}</div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "monospace" }}>
                Labels: {lru.labels.join(", ")}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

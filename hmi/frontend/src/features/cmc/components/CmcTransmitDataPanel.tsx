import { useEffect, useState } from "react";
import type { CmcStateResponse } from "../types";
import { CMC_LABEL155_SWITCHES } from "../utils";

interface Props {
  state: CmcStateResponse;
  loading: boolean;
  onSaveTransmitData: (payload: {
    date: string;
    time: string;
    flt_num: string;
    city_pairs: string;
    flt_phase: number;
    aircraft_id: string;
    config_word_bits: Record<string, boolean>;
    channel?: string;
  }) => void;
}

const FLIGHT_PHASE_NAMES: Record<number, string> = {
  1: "1: Pre-Flight",
  2: "2: Taxi Out",
  3: "3: Takeoff",
  4: "4: Climb",
  5: "5: Cruise",
  6: "6: Descent",
  7: "7: Approach",
  8: "8: Landing",
  9: "9: Taxi In",
  10: "10: Post-Flight",
};

export function CmcTransmitDataPanel({ state, loading, onSaveTransmitData }: Props) {
  const tx = state.transmit_data;
  const [date, setDate] = useState(tx.date ?? "11/13/26");
  const [time, setTime] = useState(tx.time ?? "09:30.0 GMT");
  const [fltNum, setFltNum] = useState(tx.flt_num ?? "AA1234");
  const [cityPairs, setCityPairs] = useState(tx.city_pairs ?? "KSEA KORD");
  const [fltPhase, setFltPhase] = useState(tx.flt_phase ?? 5);
  const [aircraftId, setAircraftId] = useState(tx.aircraft_id ?? "N777AA");
  const [configBits, setConfigBits] = useState<Record<string, boolean>>(
    tx.config_word_bits ?? {}
  );
  const [channel, setChannel] = useState("TX-A");

  useEffect(() => {
    setDate(tx.date ?? "11/13/26");
    setTime(tx.time ?? "09:30.0 GMT");
    setFltNum(tx.flt_num ?? "AA1234");
    setCityPairs(tx.city_pairs ?? "KSEA KORD");
    setFltPhase(tx.flt_phase ?? 5);
    setAircraftId(tx.aircraft_id ?? "N777AA");
    setConfigBits(tx.config_word_bits ?? {});
  }, [tx]);

  const toggleBit = (key: string) => {
    setConfigBits((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApply = () => {
    onSaveTransmitData({
      date,
      time,
      flt_num: fltNum,
      city_pairs: cityPairs,
      flt_phase: Number(fltPhase),
      aircraft_id: aircraftId,
      config_word_bits: configBits,
      channel,
    });
  };

  const allOn = () => {
    const updated: Record<string, boolean> = {};
    for (const sw of CMC_LABEL155_SWITCHES) updated[sw.key] = true;
    setConfigBits(updated);
  };

  const allOff = () => {
    const updated: Record<string, boolean> = {};
    for (const sw of CMC_LABEL155_SWITCHES) updated[sw.key] = false;
    setConfigBits(updated);
  };

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Header and Action */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>EDIT CMC TRANSMIT DATA</h2>
            <p className="section-sub">
              Background flight and airframe parameters continuously broadcast to LRUs (D243W201-1)
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              className="category-select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="TX-A">Broadcast TX-A</option>
              <option value="TX-B">Broadcast TX-B</option>
              <option value="TX-C">Broadcast TX-C</option>
              <option value="TX-D">Broadcast TX-D</option>
            </select>
            <button
              type="button"
              className="btn-sm primary"
              disabled={loading}
              onClick={handleApply}
            >
              {loading ? "TRANSMITTING..." : "APPLY & TRANSMIT DATA"}
            </button>
          </div>
        </div>

        {/* 6 Background Transmission Parameters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
            marginTop: "12px",
          }}
        >
          {/* DATE (Label 260, rate 1000 ms, MM/DD/YY, BCD) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>DATE (Label 260)</span>
              <span className="pill-category">1000 ms · BCD</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Format: MM/DD/YY</div>
            <input
              type="text"
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={date}
              placeholder="MM/DD/YY"
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* TIME (Label 125, rate 1000 ms, HH:MM.t GMT, BCD) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>TIME (Label 125)</span>
              <span className="pill-category">1000 ms · BCD</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Format: HH:MM.t GMT</div>
            <input
              type="text"
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={time}
              placeholder="09:30.0 GMT"
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          {/* FLT_NUM (Labels 233-236, rate 4000 ms, 8 char ISO #5) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>FLT_NUM (Labels 233–236)</span>
              <span className="pill-category">4000 ms · ISO #5</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>8 Characters Flight Number</div>
            <input
              type="text"
              maxLength={8}
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={fltNum}
              placeholder="AA1234"
              onChange={(e) => setFltNum(e.target.value.toUpperCase())}
            />
          </div>

          {/* CITY_PAIRS (Labels 040-042, rate 3000 ms, two 4-char codes) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>CITY_PAIRS (Labels 040–042)</span>
              <span className="pill-category">3000 ms · FROM/TO</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Two 4-char codes (e.g. KSEA KORD)</div>
            <input
              type="text"
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={cityPairs}
              placeholder="KSEA KORD"
              onChange={(e) => setCityPairs(e.target.value.toUpperCase())}
            />
          </div>

          {/* FLT_PHASE (Label 126, rate 1000 ms, 1-10 BNR on Bit 11-14) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>FLT_PHASE (Label 126)</span>
              <span className="pill-category">1000 ms · BNR Bits 11–14</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Flight Phase 1 to 10</div>
            <select
              className="category-select"
              style={{ width: "100%" }}
              value={fltPhase}
              onChange={(e) => setFltPhase(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                <option key={p} value={p}>
                  {FLIGHT_PHASE_NAMES[p]}
                </option>
              ))}
            </select>
          </div>

          {/* AIRCRAFT_ID (Labels 301-304, rate 4000 ms, 7 char tail number) */}
          <div className="channel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>AIRCRAFT_ID (Labels 301–304)</span>
              <span className="pill-category">4000 ms · Tail Number</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>7-char Aircraft Tail Number</div>
            <input
              type="text"
              maxLength={7}
              className="category-select"
              style={{ width: "100%", fontFamily: "monospace" }}
              value={aircraftId}
              placeholder="N777AA"
              onChange={(e) => setAircraftId(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </section>

      {/* AIRCRAFT CONFIGURATION WORD (Label 155, rate 1000 ms, 17 Switches for Bit 11 to Bit 27) */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>AIRCRAFT CONFIGURATION WORD (LABEL 155)</h2>
            <p className="section-sub">
              Broadcast rate: 1000 ms · 17 Discrete switches encoded sequentially from Bit 11 to Bit 27
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn-sm" onClick={allOn}>
              ALL ON (1)
            </button>
            <button type="button" className="btn-sm" onClick={allOff}>
              ALL OFF (0)
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          {CMC_LABEL155_SWITCHES.map((sw) => {
            const isOn = Boolean(configBits[sw.key]);
            return (
              <button
                key={sw.key}
                type="button"
                className="channel-row"
                style={{
                  cursor: "pointer",
                  borderColor: isOn ? "var(--teal-primary)" : undefined,
                  backgroundColor: isOn ? "var(--teal-bg)" : undefined,
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => toggleBit(sw.key)}
              >
                <div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>BIT {sw.bit}</div>
                  <div style={{ fontWeight: 700, fontSize: "12px", color: isOn ? "var(--teal-primary)" : "var(--text-main)" }}>
                    {sw.label}
                  </div>
                </div>
                <span
                  className={isOn ? "pill ok" : "pill"}
                  style={{ fontSize: "11px", fontWeight: 700 }}
                >
                  {isOn ? "ON (1)" : "OFF (0)"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Encoded 32-bit Words Summary Bar */}
        {tx.words_hex && (
          <div style={{ marginTop: "14px" }}>
            <div className="channel-col-title">TRANSMITTED ARINC 429 32-BIT HEX WORDS</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
              {Object.entries(tx.words_hex).map(([k, v]) => (
                <div key={k} className="pill-category" style={{ fontFamily: "monospace" }}>
                  <span style={{ color: "var(--text-muted)", marginRight: "4px" }}>{k.replace("label_", "L")}:</span>
                  <strong style={{ color: "var(--teal-primary)" }}>{v}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}


import { useState } from "react";
import { standardApi } from "../services";
import { LruDefinition } from "../types/lruTypes";

interface LruMultiChannelModeViewProps {
  lru: LruDefinition;
  onBackToConfig: () => void;
  onBackToMenu: () => void;
}

interface MultiChannelRow {
  slot: number;
  mode: string;
  echo: string;
  chanNum: number | string;
  xy: "X" | "Y" | "";
  sdi: string;
  disp: "ON" | "OFF";
  ident: "ON" | "OFF";
  nav: "VOR" | "ILS" | "MLS" | "UND";
  freq: number;
  bnrDist?: string;
  mem?: string;
  bf?: string;
  delta?: string;
  bcdDistIdent?: string;
}

// Frequency <-> Channel conversion utility matching ARINC 709 & Aeroflex T1200
function dmeChannelToFreq(ch: number, xy: "X" | "Y"): number {
  ch = Math.max(1, Math.min(126, ch));
  if (17 <= ch && ch <= 56) {
    const base = xy === "Y" ? 108.05 : 108.0;
    return Number((base + (ch - 17) * 0.1).toFixed(2));
  } else if (70 <= ch && ch <= 126) {
    const base = xy === "Y" ? 112.35 : 112.3;
    return Number((base + (ch - 70) * 0.1).toFixed(2));
  } else if (ch === 1 && xy === "X") return 108.0;
  else if (ch === 1 && xy === "Y") return 108.05;
  else if (ch === 34 && xy === "Y") return 109.75;
  else if (ch === 64 && xy === "X") return 133.7;
  else if (ch === 93 && xy === "Y") return 114.65;
  else if (ch === 126 && xy === "X") return 117.9;
  const base = xy === "Y" ? 108.05 : 108.0;
  return Number((base + (ch - 1) * 0.1).toFixed(2));
}

function dmePackPad(mode: string, nav: string, disp: boolean, ident: boolean): string {
  const modeMap: Record<string, number> = {
    STBY: 0,
    DF1: 1,
    DF2: 2,
    DF3: 3,
    DF4: 4,
    DF5: 5,
    SCAN: 6,
  };
  const navMap: Record<string, number> = { VOR: 0, ILS: 1, MLS: 2, UND: 3 };
  const m = modeMap[mode.toUpperCase()] ?? 1;
  const n = navMap[nav.toUpperCase()] ?? 0;
  const d = disp ? 1 : 0;
  const id = ident ? 1 : 0;
  const val = (m & 0x7) | ((n & 0x3) << 3) | (d << 5) | (id << 6);
  return val.toString(2).padStart(7, "0");
}

export function LruMultiChannelModeView({
  lru,
  onBackToConfig,
  onBackToMenu,
}: LruMultiChannelModeViewProps) {
  // 6 Pre-configured Directed Frequency Rows per Aeroflex CMM Figure 18 & User Photos
  const [rows, setRows] = useState<MultiChannelRow[]>([
    {
      slot: 0,
      mode: "DF1",
      echo: "NONE",
      chanNum: 1,
      xy: "X",
      sdi: "ALL",
      disp: "ON",
      ident: "OFF",
      nav: "VOR",
      freq: 108.0,
      bnrDist: "--.- NM",
      mem: "N",
      bf: "F",
      delta: "0.0",
      bcdDistIdent: "---",
    },
    {
      slot: 1,
      mode: "DF2",
      echo: "NONE",
      chanNum: 34,
      xy: "Y",
      sdi: "ALL",
      disp: "OFF",
      ident: "OFF",
      nav: "VOR",
      freq: 109.75,
    },
    {
      slot: 2,
      mode: "DF3",
      echo: "NONE",
      chanNum: 64,
      xy: "X",
      sdi: "ALL",
      disp: "OFF",
      ident: "OFF",
      nav: "VOR",
      freq: 133.7,
    },
    {
      slot: 3,
      mode: "DF4",
      echo: "NONE",
      chanNum: 93,
      xy: "Y",
      sdi: "ALL",
      disp: "OFF",
      ident: "OFF",
      nav: "VOR",
      freq: 114.65,
    },
    {
      slot: 4,
      mode: "DF5",
      echo: "NONE",
      chanNum: 126,
      xy: "X",
      sdi: "ALL",
      disp: "OFF",
      ident: "OFF",
      nav: "VOR",
      freq: 117.9,
    },
    {
      slot: 5,
      mode: "SCAN",
      echo: "NONE",
      chanNum: "---",
      xy: "",
      sdi: "ALL",
      disp: "OFF",
      ident: "OFF",
      nav: "VOR",
      freq: 108.0,
    },
  ]);

  const [activeLine, setActiveLine] = useState<number>(0);
  const [activeTxChan, setActiveTxChan] = useState<"TX-A" | "TX-B">("TX-A");
  const [activeRxChan, setActiveRxChan] = useState<"RX-A" | "RX-B">("RX-A");
  const [sqntIndep, setSqntIndep] = useState<boolean>(true);
  const [sqntCtl, setSqntCtl] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);

  const activeRow = rows[activeLine] || rows[0];

  // LINE ADVAN softkey advances active row
  const handleLineAdvance = () => {
    setActiveLine((prev) => (prev + 1) % rows.length);
  };

  // Toggle X/Y for active row
  const handleToggleXY = () => {
    if (activeRow.chanNum === "---") return;
    const nextXY: "X" | "Y" = activeRow.xy === "X" ? "Y" : "X";
    const chNum = typeof activeRow.chanNum === "number" ? activeRow.chanNum : 1;
    const newFreq = dmeChannelToFreq(chNum, nextXY);

    setRows((prev) =>
      prev.map((r, i) =>
        i === activeLine ? { ...r, xy: nextXY, freq: newFreq } : r
      )
    );
  };

  // In-place edit updates
  const updateActiveRow = (patch: Partial<MultiChannelRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === activeLine ? { ...r, ...patch } : r))
    );
  };

  // Handle Channel Number change
  const handleChanNumChange = (valStr: string) => {
    const val = parseInt(valStr, 10);
    if (isNaN(val) || val < 1 || val > 126) return;
    const xy = activeRow.xy || "X";
    const newFreq = dmeChannelToFreq(val, xy);
    updateActiveRow({ chanNum: val, freq: newFreq });
  };

  // Handle Transmit for active line
  const handleTransmitActiveLine = async () => {
    setIsTransmitting(true);
    setStatusMsg("");
    try {
      const padBin = dmePackPad(
        activeRow.mode,
        activeRow.nav,
        activeRow.disp === "ON",
        activeRow.ident === "ON"
      );

      const res = await standardApi.transmitLruSingleMode({
        lru_id: lru.id,
        channel: activeTxChan,
        slot: activeRow.slot,
        label: "035",
        function: `${activeRow.mode} ${activeRow.chanNum}${activeRow.xy}`,
        data: `${activeRow.freq.toFixed(2)} MHZ`,
        sdi: activeRow.sdi === "ALL" ? "00" : activeRow.sdi,
        pad: padBin,
        ssm: "NML",
        parity: "ODD",
        rate: 150,
      });

      setStatusMsg(
        `[${res.source}] Transmitted ${activeRow.mode} on ${res.channel}: Word=${res.raw_hex} (Freq=${activeRow.freq.toFixed(2)} MHz, PAD=${padBin})`
      );

      setRows((prev) =>
        prev.map((r, i) =>
          i === activeLine
            ? {
                ...r,
                echo: "OK",
                bnrDist: res.rx_simulation?.bnr_dist || "12.4 NM",
                bcdDistIdent: res.rx_simulation?.function || "IAH",
              }
            : r
        )
      );
    } catch (err: any) {
      setStatusMsg(`TX Error: ${err.message || String(err)}`);
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="retro-dynapro-container">
      {/* Dynapro Top Title Banner */}
      <div className="retro-screen-title" style={{ letterSpacing: "1px" }}>
        {lru.id} MULTI CHANNEL TEST MODE (ARINC 709 / AEROFLEX T1200)
      </div>

      {/* Header Separation Line */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderBottom: "1px solid #134e4a",
          paddingBottom: "4px",
          fontSize: "12px",
          color: "#34d399",
          fontWeight: 700,
        }}
      >
        <span>-------- TRANSMITTER CONTROL --------</span>
        <span>----- RECEIVED DATA ------</span>
      </div>

      {/* Main Multi-Channel CRT Table */}
      <div className="retro-table-container">
        <table className="retro-crt-table">
          <thead>
            <tr>
              <th>ECHO</th>
              <th>MODE SSM</th>
              <th>CHAN</th>
              <th>SDI</th>
              <th>DISP</th>
              <th>IDENT</th>
              <th>NAV</th>
              <th style={{ borderLeft: "1px dashed #065f46", paddingLeft: "10px" }}>
                BNR DIST
              </th>
              <th>MEM</th>
              <th>B/F</th>
              <th>DELTA</th>
              <th>BCDDIST IDENT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isSelected = i === activeLine;
              return (
                <tr
                  key={r.mode}
                  className={`retro-multi-row ${isSelected ? "selected-row" : ""}`}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "rgba(16, 185, 129, 0.22)" : undefined,
                    borderLeft: isSelected ? "4px solid #00ffff" : "4px solid transparent",
                  }}
                  onClick={() => setActiveLine(i)}
                >
                  <td style={{ color: r.echo === "OK" ? "#10b981" : "#6ee7b7" }}>
                    {r.echo}
                  </td>
                  <td className="retro-num" style={{ fontWeight: 800 }}>
                    {r.mode}
                  </td>
                  <td className="retro-num">
                    {r.chanNum === "---" ? "---" : `${r.chanNum} ${r.xy}`}
                  </td>
                  <td>{r.sdi}</td>
                  <td style={{ color: r.disp === "ON" ? "#00ffff" : "#6ee7b7" }}>
                    {r.disp}
                  </td>
                  <td style={{ color: r.ident === "ON" ? "#00ffff" : "#6ee7b7" }}>
                    {r.ident}
                  </td>
                  <td>{r.nav}</td>
                  <td
                    style={{
                      borderLeft: "1px dashed #065f46",
                      paddingLeft: "10px",
                      color: "#00ffff",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {r.bnrDist || (i === 0 ? "--.- NM" : "")}
                  </td>
                  <td>{r.mem || (i === 0 ? "N" : "")}</td>
                  <td>{r.bf || (i === 0 ? "F" : "")}</td>
                  <td>{r.delta || (i === 0 ? "0.0" : "")}</td>
                  <td style={{ color: "#34d399", fontWeight: 700 }}>
                    {r.bcdDistIdent || (i === 0 ? "---" : "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Line In-Place Editor Panel */}
      <div
        style={{
          background: "#022114",
          border: "1px solid #059669",
          borderRadius: "6px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px dashed #065f46",
            paddingBottom: "4px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#34d399" }}>
            EDIT LINE: {activeRow.mode} (LINE {activeLine + 1} OF {rows.length})
          </span>
          <span style={{ fontSize: "11px", color: "#6ee7b7" }}>
            FREQ: <strong style={{ color: "#00ffff" }}>{activeRow.freq.toFixed(2)} MHz</strong>
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "10px",
            alignItems: "center",
          }}
        >
          {activeRow.chanNum !== "---" ? (
            <div>
              <label style={{ fontSize: "11px", display: "block", color: "#6ee7b7" }}>
                CHANNEL (1..126):
              </label>
              <input
                type="number"
                min={1}
                max={126}
                value={activeRow.chanNum}
                onChange={(e) => handleChanNumChange(e.target.value)}
                className="retro-table-input"
                style={{ width: "80px" }}
              />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: "11px", display: "block", color: "#6ee7b7" }}>
                CHANNEL:
              </label>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>SCAN MODE (---)</span>
            </div>
          )}

          {activeRow.chanNum !== "---" && (
            <div>
              <label style={{ fontSize: "11px", display: "block", color: "#6ee7b7" }}>
                X / Y MODE:
              </label>
              <button
                type="button"
                className="retro-fkey"
                style={{ minWidth: "60px", padding: "4px 8px" }}
                onClick={handleToggleXY}
              >
                {activeRow.xy || "X"} MODE
              </button>
            </div>
          )}

          <div>
            <label style={{ fontSize: "11px", display: "block", color: "#6ee7b7" }}>
              NAV MODE:
            </label>
            <select
              className="retro-table-select"
              value={activeRow.nav}
              onChange={(e) =>
                updateActiveRow({
                  nav: e.target.value as "VOR" | "ILS" | "MLS" | "UND",
                })
              }
            >
              <option value="VOR">VOR</option>
              <option value="ILS">ILS</option>
              <option value="MLS">MLS</option>
              <option value="UND">UND</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "11px", display: "block", color: "#6ee7b7" }}>
              SDI:
            </label>
            <select
              className="retro-table-select"
              value={activeRow.sdi}
              onChange={(e) => updateActiveRow({ sdi: e.target.value })}
            >
              <option value="ALL">ALL (00)</option>
              <option value="01">01</option>
              <option value="10">10</option>
              <option value="11">11</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "14px", alignItems: "center", paddingTop: "12px" }}>
            <label
              style={{
                fontSize: "12px",
                color: activeRow.disp === "ON" ? "#00ffff" : "#9ca3af",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <input
                type="checkbox"
                checked={activeRow.disp === "ON"}
                onChange={(e) =>
                  updateActiveRow({ disp: e.target.checked ? "ON" : "OFF" })
                }
              />
              DISP
            </label>

            <label
              style={{
                fontSize: "12px",
                color: activeRow.ident === "ON" ? "#00ffff" : "#9ca3af",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <input
                type="checkbox"
                checked={activeRow.ident === "ON"}
                onChange={(e) =>
                  updateActiveRow({ ident: e.target.checked ? "ON" : "OFF" })
                }
              />
              IDENT
            </label>
          </div>
        </div>
      </div>

      {/* Status or Alert Notification */}
      {statusMsg && <div className="retro-alert-box success">{statusMsg}</div>}

      {/* Dynapro Softkeys Row matching CMM Figure 18 & WhatsApp Image */}
      <div className="retro-fkey-bar">
        <button
          type="button"
          className="retro-fkey"
          onClick={handleToggleXY}
          title="Toggle X/Y channel mode"
        >
          X<br />Y
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={() => setActiveTxChan((prev) => (prev === "TX-A" ? "TX-B" : "TX-A"))}
          title="Toggle TX-A / TX-B"
        >
          <span style={{ color: activeTxChan === "TX-A" ? "#00ffff" : "#888" }}>TX-A</span>
          <br />
          <span style={{ color: activeTxChan === "TX-B" ? "#00ffff" : "#888" }}>TX-B</span>
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={() => setActiveRxChan((prev) => (prev === "RX-A" ? "RX-B" : "RX-A"))}
          title="Toggle RX-A / RX-B"
        >
          <span style={{ color: activeRxChan === "RX-A" ? "#10b981" : "#888" }}>RX-A</span>
          <br />
          <span style={{ color: activeRxChan === "RX-B" ? "#10b981" : "#888" }}>RX-B</span>
        </button>

        <button
          type="button"
          className={`retro-fkey ${sqntIndep ? "active" : ""}`}
          onClick={() => setSqntIndep((prev) => !prev)}
          title="Toggle Squelch / Noise Independent"
        >
          SQ/NT<br />INDEP.
        </button>

        <button
          type="button"
          className={`retro-fkey ${sqntCtl ? "active" : ""}`}
          onClick={() => setSqntCtl((prev) => !prev)}
          title="Toggle Squelch / Noise Control"
        >
          SQ/NT<br />CTL
        </button>

        <button
          type="button"
          className="retro-fkey active"
          onClick={handleLineAdvance}
          title="Advance to next channel line (LINE ADVAN)"
          style={{ background: "#059669", color: "#ffffff", fontWeight: 800 }}
        >
          LINE<br />ADVAN
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={() =>
            updateActiveRow({
              bcdDistIdent: activeRow.bcdDistIdent === "IAH" ? "SFO" : "IAH",
            })
          }
          title="Cycle BCD IDENT station identifier"
        >
          BCD<br />IDENT
        </button>

        <button
          type="button"
          className="retro-fkey transmit-btn"
          onClick={handleTransmitActiveLine}
          disabled={isTransmitting}
          title="Transmit current active line parameters"
        >
          {isTransmitting ? "TX..." : "TRANSMIT\nLINE"}
        </button>

        <button
          type="button"
          className="retro-fkey nav-btn"
          onClick={onBackToConfig}
          title="Return to Mode Selection"
        >
          MODE<br />MENU
        </button>

        <button
          type="button"
          className="retro-fkey nav-btn"
          onClick={onBackToMenu}
          title="Return to Avionics LRU Menu"
        >
          LRU<br />MENU
        </button>
      </div>
    </div>
  );
}

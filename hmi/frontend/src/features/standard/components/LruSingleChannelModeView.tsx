import { useState } from "react";
import { standardApi } from "../services";
import { LruDefinition, LruRxWordData, LruTxSlotData } from "../types/lruTypes";

interface LruSingleChannelModeViewProps {
  lru: LruDefinition;
  onBackToConfig: () => void;
  onBackToMenu: () => void;
}

export function LruSingleChannelModeView({
  lru,
  onBackToConfig,
  onBackToMenu,
}: LruSingleChannelModeViewProps) {
  // Transmit slot configuration
  const [txData, setTxData] = useState<LruTxSlotData>(() => ({
    ...lru.tx_template,
  }));

  // Received word status
  const [rxData, setRxData] = useState<LruRxWordData>(() => ({
    ...lru.rx_template,
  }));

  // Active Channel selections
  const [activeTxChan, setActiveTxChan] = useState<"TX-A" | "TX-B">("TX-A");
  const [activeRxChan, setActiveRxChan] = useState<"RX-A" | "RX-B">("RX-A");
  const [bitRate, setBitRate] = useState<string>("12.5 KBPS");

  // Status & communication responses
  const [txStatusMsg, setTxStatusMsg] = useState<string>("");
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);

  // Field cursor / step tracking (Retro Dynapro F-Key navigation)
  const [activeField, setActiveField] = useState<string>("pad");
  const [stepDirection, setStepDirection] = useState<"INC" | "DECR">("INC");
  const [validationError, setValidationError] = useState<string>("");

  const isDme = lru.id === "DME";

  // Cycle Bit Rate (12.5 KBPS <-> 100 KBPS)
  const handleToggleBitRate = () => {
    setBitRate((prev) => (prev === "12.5 KBPS" ? "100 KBPS" : "12.5 KBPS"));
  };

  // Toggle TX channel (TX-A <-> TX-B)
  const handleToggleTxChan = () => {
    const nextTx = activeTxChan === "TX-A" ? "TX-B" : "TX-A";
    setActiveTxChan(nextTx);
    setTxData((prev) => ({ ...prev, channel: nextTx }));
  };

  // Toggle RX channel (RX-A <-> RX-B)
  const handleToggleRxChan = () => {
    const nextRx = activeRxChan === "RX-A" ? "RX-B" : "RX-A";
    setActiveRxChan(nextRx);
    setRxData((prev) => ({ ...prev, channel: nextRx }));
  };

  // Handle Field Edit with Validation
  const handleFieldChange = (fieldId: string, value: string) => {
    setValidationError("");
    if (fieldId === "pad") {
      // Validate binary string
      if (!/^[01]*$/.test(value)) {
        setValidationError("PAD must only contain binary digits (0 or 1)");
        return;
      }
      setTxData((prev) => ({ ...prev, pad: value }));
    } else if (fieldId === "data") {
      setTxData((prev) => ({ ...prev, data: value }));
    } else if (fieldId === "sdi") {
      setTxData((prev) => ({ ...prev, sdi: value }));
    } else if (fieldId === "ssm") {
      setTxData((prev) => ({ ...prev, ssm: value }));
    } else if (fieldId === "parity") {
      setTxData((prev) => ({ ...prev, parity: value as "ODD" | "EVEN" }));
    } else if (fieldId === "rate") {
      const num = parseInt(value, 10);
      setTxData((prev) => ({ ...prev, rate: isNaN(num) ? 100 : num }));
    }
  };

  // F-Key: DATA STEP (increment / decrement active field based on INC/DECR mode)
  const handleDataStep = () => {
    if (activeField === "data") {
      const match = txData.data.match(/(\d+(\.\d+)?)/);
      if (match) {
        const curNum = parseFloat(match[1]);
        const step = isDme ? 0.05 : 0.1;
        const newNum = stepDirection === "INC" ? curNum + step : Math.max(0, curNum - step);
        const unit = txData.data.replace(match[1], "").trim();
        const updated = `${newNum.toFixed(2)} ${unit}`.trim();
        setTxData((prev) => ({ ...prev, data: updated }));
      }
    } else if (activeField === "pad") {
      // Step through binary value of PAD
      const intVal = parseInt(txData.pad || "0", 2);
      const nextVal = stepDirection === "INC" ? intVal + 1 : Math.max(0, intVal - 1);
      const padLen = txData.pad.length || 7;
      const binStr = (nextVal % Math.pow(2, padLen)).toString(2).padStart(padLen, "0");
      setTxData((prev) => ({ ...prev, pad: binStr }));
    } else if (activeField === "ssm") {
      const ssmList = ["NML", "NO", "NCD", "FT", "FW"];
      const idx = ssmList.indexOf(txData.ssm);
      const nextIdx =
        stepDirection === "INC"
          ? (idx + 1) % ssmList.length
          : (idx - 1 + ssmList.length) % ssmList.length;
      setTxData((prev) => ({ ...prev, ssm: ssmList[nextIdx] }));
    } else if (activeField === "parity") {
      setTxData((prev) => ({ ...prev, parity: prev.parity === "ODD" ? "EVEN" : "ODD" }));
    }
  };

  // F-Key: INC / DECR toggle
  const handleToggleIncDecr = () => {
    setStepDirection((prev) => (prev === "INC" ? "DECR" : "INC"));
  };

  // F-Key: DISP CURSOR (cycle cursor focus among fields)
  const handleDispCursor = () => {
    const fieldsOrder = ["pad", "data", "sdi", "ssm", "parity", "rate"];
    const curIdx = fieldsOrder.indexOf(activeField);
    const nextIdx = (curIdx + 1) % fieldsOrder.length;
    setActiveField(fieldsOrder[nextIdx]);
  };

  // Send configured word to backend / ARINC 429 coordinator
  const handleTransmit = async () => {
    setIsTransmitting(true);
    setValidationError("");
    try {
      const res = await standardApi.transmitLruSingleMode({
        lru_id: lru.id,
        channel: activeTxChan,
        slot: txData.slot || 0,
        label: txData.label,
        function: txData.function,
        data: txData.data,
        sdi: txData.sdi,
        pad: txData.pad,
        ssm: txData.ssm,
        parity: txData.parity,
        rate: txData.rate,
      });

      setTxStatusMsg(
        `[${res.source}] Transmitted ${lru.id} (${res.function}) on ${res.channel}: Word=${res.raw_hex} (Payload=${res.payload_19})`
      );

      if (res.rx_simulation) {
        setRxData(res.rx_simulation);
      }
    } catch (err: any) {
      setValidationError(`Transmission error: ${err.message || String(err)}`);
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="retro-dynapro-container">
      {/* Top Header / Channel Word Summary */}
      <div className="retro-header-grid">
        <div className="retro-header-box">
          <div className="retro-header-title">
            CHANNEL A -- TRANSMITTED WORDS --
          </div>
          <div className="retro-header-sub">
            <span>{txData.function || `${lru.name} FREQ`}</span>
            <div className="retro-slot-badge">
              SLOT <span className="retro-slot-num">{txData.slot}</span>
            </div>
          </div>
        </div>

        <div className="retro-header-box">
          <div className="retro-header-title">
            CHANNEL A -- RECEIVED WORDS --
          </div>
          <div className="retro-header-sub">
            <span>{rxData.function || "RECEIVED WORDS"}</span>
            <div className="retro-slot-badge" style={{ borderColor: "#10b981", color: "#10b981" }}>
              ACTIVE
            </div>
          </div>
        </div>
      </div>

      {/* Main Single Channel Table Display */}
      <div className="retro-table-container">
        <table className="retro-crt-table">
          <thead>
            <tr>
              <th>CHAN</th>
              <th>FUNCT</th>
              <th>LABEL</th>
              <th>DATA</th>
              <th>SDI</th>
              <th>PAD</th>
              <th>SSM</th>
              <th>PAR</th>
              <th>RATE(ms)</th>
            </tr>
          </thead>
          <tbody>
            {/* Transmit Row */}
            <tr className="retro-tx-row">
              <td>
                <span className="retro-chan-pill tx">{activeTxChan}</span>
              </td>
              <td>{txData.function}</td>
              <td className="retro-num">{txData.label}</td>
              <td className={`retro-editable ${activeField === "data" ? "cursor-active" : ""}`}>
                <input
                  type="text"
                  className="retro-table-input"
                  value={txData.data}
                  onFocus={() => setActiveField("data")}
                  onChange={(e) => handleFieldChange("data", e.target.value)}
                />
              </td>
              <td className={`retro-editable ${activeField === "sdi" ? "cursor-active" : ""}`}>
                <select
                  className="retro-table-select"
                  value={txData.sdi}
                  onFocus={() => setActiveField("sdi")}
                  onChange={(e) => handleFieldChange("sdi", e.target.value)}
                >
                  <option value="00">00</option>
                  <option value="01">01</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                </select>
              </td>
              <td className={`retro-editable ${activeField === "pad" ? "cursor-active" : ""}`}>
                <input
                  type="text"
                  className="retro-table-input"
                  style={{ width: "85px", letterSpacing: "1px" }}
                  value={txData.pad}
                  onFocus={() => setActiveField("pad")}
                  onChange={(e) => handleFieldChange("pad", e.target.value)}
                />
              </td>
              <td className={`retro-editable ${activeField === "ssm" ? "cursor-active" : ""}`}>
                <select
                  className="retro-table-select"
                  value={txData.ssm}
                  onFocus={() => setActiveField("ssm")}
                  onChange={(e) => handleFieldChange("ssm", e.target.value)}
                >
                  <option value="NML">NML</option>
                  <option value="NO">NO</option>
                  <option value="NCD">NCD</option>
                  <option value="FT">FT</option>
                  <option value="FW">FW</option>
                </select>
              </td>
              <td className={`retro-editable ${activeField === "parity" ? "cursor-active" : ""}`}>
                <span
                  className="retro-clickable-cell"
                  onClick={() => {
                    setActiveField("parity");
                    handleFieldChange("parity", txData.parity === "ODD" ? "EVEN" : "ODD");
                  }}
                >
                  {txData.parity}
                </span>
              </td>
              <td className={`retro-editable ${activeField === "rate" ? "cursor-active" : ""}`}>
                <input
                  type="number"
                  className="retro-table-input"
                  style={{ width: "55px" }}
                  value={txData.rate}
                  onFocus={() => setActiveField("rate")}
                  onChange={(e) => handleFieldChange("rate", e.target.value)}
                />
              </td>
            </tr>

            {/* Receive Row */}
            <tr className="retro-rx-row">
              <td>
                <span className="retro-chan-pill rx">{activeRxChan}</span>
              </td>
              <td>{rxData.function}</td>
              <td className="retro-num">{rxData.label}</td>
              <td className="retro-num">{rxData.data}</td>
              <td>{rxData.sdi}</td>
              <td style={{ letterSpacing: "1px" }}>{rxData.pad}</td>
              <td>{rxData.ssm}</td>
              <td>{rxData.parity}</td>
              <td>{rxData.rate}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DME Specific Monitor Telemetry Panel if LRU is DME */}
      {isDme && (
        <div className="retro-dme-telemetry">
          <div className="retro-telem-item">
            <span className="telem-label">BNR DIST:</span>
            <span className="telem-val">{rxData.bnr_dist || "--.-- NM"}</span>
          </div>
          <div className="retro-telem-item">
            <span className="telem-label">BCD DIST:</span>
            <span className="telem-val">{rxData.bcd_dist || "--.-- NM"}</span>
          </div>
          <div className="retro-telem-item">
            <span className="telem-label">SPEED:</span>
            <span className="telem-val">{rxData.speed_kts || "0 KTS"}</span>
          </div>
          <div className="retro-telem-item">
            <span className="telem-label">REPLY EFF:</span>
            <span className="telem-val">{rxData.reply_eff || "70%"}</span>
          </div>
          <div className="retro-telem-item">
            <span className="telem-label">RF LEVEL:</span>
            <span className="telem-val">{rxData.rf_level || "-00 dBM"}</span>
          </div>
        </div>
      )}

      {/* Validation or Status Alert */}
      {validationError && (
        <div className="retro-alert-box error">{validationError}</div>
      )}
      {txStatusMsg && (
        <div className="retro-alert-box success">{txStatusMsg}</div>
      )}

      {/* Bottom CRT F-Keys / Touch Bar */}
      <div className="retro-fkey-bar">
        <button
          type="button"
          className="retro-fkey"
          onClick={handleDispCursor}
          title="Cycle edit cursor to next field"
        >
          DISP<br />CURSOR
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={handleDataStep}
          title="Step value of highlighted field"
        >
          DATA<br />STEP
        </button>

        <button
          type="button"
          className={`retro-fkey ${stepDirection === "INC" ? "active" : ""}`}
          onClick={handleToggleIncDecr}
          title="Toggle Increment or Decrement direction"
        >
          {stepDirection}.<br />
          {stepDirection === "INC" ? "DECR" : "INC"}
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={() => {
            setTxStatusMsg("Scrolling words (SLOT 0 of 10)");
          }}
          title="Scroll or view more words"
        >
          MORE<br />WORDS
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={handleToggleBitRate}
          title="Toggle transmitter bit rate"
        >
          <span style={{ fontSize: "11px", display: "block" }}>{bitRate}</span>
          BIT RATE
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={handleToggleTxChan}
          title="Toggle TX-A / TX-B"
        >
          <span style={{ color: activeTxChan === "TX-A" ? "#00ffff" : "#888" }}>TX-A</span>
          <br />
          <span style={{ color: activeTxChan === "TX-B" ? "#00ffff" : "#888" }}>TX-B</span>
        </button>

        <button
          type="button"
          className="retro-fkey"
          onClick={handleToggleRxChan}
          title="Toggle RX-A / RX-B"
        >
          <span style={{ color: activeRxChan === "RX-A" ? "#10b981" : "#888" }}>RX-A</span>
          <br />
          <span style={{ color: activeRxChan === "RX-B" ? "#10b981" : "#888" }}>RX-B</span>
        </button>

        <button
          type="button"
          className="retro-fkey transmit-btn"
          onClick={handleTransmit}
          disabled={isTransmitting}
          title="Transmit word to ARINC 429 Bus"
        >
          {isTransmitting ? "TX..." : "TRANSMIT\nWORD"}
        </button>

        <button
          type="button"
          className="retro-fkey nav-btn"
          onClick={onBackToConfig}
          title="Back to Mode Selection"
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

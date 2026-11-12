import { useState, type FC, type FormEvent } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";
import {
  type CfdsTxParameters,
  type AircraftConfigWord,
  DEFAULT_CFDS_TX_PARAMS,
  DEFAULT_AIRCRAFT_CONFIG,
  FLIGHT_PHASE_NAMES,
  CFDS_TRANSMIT_LABELS,
} from "../utils/cfdsDefaults";

interface EditCFDSTXDataProps {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  aircraftConfig: AircraftConfigWord;
  onSave: (params: CfdsTxParameters, config: AircraftConfigWord) => void;
  onBack: () => void;
}

export const EditCFDSTXData: FC<EditCFDSTXDataProps> = ({
  selectedLru,
  txParams: initialTxParams,
  aircraftConfig: initialAircraftConfig,
  onSave,
  onBack,
}) => {
  const [params, setParams] = useState<CfdsTxParameters>({ ...initialTxParams });
  const [config, setConfig] = useState<AircraftConfigWord>({ ...initialAircraftConfig });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Validation functions
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    // Date: DDMMYY (6 digits)
    if (!/^\d{6}$/.test(params.date)) {
      errs.date = "Date must be 6 digits (DDMMYY).";
    } else {
      const dd = parseInt(params.date.substring(0, 2), 10);
      const mm = parseInt(params.date.substring(2, 4), 10);
      if (dd < 1 || dd > 31 || mm < 1 || mm > 12) {
        errs.date = "Invalid date: DD (01-31), MM (01-12).";
      }
    }

    // Time: HHMMSS (6 digits)
    if (!/^\d{6}$/.test(params.time)) {
      errs.time = "Time must be 6 digits (HHMMSS).";
    } else {
      const hh = parseInt(params.time.substring(0, 2), 10);
      const mm = parseInt(params.time.substring(2, 4), 10);
      const ss = parseInt(params.time.substring(4, 6), 10);
      if (hh > 23 || mm > 59 || ss > 59) {
        errs.time = "Invalid time: HH (00-23), MM (00-59), SS (00-59).";
      }
    }

    // Flight number: 1 to 6 alphanumeric
    if (!/^[A-Z0-9]{1,6}$/i.test(params.flightNumber.trim())) {
      errs.flightNumber = "Flight number must be 1 to 6 alphanumeric characters.";
    }

    // City pairs: 6 alphabetic chars (e.g. CGKDPS)
    if (!/^[A-Z]{6}$/i.test(params.cityPairs.trim())) {
      errs.cityPairs = "City pairs must be 6 letters (3 origin + 3 destination, e.g. CGKDPS).";
    }

    // Aircraft ID: up to 8 characters
    if (!/^[A-Z0-9-]{1,8}$/i.test(params.aircraftId.trim())) {
      errs.aircraftId = "Aircraft ID must be 1 to 8 characters (e.g. PK-GIA).";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(params, config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleResetDefaults = () => {
    setParams({ ...DEFAULT_CFDS_TX_PARAMS });
    setConfig({ ...DEFAULT_AIRCRAFT_CONFIG });
    setErrors({});
    setSaveSuccess(false);
  };

  const toggleSubsystem = (key: keyof AircraftConfigWord) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSubsystems = (enable: boolean) => {
    const updated = { ...config };
    (Object.keys(updated) as (keyof AircraftConfigWord)[]).forEach((k) => {
      updated[k] = enable;
    });
    setConfig(updated);
  };

  // 17 Subsystems metadata for Figure 50-52
  const SUBSYSTEMS_LIST: { key: keyof AircraftConfigWord; name: string; desc: string }[] = [
    { key: "printer",   name: "PRINTER",     desc: "Cockpit Thermal Printer" },
    { key: "link",      name: "LINK",        desc: "ACARS Management Unit Link" },
    { key: "aids",      name: "AIDS",        desc: "Aircraft Integrated Data System" },
    { key: "rmp3",      name: "RMP3",        desc: "Radio Management Panel 3" },
    { key: "vhf3",      name: "VHF3",        desc: "VHF Transceiver 3" },
    { key: "hf1",       name: "HF1",         desc: "High Frequency Transceiver 1" },
    { key: "hf2",       name: "HF2",         desc: "High Frequency Transceiver 2" },
    { key: "adf2",      name: "ADF2",        desc: "Automatic Direction Finder 2" },
    { key: "mls1",      name: "MLS1",        desc: "Microwave Landing System 1" },
    { key: "mls2",      name: "MLS2",        desc: "Microwave Landing System 2" },
    { key: "wbs1",      name: "WBS1",        desc: "Weight & Balance System 1" },
    { key: "radar2",    name: "RADAR2",      desc: "Weather Radar Transceiver 2" },
    { key: "tpis",      name: "TPIS",        desc: "Tire Pressure Indicating System" },
    { key: "aftCrgHt",  name: "AFT_CRG/HT",  desc: "Aft Cargo Heating Controller" },
    { key: "fwdCrgHt",  name: "FWD_CRG/HT",  desc: "Forward Cargo Heating Controller" },
    { key: "crgSmoke",  name: "CRG/SMOKE",   desc: "Cargo Smoke Detection Unit" },
    { key: "wbs2",      name: "WBS2",        desc: "Weight & Balance System 2" },
  ];

  return (
    <div style={{ maxWidth: "1150px", margin: "0 auto", display: "grid", gap: "20px" }}>
      {/* Top Breadcrumb & Return Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            color: "#475569",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          &laquo; Back to CFDS Mode Select (Fig 48)
        </button>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Reference: <strong style={{ color: "#0d9488" }}>Figure 49&ndash;52 &bull; Edit CFDS TX Data</strong> (Manual pp. 1-4-86)
        </div>
      </div>

      {/* Screen Header Banner */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
            T1200B Transmitter Parameters &bull; Target: {selectedLru.name} (0x{selectedLru.code})
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            Edit CFDS TX Data
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Configure transmission parameters sent from T1200B to avionics LRU (Date, Time, Flight No, City Pairs, Phase, Aircraft ID, and Subsystem Configuration).
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleResetDefaults}
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#475569",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              background: "#0d9488",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(13,148,136,0.25)",
            }}
          >
            Save TX Parameters
          </button>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "8px",
            padding: "12px 18px",
            color: "#16a34a",
            fontWeight: 600,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>&#10003;</span>
          CFDS Transmission parameters and Aircraft Configuration Word saved successfully!
        </div>
      )}

      {/* 2-Column Parameter Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "20px" }}>
        {/* Panel 1: Core Parameters (Figure 49) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "16px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              1. Flight &amp; Aircraft Transmission Parameters
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Standard ARINC 429 Labels: 260, 125, 233-237, 040-042, 126, 301-304
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
            {/* Row 1: Date & Time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  DATE (DDMMYY) &bull; Label 260
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={params.date}
                  onChange={(e) => setParams({ ...params, date: e.target.value.replace(/\D/g, "") })}
                  placeholder="111126"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.date ? "#ef4444" : "#cbd5e1"}`,
                    fontFamily: "monospace",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                />
                {errors.date && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>{errors.date}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  TIME (HHMMSS UTC) &bull; Label 125
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={params.time}
                  onChange={(e) => setParams({ ...params, time: e.target.value.replace(/\D/g, "") })}
                  placeholder="120000"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.time ? "#ef4444" : "#cbd5e1"}`,
                    fontFamily: "monospace",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                />
                {errors.time && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>{errors.time}</div>}
              </div>
            </div>

            {/* Row 2: Flight Number & City Pairs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  FLIGHT NUMBER &bull; Labels 233&ndash;237
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={params.flightNumber}
                  onChange={(e) => setParams({ ...params, flightNumber: e.target.value.toUpperCase() })}
                  placeholder="GA429"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.flightNumber ? "#ef4444" : "#cbd5e1"}`,
                    fontFamily: "monospace",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                />
                {errors.flightNumber && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>{errors.flightNumber}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  CITY PAIRS (6 LTR) &bull; Labels 040&ndash;042
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={params.cityPairs}
                  onChange={(e) => setParams({ ...params, cityPairs: e.target.value.toUpperCase() })}
                  placeholder="CGKDPS"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.cityPairs ? "#ef4444" : "#cbd5e1"}`,
                    fontFamily: "monospace",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                />
                {errors.cityPairs && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>{errors.cityPairs}</div>}
              </div>
            </div>

            {/* Row 3: Flight Phase & Aircraft ID */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  FLIGHT PHASE (0&ndash;12) &bull; Label 126
                </label>
                <select
                  value={params.flightPhase}
                  onChange={(e) => setParams({ ...params, flightPhase: parseInt(e.target.value, 10) })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                >
                  {Object.entries(FLIGHT_PHASE_NAMES).map(([phase, name]) => (
                    <option key={phase} value={phase}>
                      {name}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "11px", color: params.flightPhase === 0 ? "#16a34a" : "#0284c7", marginTop: "4px", fontWeight: 600 }}>
                  Current: {params.flightPhase === 0 ? "GROUND CONDITION (00h)" : "AIR CONDITION (11h / 12h)"}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  AIRCRAFT ID &bull; Labels 301&ndash;304
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={params.aircraftId}
                  onChange={(e) => setParams({ ...params, aircraftId: e.target.value.toUpperCase() })}
                  placeholder="PK-GIA"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.aircraftId ? "#ef4444" : "#cbd5e1"}`,
                    fontFamily: "monospace",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                />
                {errors.aircraftId && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>{errors.aircraftId}</div>}
              </div>
            </div>

            {/* Row 4: Aircraft Model Type */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                AIRCRAFT TYPE &bull; Label 156 (1000 ms Refresh Rate)
              </label>
              <select
                value={params.aircraftType}
                onChange={(e) => setParams({ ...params, aircraftType: e.target.value })}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0f172a",
                  background: "#f8fafc",
                }}
              >
                <option value="A320">Airbus A320</option>
                <option value="A321">Airbus A321</option>
                <option value="A319">Airbus A319</option>
                <option value="A330">Airbus A330</option>
                <option value="A340">Airbus A340</option>
                <option value="A350">Airbus A350</option>
                <option value="A380">Airbus A380</option>
              </select>
            </div>
          </form>
        </div>

        {/* Panel 2: Aircraft Configuration Word (17 Subsystems, Figure 50-52) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                2. Aircraft Configuration Word (Label 155)
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                17 Equipment Subsystem Discretes
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setAllSubsystems(true)}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  color: "#475569",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                All On
              </button>
              <button
                type="button"
                onClick={() => setAllSubsystems(false)}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  color: "#475569",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                All Off
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: "360px",
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              paddingRight: "4px",
            }}
          >
            {SUBSYSTEMS_LIST.map((subsys) => {
              const active = config[subsys.key];
              return (
                <div
                  key={subsys.key}
                  onClick={() => toggleSubsystem(subsys.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: active ? "1px solid #0d9488" : "1px solid #e2e8f0",
                    background: active ? "#f0fdfa" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: active ? "#0f766e" : "#334155" }}>
                      {subsys.name}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>{subsys.desc}</div>
                  </div>
                  <span
                    style={{
                      background: active ? "#0d9488" : "#cbd5e1",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 800,
                      borderRadius: "4px",
                      padding: "2px 6px",
                    }}
                  >
                    {active ? "1" : "0"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel 3: 18 Verified Transmit Labels & Refresh Rate Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              3. ARINC 429 Transmit Labels &amp; Refresh Rate Mapping (Manual pp. 1-4-86 &ndash; 1-4-90)
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Active bus transmission schedule for CFDS avionics interface
            </span>
          </div>
          <span
            style={{
              background: "#f0fdfa",
              color: "#0d9488",
              border: "1px solid #99f6e4",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            18 Verified TX Labels
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700, width: "70px" }}>Label</th>
                <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>Parameter Name</th>
                <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700, width: "110px" }}>Format</th>
                <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700, width: "110px" }}>Refresh Rate</th>
                <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {CFDS_TRANSMIT_LABELS.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, color: "#0d9488" }}>
                    {item.labelOctal}
                  </td>
                  <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0f172a" }}>
                    {item.name}
                  </td>
                  <td style={{ padding: "7px 10px", color: "#64748b", fontFamily: "monospace" }}>
                    {item.format}
                  </td>
                  <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, color: item.refreshRateMs === 100 ? "#d97706" : "#0284c7" }}>
                    {item.refreshRateMs} ms
                  </td>
                  <td style={{ padding: "7px 10px", color: "#64748b" }}>
                    {item.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


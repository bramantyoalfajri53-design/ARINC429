import { useState, type FC } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";
import { encodeBiteCommandWord, formatHex32 } from "../utils/cfdsProtocol";

interface ConfigureChannelsProps {
  selectedLru: CfdsLruItem;
  onBack: () => void;
  onConfigureSharedChannel?: (payload: {
    channel: string;
    speed?: "100k" | "12.5k";
    enabled?: boolean;
    trap_label?: string;
    trap_active?: boolean;
  }) => void;
}

export type ChannelId = "TX-A" | "TX-B" | "TX-C" | "TX-D" | "RX-A" | "RX-B" | "RX-C" | "RX-D";

export interface ChannelWordSlot {
  slot: number;
  label: string;       // 3 octal digits (e.g. "227", "156")
  sdi: string;         // "00", "01", "10", "11"
  dataHex: string;     // 19-bit data in hex (e.g. "000000")
  dataBin: string;     // 19-bit binary representation
  dataEng: string;     // Engineering display text
  ssm: string;         // "NO", "NCD", "FT", "FW"
  parity: "ODD" | "EVEN";
  rateMs: number;      // Transmit refresh rate in ms (e.g. 100, 1000)
  enabled: boolean;
}

interface ChannelConfig {
  id: ChannelId;
  type: "TX" | "RX";
  speed: "100k" | "12.5k";
  enabled: boolean;
  trapLabel?: string;
  trapActive?: boolean;
  words: ChannelWordSlot[];
}

export const ConfigureChannels: FC<ConfigureChannelsProps> = ({
  selectedLru,
  onBack,
  onConfigureSharedChannel,
}) => {
  // Initial channels configuration per Figure 53 & Figure 54
  const [channels, setChannels] = useState<Record<ChannelId, ChannelConfig>>({
    "TX-A": {
      id: "TX-A",
      type: "TX",
      speed: "100k",
      enabled: true,
      words: [
        {
          slot: 1,
          label: "227",
          sdi: "00",
          dataHex: (parseInt(selectedLru.code, 16) << 2).toString(16).toUpperCase().padStart(6, "0"),
          dataBin: "000 0000 0000 0000 000",
          dataEng: `BITE CMD: ${selectedLru.name} (EQ ${selectedLru.code})`,
          ssm: "NO",
          parity: "ODD",
          rateMs: 100,
          enabled: true,
        },
        {
          slot: 2,
          label: "156",
          sdi: "00",
          dataHex: "413332",
          dataBin: "100 0001 0011 0011 001",
          dataEng: "A/C TYPE: A320",
          ssm: "NO",
          parity: "ODD",
          rateMs: 1000,
          enabled: true,
        },
        {
          slot: 3,
          label: "155",
          sdi: "00",
          dataHex: "00007F",
          dataBin: "000 0000 0000 0111 111",
          dataEng: "CONFIG: 17 SUBSYS",
          ssm: "NO",
          parity: "ODD",
          rateMs: 1000,
          enabled: true,
        },
        {
          slot: 4,
          label: "260",
          sdi: "00",
          dataHex: "111126",
          dataBin: "001 0001 0001 0010 011",
          dataEng: "DATE: 11-11-26",
          ssm: "NO",
          parity: "ODD",
          rateMs: 1000,
          enabled: true,
        },
        {
          slot: 5,
          label: "125",
          sdi: "00",
          dataHex: "120000",
          dataBin: "001 0010 0000 0000 000",
          dataEng: "TIME: 12:00:00 UTC",
          ssm: "NO",
          parity: "ODD",
          rateMs: 1000,
          enabled: true,
        },
        { slot: 6, label: "000", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "UNUSED", ssm: "NO", parity: "ODD", rateMs: 100, enabled: false },
        { slot: 7, label: "000", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "UNUSED", ssm: "NO", parity: "ODD", rateMs: 100, enabled: false },
        { slot: 8, label: "000", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "UNUSED", ssm: "NO", parity: "ODD", rateMs: 100, enabled: false },
        { slot: 9, label: "000", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "UNUSED", ssm: "NO", parity: "ODD", rateMs: 100, enabled: false },
        { slot: 10, label: "000", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "UNUSED", ssm: "NO", parity: "ODD", rateMs: 100, enabled: false },
      ],
    },
    "TX-B": {
      id: "TX-B",
      type: "TX",
      speed: "100k",
      enabled: false,
      words: Array.from({ length: 10 }, (_, i) => ({
        slot: i + 1,
        label: "000",
        sdi: "00",
        dataHex: "000000",
        dataBin: "000 0000 0000 0000 000",
        dataEng: "UNUSED",
        ssm: "NO",
        parity: "ODD",
        rateMs: 100,
        enabled: false,
      })),
    },
    "TX-C": {
      id: "TX-C",
      type: "TX",
      speed: "12.5k",
      enabled: true,
      words: Array.from({ length: 10 }, (_, i) => ({
        slot: i + 1,
        label: i === 0 ? "270" : "000",
        sdi: "00",
        dataHex: "000000",
        dataBin: "000 0000 0000 0000 000",
        dataEng: i === 0 ? "DISCRETE #1" : "UNUSED",
        ssm: "NO",
        parity: "ODD",
        rateMs: 100,
        enabled: i === 0,
      })),
    },
    "TX-D": {
      id: "TX-D",
      type: "TX",
      speed: "100k",
      enabled: false,
      words: Array.from({ length: 10 }, (_, i) => ({
        slot: i + 1,
        label: "000",
        sdi: "00",
        dataHex: "000000",
        dataBin: "000 0000 0000 0000 000",
        dataEng: "UNUSED",
        ssm: "NO",
        parity: "ODD",
        rateMs: 100,
        enabled: false,
      })),
    },
    "RX-A": {
      id: "RX-A",
      type: "RX",
      speed: "100k",
      enabled: true,
      trapLabel: "356",
      trapActive: true,
      words: [
        { slot: 1, label: "356", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "NORMAL MAINT DATA", ssm: "NO", parity: "ODD", rateMs: 0, enabled: true },
        { slot: 2, label: "355", sdi: "00", dataHex: "000000", dataBin: "000 0000 0000 0000 000", dataEng: "DISCRETE FAULT", ssm: "NO", parity: "ODD", rateMs: 0, enabled: true },
      ],
    },
    "RX-B": {
      id: "RX-B",
      type: "RX",
      speed: "100k",
      enabled: false,
      trapLabel: "",
      trapActive: false,
      words: [],
    },
    "RX-C": {
      id: "RX-C",
      type: "RX",
      speed: "12.5k",
      enabled: true,
      trapLabel: "356",
      trapActive: false,
      words: [],
    },
    "RX-D": {
      id: "RX-D",
      type: "RX",
      speed: "100k",
      enabled: false,
      trapLabel: "",
      trapActive: false,
      words: [],
    },
  });

  const [activeChannelId, setActiveChannelId] = useState<ChannelId>("TX-A");
  const [displayMode, setDisplayMode] = useState<"ENG" | "BIN" | "HEX">("HEX");
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const currentChannel = channels[activeChannelId];

  const toggleChannelSpeed = (chId: ChannelId) => {
    const nextSpeed = channels[chId].speed === "100k" ? "12.5k" : "100k";
    setChannels((prev) => ({
      ...prev,
      [chId]: {
        ...prev[chId],
        speed: nextSpeed,
      },
    }));
    onConfigureSharedChannel?.({ channel: chId, speed: nextSpeed });
    showToast(`${chId} speed set to ${nextSpeed}`);
  };

  const toggleChannelState = (chId: ChannelId) => {
    const nextEnabled = !channels[chId].enabled;
    setChannels((prev) => ({
      ...prev,
      [chId]: {
        ...prev[chId],
        enabled: nextEnabled,
      },
    }));
    onConfigureSharedChannel?.({ channel: chId, enabled: nextEnabled });
  };

  const updateWordSlot = (slotIdx: number, field: keyof ChannelWordSlot, value: any) => {
    const updatedWords = [...currentChannel.words];
    updatedWords[slotIdx] = {
      ...updatedWords[slotIdx],
      [field]: value,
    };
    setChannels((prev) => ({
      ...prev,
      [activeChannelId]: {
        ...prev[activeChannelId],
        words: updatedWords,
      },
    }));
  };

  // Helper to load BITE Command Word into active slot
  const handleInsertBiteCommand = () => {
    const biteHex = encodeBiteCommandWord({
      label: "227",
      sdi: 0,
      ready: true,
      equipmentCode: selectedLru.code,
      commandCode: 0x00,
    });
    const updatedWords = [...currentChannel.words];
    updatedWords[activeSlotIdx] = {
      slot: activeSlotIdx + 1,
      label: "227",
      sdi: "00",
      dataHex: formatHex32(biteHex).replace("0x", "").slice(2),
      dataBin: "100 0000 0000 0000 000",
      dataEng: `BITE CMD: ${selectedLru.name} (0x${selectedLru.code})`,
      ssm: "NO",
      parity: "ODD",
      rateMs: 100,
      enabled: true,
    };
    setChannels((prev) => ({
      ...prev,
      [activeChannelId]: {
        ...prev[activeChannelId],
        words: updatedWords,
      },
    }));
    showToast(`Inserted BITE Command Word (Label 227 - 100ms) for ${selectedLru.name}`);
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gap: "20px" }}>
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
          Reference: <strong style={{ color: "#0d9488" }}>Figure 53 &amp; 54 &bull; Configure Channels A, B, C, D</strong> (Manual pp. 1-4-91)
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
            T1200B ARINC 429 Bus Interface &bull; Target: {selectedLru.name} (0x{selectedLru.code})
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            Configure Channels A, B, C, D
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Configure 4 Transmitters (TX-A..D) and 4 Receivers (RX-A..D), Bit Rate (100k / 12.5k), Display Mode (ENG, BIN, HEX), Word Buffers, and Refresh Rates.
          </p>
        </div>

        {/* Display Format Toggle (ENG, BIN, HEX per Figure 54) */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Display Mode:</span>
          {(["ENG", "BIN", "HEX"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setDisplayMode(fmt)}
              style={{
                background: displayMode === fmt ? "#0d9488" : "#f1f5f9",
                color: displayMode === fmt ? "#ffffff" : "#475569",
                border: displayMode === fmt ? "1px solid #0d9488" : "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "#16a34a",
            fontWeight: 600,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>&#10003;</span>
          {toastMessage}
        </div>
      )}

      {/* Main Channels & Editor Layout (Figure 53 & Figure 54) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "20px" }}>
        {/* Left Column: Figure 53 - Channels Selection & Calibration */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Figure 53 &bull; Channel Selection
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Click channel to open in TX/RX Word Editor
            </span>
          </div>

          {/* Transmitters (TX-A, TX-B, TX-C, TX-D) */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#0d9488", textTransform: "uppercase", marginBottom: "8px" }}>
              Transmitter Channels (TX)
            </div>
            {(["TX-A", "TX-B", "TX-C", "TX-D"] as const).map((chId) => {
              const ch = channels[chId];
              const isSelected = activeChannelId === chId;
              const activeCount = ch.words.filter((w) => w.enabled).length;
              return (
                <div
                  key={chId}
                  onClick={() => setActiveChannelId(chId)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isSelected ? "#f0fdfa" : "#f8fafc",
                    border: isSelected ? "2px solid #0d9488" : "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 800, color: isSelected ? "#0d9488" : "#0f172a", fontSize: "14px", marginRight: "8px" }}>
                      {chId}
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      ({activeCount} / {ch.words.length} Words)
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleChannelSpeed(chId)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        color: "#475569",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {ch.speed}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleChannelState(chId)}
                      style={{
                        background: ch.enabled ? "#0d9488" : "#f1f5f9",
                        color: ch.enabled ? "#ffffff" : "#64748b",
                        border: ch.enabled ? "1px solid #0d9488" : "1px solid #cbd5e1",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {ch.enabled ? "ENABLED" : "OFF"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Receivers (RX-A, RX-B, RX-C, RX-D) */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#0284c7", textTransform: "uppercase", marginBottom: "8px" }}>
              Receiver Channels (RX)
            </div>
            {(["RX-A", "RX-B", "RX-C", "RX-D"] as const).map((chId) => {
              const ch = channels[chId];
              const isSelected = activeChannelId === chId;
              return (
                <div
                  key={chId}
                  onClick={() => setActiveChannelId(chId)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isSelected ? "#f0f9ff" : "#f8fafc",
                    border: isSelected ? "2px solid #0284c7" : "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontWeight: 800, color: isSelected ? "#0284c7" : "#0f172a", fontSize: "14px" }}>
                    {chId}
                  </span>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", color: "#475569" }}>
                      {ch.speed}
                    </span>
                    <span
                      style={{
                        background: ch.trapActive ? "#fee2e2" : "#f1f5f9",
                        color: ch.trapActive ? "#dc2626" : "#64748b",
                        border: ch.trapActive ? "1px solid #fca5a5" : "1px solid #cbd5e1",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      TRAP: {ch.trapLabel || "OFF"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Figure 54 - TX/RX Word Editor */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Figure 54 &bull; Word Editor &bull; {activeChannelId}
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Channel State: <strong style={{ color: currentChannel.enabled ? "#16a34a" : "#dc2626" }}>{currentChannel.enabled ? "ACTIVE" : "DISABLED"}</strong> &bull; Speed: <strong>{currentChannel.speed}</strong>
              </span>
            </div>

            {currentChannel.type === "TX" && (
              <button
                type="button"
                onClick={handleInsertBiteCommand}
                style={{
                  background: "#0d9488",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Insert BITE Cmd (227 &bull; 100ms)
              </button>
            )}
          </div>

          {/* Word Buffer Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>SLOT</th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>LABEL</th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>SDI</th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>
                    DATA ({displayMode})
                  </th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>SSM</th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>PAR</th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>RATE</th>
                  <th style={{ padding: "8px 10px", color: "#475569", fontWeight: 700 }}>STATE</th>
                </tr>
              </thead>
              <tbody>
                {currentChannel.words.map((slot, idx) => (
                  <tr
                    key={slot.slot}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: activeSlotIdx === idx ? "#f0fdfa" : "transparent",
                    }}
                    onClick={() => setActiveSlotIdx(idx)}
                  >
                    <td style={{ padding: "6px 10px", fontWeight: 700, color: "#1e293b" }}>
                      L{String(slot.slot).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <input
                        style={{
                          width: "48px",
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          color: "#0d9488",
                          fontWeight: 700,
                          fontFamily: "monospace",
                          textAlign: "center",
                        }}
                        value={slot.label}
                        onChange={(e) => updateWordSlot(idx, "label", e.target.value)}
                      />
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <select
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "2px 4px",
                          fontSize: "11px",
                          fontFamily: "monospace",
                        }}
                        value={slot.sdi}
                        onChange={(e) => updateWordSlot(idx, "sdi", e.target.value)}
                      >
                        <option value="00">00</option>
                        <option value="01">01</option>
                        <option value="10">10</option>
                        <option value="11">11</option>
                      </select>
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      {displayMode === "HEX" && (
                        <input
                          style={{
                            width: "75px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            fontFamily: "monospace",
                            fontSize: "12px",
                          }}
                          value={slot.dataHex}
                          onChange={(e) => updateWordSlot(idx, "dataHex", e.target.value.toUpperCase())}
                        />
                      )}
                      {displayMode === "BIN" && (
                        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#0f172a" }}>
                          {slot.dataBin}
                        </span>
                      )}
                      {displayMode === "ENG" && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#0284c7" }}>
                          {slot.dataEng}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <select
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "2px 4px",
                          fontSize: "11px",
                        }}
                        value={slot.ssm}
                        onChange={(e) => updateWordSlot(idx, "ssm", e.target.value)}
                      >
                        <option value="NO">NO</option>
                        <option value="NCD">NCD</option>
                        <option value="FT">FT</option>
                        <option value="FW">FW</option>
                      </select>
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <button
                        type="button"
                        onClick={() => updateWordSlot(idx, "parity", slot.parity === "ODD" ? "EVEN" : "ODD")}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          color: "#475569",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {slot.parity}
                      </button>
                    </td>
                    <td style={{ padding: "6px 10px", color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                      {slot.rateMs}ms
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <button
                        type="button"
                        onClick={() => updateWordSlot(idx, "enabled", !slot.enabled)}
                        style={{
                          background: slot.enabled ? "#0d9488" : "#f1f5f9",
                          color: slot.enabled ? "#ffffff" : "#64748b",
                          border: slot.enabled ? "1px solid #0d9488" : "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {slot.enabled ? "ON" : "OFF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Row & Memory State Indicator */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#0d9488",
                }}
              />
              <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                Simulation Active &bull; Stored in React Memory State (Non-volatile hardware link pending)
              </span>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => showToast("Channel configuration saved to active CFDS memory state.")}
                style={{
                  background: "#0d9488",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 2px rgba(13,148,136,0.2)",
                }}
              >
                <span>&#10003;</span> Save Channel Setup
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

import { useState } from "react";
import { ArincStandardMode, AvionicsLruContainer } from "../components";

export function StandardModePage() {
  const [activeTab, setActiveTab] = useState<"AVIONICS_LRU" | "CHANNELS_CFG">("AVIONICS_LRU");

  return (
    <div className="module-page-container">
      <div className="module-page-header">
        <div>
          <h2>AEROFLEX JCAIR T1200 / T1200B — STANDARD MODE</h2>
          <p className="section-sub">
            Dynapro 1780A Infotouch Interface &bull; Avionics LRU Dynamic Testing &bull; 4 TX / 4 RX Channels
          </p>
        </div>

        {/* Top View Toggle Navigation */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className={activeTab === "AVIONICS_LRU" ? "btn-sm primary" : "btn-sm"}
            style={{ fontWeight: "bold" }}
            onClick={() => setActiveTab("AVIONICS_LRU")}
          >
            AVIONICS LRU MENU
          </button>
          <button
            type="button"
            className={activeTab === "CHANNELS_CFG" ? "btn-sm primary" : "btn-sm"}
            style={{ fontWeight: "bold" }}
            onClick={() => setActiveTab("CHANNELS_CFG")}
          >
            USER CONFIGURE (4 TX / 4 RX)
          </button>
        </div>
      </div>

      {activeTab === "AVIONICS_LRU" ? (
        <AvionicsLruContainer onBackToChannels={() => setActiveTab("CHANNELS_CFG")} />
      ) : (
        <ArincStandardMode />
      )}
    </div>
  );
}

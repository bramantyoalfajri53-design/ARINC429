import { useState } from "react";
import { LRU_DEFINITIONS } from "../config/lruRegistry";
import { LruSingleChannelModeView } from "./LruSingleChannelModeView";

export type StandardSubScreen =
  | "SELECT_MENU"
  | "AVIONICS_LRU_MENU"
  | "LRU_MODE_SELECT"
  | "SINGLE_CHANNEL_MODE"
  | "MULTI_CHANNEL_MODE"
  | "STANDARD_NAV_CONFIG"
  | "USER_CONFIGURE_MENU";

interface AvionicsLruContainerProps {
  onBackToChannels?: () => void;
}

export function AvionicsLruContainer({ onBackToChannels }: AvionicsLruContainerProps) {
  const [currentScreen, setCurrentScreen] = useState<StandardSubScreen>("SELECT_MENU");
  const [selectedLruId, setSelectedLruId] = useState<string>("DME");

  const lruList = Object.values(LRU_DEFINITIONS);
  const selectedLru = LRU_DEFINITIONS[selectedLruId] || LRU_DEFINITIONS["DME"];

  // 1. SELECT MENU: USER CONFIGURE MENU vs AVIONICS LRU MENU (Figure 6 / Photo 1)
  if (currentScreen === "SELECT_MENU") {
    return (
      <div className="retro-dynapro-container">
        <div className="retro-screen-title">SELECT MENU:</div>
        <div className="retro-menu-split-grid">
          <button
            type="button"
            className="retro-crt-big-btn"
            onClick={() => {
              if (onBackToChannels) onBackToChannels();
              else setCurrentScreen("USER_CONFIGURE_MENU");
            }}
          >
            USER<br />CONFIGURE<br />MENU
          </button>

          <button
            type="button"
            className="retro-crt-big-btn"
            onClick={() => setCurrentScreen("AVIONICS_LRU_MENU")}
          >
            AVIONICS<br />LRU<br />MENU
          </button>
        </div>
      </div>
    );
  }

  // 2. AVIONICS LRU MENU: List of registered LRUs (DME, VOR, ILS, ADF, MMR)
  if (currentScreen === "AVIONICS_LRU_MENU") {
    return (
      <div className="retro-dynapro-container">
        <div className="retro-screen-title">AVIONICS LRU MENU - SELECT LRU TO TEST:</div>
        <div className="retro-lru-grid">
          {lruList.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`retro-lru-btn ${selectedLruId === l.id ? "selected" : ""}`}
              onClick={() => {
                setSelectedLruId(l.id);
                setCurrentScreen("LRU_MODE_SELECT");
              }}
            >
              <span className="lru-code">{l.code}</span>
              <span className="lru-id-badge">{l.id}</span>
              <span className="lru-full-name">{l.name}</span>
            </button>
          ))}
        </div>

        <div className="retro-bottom-nav">
          <button
            type="button"
            className="retro-fkey nav-btn"
            onClick={() => setCurrentScreen("SELECT_MENU")}
          >
            &larr; BACK TO SELECT MENU
          </button>
        </div>
      </div>
    );
  }

  // 3. DESIRED LRU TEST CONFIGURATION (Figure 16 / Photo 2)
  if (currentScreen === "LRU_MODE_SELECT") {
    return (
      <div className="retro-dynapro-container">
        <div className="retro-screen-title">
          DESIRED {selectedLru.id} TEST CONFIGURATION:
        </div>

        <div className="retro-mode-choice-grid">
          <div className="retro-mode-top-row">
            <button
              type="button"
              className="retro-crt-mode-btn"
              onClick={() => setCurrentScreen("SINGLE_CHANNEL_MODE")}
            >
              SINGLE<br />CHANNEL<br />MODE
            </button>

            <button
              type="button"
              className="retro-crt-mode-btn"
              onClick={() => setCurrentScreen("MULTI_CHANNEL_MODE")}
            >
              MULTI<br />CHANNEL<br />MODE
            </button>
          </div>

          <div className="retro-mode-bottom-row">
            <button
              type="button"
              className="retro-crt-mode-btn nav-cfg-btn"
              onClick={() => setCurrentScreen("STANDARD_NAV_CONFIG")}
            >
              STANDARD<br />NAV<br />CONFIGURATION
            </button>
          </div>
        </div>

        <div className="retro-bottom-nav">
          <button
            type="button"
            className="retro-fkey nav-btn"
            onClick={() => setCurrentScreen("AVIONICS_LRU_MENU")}
          >
            &larr; BACK TO LRU MENU
          </button>
        </div>
      </div>
    );
  }

  // 4. SINGLE CHANNEL MODE (Figure 17 / Photo 3 & 5) - Full Dynamic Implementation
  if (currentScreen === "SINGLE_CHANNEL_MODE") {
    return (
      <LruSingleChannelModeView
        lru={selectedLru}
        onBackToConfig={() => setCurrentScreen("LRU_MODE_SELECT")}
        onBackToMenu={() => setCurrentScreen("AVIONICS_LRU_MENU")}
      />
    );
  }

  // 5. MULTI CHANNEL MODE (Figure 18 / Photo 4) - Structure preserved
  if (currentScreen === "MULTI_CHANNEL_MODE") {
    return (
      <div className="retro-dynapro-container">
        <div className="retro-screen-title">
          {selectedLru.id} MULTI CHANNEL TEST MODE (ARINC 604 / T1200B)
        </div>
        <div className="retro-notice-card">
          <p>
            <strong>MULTI CHANNEL MODE</strong> is configured for {selectedLru.standard_lru}.
          </p>
          <p style={{ fontSize: "12px", color: "#a3e635" }}>
            Transmits multiple directed frequency channels (DF1 to DF5 &amp; SCAN) according to Aeroflex Manual Section 4.B (Figure 18).
          </p>
        </div>

        <div className="retro-bottom-nav">
          <button
            type="button"
            className="retro-fkey nav-btn"
            onClick={() => setCurrentScreen("LRU_MODE_SELECT")}
          >
            &larr; BACK TO MODE SELECTION
          </button>
        </div>
      </div>
    );
  }

  // 6. STANDARD NAV CONFIGURATION (Standard LRU Format)
  if (currentScreen === "STANDARD_NAV_CONFIG") {
    return (
      <div className="retro-dynapro-container">
        <div className="retro-screen-title">
          {selectedLru.id} STANDARD NAV CONFIGURATION (Figure 15)
        </div>
        <div className="retro-notice-card">
          <p>
            <strong>STANDARD NAV CONFIGURATION</strong> for {selectedLru.standard_lru}.
          </p>
          <p style={{ fontSize: "12px", color: "#a3e635" }}>
            Standard 10-slot ARINC 429 navigation tuning and receiver trap configuration.
          </p>
        </div>

        <div className="retro-bottom-nav">
          <button
            type="button"
            className="retro-fkey nav-btn"
            onClick={() => setCurrentScreen("LRU_MODE_SELECT")}
          >
            &larr; BACK TO MODE SELECTION
          </button>
        </div>
      </div>
    );
  }

  return null;
}

import { useState } from "react";
import { LRU_DEFINITIONS } from "../config/lruRegistry";
import { LruMultiChannelModeView } from "./LruMultiChannelModeView";
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
                if (l.id === "DME") {
                  setCurrentScreen("LRU_MODE_SELECT");
                } else {
                  setCurrentScreen("SINGLE_CHANNEL_MODE");
                }
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

  // 5. MULTI CHANNEL MODE (Figure 18 / Photo 4) - Full Dynamic Multi-Frequency Control
  if (currentScreen === "MULTI_CHANNEL_MODE") {
    return (
      <LruMultiChannelModeView
        lru={selectedLru}
        onBackToConfig={() => setCurrentScreen("LRU_MODE_SELECT")}
        onBackToMenu={() => setCurrentScreen("AVIONICS_LRU_MENU")}
      />
    );
  }

  // 6. STANDARD NAV CONFIGURATION (Figure 15 / Standard 10-Slot Nav Configuration)
  if (currentScreen === "STANDARD_NAV_CONFIG") {
    return (
      <LruSingleChannelModeView
        lru={selectedLru}
        isStandardNav={true}
        onBackToConfig={() => setCurrentScreen("LRU_MODE_SELECT")}
        onBackToMenu={() => setCurrentScreen("AVIONICS_LRU_MENU")}
      />
    );
  }

  return null;
}

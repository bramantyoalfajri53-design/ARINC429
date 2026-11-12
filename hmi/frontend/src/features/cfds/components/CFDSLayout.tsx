import type { FC } from "react";
import { LRUSelection } from "./LRUSelection";
import { CFDSModeSelect } from "./CFDSModeSelect";
import { EditCFDSTXData } from "./EditCFDSTXData";
import { ConfigureChannels } from "./ConfigureChannels";
import { EnterDateShopCode } from "./EnterDateShopCode";
import { NormalModeABD0018 } from "./NormalModeABD0018";
import { NormalModeABD0048 } from "./NormalModeABD0048";
import { MenuModeABD0018 } from "./menu/MenuModeABD0018";
import { InteractiveModeABD0048 } from "./interactive/InteractiveModeABD0048";
import { DiscreteModeABD0048 } from "./discrete/DiscreteModeABD0048";
import { useCfdsController } from "../hooks";

interface CFDSLayoutProps {
  onBackToMain: () => void;
}

export const CFDSLayout: FC<CFDSLayoutProps> = ({ onBackToMain }) => {
  const {
    currentView,
    setCurrentView,
    selectedLru,
    txParams,
    aircraftConfig,
    dataSource,
    busRunning,
    handleSelectLru,
    handleProceedToModeSelect,
    handleSaveTxData,
    handleUpdateDateShopCode,
    handleOpenSubmode,
    emitBiteCommand,
    notifyNormalSimulation,
    notifyDiscreteSimulation,
    configureSharedChannel,
  } = useCfdsController();

  return (
    <div>
      {/* Honest Coordinator Source & Bus Status Strip */}
      <div className="cfds-status-strip">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            className={`cfds-status-pill ${dataSource === "HARDWARE" ? "hw" : "sim"}`}
            data-testid="cfds-coordinator-source"
          >
            SOURCE: {dataSource === "HARDWARE" ? "HARDWARE CONNECTED" : "SIMULATION (NO HW RX)"}
          </span>
          <span style={{ color: "#475569", fontWeight: 600 }}>
            BUS: {busRunning ? "RUNNING" : "IDLE"}
          </span>
          {selectedLru && (
            <span style={{ color: "#0f766e", fontWeight: 600 }}>
              LRU: {selectedLru.name} (0x{selectedLru.code})
            </span>
          )}
        </div>
        <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
          VIEW: {currentView}
        </span>
      </div>

      {currentView === "LRU_SELECTION" && (
        <LRUSelection
          selectedLru={selectedLru}
          onSelectLru={handleSelectLru}
          onProceed={handleProceedToModeSelect}
          onBack={onBackToMain}
        />
      )}

      {currentView === "MODE_SELECT" && selectedLru && (
        <CFDSModeSelect
          selectedLru={selectedLru}
          onChangeLru={() => setCurrentView("LRU_SELECTION")}
          onSelectSubmode={(submode) => setCurrentView(submode)}
          onBackToMain={onBackToMain}
        />
      )}

      {currentView === "EDIT_TX" && selectedLru && (
        <EditCFDSTXData
          selectedLru={selectedLru}
          txParams={txParams}
          aircraftConfig={aircraftConfig}
          onSave={handleSaveTxData}
          onBack={() => setCurrentView("MODE_SELECT")}
        />
      )}

      {currentView === "OPERATION_MODE" && selectedLru && (
        <EnterDateShopCode
          selectedLru={selectedLru}
          txParams={txParams}
          onUpdateParams={handleUpdateDateShopCode}
          onSelectSubmode={handleOpenSubmode}
          onBack={() => setCurrentView("MODE_SELECT")}
        />
      )}

      {currentView === "NORMAL_MODE_ABD0018" && selectedLru && (
        <NormalModeABD0018
          selectedLru={selectedLru}
          txParams={txParams}
          onBack={() => setCurrentView("OPERATION_MODE")}
          onEmitBiteCommand={(cmd) =>
            emitBiteCommand({
              equipment_code: selectedLru.code,
              command_code: cmd.commandCode,
              sdi: cmd.sdi ?? 0,
              ready: cmd.ready ?? false,
              submode: "NORMAL",
              action_label: cmd.actionLabel,
            })
          }
          onSimulateNormal={notifyNormalSimulation}
        />
      )}

      {currentView === "NORMAL_MODE_ABD0048" && selectedLru && (
        <NormalModeABD0048
          selectedLru={selectedLru}
          txParams={txParams}
          onBack={() => setCurrentView("OPERATION_MODE")}
          onEmitBiteCommand={(cmd) =>
            emitBiteCommand({
              equipment_code: selectedLru.code,
              command_code: cmd.commandCode,
              sdi: cmd.sdi ?? 0,
              ready: cmd.ready ?? false,
              submode: "NORMAL",
              action_label: cmd.actionLabel,
            })
          }
          onSimulateNormal={notifyNormalSimulation}
        />
      )}

      {currentView === "MENU_MODE_ABD0018" && selectedLru && (
        <MenuModeABD0018
          selectedLru={selectedLru}
          txParams={txParams}
          onBack={() => setCurrentView("OPERATION_MODE")}
          onEmitBiteCommand={(cmd) =>
            emitBiteCommand({
              equipment_code: selectedLru.code,
              command_code: cmd.commandCode,
              sdi: cmd.sdi ?? 0,
              ready: cmd.ready ?? false,
              submode: "MENU",
              action_label: cmd.actionLabel,
            })
          }
        />
      )}

      {currentView === "INTERACTIVE_MODE_ABD0048" && selectedLru && (
        <InteractiveModeABD0048
          selectedLru={selectedLru}
          txParams={txParams}
          onBack={() => setCurrentView("OPERATION_MODE")}
          onEmitBiteCommand={(cmd) =>
            emitBiteCommand({
              equipment_code: selectedLru.code,
              command_code: cmd.commandCode,
              sdi: cmd.sdi ?? 0,
              ready: cmd.ready ?? false,
              bit12: cmd.bit12 ?? false,
              submode: "INTERACTIVE",
              action_label: cmd.actionLabel,
            })
          }
        />
      )}

      {currentView === "DISCRETE_MODE_ABD0048" && selectedLru && (
        <DiscreteModeABD0048
          selectedLru={selectedLru}
          txParams={txParams}
          onBack={() => setCurrentView("OPERATION_MODE")}
          onSimulateDiscrete={notifyDiscreteSimulation}
        />
      )}

      {currentView === "CONFIGURE_CHANNELS" && selectedLru && (
        <ConfigureChannels
          selectedLru={selectedLru}
          onBack={() => setCurrentView("MODE_SELECT")}
          onConfigureSharedChannel={configureSharedChannel}
        />
      )}
    </div>
  );
};

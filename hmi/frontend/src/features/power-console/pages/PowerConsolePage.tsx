import { useMemo } from "react";
import { useAppSession } from "../../../shared";
import { AcSupplyPanel, DcSupplyPanel } from "../components";
import { usePowerTelemetryHistory } from "../hooks";
import { createPowerActions } from "../services";

export function PowerConsolePage() {
  const { frame, canControl, command, requestOutput, subscribeTelemetry } = useAppSession();
  const { dcCharts, acCharts } = usePowerTelemetryHistory(subscribeTelemetry);
  const actions = useMemo(() => createPowerActions(command), [command]);

  return (
    <main className="panels">
      <DcSupplyPanel
        dc={frame?.dc}
        canControl={canControl}
        charts={dcCharts}
        onToggleOutput={(enabled) => requestOutput("dc", enabled)}
        onSetVoltage={(voltage) => void actions.setDcSetpoint({ voltage })}
        onSetCurrent={(current) => void actions.setDcSetpoint({ current })}
        onSetOvp={(ovp) => void actions.setDcSetpoint({ ovp })}
        onApplyPreset={(voltage) => void actions.applyDcPreset(voltage)}
      />
      <AcSupplyPanel
        ac={frame?.ac}
        canControl={canControl}
        charts={acCharts}
        onToggleOutput={(enabled) => requestOutput("ac", enabled)}
        onSetVoltage={(voltage) => void actions.setAcSetpoint({ voltage })}
        onSetFrequency={(frequency) => void actions.setAcSetpoint({ frequency })}
        onSetCurrent={(current) => void actions.setAcSetpoint({ current })}
        onApplyPreset={(voltage, frequency) => void actions.applyAcPreset(voltage, frequency)}
      />
    </main>
  );
}


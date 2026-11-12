import { Meter, SetpointInput, StatusPill, StripChart } from "../../../shared";
import { AC_LIMITS } from "../config";
import type { AcTelemetry, ChartSeries } from "../types";
import { AC_PRESETS } from "../utils";

type AcSupplyPanelProps = {
  ac: AcTelemetry | undefined;
  canControl: boolean;
  charts: ChartSeries[];
  onToggleOutput: (enabled: boolean) => void;
  onSetVoltage: (voltage: number) => void;
  onSetFrequency: (frequency: number) => void;
  onSetCurrent: (current: number) => void;
  onApplyPreset: (voltage: number, frequency: number) => void;
};

export function AcSupplyPanel({
  ac,
  canControl,
  charts,
  onToggleOutput,
  onSetVoltage,
  onSetFrequency,
  onSetCurrent,
  onApplyPreset,
}: AcSupplyPanelProps) {
  const pillVariant = ac?.fault ? "fault" : ac?.output_on ? "ok" : "default";
  const pillLabel = ac?.fault ? ac.fault_msg : ac?.output_on ? "OUTPUT ON" : "STANDBY";

  return (
    <section className="panel">
      <h2>AC6803B — AC POWER SOURCE 2 kVA</h2>
      <div className="panel-head">
        <StatusPill variant={pillVariant} label={pillLabel} />
        {canControl ? (
          <button
            type="button"
            className={ac?.output_on ? "power on" : "power"}
            onClick={() => onToggleOutput(!ac?.output_on)}
          >
            {ac?.output_on ? "AC OFF" : "AC ON"}
          </button>
        ) : null}
      </div>
      <div className="meters">
        <Meter label="Measured Vrms" value={(ac?.v_rms ?? 0).toFixed(1)} unit="Vrms" />
        <Meter label="Measured Irms" value={(ac?.i_rms ?? 0).toFixed(2)} unit="Arms" />
        <Meter label="Active Power" value={(ac?.power_watts ?? 0).toFixed(1)} unit="W" />
        <Meter
          label="Freq / PF"
          value={`${(ac?.frequency ?? 0).toFixed(0)} / ${(ac?.power_factor ?? 1).toFixed(2)}`}
          unit=""
        />
      </div>
      <label>
        Target voltage (0–270 Vrms)
        <SetpointInput
          value={ac?.set_voltage ?? AC_LIMITS.voltage.defaultVal}
          disabled={!canControl}
          step={AC_LIMITS.voltage.step}
          min={AC_LIMITS.voltage.min}
          max={AC_LIMITS.voltage.max}
          onCommit={onSetVoltage}
        />
      </label>
      <label>
        Frequency (45–500 Hz)
        <SetpointInput
          value={ac?.set_frequency ?? AC_LIMITS.frequency.defaultVal}
          disabled={!canControl}
          step={AC_LIMITS.frequency.step}
          min={AC_LIMITS.frequency.min}
          max={AC_LIMITS.frequency.max}
          onCommit={onSetFrequency}
        />
      </label>
      <label>
        Current limit (0–20 Arms)
        <SetpointInput
          value={ac?.set_current ?? AC_LIMITS.current.defaultVal}
          disabled={!canControl}
          step={AC_LIMITS.current.step}
          min={AC_LIMITS.current.min}
          max={AC_LIMITS.current.max}
          onCommit={onSetCurrent}
        />
      </label>
      <div className="presets">
        {AC_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={!canControl}
            onClick={() => onApplyPreset(p.voltage, p.frequency)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <StripChart series={charts} />
      <div className="idn">{ac?.idn}</div>
    </section>
  );
}


import { Meter, SetpointInput, StatusPill, StripChart } from "../../../shared";
import { DC_LIMITS } from "../config";
import type { ChartSeries, DcTelemetry } from "../types";
import { DC_PRESETS } from "../utils";

type DcSupplyPanelProps = {
  dc: DcTelemetry | undefined;
  canControl: boolean;
  charts: ChartSeries[];
  onToggleOutput: (enabled: boolean) => void;
  onSetVoltage: (voltage: number) => void;
  onSetCurrent: (current: number) => void;
  onSetOvp: (ovp: number) => void;
  onApplyPreset: (voltage: number) => void;
};

export function DcSupplyPanel({
  dc,
  canControl,
  charts,
  onToggleOutput,
  onSetVoltage,
  onSetCurrent,
  onSetOvp,
  onApplyPreset,
}: DcSupplyPanelProps) {
  const pillVariant = dc?.fault ? "fault" : dc?.output_on ? "ok" : "default";
  const pillLabel = dc?.fault ? dc.fault_msg : dc?.output_on ? "OUTPUT ON" : "STANDBY";

  return (
    <section className="panel">
      <h2>N5746A — DC POWER SUPPLY 40V / 19A</h2>
      <div className="panel-head">
        <StatusPill variant={pillVariant} label={pillLabel} />
        {canControl ? (
          <button
            type="button"
            className={dc?.output_on ? "power on" : "power"}
            onClick={() => onToggleOutput(!dc?.output_on)}
          >
            {dc?.output_on ? "DC OFF" : "DC ON"}
          </button>
        ) : null}
      </div>
      <div className="meters">
        <Meter label="Measured Voltage" value={(dc?.voltage ?? 0).toFixed(2)} unit="V" />
        <Meter label="Measured Current" value={(dc?.current ?? 0).toFixed(3)} unit="A" />
        <Meter label="Calculated Power" value={(dc?.power ?? 0).toFixed(1)} unit="W" />
        <Meter label="Regulation" value={dc?.status ?? "--"} unit="" />
      </div>
      <label>
        Target voltage (0–40 V)
        <SetpointInput
          value={dc?.set_voltage ?? DC_LIMITS.voltage.defaultVal}
          disabled={!canControl}
          step={DC_LIMITS.voltage.step}
          min={DC_LIMITS.voltage.min}
          max={DC_LIMITS.voltage.max}
          onCommit={onSetVoltage}
        />
      </label>
      <label>
        Current limit (0–19 A)
        <SetpointInput
          value={dc?.set_current ?? DC_LIMITS.current.defaultVal}
          disabled={!canControl}
          step={DC_LIMITS.current.step}
          min={DC_LIMITS.current.min}
          max={DC_LIMITS.current.max}
          onCommit={onSetCurrent}
        />
      </label>
      <label>
        Hardware OVP (1–45 V)
        <SetpointInput
          value={dc?.set_ovp ?? DC_LIMITS.ovp.defaultVal}
          disabled={!canControl}
          step={DC_LIMITS.ovp.step}
          min={DC_LIMITS.ovp.min}
          max={DC_LIMITS.ovp.max}
          onCommit={onSetOvp}
        />
      </label>
      <div className="presets">
        {DC_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={!canControl}
            onClick={() => onApplyPreset(p.voltage)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <StripChart series={charts} />
      <div className="idn">{dc?.idn}</div>
    </section>
  );
}


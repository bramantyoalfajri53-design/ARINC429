export type { AcTelemetry, ChartSeries, DcTelemetry } from "../../../shared";

export type DcPreset = {
  label: string;
  voltage: number;
};

export type AcPreset = {
  label: string;
  voltage: number;
  frequency: number;
};


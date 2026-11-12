export type OperatingModeId = "mode-select" | "power-console" | "standard" | "cfds" | "cmc" | "library";

export type OperatingModeDescriptor = {
  id: OperatingModeId;
  path: string;
  label: string;
  status: "active" | "development";
};

export type ChartSeries = {
  color: string;
  values: number[];
};

export type PendingOutputRequest = {
  kind: "dc" | "ac";
  enabled: boolean;
};


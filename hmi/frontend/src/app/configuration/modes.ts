import type { OperatingModeDescriptor } from "../../shared";

export const OPERATING_MODES: OperatingModeDescriptor[] = [
  { id: "mode-select", path: "/", label: "Mode Select", status: "active" },
  { id: "standard", path: "/standard", label: "Standard Mode", status: "active" },
  { id: "cfds", path: "/cfds", label: "CFDS Mode", status: "development" },
  { id: "cmc", path: "/cmc", label: "CMC Mode", status: "active" },
  { id: "library", path: "/library", label: "Label Library", status: "active" },
  { id: "power-console", path: "/power", label: "Power Console", status: "active" },
];

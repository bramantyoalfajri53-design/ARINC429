import type { AcPreset, DcPreset } from "../types";

export const DC_PRESETS: DcPreset[] = [
  { label: "28V Aircraft", voltage: 28 },
  { label: "12V", voltage: 12 },
  { label: "5V", voltage: 5 },
  { label: "3.3V", voltage: 3.3 },
  { label: "0V Off", voltage: 0 },
];

export const AC_PRESETS: AcPreset[] = [
  { label: "115V@400Hz", voltage: 115, frequency: 400 },
  { label: "230V@50Hz", voltage: 230, frequency: 50 },
  { label: "115V@60Hz", voltage: 115, frequency: 60 },
  { label: "26V@400Hz", voltage: 26, frequency: 400 },
  { label: "0V Off", voltage: 0, frequency: 400 },
];


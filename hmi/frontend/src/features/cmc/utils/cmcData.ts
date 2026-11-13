import type { BoeingLruDefinition, CmcFunctionName } from "../types";

export const BOEING_LRU_DATABASE: BoeingLruDefinition[] = [
  { id: "707 LRA", name: "Low Range Altimeter", code: "007", tc_capable: false },
  { id: "708 WXR", name: "Weather Radar", code: "008", tc_capable: false },
  { id: "709 DME", name: "Distance Measuring Equipment", code: "009", tc_capable: false },
  { id: "710 ILS", name: "Instrument Landing System", code: "010", tc_capable: true },
  { id: "711 VOR", name: "VHF Omnidirectional Range", code: "011", tc_capable: true },
  { id: "712 ADF", name: "Automatic Direction Finder", code: "012", tc_capable: true },
  { id: "716 VHF", name: "VHF Communications", code: "016", tc_capable: false },
  { id: "718 ATC", name: "Air Traffic Control Transponder", code: "018", tc_capable: false },
  { id: "719 HF", name: "HF Communications", code: "019", tc_capable: false },
  { id: "723 GPWS", name: "Ground Proximity Warning System", code: "023", tc_capable: false },
  { id: "724 ACARS", name: "ACARS Management Unit", code: "024", tc_capable: false },
  { id: "727 MLS", name: "Microwave Landing System", code: "027", tc_capable: false },
  { id: "735 TCAS", name: "Traffic Alert & Collision Avoidance", code: "035", tc_capable: false },
  { id: "740 PRNTR", name: "Cockpit Printer", code: "040", tc_capable: false },
  { id: "741 SATCM", name: "Satellite Communications", code: "041", tc_capable: false },
  { id: "718 ATC/S", name: "ATC Transponder Mode S", code: "018", tc_capable: false },
  { id: "755 MMR", name: "Multi-Mode Receiver", code: "055", tc_capable: false },
  { id: "750 VDR", name: "VHF Data Radio", code: "050", tc_capable: false },
  { id: "753 HFDU", name: "HF Data Unit", code: "053", tc_capable: false },
  { id: "753 HFDR", name: "HF Data Radio", code: "053", tc_capable: false },
  { id: "MANUAL ENTRY", name: "Manual Hex Equipment Code Entry", code: "000", tc_capable: true },
];

export const TIME_CONSTANT_OPTIONS = ["OFF", "0.4", "0.8", "1.6", "3.2", "6.4", "12.8"];

// 17 Toggle Switches on Label 155 (Aircraft Configuration Word, rate 1000 ms, Bits 11..27)
export const CMC_LABEL155_SWITCHES: Array<{ bit: number; key: string; label: string }> = [
  { bit: 11, key: "PRINTER", label: "PRINTER" },
  { bit: 12, key: "LINK", label: "LINK" },
  { bit: 13, key: "AIDS", label: "AIDS" },
  { bit: 14, key: "RMP3", label: "RMP3" },
  { bit: 15, key: "VHF3", label: "VHF3" },
  { bit: 16, key: "HF1", label: "HF1" },
  { bit: 17, key: "HF2", label: "HF2" },
  { bit: 18, key: "ADF2", label: "ADF2" },
  { bit: 19, key: "MLS1", label: "MLS1" },
  { bit: 20, key: "MLS2", label: "MLS2" },
  { bit: 21, key: "WBS1", label: "WBS1" },
  { bit: 22, key: "RADAR2", label: "RADAR2" },
  { bit: 23, key: "TPIS", label: "TPIS" },
  { bit: 24, key: "AFT_CRG/HT", label: "AFT_CRG/HT" },
  { bit: 25, key: "FWD_CRG/HT", label: "FWD_CRG/HT" },
  { bit: 26, key: "CRG/SMOKE", label: "CRG/SMOKE" },
  { bit: 27, key: "WBS2", label: "WBS2" },
];

// 6 Function select switches per Boeing D243W201-1
export const CMC_FUNCTION_SWITCHES: Array<{
  id: CmcFunctionName;
  codeHex: string;
  label: string;
  description: string;
}> = [
  {
    id: "NO REQUEST",
    codeHex: "00H",
    label: "NO REQUEST (00H)",
    description: "Default idle state transmitted on Label 227",
  },
  {
    id: "BITE TEST",
    codeHex: "01H",
    label: "BITE TEST (01H)",
    description: "Triggers LRU self-test sequence",
  },
  {
    id: "SHOP FAULTS",
    codeHex: "03H",
    label: "SHOP FAULTS (03H)",
    description: "Requests LRU internal fault log and opens Shop Faults screen",
  },
  {
    id: "NEW FLIGHT",
    codeHex: "12H",
    label: "NEW FLIGHT (12H)",
    description: "Notifies LRU of new flight leg initialization",
  },
  {
    id: "LOGOFF",
    codeHex: "7FH",
    label: "LOGOFF (7FH)",
    description: "Terminates active maintenance interrogation session",
  },
  {
    id: "CONFIG DATA",
    codeHex: "05H",
    label: "CONFIG DATA",
    description: "Requests Part Number, SW and HW modification level",
  },
];

export const CMC_FUNCTION_OPTIONS: CmcFunctionName[] = [
  "NO REQUEST",
  "BITE TEST",
  "SHOP FAULTS",
  "NEW FLIGHT",
  "LOGOFF",
  "CONFIG DATA",
];

export function getCmcApiPath(endpoint: string): string {
  return `/api/cmc${endpoint}`;
}

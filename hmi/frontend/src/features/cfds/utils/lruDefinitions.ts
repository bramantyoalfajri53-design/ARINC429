import type { CfdsLruItem } from "../types";

export type { CfdsLruItem };

/**
 * CFDS LRU Definitions from Aeroflex JcAIR T1200B Operation Manual
 * Section 4.F - CFDS Operations, Figure 47 (CFDS LRU Selection)
 *
 * DO NOT MODIFY Equipment Codes or add unverified codes.
 */
export const CFDS_LRU_TABLE: CfdsLruItem[] = [
  { code: "707", name: "LRA",   description: "Low Range Radio Altimeter" },
  { code: "708", name: "WXR",   description: "Weather Radar" },
  { code: "709", name: "DME",   description: "Distance Measuring Equipment" },
  { code: "710", name: "ILS",   description: "Instrument Landing System" },
  { code: "711", name: "VOR",   description: "VHF Omnidirectional Range" },
  { code: "712", name: "ADF",   description: "Automatic Direction Finder" },
  { code: "716", name: "VHF",   description: "VHF Communication Transceiver" },
  { code: "718", name: "ATC",   description: "Air Traffic Control Transponder" },
  { code: "719", name: "HF",    description: "High Frequency Communication Transceiver" },
  { code: "723", name: "GPWS",  description: "Ground Proximity Warning System" },
  { code: "724", name: "ACARS", description: "ARINC Communication Addressing & Reporting System" },
  { code: "727", name: "MLS",   description: "Microwave Landing System" },
  { code: "735", name: "TCAS",  description: "Traffic Alert & Collision Avoidance System" },
  { code: "740", name: "PRNTR", description: "Cockpit Printer" },
  { code: "741", name: "SATCM", description: "Satellite Communication System" },
  { code: "750", name: "VDR",   description: "VHF Data Radio" },
  { code: "753", name: "HFDU",  description: "High Frequency Data Unit" },
  { code: "753", name: "HFDR",  description: "High Frequency Data Radio" },
  { code: "755", name: "MMR",   description: "Multi Mode Receiver" },
];


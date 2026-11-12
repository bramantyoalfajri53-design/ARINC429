export interface LabelDefinition {
  label: string;
  name: string;
  description: string;
  defaultVal: string;
  units: string;
  category: "Navigation" | "Engine" | "System" | "Radio";
}

export const T1200_LABEL_DICTIONARY: LabelDefinition[] = [
  { label: "012", name: "FMC_DIST", description: "Distance to Waypoint", defaultVal: "124.5", units: "NM", category: "Navigation" },
  { label: "014", name: "FMC_ETA", description: "Estimated Time of Arrival", defaultVal: "14:28:10", units: "UTC", category: "Navigation" },
  { label: "015", name: "TCAS_TA", description: "Traffic Advisory", defaultVal: "000000", units: "HEX", category: "System" },
  { label: "016", name: "TCAS_RA", description: "Resolution Advisory", defaultVal: "000000", units: "HEX", category: "System" },
  { label: "115", name: "WAYPOINT_LAT", description: "Waypoint Latitude", defaultVal: "07°15'S", units: "DEG", category: "Navigation" },
  { label: "116", name: "WAYPOINT_LON", description: "Waypoint Longitude", defaultVal: "112°45'E", units: "DEG", category: "Navigation" },
  { label: "155", name: "ACFT_CONFIG", description: "Aircraft Configuration & Phase", defaultVal: "000100", units: "DISC", category: "System" },
  { label: "164", name: "RAD_ALT", description: "Radio Altitude", defaultVal: "2500", units: "FT", category: "Navigation" },
  { label: "173", name: "LOC_DEV", description: "Localizer Deviation", defaultVal: "0.0", units: "DDM", category: "Radio" },
  { label: "174", name: "GS_DEV", description: "Glideslope Deviation", defaultVal: "0.0", units: "DDM", category: "Radio" },
  { label: "201", name: "DME_DIST", description: "DME Distance", defaultVal: "45.2", units: "NM", category: "Radio" },
  { label: "203", name: "PRESS_ALT", description: "Pressure Altitude (Baro)", defaultVal: "32000", units: "FT", category: "Navigation" },
  { label: "204", name: "BARO_CORR", description: "Barometric Correction", defaultVal: "1013.25", units: "hPa", category: "Navigation" },
  { label: "205", name: "MACH_NO", description: "Mach Number", defaultVal: "0.78", units: "MACH", category: "Navigation" },
  { label: "206", name: "CAS", description: "Calibrated Airspeed", defaultVal: "285", units: "KTS", category: "Navigation" },
  { label: "210", name: "TRUE_AIRSPEED", description: "True Airspeed (TAS)", defaultVal: "460", units: "KTS", category: "Navigation" },
  { label: "222", name: "VOR_BEARING", description: "VOR Omnibearing", defaultVal: "095.0", units: "DEG", category: "Radio" },
  { label: "227", name: "BITE_CMD", description: "BITE Command Word", defaultVal: "000000", units: "HEX", category: "System" },
  { label: "270", name: "TCAS_DATA", description: "TCAS Operating Mode", defaultVal: "000000", units: "DISC", category: "System" },
  { label: "310", name: "MAG_HDG", description: "Magnetic Heading", defaultVal: "180.5", units: "DEG", category: "Navigation" },
  { label: "311", name: "TRUE_HDG", description: "True Heading", defaultVal: "181.2", units: "DEG", category: "Navigation" },
  { label: "350", name: "FAULT_SUM_1", description: "Fault Summary Word #1", defaultVal: "000000", units: "HEX", category: "System" },
  { label: "351", name: "FAULT_SUM_2", description: "Fault Summary Word #2", defaultVal: "000000", units: "HEX", category: "System" },
  { label: "355", name: "DISCRETE_WORD", description: "CFDS Discrete Status Word", defaultVal: "000000", units: "DISC", category: "System" },
  { label: "356", name: "BITE_COMM_PARAM", description: "BITE Communication Parameters", defaultVal: "000000", units: "HEX", category: "System" },
];


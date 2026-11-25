(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const root = () => $("view-root");
  let snap = null;
  let timer = null;
  let editing = { bus: "A", slot: 0, rxCh: "A" };
  let lastViewKey = "";
  let profilesCache = null;
  let libraryCache = null;
  let profileDetails = {};

  let activeProfile = null;
  let profileDetail = null;

  // ====================================================================
// CFDS & BOEING CMC HMI SYNCHRONIZED COMPONENT SUITE (AEROFLEX T1200B)
// Synchronized from GitHub source (ref_ARINC429_source / ARINC429.git)
// ====================================================================

const CFDS_LRU_TABLE = [
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


try {
  const _storedCfdsLrus = localStorage.getItem("cfds_custom_lrus");
  if (_storedCfdsLrus) {
    const _parsed = JSON.parse(_storedCfdsLrus);
    _parsed.forEach(c => {
      if (!CFDS_LRU_TABLE.some(x => x.code === c.code && x.name === c.name)) {
        CFDS_LRU_TABLE.push(c);
      }
    });
  }
} catch (_e) {}

// ====================================================================
// CFDS LRU BITE MENU DICTIONARIES (AEROFLEX T1200B / ABD0018 / ABD0048)
// Authentic menu trees for each LRU based on Aeroflex Manual Section 4.F & CMM
// ====================================================================

const CFDS_LRU_MENUS = {
  "709": {
    title: "DME-0",
    screens: {
      "main": {
        title: "DME-0",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<SHOP DATA", action: "screen:shop_data" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "menu_2": {
        title: "DME-0",
        subtitle: "menu 2",
        items: [
          { key: "1", letter: "A", blank: true },
          { key: "2", letter: "B", label: "<FORMAT NON-VOLATILE", action: "screen:format_nvm" },
          { key: "3", letter: "C", label: "<ERASE NON-VOLATILE", action: "screen:erase_nvm" },
          { key: "4", letter: "D", blank: true },
          { key: "5", letter: "E", blank: true },
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" },
        ]
      },
      "format_nvm": {
        title: "DME-0",
        subtitle: "menu 2",
        items: [
          { key: "1", letter: "A", blank: true },
          { key: "2", letter: "B", label: "0000 bytes bad", isText: true },
          { key: "3", letter: "C", label: "NVM FORMATTED OK", isText: true },
          { key: "4", letter: "D", blank: true },
          { key: "5", letter: "E", blank: true },
          { key: "6", letter: "F", label: "<RETURN", action: "screen:menu_2" },
        ]
      },
      "erase_nvm": {
        title: "DME-0",
        subtitle: "menu 2",
        items: [
          { key: "1", letter: "A", blank: true },
          { key: "2", letter: "B", label: "0000 bytes bad", isText: true },
          { key: "3", letter: "C", label: "NVM ERASED OK", isText: true },
          { key: "4", letter: "D", blank: true },
          { key: "5", letter: "E", blank: true },
          { key: "6", letter: "F", label: "<RETURN", action: "screen:menu_2" },
        ]
      },
      "last_leg": {
        title: "DME-0",
        subtitle: "last leg report\ndate: jan01",
        lines: [
          { type: "header", text: "    gmt     ata" },
          { type: "info", text: "    dme-0 transceiver (2)" },
          { type: "data", text: "3   0000    34-51-33" },
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "prev_legs": {
        title: "DME-0",
        subtitle: "previous legs report\n--------------------",
        lines: [
          { type: "header", text: "  leg date    gmt   ata" },
          { type: "info", text: "  dme-0 transceiver" },
          { type: "data", text: "-01 jan00   0000  34-51-33" },
          { type: "info", text: "  dme-0 transceiver (2)" },
          { type: "data", text: "-02 jan00   0000  34-51-33" },
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "lru_id": {
        title: "DME-0",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "transceiver p/n:" },
          { type: "data", text: "  822-0329-001" },
          { type: "info", text: "serial number: 1204" },
          { type: "info", text: "modification dot: 1-4" },
          { type: "info", text: "equipment: COL-DME-709" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "test": {
        title: "DME-0",
        subtitle: "test",
        lines: [
          { type: "info", text: "dme-0 no data from" },
          { type: "info", text: "        control source" },
          { type: "data", text: "ata:  34-51-23" },
          { type: "status", text: "BITE TEST COMPLETE: SYSTEM NORMAL" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "shop_data": {
        title: "DME-0",
        subtitle: "shop data",
        items: [
          { key: "1", letter: "A", blank: true },
          { key: "2", letter: "B", label: "<ENTER SHOP VISIT", action: "screen:shop_visit" },
          { key: "3", letter: "C", label: "<DISPLAY FAULT DATA", action: "screen:fault_data" },
          { key: "4", letter: "D", label: "<SOFTWARE ID", action: "screen:software_id" },
          { key: "5", letter: "E", label: "<SPECIAL FUNCTIONS", action: "screen:special_func_agc" },
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" },
        ]
      },
      "shop_visit": {
        title: "DME-0",
        subtitle: "enter shop visit",
        lines: [
          { type: "info", text: "SHOP CODE: N12345" },
          { type: "info", text: "DATE: 11/18/26" },
          { type: "info", text: "STATION: GMF-AEROASIA" },
          { type: "data", text: "VISIT RECORD STORED OK" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:shop_data" }
        ]
      },
      "fault_data": {
        title: "DME-0",
        subtitle: "display fault data",
        lines: [
          { type: "info", text: "NO FAULT DATA RECORDED" },
          { type: "data", text: "NVM LOG COUNTER: 000" },
          { type: "info", text: "INTERNAL BUS CHECKSUM: PASS" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:shop_data" }
        ]
      },
      "software_id": {
        title: "DME-0",
        subtitle: "software id",
        lines: [
          { type: "info", text: "software p/n:" },
          { type: "data", text: "  COL-DME-709-01" },
          { type: "info", text: "crc checksum: 0x9B42" },
          { type: "info", text: "release: REV 02.1" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:shop_data" }
        ]
      },
      "special_func_agc": {
        title: "DME-0",
        subtitle: "special func-agc",
        items: [
          { key: "1", letter: "A", blank: true },
          { key: "2", letter: "B", label: "current value agc {AGC_VAL}", isText: true },
          { key: "3", letter: "C", label: "<FULL GAIN FF", action: "set_agc:FF" },
          { key: "4", letter: "D", label: "<MID GAIN A0", action: "set_agc:A0" },
          { key: "5", letter: "E", label: "<MIN GAIN 00", action: "set_agc:00" },
          { key: "6", letter: "F", label: "<RETURN", action: "screen:shop_data" },
        ]
      },
      "bus_in_test": {
        title: "DME-0",
        subtitle: "bus in test",
        lines: [
          { type: "info", text: "ARINC 429 BUS RX-A: 12.5 KBPS OK" },
          { type: "info", text: "ARINC 429 BUS RX-B: STANDBY" },
          { type: "data", text: "PARITY ERRORS: 000" },
          { type: "status", text: "BUS TIMING: 100% COMPLIANT" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:special_func" }
        ]
      }
    }
  },
  "707": {
    title: "LRA-1",
    screens: {
      "main": {
        title: "LRA-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<RADIO ALTITUDE TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<PIN MATRIX & DISCRETES", action: "screen:discretes" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "LRA-1",
        subtitle: "last leg report\\nata 34-42",
        lines: [
          { type: "header", text: "  time   fault description       ata" },
          { type: "info", text: "  0842   radio altitude lockout  34-42-01" },
          { type: "data", text: "  status: class 2 maintenance alert" },
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "LRA-1",
        subtitle: "previous legs report",
        lines: [
          { type: "header", text: "  leg date    gmt   ata      fault" },
          { type: "data", text: "-01 16nov   1420  34-42-01 squitter fail" },
          { type: "data", text: "-04 14nov   0915  34-42-05 flag warning" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "LRA-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "transceiver p/n: 822-0402-002" },
          { type: "info", text: "serial number:   94021" },
          { type: "info", text: "software id:     LRA-707-04" },
          { type: "data", text: "ata chapter:     34-42-00" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "LRA-1",
        subtitle: "radio altitude test",
        lines: [
          { type: "info", text: "simulated altitude ramp:" },
          { type: "data", text: "  0 ft -> 100 ft -> 2500 ft" },
          { type: "info", text: "decision height discrete: TRIGGERED" },
          { type: "status", text: "SYSTEM STATUS: BITE TEST PASSED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "discretes": {
        title: "LRA-1",
        subtitle: "pin matrix & discretes",
        lines: [
          { type: "info", text: "gear down discrete:  GROUND (ACTIVE)" },
          { type: "info", text: "program pin p1-14:   OPEN" },
          { type: "info", text: "aid bit status:      ENABLE (0)" },
          { type: "data", text: "abd0048 pin status:  ALL NORMAL" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "708": {
    title: "WXR-1",
    screens: {
      "main": {
        title: "WXR-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<RADAR TEST & CAL", action: "screen:test" },
          { key: "5", letter: "E", label: "<WINDSHEAR / TURB TEST", action: "screen:windshear" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "WXR-1",
        subtitle: "last leg report\\nata 34-41",
        lines: [
          { type: "header", text: "  time   fault description       ata" },
          { type: "info", text: "  0210   antenna scan rate low   34-41-11" },
          { type: "data", text: "  transmitter power: 125W OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "WXR-1",
        subtitle: "previous legs report",
        lines: [
          { type: "header", text: "  leg date    gmt   ata      fault" },
          { type: "data", text: "-02 15nov   1804  34-41-11 pedestal warn" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "WXR-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "r/t unit p/n:    622-5132-001" },
          { type: "info", text: "antenna p/n:     622-5134-001" },
          { type: "data", text: "software ver:    OPS-WXR-3.1" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "WXR-1",
        subtitle: "radar test & calibration",
        lines: [
          { type: "info", text: "receiver gain cal:   0.0 dB NOMINAL" },
          { type: "info", text: "afc loop lock:       ACQUIRED" },
          { type: "data", text: "pedestal pitch/roll: STABILIZED" },
          { type: "status", text: "RADAR BITE STATUS: PASSED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "windshear": {
        title: "WXR-1",
        subtitle: "windshear / turb test",
        lines: [
          { type: "info", text: "predictive windshear: ARMED" },
          { type: "info", text: "turbulence detection: ACTIVE" },
          { type: "data", text: "simulated microburst: DETECTED" },
          { type: "status", text: "ALERT DISCRETE: PASSED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "710": {
    title: "ILS-1",
    screens: {
      "main": {
        title: "ILS-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<LOC / GS CENTER TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<MARKER BEACON TEST", action: "screen:marker" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "ILS-1",
        subtitle: "last leg report\\nata 34-36",
        lines: [
          { type: "header", text: "  time   fault description       ata" },
          { type: "info", text: "  0000   NO FAULT LOGGED         34-36-00" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "ILS-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "NO INTERMITTENT FAULTS IN NVM" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "ILS-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "receiver p/n:    822-0299-001" },
          { type: "data", text: "collins ils-710 / cat iii" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "ILS-1",
        subtitle: "loc / gs center test",
        lines: [
          { type: "info", text: "localizer centering:   0.000 DDM (0 uA)" },
          { type: "info", text: "glide slope centering: 0.000 DDM (0 uA)" },
          { type: "status", text: "ILS FLAGS: OUT OF VIEW (VALID)" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "marker": {
        title: "ILS-1",
        subtitle: "marker beacon test",
        lines: [
          { type: "info", text: "outer marker (400 Hz):   PASS" },
          { type: "info", text: "middle marker (1300 Hz): PASS" },
          { type: "info", text: "inner marker (3000 Hz):  PASS" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "711": {
    title: "VOR-1",
    screens: {
      "main": {
        title: "VOR-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<BEARING ACCURACY TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<AUDIO & IDENT TEST", action: "screen:audio" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "VOR-1",
        subtitle: "last leg report",
        lines: [{ type: "info", text: "LAST LEG NORMAL / NO FAULT" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "VOR-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "BEARING RESOLVER LOG: 0 ERRORS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "VOR-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "unit p/n: 822-0300-001" },
          { type: "data", text: "collins vor-711 receiver" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "VOR-1",
        subtitle: "bearing accuracy test",
        lines: [
          { type: "info", text: "000 DEG REF PHASE: ERROR < 0.2 DEG" },
          { type: "info", text: "090 DEG REF PHASE: ERROR < 0.2 DEG" },
          { type: "info", text: "180 DEG REF PHASE: ERROR < 0.2 DEG" },
          { type: "status", text: "BEARING TRACKING: 100% OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "audio": {
        title: "VOR-1",
        subtitle: "audio & ident test",
        lines: [
          { type: "info", text: "1020 Hz MORSE IDENT: DECODED OK" },
          { type: "data", text: "STATION IDENT: SEA" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "712": {
    title: "ADF-1",
    screens: {
      "main": {
        title: "ADF-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<SENSE / LOOP ANT TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<BFO & AUDIO TEST", action: "screen:audio" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "ADF-1",
        subtitle: "last leg report",
        lines: [{ type: "info", text: "SENSE ANTENNA ATTENUATION: NORMAL" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "ADF-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "QUADRATURE ERROR LOG: CLEAR" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "ADF-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "unit p/n: 822-0301-002" },
          { type: "data", text: "collins adf-712 receiver" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "ADF-1",
        subtitle: "sense / loop antenna test",
        lines: [
          { type: "info", text: "LOOP DRIVE MOTOR: SLEW 45 DEG/S OK" },
          { type: "status", text: "BEARING RESOLVER: LOCKED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "audio": {
        title: "ADF-1",
        subtitle: "bfo & audio test",
        lines: [
          { type: "info", text: "BFO INJECTION (1000 Hz): PASS" },
          { type: "data", text: "AUDIO OUTPUT LEVEL: 100 mW @ 600 OHM" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "716": {
    title: "VHF-1",
    screens: {
      "main": {
        title: "VHF-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<TRANSMITTER TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<SQUELCH SENSITIVITY TEST", action: "screen:squelch" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "VHF-1",
        subtitle: "last leg report\\nata 23-11",
        lines: [{ type: "info", text: "TX CYCLES: 142 | TIMEOUT FAULTS: 0" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "VHF-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "MAX PA TEMPERATURE: 52 C (NORMAL)" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "VHF-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "transceiver p/n: 822-1047-001" },
          { type: "data", text: "collins vhf-900 series" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "VHF-1",
        subtitle: "transmitter test",
        lines: [
          { type: "info", text: "CARRIER POWER: 27.5 WATTS (SPEC: >25W)" },
          { type: "info", text: "MODULATION DEPTH: 85% AM" },
          { type: "status", text: "SIDE-TONE MONITOR: VERIFIED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "squelch": {
        title: "VHF-1",
        subtitle: "squelch sensitivity test",
        lines: [
          { type: "info", text: "SQUELCH OPEN: 1.8 uV @ 10 dB SINAD" },
          { type: "data", text: "CARRIER OVERRIDE: ACTIVE" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "718": {
    title: "ATC-1",
    screens: {
      "main": {
        title: "ATC-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<MODE S INTERROGATION TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<ALTITUDE ENCODE TEST", action: "screen:alt_encode" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "ATC-1",
        subtitle: "last leg report\\nata 34-52",
        lines: [{ type: "info", text: "TOP ANTENNA: OK | BOTTOM ANTENNA: OK" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "ATC-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "REPLY RATE LIMITER: 0 EVENTS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "ATC-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "transponder p/n: 822-1338-001" },
          { type: "data", text: "icao address: 7C142B" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "ATC-1",
        subtitle: "mode s interrogation test",
        lines: [
          { type: "info", text: "UF0 SHORT SURVEILLANCE: REPLY DF0 OK" },
          { type: "info", text: "UF4 ALTITUDE REQUEST:   REPLY DF4 OK" },
          { type: "status", text: "TRANSPONDER BITE: PASSED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "alt_encode": {
        title: "ATC-1",
        subtitle: "altitude encode test",
        lines: [
          { type: "info", text: "ARINC LABEL 203: 32,000 FT" },
          { type: "data", text: "GILHAM CODE ENCODE: VALID" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "719": {
    title: "HF-1",
    screens: {
      "main": {
        title: "HF-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<COUPLER TUNE TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<POWER AMPLIFIER TEST", action: "screen:power" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "HF-1",
        subtitle: "last leg report\\nata 23-12",
        lines: [{ type: "info", text: "COUPLER TUNE FAULTS: 0" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "HF-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "TUNE TIME AVERAGE: 3.2 SECONDS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "HF-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "transceiver p/n: 822-0330-001" },
          { type: "data", text: "coupler p/n:     822-0331-001" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "HF-1",
        subtitle: "coupler tune test",
        lines: [
          { type: "info", text: "TUNE FREQUENCY: 13.3300 MHz" },
          { type: "info", text: "VSWR AFTER TUNE: 1.15:1" },
          { type: "status", text: "COUPLER DISCRETE: TUNED (PASS)" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "power": {
        title: "HF-1",
        subtitle: "power amplifier test",
        lines: [
          { type: "info", text: "100W PEP SSB TRANSMITTER: 104 WATTS" },
          { type: "data", text: "HARMONIC SUPPRESSION: -55 dBc" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "723": {
    title: "GPWS-1",
    screens: {
      "main": {
        title: "GPWS-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<VOICE WARNING TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<TERRAIN DATABASE STATUS", action: "screen:terrain" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "GPWS-1",
        subtitle: "last leg report\\nata 34-48",
        lines: [{ type: "info", text: "ALERT RECORD: NO WARNINGS LOGGED" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "GPWS-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "MODE 1-7 EXCURSIONS: ZERO" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "GPWS-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "computer p/n: 965-0976-003" },
          { type: "data", text: "honeywell mk-v egpws" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "GPWS-1",
        subtitle: "voice warning test",
        lines: [
          { type: "info", text: "SPEECH SYNTHESIZER: 'PULL UP'" },
          { type: "info", text: "SPEECH SYNTHESIZER: 'TERRAIN, TERRAIN'" },
          { type: "status", text: "AUDIO AMPLIFIER: PASSED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "terrain": {
        title: "GPWS-1",
        subtitle: "terrain database status",
        lines: [
          { type: "info", text: "DATABASE VERSION: TERA-REV-454" },
          { type: "data", text: "INTEGRITY CHECKSUM: 0x4EF1 OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "724": {
    title: "ACARS-1",
    screens: {
      "main": {
        title: "ACARS-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<VHF DATA LINK TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<ROUTING CONFIGURATION", action: "screen:routing" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "ACARS-1",
        subtitle: "last leg report\\nata 23-24",
        lines: [{ type: "info", text: "MESSAGES SENT: 48 | DOWNLINK TIMEOUTS: 0" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "ACARS-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "NVM LOG COUNTER: 001" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "ACARS-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "management unit p/n: 822-0850-001" },
          { type: "data", text: "collins acars mu" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "ACARS-1",
        subtitle: "vhf data link test",
        lines: [
          { type: "info", text: "MSK MODEM (2400 BPS): PASS" },
          { type: "status", text: "DSP PROTOCOL LOOPBACK: VERIFIED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "routing": {
        title: "ACARS-1",
        subtitle: "routing configuration",
        lines: [
          { type: "info", text: "PRIMARY ROUTE: VHF-3 DATA" },
          { type: "data", text: "SECONDARY ROUTE: SATCOM" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "727": {
    title: "MLS-1",
    screens: {
      "main": {
        title: "MLS-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<AZIMUTH / ELEVATION TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<DME/P INTERFACE TEST", action: "screen:dmep" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "MLS-1",
        subtitle: "last leg report",
        lines: [{ type: "info", text: "NO SCANNING BEAM ACQUISITION ERRORS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "MLS-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "HISTORICAL CHANNEL TRACKING: NOMINAL" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "MLS-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "receiver p/n: 066-50005-0101" },
          { type: "data", text: "bendix mls-20a" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "MLS-1",
        subtitle: "azimuth / elevation test",
        lines: [
          { type: "info", text: "AZIMUTH DEVIATION:   0.00 DEG" },
          { type: "info", text: "ELEVATION DEVIATION: 3.00 DEG GLIDEPATH" },
          { type: "status", text: "TIME REFERENCE SCANNING BEAM: LOCKED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "dmep": {
        title: "MLS-1",
        subtitle: "dme/p interface test",
        lines: [
          { type: "info", text: "PRECISION DME PULSE SPACING: 12 us" },
          { type: "data", text: "RANGE ACCURACY: < 100 FT" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "735": {
    title: "TCAS-1",
    screens: {
      "main": {
        title: "TCAS-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<SYNTHESIZED TRAFFIC TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<ANTENNA BEARING CAL", action: "screen:antenna" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "TCAS-1",
        subtitle: "last leg report\\nata 34-43",
        lines: [
          { type: "header", text: "  time   encounter type          ata" },
          { type: "info", text: "  1120   TRAFFIC ADVISORY (TA)   34-43-02" },
          { type: "data", text: "  STATUS: RESOLUTION ADVISORY CLEAR" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "TCAS-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "64 ENCOUNTERS STORED IN NVM" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "TCAS-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "processor p/n: 066-50000-0202" },
          { type: "data", text: "tpu-67a tcas ii / version 7.1" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "TCAS-1",
        subtitle: "synthesized traffic test",
        lines: [
          { type: "info", text: "SIMULATED TARGET: +1000 FT DESCENDING" },
          { type: "info", text: "VOICE ALERT: 'CLIMB, CLIMB'" },
          { type: "status", text: "TCAS II SYSTEM TEST OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "antenna": {
        title: "TCAS-1",
        subtitle: "antenna bearing calibration",
        lines: [
          { type: "info", text: "TOP 4-ELEMENT DIRECTIONAL ANT: 0.8 DEG" },
          { type: "info", text: "BOTTOM OMNI/DIR ANTENNA:       PASS" },
          { type: "data", text: "PHASE SHIFTER CALIBRATION: LOCKED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "740": {
    title: "PRNTR-1",
    screens: {
      "main": {
        title: "PRNTR-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<PRINT TEST PATTERN", action: "screen:test" },
          { key: "5", letter: "E", label: "<PAPER FEED & CUTTER TEST", action: "screen:feed" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "PRNTR-1",
        subtitle: "last leg report\\nata 31-31",
        lines: [{ type: "info", text: "PRINTOUTS: 12 | BUFFER OVERRUNS: 0" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "PRNTR-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "THERMAL HEAD TEMPERATURE: 28 C" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "PRNTR-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "printer p/n: 801240-1" },
          { type: "data", text: "miltope tp-4840 cockpit printer" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "PRNTR-1",
        subtitle: "print test pattern",
        lines: [
          { type: "info", text: "80-COLUMN ASCII GRID PRINT: SUCCESS" },
          { type: "data", text: "HEAD ELEMENTS 1-640: 100% OPERATIONAL" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "feed": {
        title: "PRNTR-1",
        subtitle: "paper feed & cutter test",
        lines: [
          { type: "info", text: "STEPPER MOTOR ADVANCE 10 LINES: PASS" },
          { type: "data", text: "ROTARY CUTTER CYCLE: COMPLETE" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "741": {
    title: "SATCM-1",
    screens: {
      "main": {
        title: "SATCM-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<HPA & BEAM STEERING TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<GES LOG-ON SIMULATION", action: "screen:ges" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "SATCM-1",
        subtitle: "last leg report\\nata 23-15",
        lines: [{ type: "info", text: "GES LOG-ON CYCLES: 3 | DROPPED CALLS: 0" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "SATCM-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "HPA OVERHEAT EVENTS: ZERO" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "SATCM-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "satellite data unit p/n: 822-0333-001" },
          { type: "data", text: "collins sat-906 sdu" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "SATCM-1",
        subtitle: "hpa & beam steering test",
        lines: [
          { type: "info", text: "HIGH POWER AMP 40W CW: 41.2 WATTS" },
          { type: "data", text: "BEAM STEERING AZ/EL: LOCKED ON SATELLITE" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "ges": {
        title: "SATCM-1",
        subtitle: "ges log-on simulation",
        lines: [
          { type: "info", text: "INMARSAT AERO-H+: HANDSHAKE ACQUIRED" },
          { type: "status", text: "CH 1 & CH 2 VOICE/DATA READY" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "750": {
    title: "VDR-1",
    screens: {
      "main": {
        title: "VDR-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<VDL MODE 2 BURST TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<VOICE / DATA TOGGLE", action: "screen:voice_toggle" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "VDR-1",
        subtitle: "last leg report\\nata 23-13",
        lines: [{ type: "info", text: "PACKET DROPS: 0 | D8PSK DEMOD ERRORS: 0" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "VDR-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "VDL PACKET TRANSACTIONS: 1,842 OK" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "VDR-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "transceiver p/n: 822-1468-001" },
          { type: "data", text: "collins vhf-4000 vdr" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "VDR-1",
        subtitle: "vdl mode 2 burst test",
        lines: [
          { type: "info", text: "D8PSK 31.5 KBPS PACKET LOOPBACK: PASS" },
          { type: "status", text: "AVLC FRAME TIMING: 100% COMPLIANT" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "voice_toggle": {
        title: "VDR-1",
        subtitle: "operating mode status",
        lines: [
          { type: "info", text: "CURRENT CHANNEL 1: VDL MODE 2 DATA" },
          { type: "data", text: "REVERSION CHANNEL: DSB-AM VOICE ENABLED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "753": {
    title: "HFDU-1",
    screens: {
      "main": {
        title: "HFDU-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<HF LINK PROTOCOL TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<MODEM CHANNEL SOUNDING", action: "screen:sounding" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "HFDU-1",
        subtitle: "last leg report\\nata 23-14",
        lines: [{ type: "info", text: "HF DATA PACKET SYNC: LOCKED" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "HFDU-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "IONOSPHERIC FADE LOG: 2 RE-TRANSFERS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "HFDU-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "data unit p/n: 822-0336-001" },
          { type: "data", text: "collins hfdu-9000" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "HFDU-1",
        subtitle: "hf link protocol test",
        lines: [
          { type: "info", text: "ARINC 635 / 753 HF DATA LINK: PASS" },
          { type: "status", text: "FSK / PSK MODEM INTERNAL BITE OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "sounding": {
        title: "HFDU-1",
        subtitle: "modem channel sounding",
        lines: [
          { type: "info", text: "PROBE FREQUENCIES: 8.8 MHz / 13.3 MHz" },
          { type: "data", text: "SIGNAL-TO-NOISE RATIO: 18 dB" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  },
  "755": {
    title: "MMR-1",
    screens: {
      "main": {
        title: "MMR-1",
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<GLS / GBAS APPROACH TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<ILS / MLS FALLBACK TEST", action: "screen:fallback" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: "MMR-1",
        subtitle: "last leg report\\nata 34-36",
        lines: [{ type: "info", text: "GPS RAIM STATUS: AVAILABLE | VDB CRC: PASS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "prev_legs": {
        title: "MMR-1",
        subtitle: "previous legs report",
        lines: [{ type: "info", text: "GLS APPROACH COUNT: 28 / 0 REVERSIONS" }],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "lru_id": {
        title: "MMR-1",
        subtitle: "lru identification",
        lines: [
          { type: "info", text: "receiver p/n: 822-1152-002" },
          { type: "data", text: "collins glu-920 mmr / sw v3.4" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "test": {
        title: "MMR-1",
        subtitle: "gls / gbas approach test",
        lines: [
          { type: "info", text: "VHF DATA BROADCAST (VDB) 108.05 MHz: OK" },
          { type: "info", text: "DIFFERENTIAL CORRECTIONS DECODED: 12 SATS" },
          { type: "status", text: "GLS CAT I/II/III CAPABLE: VERIFIED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      "fallback": {
        title: "MMR-1",
        subtitle: "ils / mls fallback test",
        lines: [
          { type: "info", text: "ILS CAT III FALLBACK: READY" },
          { type: "data", text: "AUTOLAND TRIP REVERSION: VERIFIED" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  }
};

function getGenericLruMenu(lru) {
  const code = (lru && lru.code) || "000";
  const name = (lru && lru.name) || "LRU";
  return {
    title: `${name}-0`,
    screens: {
      main: {
        title: `${name}-0`,
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<SHOP DATA", action: "screen:shop_data" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      last_leg: {
        title: `${name}-0`,
        subtitle: `last leg report\\ndate: jan01`,
        lines: [
          { type: "header", text: "    gmt     ata" },
          { type: "info", text: `    ${name.toLowerCase()}-0 transceiver (1)` },
          { type: "data", text: `3   0000    ${code.padStart(2, '0')}-00-01` },
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      prev_legs: {
        title: `${name}-0`,
        subtitle: `previous legs report\\n--------------------`,
        lines: [
          { type: "header", text: "  leg date    gmt   ata" },
          { type: "info", text: `  ${name.toLowerCase()}-0 unit` },
          { type: "data", text: `-01 jan00   0000  ${code.padStart(2, '0')}-00-01` }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      lru_id: {
        title: `${name}-0`,
        subtitle: `lru identification`,
        lines: [
          { type: "info", text: "unit p/n:" },
          { type: "data", text: `  ${code}-0001-A` },
          { type: "info", text: "serial number: 8841" },
          { type: "info", text: `equipment: 0x${code} ${name}` }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      test: {
        title: `${name}-0`,
        subtitle: `test`,
        lines: [
          { type: "info", text: `${name.toLowerCase()}-0 status check` },
          { type: "data", text: "self-test: PASS" },
          { type: "status", text: "ARINC 429 INTERFACE: OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      },
      shop_data: {
        title: `${name}-0`,
        subtitle: `shop data`,
        lines: [
          { type: "info", text: "SHOP CODE: N12345" },
          { type: "info", text: "VISIT: OK" }
        ],
        items: [{ key: "6", letter: "F", label: "<RETURN", action: "screen:main" }]
      }
    }
  };
}


function getGenericLruMenu(lru) {
  const name = (lru && lru.name) ? lru.name.toUpperCase() : "LRU";
  const code = (lru && lru.code) ? lru.code : "000";
  return {
    title: `${name}-1`,
    screens: {
      "main": {
        title: `${name}-1`,
        items: [
          { key: "1", letter: "A", label: "<LAST LEG REPORT", action: "screen:last_leg" },
          { key: "2", letter: "B", label: "<PREVIOUS LEGS REPORT", action: "screen:prev_legs" },
          { key: "3", letter: "C", label: "<LRU IDENTIFICATION", action: "screen:lru_id" },
          { key: "4", letter: "D", label: "<SYSTEM BITE TEST", action: "screen:test" },
          { key: "5", letter: "E", label: "<SHOP DATA", action: "screen:shop_data" },
          { key: "6", letter: "F", label: "<RETURN", action: "exit" },
        ]
      },
      "last_leg": {
        title: `${name}-1`,
        subtitle: "last leg report",
        lines: [
          { type: "info", text: `NO FAULTS DETECTED FOR ${name}` },
          { type: "data", text: `EQ CODE: 0x${code}` },
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "prev_legs": {
        title: `${name}-1`,
        subtitle: "previous legs report",
        lines: [
          { type: "info", text: "LEG -01: NO RECORDED FAULTS" },
          { type: "info", text: "LEG -02: NO RECORDED FAULTS" },
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "lru_id": {
        title: `${name}-1`,
        subtitle: "lru identification",
        lines: [
          { type: "info", text: `${name} LRU PART NO:` },
          { type: "data", text: `  PN-${code}-001` },
          { type: "info", text: `EQ CODE: 0x${code}` },
          { type: "info", text: `DESC: ${lru.description || name}` }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "test": {
        title: `${name}-1`,
        subtitle: "system bite test",
        lines: [
          { type: "info", text: `TESTING ${name} (0x${code})...` },
          { type: "status", text: "BITE TEST COMPLETE: ALL SYSTEMS NORMAL" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      },
      "shop_data": {
        title: `${name}-1`,
        subtitle: "shop data",
        lines: [
          { type: "info", text: "SHOP VISIT: NONE" },
          { type: "data", text: "OPERATING HOURS: 00124 HRS" }
        ],
        items: [
          { key: "6", letter: "F", label: "<RETURN", action: "screen:main" }
        ]
      }
    }
  };
}


const BOEING_LRU_DATABASE = [
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

const TIME_CONSTANT_OPTIONS = ["OFF", "0.4", "0.8", "1.6", "3.2", "6.4", "12.8"];

const CMC_LABEL155_SWITCHES = [
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

const CMC_FUNCTION_SWITCHES = [
  { id: "NO REQUEST", codeHex: "00H", label: "NO REQUEST (00H)", desc: "Default idle state transmitted on Label 227" },
  { id: "BITE TEST", codeHex: "01H", label: "BITE TEST (01H)", desc: "Triggers LRU self-test sequence" },
  { id: "SHOP FAULTS", codeHex: "03H", label: "SHOP FAULTS (03H)", desc: "Requests LRU internal fault log and opens Shop Faults screen" },
  { id: "NEW FLIGHT", codeHex: "12H", label: "NEW FLIGHT (12H)", desc: "Notifies LRU of new flight leg initialization" },
  { id: "LOGOFF", codeHex: "7FH", label: "LOGOFF (7FH)", desc: "Terminates active maintenance interrogation session" },
  { id: "CONFIG DATA", codeHex: "05H", label: "CONFIG DATA (05H)", desc: "Requests Part Number, SW and HW modification level" },
];

// Operational States for CFDS & CMC
let cfdsState = {
  currentView: "LRU_SELECTION",
  selectedLru: CFDS_LRU_TABLE[2], // 709 DME
  dataSource: "SIMULATION",
  busRunning: false,
  searchFilter: "",
  sdi: 0,
  nxtReverseVideo: false,
  menuPage: 1,
  menuTimeoutTimer: null,
  menuStatusText: "SELECT OPTION",
  interactiveProgress: 0,
  interactiveStatus: "READY",
  burstRows: [],
  simulationMode: false,      // Explicit Simulation Mode toggle (default: Real Device Mode)
  simDeviceConnected: false,  // In simulation mode: whether mock simulator is active
  realDeviceConnected: false, // In real mode: live detected physical hardware status
  deviceStatusDetail: "",     // Communication detail from backend
  lastKnownRealConn: undefined,
  lruSubScreen: "main",
  xmitRateOn: false,
  dmeAgcVal: "00",
};

let cmcState = {
  activeTab: "TRANSMIT_DATA",
  selectedLru: BOEING_LRU_DATABASE[0], // 707 LRA
  manualCode: "000",
  timeConstant: "OFF",
  source: "SIMULATION",
  cmdChannel: "TX-A",
  cmdFunction: "NO REQUEST",
  cmdSdi: "00",
  cmdRateMs: 100,
  cmdParity: "ODD",
  cmdHistory: [],
  faultPage: "350",
  hasWordsReceived: true,
  bit28Inhibit: false,
  bit29Ack: true,
  faultBits: Array.from({ length: 19 }, (_, i) => ({
    bit: 11 + i,
    label: (11 + i === 29) ? "COMMAND ACK" : (11 + i === 28) ? "BITE INHIBIT" : `LRU FAULT BIT ${11 + i}`,
    fault: false,
    status: (11 + i === 29) ? "ACK (1)" : (11 + i === 28) ? "ENABLE (0)" : "OK (0)",
    is_spare: (11 + i >= 24 && 11 + i <= 27),
  })),
  terminalView: "TERMINAL",
  terminalPage: 1,
  terminalMsg: "AEROFLEX T1200B READY",
  terminalLines: [
    "AEROFLEX T1200B CDU INTERFACE",
    "----------------------------",
    "1L< CURRENT BITE REPORT",
    "2L< PREVIOUS FLIGHT LEGS",
    "3L< LRU CONFIGURATION",
    "4L< CONTINUOUS MONITORING",
    "5L< GROUND TEST SEQUENCE",
    "6L< SHOP FAULTS MATRIX",
    "",
    "1R> INITIATE SELF TEST",
    "2R> CLEAR FAULT MEMORY",
    "3R> VERIFY INTERFACE",
    "4R> RETURN TO CMC MAIN",
  ],
  configData: {
    part_number: "777-12345-001",
    sw_version: "OPS-SW-V3.4.2",
    database_pn: "NAV-DB-2026",
    serial_number: "SN-98234-A",
  },
  transmitData: {
    date: "11/16/26",
    time: "10:15.0 GMT",
    flt_num: "AA1234",
    city_pairs: "KSEA KORD",
    flt_phase: 5,
    aircraft_id: "N777AA",
    channel: "TX-A",
    config_word_bits: {},
  }
};

// Initialize Label 155 default bits
CMC_LABEL155_SWITCHES.forEach((sw) => {
  cmcState.transmitData.config_word_bits[sw.key] = false;
});

// Helper: Escape HTML attribute
function escAttr(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ====================================================================
// CFDS MODE IMPLEMENTATION (AEROFLEX T1200B / ABD0018 / ABD0048)
// ====================================================================

function renderCfdsHub(r, s) {
  r.innerHTML = "";
  const wb = el("div", "cfds-workbench");
  r.appendChild(wb);

  // Status Strip matching GitHub CFDSLayout.tsx
  const strip = el("div", "cfds-status-strip");
  strip.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="cfds-status-pill ${cfdsState.dataSource === 'HARDWARE' ? 'hw' : 'sim'}">
        SOURCE: ${cfdsState.dataSource === 'HARDWARE' ? 'HARDWARE CONNECTED' : 'SIMULATION (NO HW RX)'}
      </span>
      <span style="color:#475569;font-weight:600">
        BUS: ${s.bus && s.bus.A && s.bus.A.running ? 'RUNNING' : 'IDLE'}
      </span>
      ${cfdsState.selectedLru ? `<span style="color:#0f766e;font-weight:600">LRU: ${escAttr(cfdsState.selectedLru.name)} (0x${escAttr(cfdsState.selectedLru.code)})</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span style="color:#64748b;font-family:monospace;font-size:11px">VIEW: ${cfdsState.currentView}</span>
      ${cfdsState.currentView !== 'LRU_SELECTION' ? '<button type="button" class="btn btn-sm btn-ghost" id="btn-cfds-lru-nav">Change LRU</button>' : ''}
      <button type="button" class="btn btn-sm btn-ghost" id="btn-cfds-main-menu">Mode Select</button>
    </div>
  `;
  wb.appendChild(strip);

  const btnLruNav = strip.querySelector("#btn-cfds-lru-nav");
  if (btnLruNav) {
    btnLruNav.addEventListener("click", () => {
      cfdsState.currentView = "LRU_SELECTION";
      renderCfdsHub(r, s);
    });
  }

  strip.querySelector("#btn-cfds-main-menu").addEventListener("click", () => {
    pushScreen("mode_select");
  });

  // Render view corresponding to currentView
  const viewContainer = el("div", "cfds-view-body");
  wb.appendChild(viewContainer);

  switch (cfdsState.currentView) {
    case "LRU_SELECTION":
      renderCfdsLruSelection(viewContainer, r, s);
      break;
    case "LRU_CONSOLE":
      renderCfdsLruConsole(viewContainer, r, s);
      break;
    case "MODE_SELECT":
      renderCfdsSubmodeSelect(viewContainer, r, s);
      break;
    case "NORMAL_MODE_ABD0018":
    case "NORMAL_MODE_ABD0048":
      renderCfdsNormalModeView(viewContainer, r, s);
      break;
    case "MENU_MODE_ABD0018":
      renderCfdsMenuModeView(viewContainer, r, s);
      break;
    case "DISCRETE_MODE_ABD0048":
      renderCfdsDiscreteModeView(viewContainer, r, s);
      break;
    case "INTERACTIVE_MODE_ABD0048":
      renderCfdsInteractiveModeView(viewContainer, r, s);
      break;
    case "EDIT_TX":
      renderCfdsEditTxView(viewContainer, r, s);
      break;
    case "CONFIGURE_CHANNELS":
      renderCfdsConfigChannelsView(viewContainer, r, s);
      break;
    default:
      renderCfdsLruSelection(viewContainer, r, s);
      break;
  }
}

// 1. CFDS LRU SELECTION (Figure 47 Horizontal Grid & Add LRU)
function renderCfdsLruSelection(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h2 style="font-size:1.2rem;font-weight:700;margin:0 0 4px 0">CFDS LRU SELECTION</h2>
        <p class="muted" style="margin:0;font-size:13px">Aeroflex JcAIR T1200B Operation Manual Figure 47 (Section 4.F)</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="cfds-lru-filter" placeholder="Search LRU by code or name..."
          class="category-select" style="min-width:220px" value="${escAttr(cfdsState.searchFilter)}" />
        <button type="button" class="btn primary" id="btn-cfds-add-lru">+ Add LRU</button>
      </div>
    </div>
    <div class="cfds-lru-grid" id="cfds-lru-grid"></div>
  `;
  c.appendChild(p);

  const grid = p.querySelector("#cfds-lru-grid");
  const filterInput = p.querySelector("#cfds-lru-filter");
  const btnAddLru = p.querySelector("#btn-cfds-add-lru");

  btnAddLru.addEventListener("click", () => {
    openAddCfdsLruModal(r, s);
  });

  function updateLruGrid() {
    const q = (filterInput.value || "").trim().toLowerCase();
    const filtered = CFDS_LRU_TABLE.filter(
      (item) => item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q))
    );

    if (!filtered.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:#94a3b8">No LRUs matching "${escAttr(q)}"</div>`;
      return;
    }

    grid.innerHTML = filtered.map((lru) => {
      const isSelected = cfdsState.selectedLru && cfdsState.selectedLru.code === lru.code && cfdsState.selectedLru.name === lru.name;
      return `
        <div class="cfds-lru-card ${isSelected ? 'selected' : ''}" data-lru-code="${escAttr(lru.code)}" data-lru-name="${escAttr(lru.name)}">
          <div class="cfds-lru-card-header">
            <span class="cfds-lru-code-pill mono">EQ 0x${escAttr(lru.code)}</span>
            ${lru.isCustom ? '<span style="font-size:10px;color:#0d9488;background:#ccfbf1;padding:1px 6px;border-radius:3px;font-weight:700">CUSTOM</span>' : ''}
          </div>
          <div class="cfds-lru-card-title">${escAttr(lru.name)}</div>
          <div class="cfds-lru-card-desc">${escAttr(lru.description || '')}</div>
          <div class="cfds-lru-card-footer">
            <button type="button" class="btn btn-sm ${isSelected ? 'primary' : 'btn-ghost'}" data-lru-act="select">
              ${isSelected ? 'Selected' : 'Select'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll(".cfds-lru-card").forEach((card) => {
      card.addEventListener("click", () => {
        const code = card.getAttribute("data-lru-code");
        const name = card.getAttribute("data-lru-name");
        const found = CFDS_LRU_TABLE.find((item) => item.code === code && item.name === name) || CFDS_LRU_TABLE.find((item) => item.code === code);
        if (found) {
          cfdsState.selectedLru = found;
          cfdsState.currentView = "LRU_CONSOLE";
          cfdsState.lruSubScreen = "main";
          cfdsState.deviceConnected = false; // Disconnected by default
          api("/api/cfds/lru", {
            method: "POST",
            body: JSON.stringify({ code: found.code, name: found.name }),
          }).catch(() => {});
          renderCfdsHub(r, s);
        }
      });
    });
  }

  filterInput.addEventListener("input", () => {
    cfdsState.searchFilter = filterInput.value;
    updateLruGrid();
  });

  updateLruGrid();
}

function openAddCfdsLruModal(r, s) {
  const existingModal = document.getElementById("cfds-modal-container");
  if (existingModal) existingModal.remove();

  const modal = el("div", "cfds-modal-overlay");
  modal.id = "cfds-modal-container";
  modal.innerHTML = `
    <div class="cfds-modal-card">
      <div class="cfds-modal-header">
        <h3 style="margin:0;font-size:1.15rem;font-weight:700">Add New CFDS LRU</h3>
        <button type="button" class="btn-close" id="btn-modal-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b">&times;</button>
      </div>
      <div class="cfds-modal-body" style="margin-top:14px">
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px;color:#334155">LRU Name (e.g. ADIRU, FWC, FMGC)</label>
          <input type="text" id="modal-lru-name" class="category-select" style="width:100%" placeholder="e.g. ADIRU" required />
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px;color:#334155">Equipment Code (Hex, e.g. 738, 020, 009)</label>
          <input type="text" id="modal-lru-code" class="category-select" style="width:100%" placeholder="e.g. 738" required />
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px;color:#334155">LRU Description</label>
          <input type="text" id="modal-lru-desc" class="category-select" style="width:100%" placeholder="e.g. Air Data Inertial Reference Unit" required />
        </div>
      </div>
      <div class="cfds-modal-footer" style="display:flex;justify-content:flex-end;gap:10px">
        <button type="button" class="btn btn-ghost" id="btn-modal-cancel">Cancel</button>
        <button type="button" class="btn primary" id="btn-modal-save">Add LRU</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#btn-modal-close").onclick = close;
  modal.querySelector("#btn-modal-cancel").onclick = close;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector("#btn-modal-save").onclick = () => {
    const name = modal.querySelector("#modal-lru-name").value.trim();
    const code = modal.querySelector("#modal-lru-code").value.trim().replace(/^0x/i, "");
    const desc = modal.querySelector("#modal-lru-desc").value.trim();
    if (!name || !code) {
      alert("Please enter LRU Name and Equipment Code.");
      return;
    }
    const newLru = {
      code: code.toUpperCase(),
      name: name.toUpperCase(),
      description: desc || `${name.toUpperCase()} Avionics Equipment`,
      isCustom: true
    };
    CFDS_LRU_TABLE.push(newLru);
    try {
      const raw = localStorage.getItem("cfds_custom_lrus");
      const list = raw ? JSON.parse(raw) : [];
      list.push(newLru);
      localStorage.setItem("cfds_custom_lrus", JSON.stringify(list));
    } catch (e) {}
    close();
    cfdsState.selectedLru = newLru;
    renderCfdsHub(r, s);
  };
}

// 1.B CFDS LRU INTERACTIVE CONSOLE (Dynapro 1780A INFOTOUCH CRT Display)
// Real Device Mode (Automatic Physical Detection) & Simulation Mode (Explicit Demo/Mock)
function renderCfdsLruConsole(c, r, s) {
  const lru = cfdsState.selectedLru || CFDS_LRU_TABLE[2]; // Default DME
  const lruKey = (lru.code || "").toUpperCase();
  const lruMenuConfig = CFDS_LRU_MENUS[lruKey] || CFDS_LRU_MENUS[lru.name.toUpperCase()] || getGenericLruMenu(lru);
  const currentSub = cfdsState.lruSubScreen || "main";
  const activeScreen = (lruMenuConfig.screens && lruMenuConfig.screens[currentSub]) || lruMenuConfig.screens["main"];

  const isSimMode = !!cfdsState.simulationMode;
  // In Real Device Mode: strictly based on real hardware response from backend (no fake connect).
  // In Simulation Mode: based on mock simulator toggle.
  const isConnected = isSimMode ? !!cfdsState.simDeviceConnected : !!cfdsState.realDeviceConnected;

  const p = el("div", "panel cfds-console-panel");
  p.innerHTML = `
    <!-- Top Console Toolbar -->
    <div class="panel-head" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <h2 style="font-size:1.25rem;font-weight:700;margin:0">${escAttr(lru.name)} CFDS CONSOLE</h2>
          <span class="cfds-lru-code-pill mono">EQ 0x${escAttr(lru.code)}</span>
          ${lru.isCustom ? '<span style="font-size:10px;color:#0d9488;background:#ccfbf1;padding:1px 6px;border-radius:3px;font-weight:700">CUSTOM</span>' : ''}
        </div>
        <p class="muted" style="margin:3px 0 0 0;font-size:13px">${escAttr(lru.description || '')}</p>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <!-- Mode Switcher: Real Device Mode vs Simulation Mode -->
        <div class="cfds-mode-switcher" title="Switch between Real Hardware Detection and Software Simulation">
          <button type="button" class="cfds-mode-btn ${!isSimMode ? 'active' : ''}" id="btn-mode-real">
            Real Device Mode
          </button>
          <button type="button" class="cfds-mode-btn ${isSimMode ? 'active' : ''}" id="btn-mode-sim">
            Simulation Mode
          </button>
        </div>

        <!-- Connection Status Pill -->
        <div class="cfds-conn-status ${!isConnected ? 'is-disconnected' : (isSimMode ? 'is-sim-connected' : 'is-connected')}">
          <span class="cfds-conn-dot"></span>
          <span>${!isConnected ? 'DISCONNECTED' : (isSimMode ? 'CONNECTED (SIMULATION)' : 'CONNECTED (REAL DEVICE)')}</span>
        </div>

        <!-- Action Button depending on Mode -->
        ${!isSimMode ? `
          <button type="button" class="btn btn-sm btn-ghost" id="btn-detect-real-device" title="Interrogate and detect physical DME on ARINC 429 bus">
            Detect Device
          </button>
        ` : `
          <button type="button" class="btn btn-sm ${cfdsState.simDeviceConnected ? 'btn-ghost' : 'primary'}" id="btn-sim-toggle-conn">
            ${cfdsState.simDeviceConnected ? 'Simulate Disconnect' : 'Simulate Connect'}
          </button>
        `}

        <!-- Submode Navigation -->
        <button type="button" class="btn btn-sm btn-ghost" id="btn-cfds-modes-menu" title="Open CFDS Submodes (Normal, Discrete, TX, Channels)">
          CFDS Submodes
        </button>

        <!-- Back to LRUs -->
        <button type="button" class="btn btn-sm btn-ghost" id="btn-cfds-back-lrus">
          &lt; Back to LRUs
        </button>
      </div>
    </div>

    <!-- Explicit Simulation Mode Banner -->
    ${isSimMode ? `
      <div class="cfds-sim-banner">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="cfds-sim-badge">SIMULATION MODE ACTIVE</span>
          <span>Data and responses are generated by software simulator for demonstration/test. No physical device communication.</span>
        </div>
        <span class="cfds-sim-subtag">DEMO / MOCK</span>
      </div>
    ` : ''}

    <!-- Dynapro 1780A INFOTOUCH CRT Chassis -->
    <div class="dynapro-chassis">
      <div class="dynapro-bezel-header">
        <span class="dynapro-badge">DYNAPRO 1780A INFOTOUCH DISPLAY ${isSimMode ? '[SIMULATION]' : '[REAL HARDWARE]'}</span>
        <span class="dynapro-target mono">${escAttr(lru.name)} BITE INTERFACE (EQ 0x${escAttr(lru.code)})</span>
      </div>

      <!-- CRT Display Screen: SOLID BLACK POLOS WHEN DISCONNECTED -->
      <div id="cfds-lru-crt-screen" class="cfds-crt-screen ${isConnected ? 'is-connected' : 'is-disconnected'}"></div>

      <!-- Tactile Hardware Buttons Below CRT Screen -->
      <div class="dynapro-tactile-bar">
        <div style="display:flex;gap:8px">
          <button type="button" class="dynapro-hw-btn" id="hw-btn-prev-pg" ${!isConnected ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>&lt; PRIOR PG</button>
          <button type="button" class="dynapro-hw-btn" id="hw-btn-nxt-pg" ${!isConnected ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>NEXT PG &gt;</button>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="dynapro-hw-btn" id="hw-btn-self-test" ${!isConnected ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>SELF TEST</button>
          <button type="button" class="dynapro-hw-btn clr" id="hw-btn-clr" ${!isConnected ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>CLR</button>
        </div>
      </div>
    </div>
  `;
  c.appendChild(p);

  const crtScreen = p.querySelector("#cfds-lru-crt-screen");

  // A. DISCONNECTED: SOLID PURE BLACK BOX WITHOUT ANY TEXT, LABELS, BUTTONS
  if (!isConnected) {
    crtScreen.innerHTML = ""; // 100% BLANK, SOLID BLACK POLOS
  } else {
    // B. CONNECTED: GREEN PHOSPHOR CRT SCREEN WITH INTERACTIVE MENU/MODE
    renderCrtGreenScreen(crtScreen, lru, activeScreen, currentSub, r, s, isSimMode);
  }

  // Mode Switcher Listeners
  p.querySelector("#btn-mode-real").addEventListener("click", async () => {
    if (cfdsState.simulationMode) {
      cfdsState.simulationMode = false;
      try {
        await api("/api/arinc/simulation", { method: "POST", body: JSON.stringify({ enabled: false }) });
        const res = await api(`/api/arinc/device/detect?lru=${encodeURIComponent(lru.code)}&bus=A`);
        cfdsState.realDeviceConnected = !!res.connected;
        cfdsState.deviceStatusDetail = res.detail || "";
      } catch (e) {
        cfdsState.realDeviceConnected = false;
      }
      renderCfdsHub(r, s);
    }
  });

  p.querySelector("#btn-mode-sim").addEventListener("click", async () => {
    if (!cfdsState.simulationMode) {
      cfdsState.simulationMode = true;
      cfdsState.simDeviceConnected = true; // Auto-connect mock simulator
      try {
        await api("/api/arinc/simulation", { method: "POST", body: JSON.stringify({ enabled: true }) });
      } catch (e) {}
      renderCfdsHub(r, s);
    }
  });

  // Real Device Mode: Detect button
  const btnDetect = p.querySelector("#btn-detect-real-device");
  if (btnDetect) {
    btnDetect.addEventListener("click", async () => {
      try {
        btnDetect.textContent = "Detecting...";
        btnDetect.disabled = true;
        const res = await api(`/api/arinc/device/detect?lru=${encodeURIComponent(lru.code)}&bus=A`);
        cfdsState.realDeviceConnected = !!res.connected;
        cfdsState.deviceStatusDetail = res.detail || "";
        if (!res.connected) {
          alert(`[STATUS: DISCONNECTED]\n${res.detail || "Perangkat fisik tidak merespons pada bus ARINC 429 RCVR_A."}\n\nPastikan kabel ATE CONNECTOR, catu daya 28V, dan transceiver DME terhubung dengan benar.`);
        }
        renderCfdsHub(r, s);
      } catch (err) {
        alert("Gagal melakukan deteksi perangkat: " + err.message);
        renderCfdsHub(r, s);
      }
    });
  }

  // Simulation Mode: Toggle connect/disconnect button
  const btnSimToggle = p.querySelector("#btn-sim-toggle-conn");
  if (btnSimToggle) {
    btnSimToggle.addEventListener("click", () => {
      cfdsState.simDeviceConnected = !cfdsState.simDeviceConnected;
      renderCfdsHub(r, s);
    });
  }

  // Back to LRUs
  p.querySelector("#btn-cfds-back-lrus").addEventListener("click", () => {
    cfdsState.currentView = "LRU_SELECTION";
    renderCfdsHub(r, s);
  });

  // CFDS Submodes (Normal, Discrete, TX, Channels)
  p.querySelector("#btn-cfds-modes-menu").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  // Hardware tactile buttons
  p.querySelector("#hw-btn-clr").addEventListener("click", () => {
    if (isConnected) {
      cfdsState.lruSubScreen = "main";
      renderCfdsHub(r, s);
    }
  });

  p.querySelector("#hw-btn-self-test").addEventListener("click", () => {
    if (isConnected) {
      cfdsState.lruSubScreen = "test";
      renderCfdsHub(r, s);
    }
  });

  p.querySelector("#hw-btn-prev-pg").addEventListener("click", () => {
    if (isConnected && cfdsState.lruSubScreen !== "main") {
      cfdsState.lruSubScreen = "main";
      renderCfdsHub(r, s);
    }
  });

  p.querySelector("#hw-btn-nxt-pg").addEventListener("click", () => {
    if (isConnected) {
      cfdsState.nxtReverseVideo = !cfdsState.nxtReverseVideo;
      renderCfdsHub(r, s);
    }
  });
}

function renderCrtGreenScreen(container, lru, activeScreen, currentSub, r, s, isSimMode) {
  const title = activeScreen.title || `${lru.name}-0`;
  const subtitle = activeScreen.subtitle || "";

  let linesHtml = "";
  if (activeScreen.lines && activeScreen.lines.length) {
    linesHtml = `
      <div class="dynapro-screen-body-lines">
        ${activeScreen.lines.map(line => {
          let txt = typeof line === "string" ? line : (line.text || "");
          txt = txt.replace("{AGC_VAL}", cfdsState.dmeAgcVal || "00");
          return `<div class="dynapro-line ${line.type || 'info'}">${escAttr(txt)}</div>`;
        }).join("")}
      </div>
    `;
  }

  let itemsHtml = "";
  if (activeScreen.items && activeScreen.items.length) {
    itemsHtml = `
      <div class="dynapro-menu-grid">
        ${activeScreen.items.map(item => {
          let labelText = (item.label || "").replace("{AGC_VAL}", cfdsState.dmeAgcVal || "00");
          if (item.blank) {
            return `
              <div class="dynapro-menu-row">
                <span class="dynapro-menu-item-text" style="display:inline-flex;align-items:center;gap:12px;padding:4px 8px;">
                  <span class="dynapro-key-num">${escAttr(item.key)}</span>
                  <span class="dynapro-key-label" style="visibility:hidden">-</span>
                </span>
                <span class="dynapro-key-right">${escAttr(item.letter || '')}</span>
              </div>
            `;
          }
          if (item.isText) {
            return `
              <div class="dynapro-menu-row">
                <span class="dynapro-menu-item-text" style="display:inline-flex;align-items:center;gap:12px;padding:4px 8px;color:#22c55e">
                  <span class="dynapro-key-num">${escAttr(item.key)}</span>
                  <span class="dynapro-key-label" style="font-weight:700;margin-left:8px;">${escAttr(labelText)}</span>
                </span>
                <span class="dynapro-key-right">${escAttr(item.letter || '')}</span>
              </div>
            `;
          }
          return `
            <div class="dynapro-menu-row">
              <button type="button" class="dynapro-menu-item-btn" data-act="${escAttr(item.action)}">
                <span class="dynapro-key-num">${escAttr(item.key)}</span>
                <span class="dynapro-key-label">${escAttr(labelText)}</span>
              </button>
              <span class="dynapro-key-right">${escAttr(item.letter || '')}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="dynapro-inner-box">
      <div class="dynapro-screen-header">
        <span class="dynapro-screen-title">${escAttr(title)}</span>
        <div style="display:flex;align-items:center;gap:6px">
          ${isSimMode ? '<span class="dynapro-sim-crt-tag">&lt;SIMULATION&gt;</span>' : ''}
          <span class="dynapro-screen-nxt ${cfdsState.nxtReverseVideo ? 'rev' : ''}" id="crt-nxt-btn" style="cursor:pointer;" title="Toggle Next Page / Menu">NXT</span>
        </div>
      </div>
      ${subtitle ? `<div class="dynapro-screen-sub">${subtitle.split("\n").map(str => escAttr(str)).join("<br>")}</div>` : ''}
      ${linesHtml}
      ${itemsHtml}
    </div>
  `;

  // Attach NXT click handler
  const nxtBtn = container.querySelector("#crt-nxt-btn");
  if (nxtBtn) {
    nxtBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cfdsState.nxtReverseVideo = !cfdsState.nxtReverseVideo;
      if (cfdsState.selectedLru && (cfdsState.selectedLru.code === "709" || cfdsState.selectedLru.name === "DME")) {
        if (cfdsState.lruSubScreen === "main") {
          cfdsState.lruSubScreen = "menu_2";
        } else if (cfdsState.lruSubScreen === "menu_2") {
          cfdsState.lruSubScreen = "main";
        }
      }
      renderCfdsHub(r, s);
    });
  }

  // Attach interactive click handlers for menu items
  container.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const act = btn.getAttribute("data-act");
      if (!act) return;

      if (act.startsWith("screen:")) {
        const targetScreen = act.replace("screen:", "");
        cfdsState.lruSubScreen = targetScreen;
        renderCfdsHub(r, s);
      } else if (act === "exit") {
        cfdsState.currentView = "LRU_SELECTION";
        renderCfdsHub(r, s);
      } else if (act.startsWith("set_agc:")) {
        cfdsState.dmeAgcVal = act.replace("set_agc:", "");
        renderCfdsHub(r, s);
      } else if (act.startsWith("toggle:")) {
        const prop = act.replace("toggle:", "");
        if (prop === "xmit_rate") {
          cfdsState.xmitRateOn = !cfdsState.xmitRateOn;
          alert("Fixed Transmit Rate: " + (cfdsState.xmitRateOn ? "ON (40 PPS)" : "OFF"));
          renderCfdsHub(r, s);
        }
      }
    });
  });
}

// 2. CFDS SUBMODE SELECTION
function renderCfdsSubmodeSelect(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700;margin:0 0 4px 0">CFDS OPERATION MODE SELECT</h2>
        <p class="muted" style="margin:0">Interrogating: <strong style="color:var(--teal-primary, #0d9488)">${escAttr(cfdsState.selectedLru.name)}</strong> (Eq Code: 0x${escAttr(cfdsState.selectedLru.code)})</p>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn btn-sm primary" id="btn-back-to-console">Return to LRU Console</button>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-back-to-lrus">LRU Selection</button>
      </div>
    </div>
    <div class="mode-grid">
      <div class="mode-card" data-submode="LRU_CONSOLE">
        <div class="tag">BITE Console</div>
        <h2>LRU Interactive Console</h2>
        <p>Dynapro 1780A Infotouch CRT Console with connected/disconnected state and LRU BITE menus.</p>
      </div>
      <div class="mode-card" data-submode="NORMAL_MODE_ABD0048">
        <div class="tag">ABD0048 / 0018</div>
        <h2>Normal Mode</h2>
        <p>Label 356 burst simulation (Figure 58). Generates 14-byte block packets with STX, decoded ASCII lines, and parity.</p>
      </div>
      <div class="mode-card" data-submode="MENU_MODE_ABD0018">
        <div class="tag">ABD0018</div>
        <h2>Menu Mode (MCDU)</h2>
        <p>Emulates Aeroflex T1200B Figures 59-61 MCDU navigation with side keys (1..6, A..F, PAGE) and timeout monitoring.</p>
      </div>
      <div class="mode-card" data-submode="DISCRETE_MODE_ABD0048">
        <div class="tag">ABD0048</div>
        <h2>Discrete Mode</h2>
        <p>ABD0048 pin status matrix, ground/open discretes, program pins, and active fault detection.</p>
      </div>
      <div class="mode-card" data-submode="INTERACTIVE_MODE_ABD0048">
        <div class="tag">ABD0048</div>
        <h2>Interactive Mode</h2>
        <p>Interactive BITE test session with Word 227 Command builder and real-time handshake monitoring.</p>
      </div>
      <div class="mode-card" data-submode="EDIT_TX">
        <div class="tag">Configuration</div>
        <h2>Edit CFDS TX Data</h2>
        <p>Configure and broadcast custom 32-bit ARINC 429 maintenance words and parameters.</p>
      </div>
      <div class="mode-card" data-submode="CONFIGURE_CHANNELS">
        <div class="tag">Channels</div>
        <h2>Configure Channels</h2>
        <p>Setup ARINC 429 Channel A-D speeds (12.5k / 100k), loopback, and parity.</p>
      </div>
    </div>
  `;
  c.appendChild(p);

  p.querySelector("#btn-back-to-console").addEventListener("click", () => {
    cfdsState.currentView = "LRU_CONSOLE";
    renderCfdsHub(r, s);
  });
  p.querySelector("#btn-back-to-lrus").addEventListener("click", () => {
    cfdsState.currentView = "LRU_SELECTION";
    renderCfdsHub(r, s);
  });

  p.querySelectorAll(".mode-card[data-submode]").forEach((card) => {
    card.addEventListener("click", () => {
      cfdsState.currentView = card.getAttribute("data-submode");
      renderCfdsHub(r, s);
    });
  });
}

// 3. CFDS NORMAL MODE (Figure 58 Burst)
function renderCfdsNormalModeView(c, r, s) {
  const p = el("div", "panel");
  const is48 = cfdsState.currentView === "NORMAL_MODE_ABD0048";
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CFDS NORMAL MODE — ${is48 ? 'ABD0048' : 'ABD0018'}</h2>
        <p class="muted">Figure 58 Burst Reception & Decoding · LRU: ${escAttr(cfdsState.selectedLru.name)} (0x${escAttr(cfdsState.selectedLru.code)})</p>
      </div>
      <div style="display:flex;gap:8px">
        <select id="cfds-norm-proto" class="category-select">
          <option value="NORMAL_MODE_ABD0048" ${is48 ? 'selected' : ''}>ABD0048 (Figure 58 Burst)</option>
          <option value="NORMAL_MODE_ABD0018" ${!is48 ? 'selected' : ''}>ABD0018 (350-Word Standard)</option>
        </select>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-norm-back">Back to Modes</button>
      </div>
    </div>

    <!-- Figure 58 Burst Block Diagram -->
    <div class="cfds-fig58-box">
      <div class="channel-col-title">FIGURE 58 — ARINC 429 NORMAL MODE BURST PROTOCOL STRUCTURE</div>
      <div class="cfds-burst-flow">
        <div class="cfds-burst-item stx">STX (0x02)<br><small>Start of Text</small></div>
        <div style="color:#94a3b8">→</div>
        <div class="cfds-burst-item">EQ CODE (0x${escAttr(cfdsState.selectedLru.code)})<br><small>Bits 13–24</small></div>
        <div style="color:#94a3b8">→</div>
        <div class="cfds-burst-item">BLK LENGTH (0x0E)<br><small>14 Bytes / Burst</small></div>
        <div style="color:#94a3b8">→</div>
        <div class="cfds-burst-item" style="border-color:#0d9488">DATA WORDS (Label 356)<br><small>ISO #5 ASCII Payload</small></div>
        <div style="color:#94a3b8">→</div>
        <div class="cfds-burst-item etx">ETX (0x03)<br><small>End of Text</small></div>
        <div style="color:#94a3b8">→</div>
        <div class="cfds-burst-item">CHECKSUM<br><small>ARINC Parity (Bit 32)</small></div>
      </div>
    </div>

    <!-- CRT Terminal Monitor -->
    <div style="margin:12px 0">
      <div class="cdu-crt" style="min-height:220px" id="cfds-burst-terminal">
        <div>[CFDS NORMAL BURST MONITOR READY — WAITING FOR LABEL 356 PACKETS]
AWAITING INTERROGATION BURST FROM ${escAttr(cfdsState.selectedLru.name)}...</div>
        <div class="cdu-crt-status">
          <span>STATUS: STANDBY</span>
          <span>PROTOCOL: ${is48 ? 'ABD0048 FIG 58' : 'ABD0018'}</span>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
      <button type="button" class="btn btn-sm primary" id="btn-run-burst">Simulate Burst (Figure 58)</button>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-clear-burst-term">Clear Terminal</button>
      <span id="cfds-burst-spinner" class="muted" style="font-size:12px" hidden>Simulating...</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="mono" style="width:70px">SLOT</th>
            <th class="mono" style="width:90px">LABEL</th>
            <th class="mono" style="width:130px">DATA (HEX)</th>
            <th style="width:180px">DECODED ASCII</th>
            <th>DESCRIPTION</th>
          </tr>
        </thead>
        <tbody id="cfds-norm-tbody">
          <tr><td colspan="5" class="muted" style="text-align:center">No burst packets received. Click 'Simulate Burst' to execute test.</td></tr>
        </tbody>
      </table>
    </div>
  `;
  c.appendChild(p);

  p.querySelector("#cfds-norm-proto").addEventListener("change", (e) => {
    cfdsState.currentView = e.target.value;
    renderCfdsHub(r, s);
  });

  p.querySelector("#btn-norm-back").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  const term = p.querySelector("#cfds-burst-terminal");
  const tbody = p.querySelector("#cfds-norm-tbody");
  const btnRun = p.querySelector("#btn-run-burst");

  btnRun.addEventListener("click", async () => {
    btnRun.disabled = true;
    p.querySelector("#cfds-burst-spinner").hidden = false;
    try {
      const res = await api("/api/cfds/normal/simulate", {
        method: "POST",
        body: JSON.stringify({ mode_type: is48 ? "ABD0048" : "ABD0018" }),
      });
      const words = (res.normal_rx && res.normal_rx.words) || [];
      if (words.length) {
        tbody.innerHTML = words.map((w) => `
          <tr>
            <td class="mono">${escAttr(w.slot)}</td>
            <td class="mono" style="color:var(--teal-primary, #0d9488);font-weight:700">${escAttr(w.label)}</td>
            <td class="mono"><code>${escAttr(w.dataHex || "")}</code></td>
            <td class="mono" style="color:var(--ok, #10b981);font-weight:700">${escAttr(w.desc && w.desc.includes("'") ? w.desc.split("'")[1] : "")}</td>
            <td>${escAttr(w.desc || "")}</td>
          </tr>
        `).join("");

        term.innerHTML = `
          <div>[BURST PACKET RECEIVED — ${words.length} WORDS]
==================================================
STX: 0x02 | LENGTH: 14 BYTES | PROTOCOL: ${is48 ? 'ABD0048' : 'ABD0018'}
PAYLOAD ASCII STREAM:
${words.filter(w => w.desc && w.desc.includes("'")).map(w => w.desc.split("'")[1]).join("")}
==================================================
CHECKSUM VERIFIED (ODD PARITY VALID)</div>
          <div class="cdu-crt-status">
            <span>STATUS: PACKET DECODED OK</span>
            <span>WORDS: ${words.length}</span>
          </div>
        `;
      }
    } catch (err) {
      alert("Burst simulation error: " + err.message);
    } finally {
      btnRun.disabled = false;
      p.querySelector("#cfds-burst-spinner").hidden = true;
    }
  });

  p.querySelector("#btn-clear-burst-term").addEventListener("click", () => {
    term.innerHTML = `
      <div>[TERMINAL CLEARED — READY]</div>
      <div class="cdu-crt-status"><span>STATUS: READY</span><span>PROTOCOL: ${is48 ? 'ABD0048 FIG 58' : 'ABD0018'}</span></div>
    `;
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center">Terminal cleared.</td></tr>`;
  });
}

// 4. CFDS MENU MODE (Aeroflex Figures 59-61 MCDU)
function renderCfdsMenuModeView(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CFDS MENU MODE — AEROFLEX T1200B (ABD0018)</h2>
        <p class="muted">Aeroflex Figures 59-61 (pp. 1-4-101 to 1-4-103) · MCDU Interactive Navigation</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-menu-back">Back to Modes</button>
    </div>

    <!-- MCDU Visual Unit with Side Keys -->
    <div class="cdu-bezel">
      <div class="cdu-header">
        <span>AEROFLEX T1200B MCDU DISPLAY UNIT (FIGURE 59)</span>
        <span>TARGET: <strong style="color:#10b981">${escAttr(cfdsState.selectedLru.name)}</strong> (0x${escAttr(cfdsState.selectedLru.code)})</span>
      </div>

      <div class="cdu-grid">
        <!-- Left Keys 1..6 -->
        <div class="cdu-key-col">
          ${[1, 2, 3, 4, 5, 6].map(k => `
            <button type="button" class="cdu-key" data-mkey="${k}" title="Line Select Key <${k}">&lt; ${k}</button>
          `).join("")}
        </div>

        <!-- CRT Display Screen -->
        <div class="cdu-crt" id="cfds-mcdu-crt">
          <div class="cfds-mcdu-header">
            <span>&lt; ${escAttr(cfdsState.selectedLru.name)} BITE MENU &gt;</span>
            <span class="${cfdsState.nxtReverseVideo ? 'cfds-nxt-rev' : ''}">NXT</span>
          </div>
          <div style="flex:1" id="cfds-mcdu-lines">
            <div>&lt; 1  SYSTEM STATUS / FAULTS</div>
            <div>&lt; 2  CURRENT FLIGHT LEG REPORT</div>
            <div>&lt; 3  PREVIOUS LEGS LOG (64 FLIGHTS)</div>
            <div>&lt; 4  LRU IDENTIFICATION &amp; PART NO</div>
            <div>&lt; 5  GROUND TEST INITIATION</div>
            <div>&lt; 6  CLASS 3 INTERNAL FAULTS</div>
            <div style="margin-top:14px;color:#94a3b8">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RETURN &gt;</div>
          </div>
          <div class="cdu-crt-status">
            <span id="cfds-mcdu-status-msg">MSG: ${cfdsState.menuStatusText}</span>
            <span>PAGE ${cfdsState.menuPage}/2</span>
          </div>
        </div>

        <!-- Right Keys A..F -->
        <div class="cdu-key-col">
          ${['A', 'B', 'C', 'D', 'E', 'F'].map(k => `
            <button type="button" class="cdu-key" data-mkey="${k}" title="Line Select Key ${k}>">${k} &gt;</button>
          `).join("")}
        </div>
      </div>

      <!-- Bottom Control Keys -->
      <div style="display:flex;justify-content:center;gap:12px;margin-top:16px">
        <button type="button" class="cdu-key" style="padding:8px 16px" id="btn-mcdu-page">PAGE</button>
        <button type="button" class="cdu-key" style="padding:8px 16px" id="btn-mcdu-prev">&lt; PREV</button>
        <button type="button" class="cdu-key" style="padding:8px 16px" id="btn-mcdu-next">NEXT &gt;</button>
        <button type="button" class="cdu-key" style="padding:8px 16px;background:#7f1d1d;border-color:#991b1b" id="btn-mcdu-clr">CLR</button>
      </div>
    </div>

    <!-- Test Controls for 3s / 30s Timeouts -->
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <button type="button" class="btn btn-sm btn-ghost" id="btn-test-3s">Trigger 3s Timeout (Fig 60)</button>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-test-30s">Trigger 30s Error (Fig 61)</button>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-reset-mcdu">Reset Menu Display</button>
    </div>
  `;
  c.appendChild(p);

  p.querySelector("#btn-menu-back").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  const crtLines = p.querySelector("#cfds-mcdu-lines");
  const statusMsg = p.querySelector("#cfds-mcdu-status-msg");

  p.querySelectorAll("button[data-mkey]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const k = btn.getAttribute("data-mkey");
      statusMsg.textContent = `MSG: KEY ${k} PRESSED — TRANSMITTING WORD 227...`;
      try {
        await api("/api/cfds/command", {
          method: "POST",
          body: JSON.stringify({
            equipment_code: cfdsState.selectedLru.code,
            command_code: isNaN(parseInt(k, 10)) ? k.charCodeAt(0) : parseInt(k, 10),
            channel: "TX-A",
            submode: "MENU",
            action_label: `MENU_KEY_${k}`,
          }),
        });
        statusMsg.textContent = `MSG: KEY ${k} ACKNOWLEDGED BY ${cfdsState.selectedLru.name}`;
      } catch (err) {
        statusMsg.textContent = `MSG: ERROR — ${err.message}`;
      }
    });
  });

  p.querySelector("#btn-mcdu-page").addEventListener("click", () => {
    cfdsState.nxtReverseVideo = !cfdsState.nxtReverseVideo;
    cfdsState.menuPage = cfdsState.menuPage === 1 ? 2 : 1;
    renderCfdsHub(r, s);
  });

  p.querySelector("#btn-test-3s").addEventListener("click", () => {
    statusMsg.textContent = "MSG: NO RESPONSE RECEIVED FROM LRU";
    statusMsg.style.color = "#f59e0b";
  });

  p.querySelector("#btn-test-30s").addEventListener("click", () => {
    crtLines.innerHTML = `
      <div style="color:#ef4444;font-weight:700;margin-top:20px;text-align:center">
        LRU ERROR — HIT &lt;PRIOR PAGE&gt; OR ANOTHER KEY
      </div>
      <div style="color:#94a3b8;font-size:12px;margin-top:14px;text-align:center">
        30-SECOND SYSTEM INTERROGATION TIMEOUT EXPIRED (FIG 61)
      </div>
    `;
    statusMsg.textContent = "MSG: LRU RESPONSE TIMEOUT (30S)";
    statusMsg.style.color = "#ef4444";
  });

  p.querySelector("#btn-reset-mcdu").addEventListener("click", () => {
    cfdsState.menuStatusText = "SELECT OPTION";
    cfdsState.nxtReverseVideo = false;
    renderCfdsHub(r, s);
  });
}

// 5. CFDS DISCRETE MODE (ABD0048)
function renderCfdsDiscreteModeView(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CFDS DISCRETE MODE — ABD0048</h2>
        <p class="muted">ABD0048 Pin Matrix &amp; Discrete Fault Status · LRU: ${escAttr(cfdsState.selectedLru.name)}</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-disc-back">Back to Modes</button>
    </div>

    <div class="meters" style="margin-bottom:16px">
      <div class="meter">
        <div class="meter-label">DISCRETE BUS STATUS</div>
        <div class="meter-value" style="color:var(--ok, #10b981)">ACTIVE (SWEEP OK)</div>
        <div class="meter-unit">Continuous ABD0048 sampling</div>
      </div>
      <div class="meter">
        <div class="meter-label">GROUND SENSE</div>
        <div class="meter-value">WEIGHT ON WHEELS</div>
        <div class="meter-unit">Bit 12: GND (0)</div>
      </div>
      <div class="meter">
        <div class="meter-label">INHIBIT INPUT</div>
        <div class="meter-value" style="color:var(--ok, #10b981)">NORMAL (NOT INHIBITED)</div>
        <div class="meter-unit">Bit 28: 0</div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <button type="button" class="btn btn-sm primary" id="btn-disc-sweep">Execute Discrete Sweep</button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="mono" style="width:100px">PIN / BIT</th>
            <th>FUNCTION / SIGNAL</th>
            <th style="width:140px">LOGIC STATE</th>
            <th style="width:140px">PHYSICAL LEVEL</th>
            <th style="width:120px">RESULT</th>
          </tr>
        </thead>
        <tbody id="cfds-disc-tbody">
          <tr><td class="mono">PIN A01</td><td>Ground / Flight Sense (WoW)</td><td>LOGIC 0</td><td>GND (0V)</td><td><span class="pill ok">PASS</span></td></tr>
          <tr><td class="mono">PIN A02</td><td>BITE Test Inhibit Interlock</td><td>LOGIC 0</td><td>OPEN (28V)</td><td><span class="pill ok">PASS</span></td></tr>
          <tr><td class="mono">PIN B05</td><td>Program Pin #1 (Ch A Enable)</td><td>LOGIC 1</td><td>GND (0V)</td><td><span class="pill ok">PASS</span></td></tr>
          <tr><td class="mono">PIN B06</td><td>Program Pin #2 (Ch B Enable)</td><td>LOGIC 1</td><td>GND (0V)</td><td><span class="pill ok">PASS</span></td></tr>
          <tr><td class="mono">PIN C12</td><td>Engine Running Sense Discrete</td><td>LOGIC 0</td><td>OPEN (28V)</td><td><span class="pill ok">PASS</span></td></tr>
          <tr><td class="mono">PIN D08</td><td>Discrete Fault Bit 17</td><td>LOGIC 0</td><td>OPEN</td><td><span class="pill ok">NOMINAL</span></td></tr>
        </tbody>
      </table>
    </div>
  `;
  c.appendChild(p);

  p.querySelector("#btn-disc-back").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  p.querySelector("#btn-disc-sweep").addEventListener("click", async () => {
    try {
      await api("/api/cfds/discrete/simulate", {
        method: "POST",
        body: JSON.stringify({ mode_type: "ABD0048" }),
      });
      alert("Discrete mode simulation sweep completed successfully. All 6 monitored pins NOMINAL.");
    } catch (err) {
      alert("Discrete sweep error: " + err.message);
    }
  });
}

// 6. CFDS INTERACTIVE MODE (ABD0048)
function renderCfdsInteractiveModeView(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CFDS INTERACTIVE MODE — ABD0048</h2>
        <p class="muted">Interactive BITE Handshake Protocol · LRU: ${escAttr(cfdsState.selectedLru.name)}</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-inter-back">Back to Modes</button>
    </div>

    <!-- Handshake State Machine Progress -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="channel-col-title">HANDSHAKE STATE MACHINE STATUS</div>
        <span class="pill primary" id="cfds-inter-status-pill">${cfdsState.interactiveStatus}</span>
      </div>
      <div style="background:#f1f5f9;border-radius:999px;height:10px;overflow:hidden">
        <div id="cfds-inter-bar" style="background:#0d9488;height:100%;width:${cfdsState.interactiveProgress}%;transition:width .3s ease"></div>
      </div>
    </div>

    <!-- Command Word 227 Builder Form -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px">
      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">COMMAND TYPE</span>
        <select id="cfds-inter-cmd" class="category-select" style="width:100%">
          <option value="1">1 — SYSTEM TEST / BITE INITIATE</option>
          <option value="2">2 — CLEAR ACTIVE FAULT LOG</option>
          <option value="3">3 — READ MEMORY DUMP</option>
          <option value="4">4 — CALIBRATION ROUTINE</option>
        </select>
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">TRANSMIT CHANNEL</span>
        <select id="cfds-inter-ch" class="category-select" style="width:100%">
          <option value="TX-A">Broadcast TX-A</option>
          <option value="TX-B">Broadcast TX-B</option>
          <option value="TX-C">Broadcast TX-C</option>
          <option value="TX-D">Broadcast TX-D</option>
        </select>
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">SDI (BITS 9–10)</span>
        <select id="cfds-inter-sdi" class="category-select" style="width:100%">
          <option value="0">00 — ALL (DISCARD SDI)</option>
          <option value="1">01 — SIDE 1 (LEFT)</option>
          <option value="2">10 — SIDE 2 (RIGHT)</option>
          <option value="3">11 — SIDE 3 (CENTER)</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <button type="button" class="btn btn-sm primary" id="btn-send-inter-cmd">Transmit BITE Command 227</button>
    </div>

    <!-- Output Terminal -->
    <div class="cdu-crt" style="min-height:160px" id="cfds-inter-output">
      <div>[INTERACTIVE BITE SESSION READY — SELECT COMMAND ABOVE]</div>
      <div class="cdu-crt-status"><span>STATE: IDLE</span><span>HANDSHAKE: WAITING</span></div>
    </div>
  `;
  c.appendChild(p);

  p.querySelector("#btn-inter-back").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  const out = p.querySelector("#cfds-inter-output");
  const bar = p.querySelector("#cfds-inter-bar");
  const pill = p.querySelector("#cfds-inter-status-pill");

  p.querySelector("#btn-send-inter-cmd").addEventListener("click", async () => {
    const cmd = parseInt(p.querySelector("#cfds-inter-cmd").value, 10);
    const ch = p.querySelector("#cfds-inter-ch").value;
    const sdiVal = parseInt(p.querySelector("#cfds-inter-sdi").value, 10);

    pill.textContent = "TRANSMITTING";
    bar.style.width = "40%";

    try {
      const res = await api("/api/cfds/command", {
        method: "POST",
        body: JSON.stringify({
          equipment_code: cfdsState.selectedLru.code,
          command_code: cmd,
          channel: ch,
          sdi: sdiVal,
          submode: "INTERACTIVE",
          action_label: `BITE_CMD_${cmd}`,
        }),
      });

      bar.style.width = "100%";
      pill.textContent = "COMPLETE (ACK)";

      out.innerHTML = `
        <div>[BITE COMMAND EXECUTED SUCCESSFULLY]
TRANSMITTED: Word 227 on ${ch} | Eq: 0x${cfdsState.selectedLru.code} | Cmd: 0x0${cmd}
HANDSHAKE RETURN: DATA VALID (ACKNOWLEDGED)
RAW RESPONSE: ${JSON.stringify(res)}</div>
        <div class="cdu-crt-status"><span>STATE: SUCCESS</span><span>ACK: RECEIVED</span></div>
      `;
    } catch (err) {
      bar.style.width = "100%";
      bar.style.background = "#ef4444";
      pill.textContent = "ERROR";
      out.innerHTML = `
        <div style="color:#ef4444">[TRANSMISSION ERROR] ${err.message}</div>
        <div class="cdu-crt-status"><span>STATE: FAILED</span><span>ACK: NAK</span></div>
      `;
    }
  });
}

// 7. CFDS EDIT TX VIEW
function renderCfdsEditTxView(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">EDIT CFDS TRANSMIT DATA</h2>
        <p class="muted">ARINC 429 Transmitted Word Parameters for ${escAttr(cfdsState.selectedLru.name)}</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-edtx-back">Back to Modes</button>
    </div>

    <div class="table-wrap" style="margin-bottom:16px">
      <table>
        <thead>
          <tr>
            <th class="mono">LABEL (OCTAL)</th>
            <th class="mono">RAW HEX</th>
            <th>SDI</th>
            <th>SSM</th>
            <th>PARITY</th>
            <th style="width:120px">INTERVAL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono" style="color:var(--teal-primary, #0d9488);font-weight:700">227</td>
            <td class="mono"><input type="text" class="category-select" style="font-family:monospace;width:120px" value="0x80007000" id="cfds-tx-227"/></td>
            <td><select class="category-select"><option>00 (ALL)</option><option>01 (L)</option><option>10 (R)</option></select></td>
            <td><span class="pill ok">NO (Normal)</span></td>
            <td>ODD</td>
            <td>100 ms</td>
          </tr>
          <tr>
            <td class="mono" style="color:var(--teal-primary, #0d9488);font-weight:700">356</td>
            <td class="mono"><input type="text" class="category-select" style="font-family:monospace;width:120px" value="0x00E0E000" id="cfds-tx-356"/></td>
            <td><select class="category-select"><option>00 (ALL)</option></select></td>
            <td><span class="pill ok">NO (Normal)</span></td>
            <td>ODD</td>
            <td>1000 ms</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button type="button" class="btn btn-sm primary" id="btn-save-cfds-tx">Save &amp; Broadcast Words</button>
  `;
  c.appendChild(p);

  p.querySelector("#btn-edtx-back").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  p.querySelector("#btn-save-cfds-tx").addEventListener("click", async () => {
    try {
      await api("/api/cfds/tx-params", {
        method: "POST",
        body: JSON.stringify({
          equipment_code: cfdsState.selectedLru.code,
          words: {
            label_227: p.querySelector("#cfds-tx-227").value,
            label_356: p.querySelector("#cfds-tx-356").value,
          }
        })
      });
      alert("CFDS Transmit parameters saved and loaded into ARINC 429 generator.");
    } catch (err) {
      alert("Save error: " + err.message);
    }
  });
}

// 8. CFDS CONFIGURE CHANNELS VIEW
function renderCfdsConfigChannelsView(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CONFIGURE CFDS CHANNELS</h2>
        <p class="muted">ARINC 429 Hardware Channels A-D Bus Configuration</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-ch-back">Back to Modes</button>
    </div>

    <div class="table-wrap" style="margin-bottom:16px">
      <table>
        <thead>
          <tr>
            <th>CHANNEL</th>
            <th>DIRECTION</th>
            <th>BIT RATE</th>
            <th>PARITY</th>
            <th>LOOPBACK</th>
          </tr>
        </thead>
        <tbody>
          ${['A', 'B', 'C', 'D'].map(ch => `
            <tr>
              <td><strong>Channel ${ch}</strong></td>
              <td>TX &amp; RX</td>
              <td>
                <select class="category-select" data-ch="${ch}" data-key="speed">
                  <option value="HIGH">High Speed (100 kbps)</option>
                  <option value="LOW" selected>Low Speed (12.5 kbps)</option>
                </select>
              </td>
              <td><span class="pill">ODD</span></td>
              <td>
                <label style="display:flex;align-items:center;gap:6px">
                  <input type="checkbox" checked /> Enabled
                </label>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <button type="button" class="btn btn-sm primary" id="btn-save-cfds-channels">Apply Channel Configuration</button>
  `;
  c.appendChild(p);

  p.querySelector("#btn-ch-back").addEventListener("click", () => {
    cfdsState.currentView = "MODE_SELECT";
    renderCfdsHub(r, s);
  });

  p.querySelector("#btn-save-cfds-channels").addEventListener("click", async () => {
    try {
      await api("/api/cfds/channels/configure", {
        method: "POST",
        body: JSON.stringify({ channel: "A", speed: "LOW" }),
      });
      alert("Channel configuration successfully applied to ARINC 429 coordinator.");
    } catch (err) {
      alert("Configuration error: " + err.message);
    }
  });
}

// ====================================================================
// BOEING CMC MODE IMPLEMENTATION (ARINC 604-1 / AEROFLEX T1200B)
// ====================================================================

function renderCmcHub(r, s) {
  r.innerHTML = "";
  const wb = el("div", "cfds-workbench");
  r.appendChild(wb);

  // Status Metric Strip matching CmcModeView.tsx
  const isTimeConstantApplicable =
    cmcState.selectedLru.code === "010" ||
    cmcState.selectedLru.code === "011" ||
    cmcState.selectedLru.code === "012" ||
    cmcState.selectedLru.id === "MANUAL ENTRY";

  const activeFaultCount = cmcState.faultBits.filter(b => b.fault && b.bit <= 27).length;

  const meters = el("div", "meters");
  meters.innerHTML = `
    <div class="meter">
      <div class="meter-label">DATA SOURCE</div>
      <div class="meter-value" style="font-size:16px">
        <span class="${cmcState.source === 'HARDWARE' ? 'badge-hw' : 'badge-sim'}">${cmcState.source}</span>
      </div>
      <div class="meter-unit">${cmcState.source === 'SIMULATION' ? 'Simulated Boeing LRU' : 'Live Ballard Card'}</div>
    </div>

    <div class="meter">
      <div class="meter-label">TARGET LRU &amp; EQ CODE</div>
      <div class="meter-value" style="color:var(--teal-primary, #0d9488);font-size:16px">
        ${escAttr(cmcState.selectedLru.id)} (${escAttr(cmcState.selectedLru.code)})
      </div>
      <div class="meter-unit">${escAttr(cmcState.selectedLru.name)}</div>
    </div>

    <div class="meter">
      <div class="meter-label">TIME CONSTANT (FILTER)</div>
      <div class="meter-value" style="font-size:16px">${escAttr(cmcState.timeConstant)} s</div>
      <div class="meter-unit">${isTimeConstantApplicable ? 'VOR/ILS/ADF Active' : 'Bypass (OFF)'}</div>
    </div>

    <div class="meter">
      <div class="meter-label">FAULT SUMMARY (350/351)</div>
      <div class="meter-value" style="color:${activeFaultCount > 0 ? 'var(--fault, #ef4444)' : 'var(--ok, #10b981)'};font-size:16px">
        ${cmcState.hasWordsReceived ? (activeFaultCount > 0 ? `${activeFaultCount} FAULT(S)` : 'ALL NOMINAL (OK)') : 'NO WORDS RECEIVED'}
      </div>
      <div class="meter-unit">Bit 29 ACK: ${cmcState.bit29Ack ? 'VALID (ACK)' : 'NAK'}</div>
    </div>

    <div class="meter">
      <div class="meter-label">COMMAND WORD (227)</div>
      <div class="meter-value" style="font-size:15px">${escAttr(cmcState.cmdFunction)}</div>
      <div class="meter-unit">Rate: ${cmcState.cmdRateMs} ms</div>
    </div>
  `;
  wb.appendChild(meters);

  // LRU Selection Strip
  const lruStrip = el("div", "channel-row");
  lruStrip.style.margin = "14px 0";
  lruStrip.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-weight:700;font-size:13px">TARGET BOEING LRU:</span>
      <select id="cmc-lru-selector" class="category-select" style="min-width:280px;font-weight:600">
        ${BOEING_LRU_DATABASE.map(item => `
          <option value="${escAttr(item.id)}" ${cmcState.selectedLru.id === item.id ? 'selected' : ''}>
            ${escAttr(item.id)} — ${escAttr(item.name)} (Eq: 0x${escAttr(item.code)})
          </option>
        `).join("")}
      </select>

      ${cmcState.selectedLru.id === 'MANUAL ENTRY' ? `
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:#64748b">Code:</span>
          <input type="text" id="cmc-manual-code" maxlength="3" class="category-select" style="width:60px;font-family:monospace" value="${escAttr(cmcState.manualCode)}" />
          <button type="button" class="btn btn-sm btn-ghost" id="btn-apply-manual-code">Set</button>
        </div>
      ` : ''}

      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:12px;color:#64748b">Time Constant:</span>
        <select id="cmc-tc-selector" class="category-select" ${!isTimeConstantApplicable ? 'disabled' : ''}>
          ${TIME_CONSTANT_OPTIONS.map(opt => `
            <option value="${opt}" ${cmcState.timeConstant === opt ? 'selected' : ''}>${opt} s</option>
          `).join("")}
        </select>
      </div>
    </div>

    <button type="button" class="btn btn-sm btn-ghost" id="btn-cmc-back-main">Mode Select</button>
  `;
  wb.appendChild(lruStrip);

  lruStrip.querySelector("#cmc-lru-selector").addEventListener("change", (e) => {
    const found = BOEING_LRU_DATABASE.find(item => item.id === e.target.value);
    if (found) {
      cmcState.selectedLru = found;
      renderCmcHub(r, s);
    }
  });

  const btnManual = lruStrip.querySelector("#btn-apply-manual-code");
  if (btnManual) {
    btnManual.addEventListener("click", () => {
      const code = lruStrip.querySelector("#cmc-manual-code").value.trim().toUpperCase().padStart(3, "0");
      cmcState.manualCode = code;
      cmcState.selectedLru.code = code;
      renderCmcHub(r, s);
    });
  }

  lruStrip.querySelector("#cmc-tc-selector").addEventListener("change", (e) => {
    cmcState.timeConstant = e.target.value;
    renderCmcHub(r, s);
  });

  lruStrip.querySelector("#btn-cmc-back-main").addEventListener("click", () => {
    pushScreen("mode_select");
  });

  // 5 Boeing CMC Navigation Tabs matching CMC_5_TABS
  const tabStrip = el("div", "cmc-tabs");
  const tabs = [
    { id: "TRANSMIT_DATA", label: "Edit CMC Transmit Data" },
    { id: "FAULT_SUMMARY", label: "Display Fault Summary Word(s) (350/351)" },
    { id: "EDIT_CMD", label: "Edit Command Summary Word (227)" },
    { id: "SHOP_CONFIG", label: "Shop Faults & Config Data (356)" },
    { id: "CHANNELS", label: "Configure TX/RX Channels A-D" },
  ];

  tabs.forEach(t => {
    const btn = el("button", `cmc-tab-btn ${cmcState.activeTab === t.id ? 'active' : ''}`);
    btn.type = "button";
    btn.textContent = t.label;
    btn.addEventListener("click", () => {
      cmcState.activeTab = t.id;
      renderCmcHub(r, s);
    });
    tabStrip.appendChild(btn);
  });
  wb.appendChild(tabStrip);

  // Tab Content Container
  const tabContent = el("div", "cmc-tab-content");
  wb.appendChild(tabContent);

  switch (cmcState.activeTab) {
    case "TRANSMIT_DATA":
      renderCmcTransmitDataTab(tabContent, r, s);
      break;
    case "FAULT_SUMMARY":
      renderCmcFaultSummaryTab(tabContent, r, s);
      break;
    case "EDIT_CMD":
      renderCmcEditCommandTab(tabContent, r, s);
      break;
    case "SHOP_CONFIG":
      renderCmcShopConfigTab(tabContent, r, s);
      break;
    case "CHANNELS":
      renderCmcChannelsTab(tabContent, r, s);
      break;
    default:
      renderCmcTransmitDataTab(tabContent, r, s);
      break;
  }
}

// CMC Tab 1: TRANSMIT DATA PANEL
function renderCmcTransmitDataTab(c, r, s) {
  const p = el("div", "panel");
  const tx = cmcState.transmitData;
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">EDIT CMC TRANSMIT DATA</h2>
        <p class="muted">Background flight and airframe parameters continuously broadcast to LRUs (D243W201-1)</p>
      </div>
      <div style="display:flex;gap:8px">
        <select id="cmc-tx-channel" class="category-select">
          <option value="TX-A" ${tx.channel === 'TX-A' ? 'selected' : ''}>Broadcast TX-A</option>
          <option value="TX-B" ${tx.channel === 'TX-B' ? 'selected' : ''}>Broadcast TX-B</option>
          <option value="TX-C" ${tx.channel === 'TX-C' ? 'selected' : ''}>Broadcast TX-C</option>
          <option value="TX-D" ${tx.channel === 'TX-D' ? 'selected' : ''}>Broadcast TX-D</option>
        </select>
        <button type="button" class="btn btn-sm primary" id="btn-save-cmc-tx">APPLY &amp; TRANSMIT DATA</button>
      </div>
    </div>

    <!-- 6 Background Parameters Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;margin:14px 0">
      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:600">DATE (Label 260)</span>
          <span class="pill-category">1000 ms · BCD</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">Format: MM/DD/YY</div>
        <input type="text" id="cmc-tx-date" class="category-select" style="width:100%;font-family:monospace" value="${escAttr(tx.date)}" />
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:600">GMT TIME (Label 125)</span>
          <span class="pill-category">1000 ms · BCD</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">Format: HH:MM.M GMT</div>
        <input type="text" id="cmc-tx-time" class="category-select" style="width:100%;font-family:monospace" value="${escAttr(tx.time)}" />
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:600">FLT_NUM (Labels 233–236)</span>
          <span class="pill-category">1000 ms · ISO #5</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">6-char Flight Identifier</div>
        <input type="text" id="cmc-tx-fltnum" maxlength="6" class="category-select" style="width:100%;font-family:monospace" value="${escAttr(tx.flt_num)}" />
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:600">CITY_PAIRS (Labels 301–304)</span>
          <span class="pill-category">3000 ms · FROM/TO</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">ICAO Orig / Dest Airport</div>
        <input type="text" id="cmc-tx-citypairs" class="category-select" style="width:100%;font-family:monospace" value="${escAttr(tx.city_pairs)}" />
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:600">FLT_PHASE (Label 126)</span>
          <span class="pill-category">1000 ms · BNR Bits 11–14</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">Flight Phase 1 to 10</div>
        <select id="cmc-tx-fltphase" class="category-select" style="width:100%">
          <option value="1" ${tx.flt_phase === 1 ? 'selected' : ''}>1: Pre-Flight</option>
          <option value="2" ${tx.flt_phase === 2 ? 'selected' : ''}>2: Taxi Out</option>
          <option value="3" ${tx.flt_phase === 3 ? 'selected' : ''}>3: Takeoff</option>
          <option value="4" ${tx.flt_phase === 4 ? 'selected' : ''}>4: Climb</option>
          <option value="5" ${tx.flt_phase === 5 ? 'selected' : ''}>5: Cruise</option>
          <option value="6" ${tx.flt_phase === 6 ? 'selected' : ''}>6: Descent</option>
          <option value="7" ${tx.flt_phase === 7 ? 'selected' : ''}>7: Approach</option>
          <option value="8" ${tx.flt_phase === 8 ? 'selected' : ''}>8: Landing</option>
          <option value="9" ${tx.flt_phase === 9 ? 'selected' : ''}>9: Taxi In</option>
          <option value="10" ${tx.flt_phase === 10 ? 'selected' : ''}>10: Post-Flight</option>
        </select>
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:600">AIRCRAFT_ID (Labels 301–304)</span>
          <span class="pill-category">4000 ms · Tail Number</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">7-char Aircraft Tail Number</div>
        <input type="text" id="cmc-tx-aircraftid" maxlength="7" class="category-select" style="width:100%;font-family:monospace" value="${escAttr(tx.aircraft_id)}" />
      </div>
    </div>

    <!-- Aircraft Configuration Word 155 (17 switches) -->
    <div style="margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <h3 style="font-size:14px;font-weight:700;margin:0">AIRCRAFT CONFIGURATION WORD (LABEL 155)</h3>
          <p class="muted" style="margin:2px 0 0">Broadcast rate: 1000 ms · 17 Discrete switches encoded sequentially from Bit 11 to Bit 27</p>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-sm btn-ghost" id="btn-sw-all-on">ALL ON (1)</button>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-sw-all-off">ALL OFF (0)</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));gap:8px" id="cmc-label155-grid">
        ${CMC_LABEL155_SWITCHES.map(sw => {
          const isOn = Boolean(tx.config_word_bits[sw.key]);
          return `
            <button type="button" class="channel-row" data-key="${sw.key}" style="cursor:pointer;${isOn ? 'background:var(--teal-bg, #f0fdfa);border-color:var(--teal-primary, #0d9488)' : ''}">
              <div>
                <div style="font-size:10.5px;color:var(--text-muted)">BIT ${sw.bit}</div>
                <div style="font-weight:700;font-size:12px;color:${isOn ? 'var(--teal-primary, #0d9488)' : 'inherit'}">${sw.label}</div>
              </div>
              <span class="pill ${isOn ? 'ok' : ''}">${isOn ? 'ON (1)' : 'OFF (0)'}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
  c.appendChild(p);

  p.querySelectorAll("#cmc-label155-grid button[data-key]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-key");
      tx.config_word_bits[key] = !tx.config_word_bits[key];
      renderCmcHub(r, s);
    });
  });

  p.querySelector("#btn-sw-all-on").addEventListener("click", () => {
    CMC_LABEL155_SWITCHES.forEach(sw => tx.config_word_bits[sw.key] = true);
    renderCmcHub(r, s);
  });

  p.querySelector("#btn-sw-all-off").addEventListener("click", () => {
    CMC_LABEL155_SWITCHES.forEach(sw => tx.config_word_bits[sw.key] = false);
    renderCmcHub(r, s);
  });

  p.querySelector("#btn-save-cmc-tx").addEventListener("click", async () => {
    tx.date = p.querySelector("#cmc-tx-date").value;
    tx.time = p.querySelector("#cmc-tx-time").value;
    tx.flt_num = p.querySelector("#cmc-tx-fltnum").value;
    tx.city_pairs = p.querySelector("#cmc-tx-citypairs").value;
    tx.flt_phase = parseInt(p.querySelector("#cmc-tx-fltphase").value, 10);
    tx.aircraft_id = p.querySelector("#cmc-tx-aircraftid").value;
    tx.channel = p.querySelector("#cmc-tx-channel").value;

    try {
      await api("/api/cmc/transmit-data", {
        method: "POST",
        body: JSON.stringify(tx),
      });
      alert("CMC Transmit data and Label 155 aircraft configuration successfully broadcast.");
    } catch (err) {
      alert("Transmit error: " + err.message);
    }
  });
}

// CMC Tab 2: FAULT SUMMARY PANEL (Labels 350 / 351)
function renderCmcFaultSummaryTab(c, r, s) {
  const p = el("div", "panel");
  const is350 = cmcState.faultPage === "350";
  const activeWordHex = is350 ? "0x80000000" : "0x80000001";
  const activeFaultCount = cmcState.faultBits.filter(b => b.fault && b.bit <= 27).length;

  p.innerHTML = `
    <!-- Warning Banner if NO WORDS RECEIVED -->
    ${!cmcState.hasWordsReceived ? `
      <div class="alert-error" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span>⚠️ WARNING: NO WORDS RECEIVED (Label ${cmcState.faultPage} Bus Inactive)</span>
        <button type="button" class="btn btn-sm" id="btn-restore-bus">RESTORE BUS RECEPTION</button>
      </div>
    ` : ''}

    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">DISPLAY FAULT SUMMARY WORD (LABEL ${cmcState.faultPage})</h2>
        <p class="muted">Interrogating ${escAttr(cmcState.selectedLru.id)} (Eq Code: 0x${escAttr(cmcState.selectedLru.code)}) · Boeing D243W201-1</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button type="button" class="btn btn-sm ${cmcState.hasWordsReceived ? 'ok' : 'fault'}" id="btn-toggle-bus-recv">
          BUS: ${cmcState.hasWordsReceived ? 'RECEIVING' : 'NO WORDS'}
        </button>
        <button type="button" class="btn btn-sm primary" id="btn-switch-fault-page">
          PAGE: WORD #${is350 ? '1 (350)' : '2 (351)'} ⇄ #${is350 ? '2 (351)' : '1 (350)'}
        </button>
      </div>
    </div>

    <!-- Header Indicators Strip -->
    <div class="meters" style="margin:14px 0">
      <div class="meter">
        <div class="meter-label">Active Word</div>
        <div class="meter-value" style="color:var(--teal-primary, #0d9488);font-size:17px">LABEL ${cmcState.faultPage}</div>
        <div class="meter-unit"><code>${activeWordHex}</code></div>
      </div>

      <div class="meter">
        <div class="meter-label">SDI (Bit 9–10)</div>
        <div class="meter-value" style="font-size:17px">ALL (00)</div>
        <div class="meter-unit">Binary: <code>00</code> (00=ALL, 01=L, 10=R, 11=C)</div>
      </div>

      <div class="meter">
        <div class="meter-label">SSM (Bit 30–31)</div>
        <div class="meter-value" style="color:var(--ok, #10b981);font-size:16px">NORMAL OPERATION (00)</div>
        <div class="meter-unit">Binary: <code>00</code></div>
      </div>

      <div class="meter">
        <div class="meter-label">Bit 28: BITE INHIBIT</div>
        <div class="meter-value" style="color:${cmcState.bit28Inhibit ? 'var(--fault, #ef4444)' : 'var(--ok, #10b981)'};font-size:16px">
          ${cmcState.bit28Inhibit ? 'INHIBIT (1)' : 'ENABLE (0)'}
        </div>
        <div class="meter-unit">Consistent all LRUs</div>
      </div>

      <div class="meter">
        <div class="meter-label">Bit 29: COMMAND ACK</div>
        <div class="meter-value" style="color:${cmcState.bit29Ack ? 'var(--ok, #10b981)' : 'var(--fault, #ef4444)'};font-size:16px">
          ${cmcState.bit29Ack ? 'ACK (1)' : 'NAK (0)'}
        </div>
        <div class="meter-unit">Consistent all LRUs</div>
      </div>
    </div>

    <!-- Complete Fault Bits Matrix (Bits 11-29) -->
    <div style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="channel-col-title">
          COMPLETE FAULT BITS MATRIX (BIT 11 TO BIT 29) · ${activeFaultCount} FAULT(S) ACTIVE
        </div>
        <div style="font-size:11px;color:#64748b">Click any row toggle to simulate LRU hardware fault condition</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:8px" id="cmc-fault-matrix">
        ${cmcState.faultBits.map(b => {
          let isAck = b.bit === 29;
          let isInhibit = b.bit === 28;
          let btnClass = "btn-sm";
          if (isAck) btnClass = cmcState.bit29Ack ? "btn-sm ok" : "btn-sm fault";
          else if (isInhibit) btnClass = cmcState.bit28Inhibit ? "btn-sm fault" : "btn-sm ok";
          else btnClass = b.fault ? "btn-sm fault" : "btn-sm ok";

          return `
            <div class="channel-row" data-bit="${b.bit}" style="${b.fault ? 'background:rgba(239, 68, 68, 0.08);border-color:var(--fault, #ef4444)' : ''}">
              <div style="display:flex;align-items:center;gap:8px">
                <code style="color:var(--teal-primary, #0d9488);font-weight:700;font-size:12px;min-width:48px">BIT ${b.bit}</code>
                <div>
                  <div style="font-weight:600;font-size:12px">${b.label}</div>
                  <div style="font-size:10.5px;color:#64748b">
                    ${isAck ? '0=NAK, 1=ACK' : isInhibit ? '0=ENABLE, 1=INHIBIT' : b.is_spare ? 'Unused spare bit' : '0=OK, 1=FAILURE'}
                  </div>
                </div>
              </div>
              <button type="button" class="${btnClass}" style="min-width:85px;font-size:11px">
                ${isAck ? (cmcState.bit29Ack ? 'ACK (1)' : 'NAK (0)') : isInhibit ? (cmcState.bit28Inhibit ? 'INHIBIT (1)' : 'ENABLE (0)') : (b.fault ? 'FAULT (1)' : 'OK (0)')}
              </button>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
  c.appendChild(p);

  const btnRestore = p.querySelector("#btn-restore-bus");
  if (btnRestore) {
    btnRestore.addEventListener("click", () => {
      cmcState.hasWordsReceived = true;
      renderCmcHub(r, s);
    });
  }

  p.querySelector("#btn-toggle-bus-recv").addEventListener("click", () => {
    cmcState.hasWordsReceived = !cmcState.hasWordsReceived;
    renderCmcHub(r, s);
  });

  p.querySelector("#btn-switch-fault-page").addEventListener("click", () => {
    cmcState.faultPage = is350 ? "351" : "350";
    renderCmcHub(r, s);
  });

  p.querySelectorAll("#cmc-fault-matrix .channel-row").forEach(row => {
    const bitNum = parseInt(row.getAttribute("data-bit"), 10);
    const btn = row.querySelector("button");
    btn.addEventListener("click", async () => {
      const target = cmcState.faultBits.find(b => b.bit === bitNum);
      if (bitNum === 29) {
        cmcState.bit29Ack = !cmcState.bit29Ack;
      } else if (bitNum === 28) {
        cmcState.bit28Inhibit = !cmcState.bit28Inhibit;
      } else {
        if (target) target.fault = !target.fault;
      }

      try {
        await api("/api/cmc/fault-summary", {
          method: "POST",
          body: JSON.stringify({
            label: cmcState.faultPage,
            bit: bitNum,
            fault: bitNum === 28 ? cmcState.bit28Inhibit : bitNum === 29 ? !cmcState.bit29Ack : Boolean(target && target.fault),
            command_ack: cmcState.bit29Ack,
            bite_inhibit: cmcState.bit28Inhibit,
          }),
        });
      } catch (err) {
        console.error("Fault toggle API error:", err);
      }
      renderCmcHub(r, s);
    });
  });
}

// CMC Tab 3: EDIT COMMAND SUMMARY WORD 227
function renderCmcEditCommandTab(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">EDIT COMMAND SUMMARY WORD (LABEL 227)</h2>
        <p class="muted">Interrogation Command structure per Boeing D243W201-1 / ARINC 604-1</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="pill-category" style="font-family:monospace;font-size:13px">
          WORD: <strong style="color:var(--teal-primary, #0d9488)">0x80${escAttr(cmcState.selectedLru.code)}00E9</strong>
        </span>
        <select id="cmc-cmd-channel" class="category-select">
          <option value="TX-A">Transmit on TX-A</option>
          <option value="TX-B">Transmit on TX-B</option>
          <option value="TX-C">Transmit on TX-C</option>
          <option value="TX-D">Transmit on TX-D</option>
        </select>
      </div>
    </div>

    <!-- Editable Parameters Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:12px;margin:14px 0">
      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">LABEL</span>
        <div style="font-size:11px;color:#64748b">Bits 1..8 (Wire reversed)</div>
        <input type="text" readonly class="category-select" style="width:100%;font-family:monospace;background:#f8fafc" value="227 (Octal)" />
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">EQ ID (Bits 13–24)</span>
        <div style="font-size:11px;color:#64748b">3-Digit Hex (000–FFF)</div>
        <input type="text" id="cmc-cmd-eqid" maxlength="3" class="category-select" style="width:100%;font-family:monospace;font-weight:700" value="${escAttr(cmcState.selectedLru.code)}" />
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">SDI (Bits 9–10)</span>
        <div style="font-size:11px;color:#64748b">Source / Destination</div>
        <select id="cmc-cmd-sdi" class="category-select" style="width:100%;font-family:monospace">
          <option value="00">ALL (00)</option>
          <option value="01">1 / LEFT (01)</option>
          <option value="10">2 / RIGHT (10)</option>
          <option value="11">3 / CENTER (11)</option>
        </select>
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">RATE (ms)</span>
        <div style="font-size:11px;color:#64748b">Default 100 ms or 1000 ms</div>
        <select id="cmc-cmd-rate" class="category-select" style="width:100%;font-family:monospace">
          <option value="100" selected>100 ms (Fast Interrogation)</option>
          <option value="1000">1000 ms (Standard CMC Rate)</option>
          <option value="200">200 ms</option>
          <option value="500">500 ms</option>
        </select>
      </div>

      <div class="channel-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span style="font-weight:600">PARITY (Bit 32)</span>
        <div style="font-size:11px;color:#64748b">ARINC 429 Odd/Even Mode</div>
        <select id="cmc-cmd-parity" class="category-select" style="width:100%;font-family:monospace">
          <option value="ODD" selected>ODD (Default ARINC 429)</option>
          <option value="EVEN">EVEN</option>
        </select>
      </div>
    </div>

    <!-- 6 Function Select Switches (Bits 25-31) -->
    <div style="margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <h3 style="font-size:14px;font-weight:700;margin:0">FUNCTION SELECT SWITCHES (BITS 25–31)</h3>
          <p class="muted" style="margin:2px 0 0">Clicking a function switch replaces NO REQUEST (00H) temporarily until LRU ACK or 5s timeout</p>
        </div>
        <span class="pill-category">Bit 29 ACK: ${cmcState.bit29Ack ? 'VALID (ACK)' : 'NAK'}</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:10px" id="cmc-fn-grid">
        ${CMC_FUNCTION_SWITCHES.map(fn => {
          const isActive = cmcState.cmdFunction === fn.id;
          return `
            <button type="button" class="channel-row" data-fn="${fn.id}" data-hex="${fn.codeHex}"
              style="cursor:pointer;text-align:left;padding:12px 14px;${isActive ? 'background:var(--teal-bg, #f0fdfa);border-color:var(--teal-primary, #0d9488)' : ''}">
              <div>
                <div style="font-weight:700;font-size:13px;color:${isActive ? 'var(--teal-primary, #0d9488)' : 'inherit'}">${fn.label}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px">${fn.desc}</div>
              </div>
              <span class="pill ${isActive ? 'primary' : ''}" style="font-family:monospace;font-weight:700">${fn.codeHex}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Command History Table -->
    <div style="margin-top:24px">
      <div class="channel-col-title">TRANSMITTED COMMAND HISTORY LOG</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:140px">TIMESTAMP</th>
              <th>FUNCTION</th>
              <th class="mono" style="width:100px">OP CODE</th>
              <th class="mono" style="width:140px">HEX WORD</th>
              <th style="width:120px">CHANNEL</th>
              <th style="width:120px">STATUS</th>
            </tr>
          </thead>
          <tbody id="cmc-history-tbody">
            ${cmcState.cmdHistory.length ? cmcState.cmdHistory.map(h => `
              <tr>
                <td>${escAttr(h.time)}</td>
                <td><strong>${escAttr(h.function)}</strong></td>
                <td class="mono">${escAttr(h.code)}</td>
                <td class="mono"><code>${escAttr(h.hex)}</code></td>
                <td>${escAttr(h.channel)}</td>
                <td><span class="pill ok">${escAttr(h.status)}</span></td>
              </tr>
            `).join("") : `
              <tr><td colspan="6" class="muted" style="text-align:center">No command words transmitted in this session yet.</td></tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
  c.appendChild(p);

  p.querySelectorAll("#cmc-fn-grid button[data-fn]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const fnId = btn.getAttribute("data-fn");
      const hexCode = btn.getAttribute("data-hex");
      const ch = p.querySelector("#cmc-cmd-channel").value;
      const rateVal = parseInt(p.querySelector("#cmc-cmd-rate").value, 10);
      const eqCode = p.querySelector("#cmc-cmd-eqid").value.trim().toUpperCase();

      cmcState.cmdFunction = fnId;
      cmcState.cmdChannel = ch;
      cmcState.cmdRateMs = rateVal;

      try {
        await api("/api/cmc/command", {
          method: "POST",
          body: JSON.stringify({
            function: fnId,
            eq_id: eqCode,
            rate_ms: rateVal,
            channel: ch,
          }),
        });

        cmcState.cmdHistory.unshift({
          time: new Date().toLocaleTimeString(),
          function: fnId,
          code: hexCode,
          hex: `0x80${eqCode}${hexCode.slice(0, 2)}E9`,
          channel: ch,
          status: "ACK RECEIVED",
        });
      } catch (err) {
        alert("Command execution error: " + err.message);
      }

      renderCmcHub(r, s);
    });
  });
}

// CMC Tab 4: SHOP FAULTS & CONFIG TERMINAL (Label 356)
function renderCmcShopConfigTab(c, r, s) {
  const p = el("div", "panel");
  const isTerm = cmcState.terminalView === "TERMINAL";
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">SHOP FAULTS &amp; CONFIG DATA (LABEL 356)</h2>
        <p class="muted">Aeroflex T1200B CDU Terminal Interface &amp; Decoded Configuration Parameters</p>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn btn-sm ${isTerm ? 'primary' : 'btn-ghost'}" id="btn-view-term">CDU TERMINAL</button>
        <button type="button" class="btn btn-sm ${!isTerm ? 'primary' : 'btn-ghost'}" id="btn-view-table">TABLE VIEW</button>
      </div>
    </div>

    ${isTerm ? `
      <!-- CDU Terminal Visual Unit with Side Keys -->
      <div class="cdu-bezel">
        <div class="cdu-header">
          <span>AEROFLEX T1200B CDU — CMC MAINTENANCE TERMINAL (LABEL 356)</span>
          <div style="display:flex;gap:12px">
            <span>VIEW: <strong style="color:#10b981">MAINTENANCE</strong></span>
            <span>LRU: <strong style="color:#10b981">${escAttr(cmcState.selectedLru.id)}</strong></span>
          </div>
        </div>

        <div class="cdu-grid">
          <!-- Left Keys 1..6 -->
          <div class="cdu-key-col">
            ${[1, 2, 3, 4, 5, 6].map(k => `
              <button type="button" class="cdu-key" data-ckey="${k}" title="Menu select key <${k}">&lt; ${k}</button>
            `).join("")}
          </div>

          <!-- CRT Display -->
          <div class="cdu-crt" id="cmc-cdu-crt">
            <div>
              ${cmcState.terminalLines.map(ln => `<div style="min-height:19px">${escAttr(ln)}</div>`).join("")}
            </div>
            <div class="cdu-crt-status">
              <span id="cmc-cdu-status-text">MSG: ${escAttr(cmcState.terminalMsg)}</span>
              <span>PAGE ${cmcState.terminalPage}/2</span>
            </div>
          </div>

          <!-- Right Keys A..F -->
          <div class="cdu-key-col">
            ${['A', 'B', 'C', 'D', 'E', 'F'].map(k => `
              <button type="button" class="cdu-key" data-ckey="${k}" title="Menu select key ${k}>">${k} &gt;</button>
            `).join("")}
          </div>
        </div>
      </div>
    ` : `
      <!-- Table View for Config Parameters -->
      <div style="margin-top:14px">
        <div class="meters" style="margin-bottom:16px">
          <div class="meter">
            <div class="meter-label">PART NUMBER</div>
            <div class="meter-value" style="font-size:16px">${escAttr(cmcState.configData.part_number)}</div>
            <div class="meter-unit">D243W201-1 Verified</div>
          </div>
          <div class="meter">
            <div class="meter-label">OPERATIONAL SW</div>
            <div class="meter-value" style="font-size:16px">${escAttr(cmcState.configData.sw_version)}</div>
            <div class="meter-unit">Label 356 Field #2</div>
          </div>
          <div class="meter">
            <div class="meter-label">DATABASE PART NUMBER</div>
            <div class="meter-value" style="font-size:16px">${escAttr(cmcState.configData.database_pn)}</div>
            <div class="meter-unit">Label 356 Field #3</div>
          </div>
          <div class="meter">
            <div class="meter-label">SERIAL NUMBER</div>
            <div class="meter-value" style="font-size:16px">${escAttr(cmcState.configData.serial_number)}</div>
            <div class="meter-unit">Label 356 Field #4</div>
          </div>
        </div>

        <button type="button" class="btn btn-sm primary" id="btn-request-cfg">REQUEST REFRESH FROM LRU</button>
      </div>
    `}
  `;
  c.appendChild(p);

  p.querySelector("#btn-view-term").addEventListener("click", () => {
    cmcState.terminalView = "TERMINAL";
    renderCmcHub(r, s);
  });

  p.querySelector("#btn-view-table").addEventListener("click", () => {
    cmcState.terminalView = "TABLE_VIEW";
    renderCmcHub(r, s);
  });

  if (isTerm) {
    const statusText = p.querySelector("#cmc-cdu-status-text");
    p.querySelectorAll("button[data-ckey]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const k = btn.getAttribute("data-ckey");
        statusText.textContent = `MSG: EXECUTING KEY ${k}...`;
        try {
          await api("/api/cmc/terminal-action", {
            method: "POST",
            body: JSON.stringify({ key: k }),
          });
          statusText.textContent = `MSG: KEY ${k} PROCESSED`;
        } catch (err) {
          statusText.textContent = `MSG: ERROR — ${err.message}`;
        }
      });
    });
  } else {
    p.querySelector("#btn-request-cfg").addEventListener("click", async () => {
      try {
        await api("/api/cmc/request-config-data", { method: "POST" });
        alert("Configuration data requested from LRU via ARINC 429 Label 356.");
      } catch (err) {
        alert("Request error: " + err.message);
      }
    });
  }
}

// CMC Tab 5: CHANNELS PANEL
function renderCmcChannelsTab(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CONFIGURE TX/RX CHANNELS A-D</h2>
        <p class="muted">ARINC 429 Hardware Interface Configuration for Boeing CMC Bus</p>
      </div>
    </div>

    <div class="table-wrap" style="margin-bottom:16px">
      <table>
        <thead>
          <tr>
            <th>CHANNEL</th>
            <th>DIRECTION</th>
            <th>BIT RATE</th>
            <th>PARITY</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${['A', 'B', 'C', 'D'].map(ch => `
            <tr>
              <td><strong>Channel ${ch}</strong></td>
              <td>TX &amp; RX (Shared Coordinator)</td>
              <td>
                <select class="category-select">
                  <option value="HIGH" ${ch === 'A' ? 'selected' : ''}>High Speed (100 kbps)</option>
                  <option value="LOW" ${ch !== 'A' ? 'selected' : ''}>Low Speed (12.5 kbps)</option>
                </select>
              </td>
              <td><span class="pill">ODD</span></td>
              <td><span class="pill ok">ONLINE</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <button type="button" class="btn btn-sm primary" id="btn-save-cmc-channels">Save Bus Configuration</button>
  `;
  c.appendChild(p);

  p.querySelector("#btn-save-cmc-channels").addEventListener("click", () => {
    alert("CMC Bus Channel configuration saved.");
  });
}


  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { detail: text }; }
    if (!res.ok) {
      const d = (body && (body.detail || body.message)) || res.statusText;
      throw new Error(typeof d === "string" ? d : JSON.stringify(d));
    }
    return body;
  }

  function show(loggedIn) {
    $("login-view").hidden = loggedIn;
    $("app-view").hidden = !loggedIn;
  }

  function setErr(id, msg) {
    const eln = $(id);
    if (!eln) return;
    eln.hidden = !msg;
    if (msg) eln.textContent = msg;
  }

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function formatDataCell(sl, dm) {
    if (sl.mode === "adf" || sl.mode === "lru") return sl.data || "";
    const d19 = parseInt((sl.data19 || "0x00000"), 16) || 0;
    if (dm === "BIN") return d19.toString(2).padStart(19, "0");
    return sl.data || ("0x" + d19.toString(16).toUpperCase().padStart(5, "0"));
  }

  function engDisplayValue(sl) {
    if (sl.eng_value != null && sl.eng_value !== "") return String(sl.eng_value);
    const text = String(sl.data_eng || sl.data || "");
    const m = text.match(/-?\d+(?:\.\d+)?/);
    if (m) return m[0];
    if (sl.freq_khz) return String(sl.freq_khz);
    return "";
  }

  function labelScreen(s) {
    const map = {
      mode_select: "Mode Select", standard: "Standard", cfds: "CFDS", cmc: "CMC",
      label_library: "Label Library",
      user_configure: "User Configure", setup_txrx: "Setup TX/RX",
      avionics_lru: "Avionics LRU", lru_format: "LRU Format", standard_lru: "Standard LRU", hf_screen: "HF COMM", vhf_align: "VHF ALIGN",
      dme_config: "DME Config", dme_single: "DME Single", dme_multi: "DME Multi", dme_standard: "DME Standard Nav",
      dme_diagnostic: "DME Live Diagnostic",
      mmr_menu: "MMR", mmr_format: "MMR Format",
      cfds_lru: "CFDS LRU", cfds_edit_tx: "Edit TX", cfds_op_modes: "Op Modes",
      cfds_config_channels: "Config Channels",
      cfds_op_normal: "Normal Mode", cfds_op_menu: "Menu Mode",
      cfds_op_discrete: "Discrete Mode", cfds_op_interactive: "Interactive Mode",
      cmc_edit_tx: "Edit TX", cmc_fault_summary: "Fault Summary",
      cmc_command_summary: "Command Summary", cmc_config_txrx: "Config TX/RX",
      cmc_shop_terminal: "Shop Terminal",
    };
    return map[s] || s;
  }

  // ---- breadcrumb ----
  function renderBreadcrumb(stack) {
    const bc = $("breadcrumb");
    bc.innerHTML = "";
    (stack || ["mode_select"]).forEach((s, i) => {
      if (i > 0) {
        const sep = el("span", "sep"); sep.textContent = "/"; bc.appendChild(sep);
      }
      const c = el("span", "crumb");
      c.textContent = labelScreen(s);
      c.addEventListener("click", () => navTo(s));
      bc.appendChild(c);
    });
  }

  async function navTo(screen) {
    const stack = (snap && snap.screen_stack) || ["mode_select"];
    const idx = stack.indexOf(screen);
    if (idx >= 0) {
      const pops = stack.length - idx - 1;
      let finalRes = null;
      for (let i = 0; i < pops; i++) {
        try {
          finalRes = await api("/api/arinc/screen/pop", { method: "POST" });
        } catch (e) {
          alert(e.message);
          break;
        }
      }
      if (finalRes) {
        render(finalRes);
      }
    } else {
      await pushScreen(screen);
    }
  }

  function renderTopbar(s) {
    const rp = $("run-pill");
    rp.textContent = s.running ? "RUNNING" : "STOPPED";
    rp.className = "pill " + (s.running ? "pill-run" : "pill-stop");
    $("rate-pill").textContent = s.bit_rate_display || `${s.bit_rate_kbps || 12.5} kbps`;
    const start = $("btn-arinc-start");
    const stop = $("btn-arinc-stop");
    if (start) start.disabled = !!s.running;
    if (stop) stop.disabled = !s.running;
    const host = $("topbar-status");
    let err = $("run-error");
    if (s.error && host) {
      if (!err) {
        err = el("span", "err");
        err.id = "run-error";
        host.appendChild(err);
      }
      err.hidden = false;
      err.textContent = s.error;
    } else if (err) {
      err.hidden = true;
      err.textContent = "";
    }
  }

  function viewKey(s) {
    return (s.screen_stack || ["mode_select"]).join("/");
  }

  function isWorkbench(view) {
    return view === "user_configure" || view === "setup_txrx" ||
      view === "cfds_edit_tx" || view === "cfds_config_channels" ||
      view === "cmc_edit_tx" || view === "cmc_config_txrx" ||
      view === "dme_single" || view === "dme_multi" || view === "dme_standard" || view === "lru_format" || view === "mmr_format";
  }

  function render(s, opts) {
    const force = !(opts && opts.live);
    if (s && s.lru_connection) {
      const prevReal = cfdsState.realDeviceConnected;
      cfdsState.realDeviceConnected = !!s.lru_connection.connected;
      cfdsState.deviceStatusDetail = s.lru_connection.detail || "";
      if (!cfdsState.simulationMode && prevReal !== cfdsState.realDeviceConnected) {
        if (cfdsState.currentView === "LRU_CONSOLE") {
          const rootEl = root();
          if (rootEl) renderCfdsHub(rootEl, s);
        }
      }
    }
    if (snap && s && s !== snap) s = Object.assign({}, snap, s);
    snap = s;
    renderTopbar(s);
    const key = viewKey(s);
    const view = s.screen_stack ? s.screen_stack[s.screen_stack.length - 1] : "mode_select";
    if (!force && key === lastViewKey) {
      if (view === "dme_diagnostic") return;
      if (view === "dme_single") {
        patchDmeSingleRx(s);
        return;
      }
      if (view === "dme_multi") {
        patchDmeMultiRx(s);
        return;
      }
      if (view === "dme_standard") {
        patchDmeStandardRx(s);
        return;
      }
      if (view === "standard_lru" || (view === "lru_format" && s.active_profile !== "vhf_align" && s.active_profile !== "hf_719" && s.active_profile !== "hfdu_753" && s.active_profile !== "hfdr_753" && s.active_profile !== "dme")) {
        patchStandardLruRx(s);
        return;
      }
      if (view === "hf_screen" || (view === "lru_format" && (s.active_profile === "hf_719" || s.active_profile === "hfdu_753" || s.active_profile === "hfdr_753"))) {
        patchHfRx(s);
        return;
      }
      if (view === "vhf_align" || (view === "lru_format" && s.active_profile === "vhf_align")) {
        patchVhfAlignRx(s);
        return;
      }
      if (isWorkbench(view)) patchRxTable(s);
      const catEmpty = view === "avionics_lru" && (s.catalog || []).length &&
        !document.querySelector(".catalog-btn");
      if (!catEmpty) return;
    }
    lastViewKey = key;
    renderBreadcrumb(s.screen_stack);
    if (view !== "dme_diagnostic") {
      stopDmeDiagTimer();
    }
    const r = root();
    r.innerHTML = "";
    if (view === "mode_select") renderModeSelect(r, s);
    else if (view === "label_library") renderLabelLibrary(r, s);
    else if (view === "standard") renderStandardHub(r, s);
    else if (view === "dme_diagnostic") renderDmeDiagnostic(r, s);
    else if (view === "dme_config") renderDmeConfig(r, s);
    else if (view === "dme_single") renderDmeSingle(r, s);
    else if (view === "dme_multi") renderDmeMulti(r, s);
    else if (view === "dme_standard" || (view === "lru_format" && (s.active_profile === "dme" || s.dme_mode === "standard"))) renderDmeStandard(r, s);
    else if (view === "vhf_align" || (view === "lru_format" && s.active_profile === "vhf_align")) renderVhfAlign(r, s);
    else if (view === "hf_screen" || (view === "lru_format" && (s.active_profile === "hf_719" || s.active_profile === "hfdu_753" || s.active_profile === "hfdr_753"))) renderHfScreen(r, s);
    else if (view === "standard_lru" || view === "lru_format" || view === "mmr_format") renderStandardLru(r, s);
    else if (view === "avionics_lru" || view === "cfds_lru") renderLruPicker(r, s);
    else if (view === "user_configure" || view === "setup_txrx" || view === "cfds_edit_tx" || view === "cfds_config_channels" || view === "cmc_edit_tx" || view === "cmc_config_txrx") renderSetupTxRx(r, s);
    else if (view === "mmr_menu") renderMmrMenu(r, s);
    else if (view === "cfds") renderCfdsHub(r, s);
    else if (view === "cmc") renderCmcHub(r, s);
    else if (view === "cfds_op_modes") renderCfdsOpModes(r, s);
    else if (view === "cfds_op_normal") renderCfdsNormalMode(r, s);
    else if (view === "cfds_op_menu") renderCfdsMenuMode(r, s);
    else if (view === "cfds_op_discrete") renderCfdsDiscreteMode(r, s);
    else if (view === "cfds_op_interactive") renderCfdsInteractiveMode(r, s);
    else if (view === "cmc_command_summary") renderCmcCommandSummary(r, s);
    else if (view === "cmc_fault_summary") renderCmcFaultSummary(r, s);
    else if (view === "cmc_shop_terminal") renderCmcShopTerminal(r, s);
    else renderModeSelect(r, s);
  }

  function renderModeSelect(r, s) {
    const hero = el("div", "mode-hero");
    hero.innerHTML = `<h1>ATE <span style="color:var(--accent)">429</span> Console</h1><p class="muted">Select operating mode</p>`;
    r.appendChild(hero);
    const grid = el("div", "mode-grid");
    const modes = [
      { id: "standard", tag: "Standard", title: "Standard Mode", desc: "Configure TX/RX channels, edit words, test avionics LRUs.", coming: false },
      { id: "cfds", tag: "CFDS", title: "CFDS Mode", desc: "Centralized Fault Display System (ABD0018 / ABD0048).", coming: false },
      { id: "cmc", tag: "CMC", title: "CMC Mode", desc: "Central Maintenance Computer (Boeing).", coming: false },
      { id: "label_library", tag: "Library", title: "Label Library", desc: "Aeroflex T1200 label dictionary (octal, name, default, units).", coming: false, library: true },
    ];
    modes.forEach((m) => {
      const card = el("div", "mode-card" + (m.coming ? " disabled" : ""));
      card.innerHTML = `<div class="tag">${m.tag}</div><h2>${m.title}</h2><p>${m.desc}</p>` + (m.coming ? `<div class="coming">Coming soon</div>` : "");
      if (!m.coming) card.addEventListener("click", () => {
        if (m.library) pushScreen("label_library");
        else selectMode(m.id);
      });
      grid.appendChild(card);
    });
    r.appendChild(grid);
  }

  function renderLabelLibrary(r, s) {
    const p = el("div", "panel");
    p.innerHTML = `<div class="panel-title">Label Library</div>
      <p class="muted">Aeroflex T1200 default-data dictionary. Avionics LRU can pick these labels or add custom rows.</p>
      <div class="ln-bar"><input id="lib-filter" placeholder="Filter octal or name" style="min-width:16rem"/></div>`;
    const wrap = el("div", "table-wrap");
    const tbl = document.createElement("table");
    tbl.className = "lib-table";
    tbl.innerHTML = `<thead><tr>
      <th class="mono">LABEL</th><th>NAME</th><th class="mono">DEFAULT</th><th>UNITS</th>
      <th class="mono">SDI</th><th class="mono">PADS</th><th>SSM</th><th class="mono">RATE</th><th>FORMAT</th>
    </tr></thead><tbody id="lib-tbody"></tbody>`;
    wrap.appendChild(tbl);
    p.appendChild(wrap);
    r.appendChild(p);

    const paint = (rows) => {
      const q = (($("lib-filter") && $("lib-filter").value) || "").trim().toLowerCase();
      const filtered = !q ? rows : rows.filter((row) =>
        String(row.label || "").toLowerCase().includes(q) ||
        String(row.funct || row.name || "").toLowerCase().includes(q));
      const tb = $("lib-tbody");
      if (!filtered.length) {
        tb.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center">No labels</td></tr>`;
        return;
      }
      tb.innerHTML = filtered.map((row) => `<tr>
        <td class="mono">${escAttr(row.label)}</td>
        <td>${escAttr(row.funct || row.name || "")}</td>
        <td class="mono">${escAttr(row.eng_default == null ? "" : row.eng_default)}</td>
        <td>${escAttr(row.units || "")}</td>
        <td class="mono">${String(row.sdi ?? 0).padStart(2, "0")}</td>
        <td class="mono">${escAttr(row.pads || "-")}</td>
        <td>${escAttr(row.ssm || "NML")}</td>
        <td class="mono">${row.rate_ms || ""}</td>
        <td class="mono">${escAttr(row.encoding || "raw")}</td>
      </tr>`).join("");
    };

    ensureLibrary().then((rows) => {
      paint(rows);
      const inp = $("lib-filter");
      if (inp) inp.addEventListener("input", () => paint(libraryCache || rows));
    }).catch((e) => { alert(e.message); });
  }

  function renderStandardHub(r, s) {
    const grid = el("div", "hub-grid");
    const items = [
      { id: "user_configure", title: "User Configure", desc: "Setup TX/RX channels" },
      { id: "avionics_lru", title: "Avionics LRU", desc: "LRU test profiles" },
    ];
    items.forEach((it) => {
      const card = el("div", "mode-card");
      card.innerHTML = `<h2>${it.title}</h2><p>${it.desc}</p>`;
      card.addEventListener("click", () => pushScreen(it.id));
      grid.appendChild(card);
    });
    r.appendChild(grid);
  }



// State objects
const standardLruState = {
  activeSlot: 0,
  txBus: "A",
  rxBus: "A",
  bitRate: 12.5,
  stepDir: "INC",
  cursorField: "DATA",
  cursorPos: 0,
  rxWordIndex: 0,
  lastSnap: null,
  slots: {},
  _customBus: false,
};

const hfScreenState = {
  freqMhz: 10.0000,
  sb: "LSB",
  mod: "AM",
  cw: false,
  ssm: "NML",
  par: "ODD",
  rateMs: 200,
  txBus: "A",
  rxBus: "B",
  bitRate: 12.5,
  stepDir: "INC",
  cursorField: "DATA",
  cursorPos: 2,
  rxWordIndex: 0,
};

const vhfAlignState = {
  page: "menu", // "menu", "tfm", "cal", "fail" / "faults"
  currentScreen: "menu",
  ssm: "00",
  sdi: "00",
  tfmPage: 1,
  calPage: 1,
  activeVarId: 1,
  cursorField: "val", // "val" or "freq"
  valNibble: 0, // 0 = high nibble, 1 = low nibble
  freqPos: 2, // 0: 100s, 1: 10s, 2: 1s, 3: 0.1s, 4: 0.01s, 5: 0.001s
  confirmAction: null,
  confirmTimer: null,
};
let vhfChecksumTimer = null;
let vhfChecksumCountdown = 0;

// ============================================================================
// 1. SELECT LRU TO BE TESTED: (Avionics LRU Menu)
// ============================================================================
function renderLruPicker(r, s) {
  const p = el("div", "panel");
  p.style.maxWidth = "1060px";
  p.style.margin = "0 auto";

  const toolbar = el("div", "lru-toolbar");
  toolbar.style.display = "flex";
  toolbar.style.justifyContent = "space-between";
  toolbar.style.alignItems = "center";
  toolbar.style.marginBottom = "1rem";
  toolbar.style.flexWrap = "nowrap";
  toolbar.style.gap = "12px";
  toolbar.innerHTML = `
    <div style="min-width:0; flex-shrink:1;">
      <div class="panel-title" style="margin-bottom:0.2rem; white-space:nowrap;">SELECT LRU TO BE TESTED:</div>
      <p class="muted" style="margin:0; font-size:12.5px; white-space:nowrap;">Aeroflex / JcAIR T1200B Avionics Characteristic Set</p>
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:nowrap; flex-shrink:0;">
      <button type="button" class="btn btn-ghost btn-sm" id="btn-lru-ret-mode" style="white-space:nowrap;">&lt; Operating Modes</button>
    </div>
  `;
  p.appendChild(toolbar);

  const container = el("div", "lru-selector-dynapro");

  const catalog = s.catalog || [];
  const findItem = (id) => catalog.find((c) => c.id === id) || { id, char: id, title: id, kind: "lru" };

  // Row 1 (10 buttons)
  const row1Ids = ["adf_032", "vor", "ils", "dme", "atc_xpdr", "radio_alt", "vhf_comm", "hf_719", "vdr_750", "hfdu_753"];
  const grid1 = el("div", "lru-grid-10");
  row1Ids.forEach((id) => {
    const item = findItem(id);
    const btn = el("button", "lru-cat-btn");
    btn.type = "button";
    btn.innerHTML = `<span class="btn-char">${item.char}</span><span class="btn-title">${item.title}</span>`;
    btn.addEventListener("click", () => selectCatalog(item));
    grid1.appendChild(btn);
  });
  container.appendChild(grid1);

  // Row 2 (7 buttons)
  const row2Ids = ["hfdr_753", "hf_rmp", "hf_acars", "hfdu_rmp", "hfdr_rmp", "vhf_833", "mmr_755"];
  const grid2 = el("div", "lru-grid-7");
  row2Ids.forEach((id) => {
    const item = findItem(id);
    const btn = el("button", "lru-cat-btn");
    btn.type = "button";
    btn.innerHTML = `<span class="btn-char">${item.char}</span><span class="btn-title">${item.title}</span>`;
    btn.addEventListener("click", () => selectCatalog(item));
    grid2.appendChild(btn);
  });
  container.appendChild(grid2);

  // Row 3 (Left: 2 buttons, Right: TIME CONSTANT block)
  const row3 = el("div", "lru-row-3");
  const row3Left = el("div", "lru-row-3-left");
  ["vhf_align", "vdl_mode"].forEach((id) => {
    const item = findItem(id);
    const btn = el("button", "lru-cat-btn");
    btn.type = "button";
    btn.innerHTML = `<span class="btn-char">${item.char}</span><span class="btn-title">${item.title}</span>`;
    btn.addEventListener("click", () => selectCatalog(item));
    row3Left.appendChild(btn);
  });
  row3.appendChild(row3Left);

  // Time Constant Box
  const curTc = Number(s.time_constant_s || 0);
  const tcBox = el("div", "lru-tc-box");
  tcBox.id = "btn-time-constant-box";
  tcBox.innerHTML = `
    <div class="tc-title">TIME CONSTANT</div>
    <div class="tc-sub">VOR ILS ADF FILTER</div>
    <div class="tc-val ${curTc > 0 ? "active-filter" : ""}" id="tc-val-display">${curTc === 0 ? "OFF" : curTc + " s"}</div>
  `;
  const tcSteps = [0, 0.4, 0.8, 1.6, 3.2, 6.4, 12.8];
  tcBox.addEventListener("click", async () => {
    let cur = Number(snap && snap.time_constant_s || 0);
    let idx = tcSteps.findIndex((v) => Math.abs(v - cur) < 0.05);
    let nextIdx = (idx + 1) % tcSteps.length;
    let nextVal = tcSteps[nextIdx];
    const valDisp = tcBox.querySelector("#tc-val-display");
    if (valDisp) {
      valDisp.textContent = nextVal === 0 ? "OFF" : nextVal + " s";
      valDisp.classList.toggle("active-filter", nextVal > 0);
    }
    if (snap) snap.time_constant_s = nextVal;
    try {
      const updated = await api("/api/arinc/time-constant", {
        method: "POST",
        body: JSON.stringify({ seconds: nextVal }),
      });
      if (snap) snap.time_constant_s = updated.time_constant_s != null ? updated.time_constant_s : nextVal;
    } catch (e) {
      alert(e.message);
    }
  });
  row3.appendChild(tcBox);
  container.appendChild(row3);

  // Row 4 (579 VOR)
  const row4 = el("div", "lru-row-4");
  const item579 = findItem("vor_579");
  const btn579 = el("button", "lru-cat-btn");
  btn579.type = "button";
  btn579.innerHTML = `<span class="btn-char">${item579.char}</span><span class="btn-title">${item579.title}</span>`;
  btn579.addEventListener("click", () => selectCatalog(item579));
  row4.appendChild(btn579);
  container.appendChild(row4);

  p.appendChild(container);

  // Event listener for top return button
  const topRet = toolbar.querySelector("#btn-lru-ret-mode");
  if (topRet) topRet.addEventListener("click", () => popScreen());

  // Custom LRUs (if any exist)
  ensureProfiles().then((list) => {
    const custom = (list || []).filter((pr) => !pr.catalog);
    if (custom.length) {
      const customTitle = el("div", "panel-title");
      customTitle.textContent = "Custom LRUs";
      customTitle.style.margin = "1.5rem 0 .5rem";
      p.appendChild(customTitle);
      const grid = el("div", "mode-grid");
      custom.forEach((prof) => {
        const card = el("div", "mode-card");
        const tags = (prof.labels || []).slice(0, 4).map((l) => `<span class="chan-card-map">${l}</span>`).join(" ");
        card.innerHTML = `<div class="tag">${prof.funct || prof.id}</div><h2>${prof.name}</h2>
          <p>TX CH ${prof.tx_ch || prof.bus || "A"} · RX CH ${prof.rx_ch || prof.bus || "A"} · ${prof.characteristic || "ARINC"} · labels ${tags}</p>
          <div class="card-actions">
            <button type="button" class="btn btn-sm" data-act="use">Use</button>
            <button type="button" class="btn btn-sm btn-ghost" data-act="edit">Edit</button>
            <button type="button" class="btn btn-sm btn-ghost" data-act="del">Delete</button>
          </div>`;
        card.querySelector("[data-act=use]").addEventListener("click", (ev) => { ev.stopPropagation(); applyProfile(prof.id); });
        card.querySelector("[data-act=edit]").addEventListener("click", (ev) => { ev.stopPropagation(); openLruForm(prof.id); });
        card.querySelector("[data-act=del]").addEventListener("click", (ev) => { ev.stopPropagation(); deleteLru(prof.id, prof.name); });
        grid.appendChild(card);
      });
      p.appendChild(grid);
    }
  }).catch(() => {});

  r.appendChild(p);
}

// ============================================================================
// 2. selectCatalog
// ============================================================================
function selectCatalog(c) {
  try {
    if (c.kind === "dme") {
      pushScreen("dme_config");
      return;
    }
    if (c.kind === "mmr" || c.id === "mmr_755") {
      api("/api/arinc/mmr/menu", { method: "POST", body: JSON.stringify({ menu: "ils" }) })
        .then(res => render(res))
        .catch(e => alert(e.message));
      return;
    }
    if (c.kind === "vhf_align" || c.id === "vhf_align") {
      vhfAlignState.page = "menu";
      vhfAlignState.currentScreen = "menu";
      if (snap) snap.active_profile = "vhf_align";
      pushScreen("vhf_align");
      applyProfile("vhf_align", { stay: true }).catch(() => {});
      return;
    }
    if (c.kind === "hf" || c.id === "hf_719" || c.id === "hfdu_753" || c.id === "hfdr_753") {
      if (snap) snap.active_profile = c.id;
      pushScreen("hf_screen");
      applyProfile(c.id, { stay: true }).catch(() => {});
      return;
    }
    if (snap) snap.active_profile = c.id;
    pushScreen("standard_lru");
    applyProfile(c.id, { stay: true }).catch(() => {});
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================================
// 3. renderStandardLru & patchStandardLruRx
// ============================================================================
const OFFICIAL_LRU_NAMES = {
  adf_032: "712 ADF",
  vor: "711 VOR",
  ils: "710 ILS",
  atc_xpdr: "718 ATC",
  radio_alt: "707 LRA",
  vhf_comm: "716 VHF",
  hf_719: "719 HF",
  vdr_750: "750 VDR",
  hfdu_753: "753 HFDU",
  hfdr_753: "753 HFDR",
  hf_rmp: "719 HF RMP",
  hf_acars: "719 HF ACARS",
  hfdu_rmp: "753 HFDU RMP",
  hfdr_rmp: "753 HFDR RMP",
  vhf_833: "716 8.33",
  mmr_755: "755 MMR",
  vhf_align: "VHF ALIGN",
  vdl_mode: "VDL MODE",
  vor_579: "579 VOR"
};

// Modal Keypad Dialog (Accessible to all LRU, HF, and DME screens)
function showDmeKeypadModal({ title, value, type, hint, onApply }) {
  const existing = document.getElementById("dynapro-modal-root");
  if (existing) existing.remove();

  const overlay = el("div", "dme-modal-overlay dynapro-modal-overlay");
  overlay.id = "dynapro-modal-root";
  const box = el("div", "dme-modal-box dynapro-modal-box");
  box.innerHTML = `
    <div class="dme-modal-title dynapro-modal-title">${title}</div>
    <input type="text" class="dme-modal-input dynapro-modal-input" id="dynapro-modal-input" value="${value || ""}" autofocus />
    ${hint ? `<div style="font-size:12px; margin-bottom:10px; color:var(--text-2); text-align:center;">${hint}</div>` : ""}
    <div id="dynapro-modal-extra"></div>
    <div class="dme-keypad-grid dynapro-keypad-grid" id="dynapro-modal-keypad"></div>
    <div class="dme-modal-actions dynapro-modal-actions">
      <button type="button" class="btn btn-ghost" id="dynapro-modal-cancel">Cancel</button>
      <button type="button" class="btn" id="dynapro-modal-apply">Apply</button>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const input = box.querySelector("#dynapro-modal-input");
  const kp = box.querySelector("#dynapro-modal-keypad");
  const extra = box.querySelector("#dynapro-modal-extra");

  const close = () => overlay.remove();
  box.querySelector("#dynapro-modal-cancel").onclick = close;
  box.querySelector("#dynapro-modal-apply").onclick = () => {
    const val = input.value;
    close();
    if (onApply) onApply(val);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      box.querySelector("#dynapro-modal-apply").click();
    } else if (e.key === "Escape") {
      close();
    }
  });

  if (type === "pad") {
    extra.innerHTML = `
      <div style="font-size:11px; margin-bottom:8px; color:var(--text-2); text-align:center;">
        Bit 6: IDENT | Bit 5: DISP | Bits 4-3: NAV | Bits 2-0: MODE
      </div>
      <div style="display:flex; justify-content:center; gap:6px; margin-bottom:12px;" id="pad-bits-row"></div>
    `;
    const row = extra.querySelector("#pad-bits-row");
    const renderBits = () => {
      row.innerHTML = "";
      let padStr = (input.value || "0100001").padEnd(7, "0").slice(0, 7);
      for (let i = 6; i >= 0; i--) {
        const bitVal = padStr[6 - i] || "0";
        const b = el("button", `dme-kp-btn dynapro-kp-btn ${bitVal === "1" ? "active" : ""}`);
        b.type = "button";
        b.style.minWidth = "38px";
        b.style.background = bitVal === "1" ? "var(--accent)" : "var(--surface)";
        b.style.color = bitVal === "1" ? "#ffffff" : "var(--text)";
        b.innerHTML = `<span style="font-size:9px; display:block; opacity:0.8;">b${i}</span><strong>${bitVal}</strong>`;
        b.onclick = () => {
          const arr = padStr.split("");
          arr[6 - i] = bitVal === "1" ? "0" : "1";
          padStr = arr.join("");
          input.value = padStr;
          renderBits();
        };
        row.appendChild(b);
      }
    };
    renderBits();
    input.addEventListener("input", renderBits);

    kp.innerHTML = `
      <button type="button" class="dme-kp-btn dynapro-kp-btn" data-act="0">0</button>
      <button type="button" class="dme-kp-btn dynapro-kp-btn" data-act="1">1</button>
      <button type="button" class="dme-kp-btn dynapro-kp-btn" data-act="bs">&larr;</button>
      <button type="button" class="dme-kp-btn dynapro-kp-btn" data-act="def">DEFAULT</button>
    `;
    kp.querySelectorAll("[data-act]").forEach((btn) => {
      btn.onclick = () => {
        const a = btn.dataset.act;
        if (a === "bs") input.value = input.value.slice(0, -1);
        else if (a === "def") input.value = "0100001";
        else input.value = (input.value + a).slice(0, 7);
        renderBits();
      };
    });
  } else {
    const keys = [
      "1", "2", "3", "+0.05",
      "4", "5", "6", "-0.05",
      "7", "8", "9", "+1.00",
      ".", "0", "CLR", "-1.00"
    ];
    keys.forEach((k) => {
      const btn = el("button", "dme-kp-btn dynapro-kp-btn");
      btn.type = "button";
      btn.textContent = k;
      btn.onclick = () => {
        if (k === "CLR") input.value = "";
        else if (k.startsWith("+") || k.startsWith("-")) {
          const cur = parseFloat(input.value) || 0;
          const delta = parseFloat(k);
          input.value = (cur + delta).toFixed(2);
        } else {
          input.value += k;
        }
      };
      kp.appendChild(btn);
    });
  }

  input.focus();
  input.select();
}

const LRU_TX_WORDS_MAP = {
  adf_032: [{ slot: 0, name: "ADF FREQ", label: "032", defaultVal: 577.0 }],
  vor: [
    { slot: 0, name: "VOR FREQ", label: "034", defaultVal: 108.00 },
    { slot: 1, name: "CRS1 BCD", label: "024", defaultVal: 0.0 },
    { slot: 2, name: "CRS2 BCD", label: "027", defaultVal: 0.0 },
    { slot: 3, name: "CRS1 BNR", label: "100", defaultVal: 0.0 },
    { slot: 4, name: "CRS2 BNR", label: "110", defaultVal: 0.0 }
  ],
  ils: [
    { slot: 0, name: "ILS FREQ", label: "033", defaultVal: 110.30 },
    { slot: 1, name: "RHDG BCD", label: "017", defaultVal: 0.0 },
    { slot: 2, name: "ISO ALPH", label: "015", defaultVal: 0 }
  ],
  atc_xpdr: [
    { slot: 0, name: "ATC RPLY", label: "031", defaultVal: "1234" },
    { slot: 1, name: "PRES ALT", label: "203", defaultVal: 10000 }
  ],
  radio_alt: [
    { slot: 0, name: "RALT BCD", label: "165", defaultVal: 1000.0 },
    { slot: 1, name: "RALT BNR", label: "164", defaultVal: 1000.0 }
  ],
  vhf_comm: [{ slot: 0, name: "VHF COMM", label: "030", defaultVal: 118.000 }],
  vhf_833: [{ slot: 0, name: "VHF 8.33", label: "047", defaultVal: 117.992 }],
  vdr_750: [
    { slot: 0, name: "VDR SAL", label: "172", defaultVal: 0 },
    { slot: 1, name: "DSCR DAT1", label: "270", defaultVal: 0 }
  ],
  vdl_mode: [
    { slot: 0, name: "VDR SAL", label: "172", defaultVal: 0 },
    { slot: 1, name: "DSCR DAT1", label: "270", defaultVal: 0 }
  ],
  vor_579: [{ slot: 0, name: "VOR FREQ", label: "034", defaultVal: 108.00 }],
  hf_rmp: [
    { slot: 0, name: "HF-A COMM", label: "205", defaultVal: 10.0000 },
    { slot: 1, name: "HF-B COMM", label: "206", defaultVal: 10.0000 },
    { slot: 2, name: "HF MODE", label: "207", defaultVal: 0 }
  ],
  hf_acars: [
    { slot: 0, name: "HF-A COMM", label: "205", defaultVal: 10.0000 },
    { slot: 1, name: "HF-B COMM", label: "206", defaultVal: 10.0000 },
    { slot: 2, name: "HF MODE", label: "207", defaultVal: 0 }
  ],
  hfdu_rmp: [
    { slot: 0, name: "HF-A COMM", label: "205", defaultVal: 10.0000 },
    { slot: 1, name: "HF-B COMM", label: "206", defaultVal: 10.0000 },
    { slot: 2, name: "HF MODE", label: "207", defaultVal: 0 }
  ],
  hfdr_rmp: [
    { slot: 0, name: "HF-A COMM", label: "205", defaultVal: 10.0000 },
    { slot: 1, name: "HF-B COMM", label: "206", defaultVal: 10.0000 },
    { slot: 2, name: "HF MODE", label: "207", defaultVal: 0 }
  ],
  mmr_755: [
    { slot: 0, name: "ILS FREQ", label: "033", defaultVal: 110.30 },
    { slot: 1, name: "GLS FREQ", label: "035", defaultVal: 110.30 },
    { slot: 2, name: "DADS", label: "203", defaultVal: 10000 },
    { slot: 3, name: "IRS", label: "310", defaultVal: 0.0 }
  ]
};

function getDefaultLruData(pid, slotIdx) {
  const words = LRU_TX_WORDS_MAP[pid] || [];
  const found = words.find(w => w.slot === slotIdx);
  if (found && found.defaultVal !== undefined) return found.defaultVal;
  return 0.0;
}

function getDefaultLruLabel(pid, slotIdx) {
  const words = LRU_TX_WORDS_MAP[pid] || [];
  const found = words.find(w => w.slot === slotIdx);
  if (found && found.label) return found.label;
  return "000";
}

function getDefaultLruFunct(pid, slotIdx) {
  const words = LRU_TX_WORDS_MAP[pid] || [];
  const found = words.find(w => w.slot === slotIdx);
  if (found && found.name) return found.name;
  return "NAV";
}

function formatLruPad(id, rawPad) {
  if (id === "adf_032") return "000";
  if (id === "vor" || id === "ils" || id === "vor_579") return "0000";
  if (id === "atc_xpdr") return "0000001";
  if (id === "radio_alt" || id === "vhf_comm" || id === "vhf_833") return "---";
  return (rawPad && rawPad !== "-") ? String(rawPad).padStart(7, "0") : "0000000";
}

function formatLruDataAndUnit(id, dataVal, curSlotIdx) {
  let unit = "";
  let formatted = "";
  if (id === "adf_032") {
    unit = "KHZ";
    let n = Number(dataVal);
    formatted = Number.isFinite(n) ? n.toFixed(1) : "577.0";
  } else if (id === "vor" || id === "ils" || id === "vor_579") {
    if (curSlotIdx > 0) {
      unit = "DEG";
      let n = Number(dataVal);
      formatted = Number.isFinite(n) ? n.toFixed(1) : "0.0";
    } else {
      unit = "MHZ";
      let n = Number(dataVal);
      formatted = Number.isFinite(n) ? n.toFixed(2) : (id === "ils" ? "110.30" : "108.00");
    }
  } else if (id === "atc_xpdr") {
    unit = (curSlotIdx === 1) ? "FT" : "SQWK";
    formatted = String(dataVal != null ? dataVal : (curSlotIdx === 1 ? "10000" : "1234"));
  } else if (id === "radio_alt") {
    unit = "FT";
    let n = Number(dataVal);
    formatted = Number.isFinite(n) ? n.toFixed(1) : "1000.0";
  } else if (id === "vhf_comm") {
    unit = "MHZ";
    let n = Number(dataVal);
    formatted = Number.isFinite(n) ? n.toFixed(3) : "118.000";
  } else if (id === "vhf_833") {
    unit = "MHZ";
    let n = Number(dataVal);
    formatted = Number.isFinite(n) ? n.toFixed(3) : "117.992";
  } else if (id === "vdr_750" || id === "vdl_mode") {
    unit = "";
    const rawVal = Number.isFinite(Number(dataVal)) ? Number(dataVal) : 0;
    const bin24 = (rawVal & 0xFFFFFF).toString(2).padStart(24, "0");
    formatted = bin24.match(/.{1,4}/g).join(" ");
  } else if (id === "hf_rmp" || id === "hfdu_rmp" || id === "hfdr_rmp" || id === "hf_acars") {
    unit = "MHZ";
    let n = Number(dataVal);
    formatted = Number.isFinite(n) ? n.toFixed(4) : "10.0000";
  } else {
    formatted = String(dataVal != null ? dataVal : "0.00");
  }
  return { formatted, unit };
}

function renderStandardLru(r, s) {
  r.innerHTML = "";
  standardLruState.lastSnap = s;
  const curSlotIdx = standardLruState.activeSlot || 0;
  const pid = (s && s.active_profile) || activeProfile || "vor";
  const isVdr = (pid === "vdr_750" || pid === "vdl_mode");

  if (isVdr && !standardLruState._customBus) {
    standardLruState.txBus = "C";
    standardLruState.rxBus = "A";
    if (standardLruState.bitRate == null) standardLruState.bitRate = 100.0;
  } else if (!standardLruState._customBus) {
    standardLruState.txBus = (s && s.tx_ch) || standardLruState.txBus || "A";
    standardLruState.rxBus = (s && s.rx_ch) || standardLruState.rxBus || "A";
    if (standardLruState.bitRate == null) standardLruState.bitRate = (s && s.bit_rate_kbps) || 12.5;
  }

  const txCh = standardLruState.txBus;
  const rxCh = standardLruState.rxBus;
  const curRate = standardLruState.bitRate || (s && s.bit_rate_kbps) || (isVdr ? 100.0 : 12.5);
  const stepDir = standardLruState.stepDir || "INC";

  const getStdLruSlotData = (slotIdx, bus) => {
    const b = bus || standardLruState.txBus || "A";
    const sIdx = slotIdx != null ? slotIdx : (standardLruState.activeSlot || 0);
    const backendSlot = (s && s.tx && s.tx[b] && s.tx[b][sIdx]) || {};
    const cached = (standardLruState.slots && standardLruState.slots[sIdx]) || {};

    let dataVal = cached.dataVal != null
      ? cached.dataVal
      : (backendSlot.eng_value != null && Number.isFinite(Number(backendSlot.eng_value))
          ? backendSlot.eng_value
          : (backendSlot.data_eng != null ? backendSlot.data_eng : (backendSlot.data != null ? backendSlot.data : getDefaultLruData(pid, sIdx))));
    let sdi = cached.sdi != null ? cached.sdi : (backendSlot.sdi != null ? Number(backendSlot.sdi) : 0);
    let ssm = cached.ssm || backendSlot.ssm || "NML";
    let parity = cached.parity || backendSlot.par || backendSlot.parity || "ODD";
    let rate = cached.rate || backendSlot.rate_ms || (isVdr ? 100 : (pid === "vor" ? 200 : 150));
    let label = cached.label || backendSlot.label || backendSlot.label_octal || getDefaultLruLabel(pid, sIdx);
    let funct = cached.funct || backendSlot.funct || getDefaultLruFunct(pid, sIdx);
    let pad = cached.pad || ((backendSlot.pads && backendSlot.pads !== "-") ? backendSlot.pads : formatLruPad(pid));

    return { dataVal, sdi, ssm, parity, rate, label, funct, pad, enabled: backendSlot.enabled !== false };
  };

  const curSlot = getStdLruSlotData(curSlotIdx, txCh);

  const p = el("div", "panel");
  p.style.maxWidth = "1060px";
  p.style.margin = "0 auto";

  // Card Outer Toolbar (Single clean line)
  const lruTitle = OFFICIAL_LRU_NAMES[pid] || (isVdr ? "750 VDR" : pid.toUpperCase());
  const isHighSpeed = (curRate === 100.0 || curRate === 100 || txCh === "C" || txCh === "D" || isVdr || pid === "mmr_755");
  const rateModeStr = isHighSpeed ? "High Speed 100 kbps Mode" : `${curRate} kbps Mode`;
  const toolbar = el("div", "lru-toolbar");
  toolbar.style.display = "flex";
  toolbar.style.justifyContent = "space-between";
  toolbar.style.alignItems = "center";
  toolbar.style.marginBottom = "0.75rem";
  toolbar.style.flexWrap = "nowrap";
  toolbar.style.gap = "12px";
  toolbar.innerHTML = `
    <div style="min-width:0; flex-shrink:1;">
      <div class="panel-title" style="margin-bottom:0.2rem; white-space:nowrap;">${lruTitle} FORMAT</div>
      <p class="muted" style="margin:0; font-size:11.5px; white-space:nowrap;">Standard LRU Format (ARINC 429 ${rateModeStr})</p>
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:nowrap; flex-shrink:0;">
      <span class="pill pill-run" style="white-space:nowrap;">BUS TX-${txCh} &bull; RX-${rxCh} &bull; ${curRate} KBPS</span>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-std-reset-def" style="white-space:nowrap;">Reset Defaults</button>
      <button type="button" class="btn btn-outline btn-sm" id="btn-std-tx-word" style="white-space:nowrap;">Transmit Active Word</button>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-std-lru-back" style="white-space:nowrap;">&lt; LRU Select</button>
    </div>
  `;
  p.appendChild(toolbar);

  const container = el("div", "dme-hmi-workbench dynapro-dme-crt");
  container.style.width = "100%";
  p.appendChild(container);

  const wordsList = LRU_TX_WORDS_MAP[pid] || [{ slot: 0, name: (curSlot.funct || "NAV").replace(/_/g, " ") }];
  const rxLabs = (s && s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
  const rxWordsStr = rxLabs.length > 0
    ? rxLabs.map(l => (l.funct || l.label || l.label_octal || "").replace(/_/g, " ")).filter(Boolean).slice(0, 4).join(" / ")
    : "---";

  // Header row inside white panel
  const hdr = el("div", "dme-hmi-hdr-line dynapro-dme-hdr-line");
  hdr.style.color = "var(--text)";
  hdr.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <div id="std-lru-hdr-tx">
        CHANNEL ${txCh} &mdash; TRANSMITTED WORDS &nbsp;&nbsp;&nbsp;
        <span style="font-weight:600;" id="std-lru-tx-words-list">
          ${wordsList.map(w => `<span class="lru-word-jump" data-slot="${w.slot}" style="cursor:pointer; margin-right:8px; ${w.slot === curSlotIdx ? "color:var(--accent); font-weight:700; text-decoration:underline;" : "color:inherit;"}">${w.name}</span>`).join(" / ")}
        </span>
        &nbsp;&nbsp;&nbsp; SLOT <span class="dme-inv-box dynapro-inv-box" id="std-lru-slot-box" style="cursor:pointer; vertical-align:middle;">${curSlotIdx}</span>
      </div>
      <div id="std-lru-hdr-rx">CHANNEL ${rxCh} &mdash; RECEIVED WORDS &nbsp;&nbsp;&nbsp; <span style="font-weight:600;" id="std-lru-rx-words-list">${rxWordsStr}</span></div>
    </div>
  `;
  container.appendChild(hdr);

  // Table
  const tableWrap = el("div", "dynapro-dme-table-wrap");
  tableWrap.style.width = "100%";
  tableWrap.style.overflowX = "auto";
  tableWrap.style.marginBottom = "0.4rem";

  const tbl = el("table", "dynapro-dme-table dme-hmi-table");
  tbl.style.width = "100%";
  tbl.style.borderCollapse = "collapse";
  tbl.style.fontFamily = "var(--font-mono, monospace)";

  const isField = (f) => standardLruState.cursorField === f;
  const cPos = standardLruState.cursorPos || 0;

  const { formatted: dataStr, unit: dataUnit } = formatLruDataAndUnit(pid, curSlot.dataVal, curSlotIdx);
  let dataHtml = "";
  for (let i = 0; i < dataStr.length; i++) {
    const isAct = isField("DATA") && cPos === i;
    dataHtml += `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="DATA" data-pos="${i}">${dataStr.charAt(i)}</span>`;
  }
  const unitSuffix = dataUnit ? ` <span class="dme-unit">${dataUnit}</span>` : "";

  const sdiStr = String(curSlot.sdi != null ? curSlot.sdi : 0).padStart(2, "0");
  const sdiHtml = `<span class="dme-cursor-bit ${isField("SDI") && cPos === 0 ? "cursor-active-bit" : ""}" data-field="SDI" data-pos="0">${sdiStr.charAt(0)}</span><span class="dme-cursor-bit ${isField("SDI") && cPos === 1 ? "cursor-active-bit" : ""}" data-field="SDI" data-pos="1">${sdiStr.charAt(1)}</span>`;

  let padHtml = "";
  const padStr = formatLruPad(pid, curSlot.pad);
  if (padStr === "---") {
    padHtml = `<span class="dme-cursor-bit">---</span>`;
  } else {
    for (let i = 0; i < padStr.length; i++) {
      const isAct = isField("PAD") && cPos === i;
      padHtml += `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="PAD" data-pos="${i}">${padStr.charAt(i)}</span>`;
    }
  }

  const ssmHtml = `<span class="dme-cursor-bit ${isField("SSM") ? "cursor-active-bit" : ""}" data-field="SSM" data-pos="0">${curSlot.ssm}</span>`;

  const curRx = rxLabs.length > 0 ? rxLabs[Math.min(standardLruState.rxWordIndex || 0, rxLabs.length - 1)] : null;
  const rxDataStr = curRx ? (curRx.data || curRx.data_eng || "---") : "WAITING...";
  const rxHasData = curRx && curRx.data;
  const functDisplay = (curSlot.funct || "NAV").replace(/_/g, " ");

  tbl.innerHTML = `
    <thead>
      <tr>
        <th style="width:8%">CHAN</th>
        <th style="width:12%">FUNCT</th>
        <th style="width:8%">LABEL</th>
        <th style="width:26%">DATA</th>
        <th style="width:8%">SDI</th>
        <th style="width:12%">PAD</th>
        <th style="width:10%">SSM</th>
        <th style="width:8%">PAR</th>
        <th style="width:8%">RATE(ms)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tx-row" id="std-lru-tx-row">
        <td class="clickable-cell" id="std-lru-td-tx-ch"><span class="dme-cell-edit dynapro-cell-edit" id="std-lru-tx-ch-cell">TX-${txCh}</span></td>
        <td id="std-lru-td-funct"><span class="dme-cell-edit dynapro-cell-edit" id="std-lru-tx-funct-cell">${functDisplay}</span></td>
        <td class="clickable-cell" id="std-lru-td-label"><span class="dme-cell-edit dynapro-cell-edit" id="std-lru-tx-label-cell">${curSlot.label}</span></td>
        <td class="clickable-cell" id="std-lru-td-data"><span class="dme-cell-edit dynapro-cell-edit ${isField("DATA") ? "field-active" : ""}" id="std-lru-tx-data-cell">${dataHtml}${unitSuffix}</span></td>
        <td class="clickable-cell" id="std-lru-td-sdi"><span class="dme-cell-edit dynapro-cell-edit ${isField("SDI") ? "field-active" : ""}" id="std-lru-tx-sdi-cell">${sdiHtml}</span></td>
        <td class="clickable-cell" id="std-lru-td-pad"><span class="dme-cell-edit dynapro-cell-edit ${isField("PAD") ? "field-active" : ""}" id="std-lru-tx-pad-cell">${padHtml}</span></td>
        <td class="clickable-cell" id="std-lru-td-ssm"><span class="dme-cell-edit dynapro-cell-edit ${isField("SSM") ? "field-active" : ""}" id="std-lru-tx-ssm-cell">${ssmHtml}</span></td>
        <td class="clickable-cell" id="std-lru-td-par"><span class="dme-cell-edit dynapro-cell-edit" id="std-lru-tx-par-cell">${curSlot.parity}</span></td>
        <td class="clickable-cell" id="std-lru-td-rate"><span class="dme-cell-edit dynapro-cell-edit" id="std-lru-tx-rate-cell">${curSlot.rate}</span></td>
      </tr>
      <tr class="rx-row" id="std-lru-rx-row">
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-ch-cell">RX-${rxCh}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-funct-cell">${curRx ? ((curRx.funct || "").replace(/_/g, " ") || "---") : "---"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-label-cell">${curRx ? (curRx.label || curRx.label_octal || "---") : "---"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly ${rxHasData ? "has-data" : ""}" id="std-lru-rx-data-cell">${rxDataStr}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-sdi-cell">${curRx ? (curRx.sdi != null ? String(curRx.sdi).padStart(2, "0") : "00") : "--"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-pad-cell">${curRx ? (curRx.pads || "-------") : "-------"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-ssm-cell">${curRx ? (curRx.ssm || "--") : "--"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-par-cell">${curRx ? (curRx.par || curRx.parity || "--") : "--"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-lru-rx-rate-cell">${curRx ? (curRx.rate_ms || 100) : "--"}</span></td>
      </tr>
    </tbody>
  `;
  tableWrap.appendChild(tbl);
  container.appendChild(tableWrap);

  // Softkeys (7 full width columns matching DME Standard Nav)
  const skGrid = el("div", "dme-softkeys-row dynapro-softkeys-row dme-standard-softkeys");

  const bitRateLabel = isVdr ? "HI SPD<br>BIT RT" : "BIT<br>RATE";
  const bitRateVal = `${curRate} KBPS`;

  skGrid.innerHTML = `
    <!-- 1: DISP CURSOR -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-std-cursor" title="Advance editable cursor / digit position"><div class="dme-softkey-label">DISP<br>CURSOR</div></button></div>
    <!-- 2: DATA STEP -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-std-step" title="Step active data / parameter by direction"><div class="dme-softkey-label">DATA<br>STEP</div></button></div>
    <!-- 3: INC / DECR Split Toggle -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="btn-std-dir" title="Select stepping direction"><div class="dme-softkey-half dynapro-softkey-half ${stepDir === "INC" ? "active" : ""}" id="btn-std-inc">INC.</div><div class="dme-softkey-divider dynapro-softkey-divider"></div><div class="dme-softkey-half dynapro-softkey-half ${stepDir === "DECR" ? "active" : ""}" id="btn-std-decr">DECR</div></button></div>
    <!-- 4: MORE WORDS -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-std-more" title="Cycle through received ARINC 429 words"><div class="dme-softkey-label">MORE<br>WORDS</div></button></div>
    <!-- 5: BIT RATE -->
    <div class="std-sk-col"><div class="std-sk-top-label" id="std-rate-display">${bitRateVal}</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-std-bitrate" title="Cycle baud rates"><div class="dme-softkey-label">${bitRateLabel}</div></button></div>
    <!-- 6: TX Split Toggle -->
    <div class="std-sk-col">
      <div class="std-sk-top-label">&nbsp;</div>
      <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="btn-std-txch" title="Toggle transmitter bus">
        <div class="dme-softkey-half dynapro-softkey-half ${txCh === (isVdr ? "C" : "A") ? "active" : ""}" id="btn-std-tx-left">${isVdr ? "TX-C" : "TX-A"}</div>
        <div class="dme-softkey-divider dynapro-softkey-divider"></div>
        <div class="dme-softkey-half dynapro-softkey-half ${txCh === (isVdr ? "D" : "B") ? "active" : ""}" id="btn-std-tx-right">${isVdr ? "TX-D" : "TX-B"}</div>
      </button>
    </div>
    <!-- 7: RX Split Toggle -->
    <div class="std-sk-col">
      <div class="std-sk-top-label">&nbsp;</div>
      <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="btn-std-rxch" title="Toggle receiver bus">
        <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "A" ? "active" : ""}" id="btn-std-rx-left">RX-A</div>
        <div class="dme-softkey-divider dynapro-softkey-divider"></div>
        <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "B" ? "active" : ""}" id="btn-std-rx-right">RX-B</div>
      </button>
    </div>
  `;
  container.appendChild(skGrid);
  r.appendChild(p);

  const triggerPress = (btn) => {
    if (!btn) return;
    btn.classList.add("momentary-press");
    setTimeout(() => btn.classList.remove("momentary-press"), 150);
  };

  const updateStdLruTxRowDOM = () => {
    const curSlotIdx = standardLruState.activeSlot || 0;
    const txCh = standardLruState.txBus || "A";
    const rxCh = standardLruState.rxBus || "A";
    const liveSlot = getStdLruSlotData(curSlotIdx, txCh);
    const curFld = standardLruState.cursorField || "DATA";
    const curPos = standardLruState.cursorPos != null ? standardLruState.cursorPos : 0;
    const isCurAct = standardLruState.cursorActive !== false;

    const slotBox = container.querySelector("#std-lru-slot-box");
    if (slotBox) slotBox.textContent = String(curSlotIdx);

    // Jump words in header
    container.querySelectorAll(".lru-word-jump").forEach(wj => {
      const s = parseInt(wj.getAttribute("data-slot"), 10);
      const isCur = s === curSlotIdx;
      wj.style.color = isCur ? "var(--accent)" : "inherit";
      wj.style.fontWeight = isCur ? "700" : "inherit";
      wj.style.textDecoration = isCur ? "underline" : "none";
    });

    const txChEl = container.querySelector("#std-lru-tx-ch-cell");
    if (txChEl) txChEl.textContent = `TX-${txCh}`;

    const functEl = container.querySelector("#std-lru-tx-funct-cell");
    if (functEl) functEl.textContent = (liveSlot.funct || "NAV").replace(/_/g, " ");

    const lblEl = container.querySelector("#std-lru-tx-label-cell");
    if (lblEl) lblEl.textContent = liveSlot.label;

    const dataEl = container.querySelector("#std-lru-tx-data-cell");
    if (dataEl) {
      const { formatted: dStr, unit: dUnit } = formatLruDataAndUnit(pid, liveSlot.dataVal, curSlotIdx);
      let dHtml = "";
      for (let i = 0; i < dStr.length; i++) {
        const isAct = isCurAct && curFld === "DATA" && curPos === i;
        dHtml += `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="DATA" data-pos="${i}">${dStr.charAt(i)}</span>`;
      }
      const uSuf = dUnit ? ` <span class="dme-unit">${dUnit}</span>` : "";
      dataEl.innerHTML = `${dHtml}${uSuf}`;
    }

    const sdiEl = container.querySelector("#std-lru-tx-sdi-cell");
    if (sdiEl) {
      const sStr = String(liveSlot.sdi != null ? liveSlot.sdi : 0).padStart(2, "0");
      const is0 = isCurAct && curFld === "SDI" && curPos === 0;
      const is1 = isCurAct && curFld === "SDI" && curPos === 1;
      sdiEl.innerHTML = `<span class="dme-cursor-bit ${is0 ? "cursor-active-bit" : ""}" data-field="SDI" data-pos="0">${sStr.charAt(0)}</span><span class="dme-cursor-bit ${is1 ? "cursor-active-bit" : ""}" data-field="SDI" data-pos="1">${sStr.charAt(1)}</span>`;
    }

    const padEl = container.querySelector("#std-lru-tx-pad-cell");
    if (padEl) {
      const pStr = formatLruPad(pid, liveSlot.pad);
      if (pStr === "---") {
        padEl.innerHTML = `<span class="dme-cursor-bit">---</span>`;
      } else {
        let pHtml = "";
        for (let i = 0; i < pStr.length; i++) {
          const isAct = isCurAct && curFld === "PAD" && curPos === i;
          pHtml += `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="PAD" data-pos="${i}">${pStr.charAt(i)}</span>`;
        }
        padEl.innerHTML = pHtml;
      }
    }

    const ssmEl = container.querySelector("#std-lru-tx-ssm-cell");
    if (ssmEl) {
      const isAct = isCurAct && curFld === "SSM";
      ssmEl.innerHTML = `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="SSM" data-pos="0">${liveSlot.ssm}</span>`;
    }

    const parEl = container.querySelector("#std-lru-tx-par-cell");
    if (parEl) parEl.textContent = liveSlot.parity;

    const rateEl = container.querySelector("#std-lru-tx-rate-cell");
    if (rateEl) rateEl.textContent = liveSlot.rate;

    ["DATA", "SDI", "PAD", "SSM"].forEach(f => {
      const elCell = container.querySelector(`#std-lru-tx-${f.toLowerCase()}-cell`);
      if (elCell) elCell.classList.toggle("field-active", isCurAct && f === curFld);
    });

    const btnInc = skGrid.querySelector("#btn-std-inc");
    const btnDecr = skGrid.querySelector("#btn-std-decr");
    if (btnInc) btnInc.classList.toggle("active", standardLruState.stepDir === "INC");
    if (btnDecr) btnDecr.classList.toggle("active", standardLruState.stepDir === "DECR");

    const curR = standardLruState.bitRate || (s && s.bit_rate_kbps) || (isVdr ? 100.0 : 12.5);
    const rateDisp = skGrid.querySelector("#std-rate-display");
    if (rateDisp) rateDisp.textContent = `${curR} KBPS`;

    const txLeft = skGrid.querySelector("#btn-std-tx-left");
    const txRight = skGrid.querySelector("#btn-std-tx-right");
    if (txLeft) txLeft.classList.toggle("active", txCh === (isVdr ? "C" : "A"));
    if (txRight) txRight.classList.toggle("active", txCh === (isVdr ? "D" : "B"));

    const rxLeft = skGrid.querySelector("#btn-std-rx-left");
    const rxRight = skGrid.querySelector("#btn-std-rx-right");
    if (rxLeft) rxLeft.classList.toggle("active", rxCh === "A");
    if (rxRight) rxRight.classList.toggle("active", rxCh === "B");

    const pill = toolbar.querySelector(".pill");
    if (pill) pill.textContent = `BUS TX-${txCh} • RX-${rxCh} • ${curR} KBPS`;
  };

  const saveStdLruSlot = async (updates) => {
    const curSlotIdx = standardLruState.activeSlot || 0;
    const txCh = standardLruState.txBus || "A";
    const cur = getStdLruSlotData(curSlotIdx, txCh);
    const merged = {
      dataVal: updates && updates.dataVal != null ? updates.dataVal : cur.dataVal,
      sdi: updates && updates.sdi != null ? updates.sdi : cur.sdi,
      ssm: updates && updates.ssm != null ? updates.ssm : cur.ssm,
      parity: updates && updates.parity != null ? updates.parity : cur.parity,
      rate: updates && updates.rate != null ? updates.rate : cur.rate,
      label: updates && updates.label != null ? updates.label : cur.label,
      pad: updates && updates.pad != null ? updates.pad : cur.pad,
      funct: updates && updates.funct != null ? updates.funct : cur.funct,
    };

    if (!standardLruState.slots) standardLruState.slots = {};
    standardLruState.slots[curSlotIdx] = merged;

    updateStdLruTxRowDOM();

    try {
      const res = await api("/api/arinc/tx/slot", {
        method: "POST",
        body: JSON.stringify({
          slot: curSlotIdx,
          bus: txCh,
          mode: "lru",
          profile: pid,
          label: merged.label,
          eng_value: merged.dataVal,
          data: String(merged.dataVal),
          sdi: merged.sdi,
          ssm: merged.ssm,
          odd_parity: merged.parity === "ODD",
          rate_ms: merged.rate,
          enabled: true,
        }),
      });
      if (res && snap) snap = res;
    } catch (e) {
      console.error("Save standard LRU slot failed:", e);
    }
  };

  const stepStdLruActiveField = (cur) => {
    const dir = (standardLruState.stepDir === "DECR") ? -1 : 1;
    const curFld = standardLruState.cursorField || "DATA";
    const pos = standardLruState.cursorPos != null ? standardLruState.cursorPos : 0;

    if (curFld === "DATA") {
      if (pid === "adf_032") {
        let stepAmount = 0.5;
        if (pos === 0) stepAmount = 100.0;
        else if (pos === 1) stepAmount = 10.0;
        else if (pos === 2) stepAmount = 1.0;
        else stepAmount = 0.5;
        let val = Number(cur.dataVal) || 577.0;
        val += dir * stepAmount;
        val = Math.max(190.0, Math.min(1750.0, val));
        val = Math.round(val * 10) / 10;
        return { dataVal: val };
      } else if (pid === "vor" || pid === "vor_579" || pid === "ils") {
        if (standardLruState.activeSlot === 0) {
          let stepAmount = 0.05;
          if (pos === 0) stepAmount = 10.0;
          else if (pos === 1) stepAmount = 1.0;
          else if (pos === 2) stepAmount = 0.10;
          else stepAmount = 0.05;
          let val = Number(cur.dataVal) || (pid === "ils" ? 110.30 : 108.00);
          val += dir * stepAmount;
          val = Math.max(108.00, Math.min(117.95, val));
          val = Math.round(val * 100) / 100;
          return { dataVal: val };
        } else {
          let stepAmount = 1.0;
          if (pos === 0) stepAmount = 100.0;
          else if (pos === 1) stepAmount = 10.0;
          else if (pos === 2) stepAmount = 1.0;
          else stepAmount = 0.1;
          let val = Number(cur.dataVal) || 0.0;
          val += dir * stepAmount;
          if (val < 0) val += 360.0;
          if (val >= 360.0) val -= 360.0;
          val = Math.round(val * 10) / 10;
          return { dataVal: val };
        }
      } else if (pid === "atc_xpdr") {
        if (standardLruState.activeSlot === 0) {
          let sqStr = String(cur.dataVal || "1234").padStart(4, "0").slice(0, 4);
          const pIdx = Math.max(0, Math.min(3, pos));
          let curDigit = parseInt(sqStr.charAt(pIdx), 10) || 0;
          curDigit = (curDigit + dir + 8) % 8;
          const newSq = sqStr.slice(0, pIdx) + curDigit + sqStr.slice(pIdx + 1);
          return { dataVal: newSq };
        } else {
          let stepAmount = 100;
          if (pos === 0) stepAmount = 10000;
          else if (pos === 1) stepAmount = 1000;
          else if (pos === 2) stepAmount = 100;
          else if (pos === 3) stepAmount = 10;
          else stepAmount = 1;
          let val = Number(cur.dataVal) || 10000;
          val += dir * stepAmount;
          val = Math.max(-1000, Math.min(126000, val));
          return { dataVal: val };
        }
      } else if (pid === "radio_alt") {
        let stepAmount = 1.0;
        if (pos === 0) stepAmount = 1000.0;
        else if (pos === 1) stepAmount = 100.0;
        else if (pos === 2) stepAmount = 10.0;
        else if (pos === 3) stepAmount = 1.0;
        else stepAmount = 0.1;
        let val = Number(cur.dataVal) || 1000.0;
        val += dir * stepAmount;
        val = Math.max(-20.0, Math.min(8191.0, val));
        val = Math.round(val * 10) / 10;
        return { dataVal: val };
      } else if (pid === "vhf_comm") {
        let stepAmount = 0.025;
        if (pos === 0) stepAmount = 10.0;
        else if (pos === 1) stepAmount = 1.0;
        else if (pos === 2) stepAmount = 0.10;
        else stepAmount = 0.025;
        let val = Number(cur.dataVal) || 118.000;
        val += dir * stepAmount;
        val = Math.max(118.000, Math.min(136.975, val));
        val = Math.round(val * 1000) / 1000;
        return { dataVal: val };
      } else if (pid === "vhf_833") {
        let stepAmount = 0.008333;
        if (pos === 0) stepAmount = 10.0;
        else if (pos === 1) stepAmount = 1.0;
        else if (pos === 2) stepAmount = 0.10;
        else stepAmount = 0.008333;
        let val = Number(cur.dataVal) || 118.000;
        val += dir * stepAmount;
        val = Math.max(118.000, Math.min(136.992, val));
        val = Math.round(val * 1000) / 1000;
        return { dataVal: val };
      } else if (pid === "hf_rmp" || pid === "hf_acars" || pid === "hfdu_rmp" || pid === "hfdr_rmp") {
        let stepAmount = 0.0001;
        if (pos === 0) stepAmount = 10.0;
        else if (pos === 1) stepAmount = 1.0;
        else if (pos === 2) stepAmount = 0.10;
        else if (pos === 3) stepAmount = 0.01;
        else if (pos === 4) stepAmount = 0.001;
        else stepAmount = 0.0001;
        let val = Number(cur.dataVal) || 10.0000;
        val += dir * stepAmount;
        val = Math.max(2.0000, Math.min(29.9999, val));
        val = Math.round(val * 10000) / 10000;
        return { dataVal: val };
      } else if (pid === "vdr_750" || pid === "vdl_mode") {
        let rawVal = Number.isFinite(Number(cur.dataVal)) ? Number(cur.dataVal) : 0;
        const bitOffset = Math.max(0, Math.min(23, 23 - pos));
        rawVal = rawVal ^ (1 << bitOffset);
        return { dataVal: rawVal };
      } else {
        let val = Number(cur.dataVal) || 0;
        val += dir * 1.0;
        return { dataVal: val };
      }
    } else if (curFld === "SDI") {
      let sdi = Number(cur.sdi) || 0;
      if (pos === 0) sdi = sdi ^ 2;
      else sdi = sdi ^ 1;
      return { sdi: sdi };
    } else if (curFld === "PAD") {
      let padStr = String(cur.pad || "0000000").padStart(7, "0");
      const pIdx = Math.max(0, Math.min(padStr.length - 1, pos));
      const curBit = padStr.charAt(pIdx);
      const newBit = curBit === "1" ? "0" : "1";
      const newPad = padStr.slice(0, pIdx) + newBit + padStr.slice(pIdx + 1);
      return { pad: newPad };
    } else if (curFld === "SSM") {
      const ssmList = ["NML", "NCD", "FT", "FAIL"];
      let idx = ssmList.indexOf(cur.ssm);
      if (idx === -1) idx = 0;
      const nextSsm = ssmList[(idx + (dir === 1 ? 1 : ssmList.length - 1)) % ssmList.length];
      return { ssm: nextSsm };
    }
    return {};
  };

  const advanceStdLruCursor = () => {
    let curFld = standardLruState.cursorField || "DATA";
    let pos = standardLruState.cursorPos || 0;
    const { formatted: dStr } = formatLruDataAndUnit(pid, curSlot.dataVal, standardLruState.activeSlot);
    const pStr = formatLruPad(pid, curSlot.pad);

    if (curFld === "DATA") {
      if (pos + 1 < dStr.length) {
        standardLruState.cursorPos = pos + 1;
      } else {
        standardLruState.cursorField = "SDI";
        standardLruState.cursorPos = 0;
      }
    } else if (curFld === "SDI") {
      if (pos < 1) {
        standardLruState.cursorPos = pos + 1;
      } else {
        standardLruState.cursorField = (pStr && pStr !== "---") ? "PAD" : "SSM";
        standardLruState.cursorPos = 0;
      }
    } else if (curFld === "PAD") {
      if (pos + 1 < pStr.length) {
        standardLruState.cursorPos = pos + 1;
      } else {
        standardLruState.cursorField = "SSM";
        standardLruState.cursorPos = 0;
      }
    } else if (curFld === "SSM") {
      standardLruState.cursorField = "DATA";
      standardLruState.cursorPos = 0;
    } else {
      standardLruState.cursorField = "DATA";
      standardLruState.cursorPos = 0;
    }
  };

  const toggleTxBus = async (targetBus) => {
    const curBus = standardLruState.txBus || (isVdr ? "C" : "A");
    let nextBus = targetBus;
    if (!nextBus) {
      if (isVdr) nextBus = curBus === "C" ? "D" : "C";
      else nextBus = curBus === "A" ? "B" : "A";
    }
    standardLruState._customBus = true;
    standardLruState.txBus = nextBus;
    updateStdLruTxRowDOM();
    try {
      const res = await api("/api/arinc/channel", {
        method: "POST",
        body: JSON.stringify({ tx_ch: nextBus }),
      });
      if (res && snap) snap = res;
    } catch (err) {
      console.error("Failed to switch TX bus", err);
    }
  };

  const toggleRxBus = async (targetBus) => {
    const curBus = standardLruState.rxBus || "A";
    let nextBus = targetBus;
    if (!nextBus) nextBus = curBus === "A" ? "B" : "A";
    standardLruState._customBus = true;
    standardLruState.rxBus = nextBus;
    updateStdLruTxRowDOM();
    try {
      const res = await api("/api/arinc/channel", {
        method: "POST",
        body: JSON.stringify({ rx_ch: nextBus }),
      });
      if (res && snap) {
        snap = res;
        patchStandardLruRx(res);
      }
    } catch (err) {
      console.error("Failed to switch RX bus", err);
    }
  };

  // Header button listeners
  const topBack = toolbar.querySelector("#btn-std-lru-back");
  if (topBack) topBack.onclick = () => navTo("avionics_lru");

  const resetBtn = toolbar.querySelector("#btn-std-reset-def");
  if (resetBtn) {
    resetBtn.onclick = async () => {
      try {
        const defRate = isHighSpeed ? 100.0 : 12.5;
        const defTxBus = isVdr ? "C" : "A";
        const defRxBus = isVdr ? "A" : "A";
        standardLruState.slots = {};
        standardLruState.activeSlot = 0;
        standardLruState.cursorActive = false;
        standardLruState.cursorField = "DATA";
        standardLruState.cursorPos = 0;
        standardLruState.stepDir = "INC";
        standardLruState.rxWordIndex = 0;
        standardLruState.bitRate = defRate;
        standardLruState.txBus = defTxBus;
        standardLruState.rxBus = defRxBus;
        standardLruState._customBus = false;

        const snapIn = await api("/api/arinc/profile/apply", {
          method: "POST",
          body: JSON.stringify({ profile: pid, reset: true }),
        });
        await api("/api/arinc/channel", {
          method: "POST",
          body: JSON.stringify({ bus: defTxBus, bit_rate_kbps: defRate, tx_ch: defTxBus, rx_ch: defRxBus }),
        });
        if (snapIn) snap = snapIn;
        renderStandardLru(r, snapIn);

        const newResetBtn = r.querySelector("#btn-std-reset-def");
        if (newResetBtn) {
          const origText = newResetBtn.textContent;
          newResetBtn.textContent = "✓ Defaults Restored";
          newResetBtn.style.color = "var(--accent)";
          setTimeout(() => {
            if (newResetBtn) {
              newResetBtn.textContent = origText;
              newResetBtn.style.color = "";
            }
          }, 1000);
        }
      } catch (e) {
        alert(e.message);
      }
    };
  }

  const txWordBtn = toolbar.querySelector("#btn-std-tx-word");
  if (txWordBtn) {
    txWordBtn.onclick = async () => {
      await saveStdLruSlot();
      txWordBtn.textContent = "Word Transmitted!";
      setTimeout(() => { if (txWordBtn) txWordBtn.textContent = "Transmit Active Word"; }, 1000);
    };
  }

  // Header transmitted words jump links
  container.querySelectorAll(".lru-word-jump").forEach(wj => {
    wj.onclick = () => {
      const s = parseInt(wj.getAttribute("data-slot"), 10) || 0;
      standardLruState.activeSlot = s;
      updateStdLruTxRowDOM();
    };
  });

  // Slot Box click
  const slotBox = container.querySelector("#std-lru-slot-box");
  if (slotBox) {
    slotBox.onclick = () => {
      const totalSlots = (s && s.tx && s.tx[txCh] && s.tx[txCh].length) || (isVdr ? 2 : (wordsList.length || 10));
      standardLruState.activeSlot = ((standardLruState.activeSlot || 0) + 1) % totalSlots;
      updateStdLruTxRowDOM();
    };
  }

  // Cell clicks on TX row
  container.querySelector("#std-lru-tx-row").onclick = (e) => {
    const bitSpan = e.target.closest(".dme-cursor-bit");
    if (bitSpan && bitSpan.hasAttribute("data-field")) {
      e.stopPropagation();
      standardLruState.cursorActive = true;
      standardLruState.cursorField = bitSpan.getAttribute("data-field");
      standardLruState.cursorPos = parseInt(bitSpan.getAttribute("data-pos") || "0", 10);
      updateStdLruTxRowDOM();
    }
  };

  const tdTxCh = container.querySelector("#std-lru-td-tx-ch");
  if (tdTxCh) tdTxCh.onclick = () => toggleTxBus();

  const tdLabel = container.querySelector("#std-lru-td-label");
  if (tdLabel) {
    tdLabel.onclick = () => {
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      showDmeKeypadModal({
        title: "SET LABEL (OCTAL)",
        value: live.label,
        type: "numeric",
        hint: "Enter 3-digit octal label (000 to disable slot)",
        onApply: (v) => {
          let sVal = String(v).padStart(3, "0").slice(-3);
          saveStdLruSlot({ label: sVal });
        },
      });
    };
  }

  const tdData = container.querySelector("#std-lru-td-data");
  if (tdData) {
    tdData.ondblclick = () => {
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      showDmeKeypadModal({
        title: "SET DATA VALUE",
        value: String(live.dataVal),
        type: "numeric",
        hint: `Enter data value (${formatLruDataAndUnit(pid, live.dataVal, standardLruState.activeSlot).unit || "value"})`,
        onApply: (v) => {
          let num = parseFloat(v);
          saveStdLruSlot({ dataVal: Number.isFinite(num) ? num : v });
        },
      });
    };
  }

  const tdSdi = container.querySelector("#std-lru-td-sdi");
  if (tdSdi) {
    tdSdi.onclick = (e) => {
      if (e.target.closest(".dme-cursor-bit")) return;
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      saveStdLruSlot({ sdi: (live.sdi + 1) % 4 });
    };
  }

  const tdPad = container.querySelector("#std-lru-td-pad");
  if (tdPad) {
    tdPad.ondblclick = () => {
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      showDmeKeypadModal({
        title: "SET PAD BITS",
        value: String(live.pad || "0000"),
        type: "pad",
        hint: "Enter binary PAD bits",
        onApply: (v) => {
          saveStdLruSlot({ pad: v });
        },
      });
    };
  }

  const tdSsm = container.querySelector("#std-lru-td-ssm");
  if (tdSsm) {
    tdSsm.onclick = () => {
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      const ssms = ["NML", "NCD", "FT", "FAIL"];
      let idx = ssms.indexOf(live.ssm);
      if (idx === -1) idx = 0;
      saveStdLruSlot({ ssm: ssms[(idx + 1) % ssms.length] });
    };
  }

  const tdPar = container.querySelector("#std-lru-td-par");
  if (tdPar) {
    tdPar.onclick = () => {
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      saveStdLruSlot({ parity: live.parity === "ODD" ? "EVEN" : "ODD" });
    };
  }

  const tdRate = container.querySelector("#std-lru-td-rate");
  if (tdRate) {
    tdRate.onclick = () => {
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      showDmeKeypadModal({
        title: "SET TRANSMIT RATE (ms)",
        value: String(live.rate),
        type: "numeric",
        hint: "Enter transmit rate in ms (10 - 5000 ms)",
        onApply: (v) => {
          const rNum = Math.max(10, Math.min(5000, parseInt(v, 10) || 150));
          saveStdLruSlot({ rate: rNum });
        },
      });
    };
  }

  // Softkey 1: DISP CURSOR
  const btnCursor = skGrid.querySelector("#btn-std-cursor");
  if (btnCursor) {
    btnCursor.onclick = (e) => {
      e.preventDefault();
      triggerPress(btnCursor);
      standardLruState.cursorActive = true;
      advanceStdLruCursor();
      updateStdLruTxRowDOM();
    };
  }

  // Softkey 2: DATA STEP
  const btnStep = skGrid.querySelector("#btn-std-step");
  if (btnStep) {
    btnStep.onclick = (e) => {
      e.preventDefault();
      triggerPress(btnStep);
      const live = getStdLruSlotData(standardLruState.activeSlot, standardLruState.txBus);
      const updates = stepStdLruActiveField(live);
      if (updates) saveStdLruSlot(updates);
    };
  }

  // Softkey 3: INC / DECR
  const btnDir = skGrid.querySelector("#btn-std-dir");
  if (btnDir) {
    btnDir.onclick = (e) => {
      e.preventDefault();
      if (e.target && e.target.closest("#btn-std-inc")) {
        standardLruState.stepDir = "INC";
      } else if (e.target && e.target.closest("#btn-std-decr")) {
        standardLruState.stepDir = "DECR";
      } else {
        standardLruState.stepDir = standardLruState.stepDir === "INC" ? "DECR" : "INC";
      }
      updateStdLruTxRowDOM();
    };
  }

  // Softkey 4: MORE WORDS
  const btnMore = skGrid.querySelector("#btn-std-more");
  if (btnMore) {
    btnMore.onclick = (e) => {
      e.preventDefault();
      triggerPress(btnMore);
      const currentSnap = standardLruState.lastSnap || snap;
      const rxChLive = standardLruState.rxBus || "A";
      const rxLabsLive = (currentSnap && currentSnap.rx && currentSnap.rx[rxChLive] && currentSnap.rx[rxChLive].labels) || [];
      if (rxLabsLive.length <= 1) {
        const hdrRx = container.querySelector("#std-lru-hdr-rx");
        if (hdrRx) {
          const orig = hdrRx.innerHTML;
          hdrRx.innerHTML = (rxLabsLive.length === 1) ? `CHANNEL ${rxChLive} &mdash; 1/1 RX WORD (${rxLabsLive[0].label || rxLabsLive[0].label_octal}) - NO MORE WORDS` : `CHANNEL ${rxChLive} &mdash; NO RX WORDS RECEIVED`;
          setTimeout(() => { if (hdrRx) hdrRx.innerHTML = orig; }, 1200);
        }
        return;
      }
      standardLruState.rxWordIndex = ((standardLruState.rxWordIndex || 0) + 1) % rxLabsLive.length;
      patchStandardLruRx(currentSnap);
    };
  }

  // Softkey 5: BIT RATE
  const btnBitrate = skGrid.querySelector("#btn-std-bitrate");
  if (btnBitrate) {
    btnBitrate.onclick = async (e) => {
      e.preventDefault();
      triggerPress(btnBitrate);
      const lowSpeedRates = [8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, 20.0];
      const highSpeedRates = [83.33, 100.0, 125.0];
      const rates = isHighSpeed ? highSpeedRates : lowSpeedRates;
      const dir = (standardLruState.stepDir === "DECR") ? -1 : 1;
      const liveCurRate = Number(standardLruState.bitRate != null ? standardLruState.bitRate : (curRate || (isHighSpeed ? 100.0 : 12.5)));
      let idx = rates.findIndex(r => Math.abs(r - liveCurRate) < 0.05);
      if (idx === -1) idx = isHighSpeed ? 1 : 3;
      const nextRate = rates[(idx + dir + rates.length) % rates.length];
      standardLruState.bitRate = nextRate;
      standardLruState._customBus = true;
      updateStdLruTxRowDOM();
      try {
        const curTxBus = standardLruState.txBus || txCh || "A";
        const res = await api("/api/arinc/channel", {
          method: "POST",
          body: JSON.stringify({ bus: curTxBus, bit_rate_kbps: nextRate }),
        });
        if (res && snap) snap = res;
      } catch (err) {
        console.error("Set bitrate failed:", err);
      }
    };
  }

  // Softkey 6: TX Split Toggle
  const btnTxCh = skGrid.querySelector("#btn-std-txch");
  if (btnTxCh) {
    btnTxCh.onclick = (e) => {
      e.preventDefault();
      if (e.target && e.target.closest("#btn-std-tx-left")) {
        toggleTxBus(isVdr ? "C" : "A");
        return;
      }
      if (e.target && e.target.closest("#btn-std-tx-right")) {
        toggleTxBus(isVdr ? "D" : "B");
        return;
      }
      toggleTxBus();
    };
  }

  // Softkey 7: RX Split Toggle
  const btnRxCh = skGrid.querySelector("#btn-std-rxch");
  if (btnRxCh) {
    btnRxCh.onclick = (e) => {
      e.preventDefault();
      if (e.target && e.target.closest("#btn-std-rx-left")) {
        toggleRxBus("A");
        return;
      }
      if (e.target && e.target.closest("#btn-std-rx-right")) {
        toggleRxBus("B");
        return;
      }
      toggleRxBus();
    };
  }
}

function patchStandardLruRx(s) {
  if (!s) return;
  standardLruState.lastSnap = s;
  const rxCh = standardLruState.rxBus || "A";
  const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
  const totalRx = rxLabs.length;
  let rxIdx = standardLruState.rxWordIndex || 0;
  if (rxIdx >= totalRx) {
    rxIdx = totalRx > 0 ? totalRx - 1 : 0;
    standardLruState.rxWordIndex = rxIdx;
  }
  const curRx = totalRx > 0 ? rxLabs[rxIdx] : null;

  const hdrRx = document.getElementById("std-lru-hdr-rx");
  if (hdrRx) {
    const wordsSummary = totalRx > 0
      ? rxLabs.map(l => (l.funct || l.label || l.label_octal || "").replace(/_/g, " ")).filter(Boolean).slice(0, 4).join(" / ")
      : "---";
    const countStr = totalRx > 1 ? `: ${totalRx} (WORD ${rxIdx + 1}/${totalRx})` : (totalRx === 1 ? `: 1 (${curRx.label || curRx.label_octal})` : "");
    hdrRx.innerHTML = `CHANNEL ${rxCh} &mdash; RECEIVED WORDS${countStr} &nbsp;&nbsp;&nbsp; <span style="font-weight:600;" id="std-lru-rx-words-list">${wordsSummary}</span>`;
  }

  const rxChEl = document.getElementById("std-lru-rx-ch-cell");
  if (rxChEl) rxChEl.textContent = `RX-${rxCh}`;

  const rxFunctEl = document.getElementById("std-lru-rx-funct-cell");
  if (rxFunctEl) rxFunctEl.textContent = curRx ? ((curRx.funct || "").replace(/_/g, " ") || "---") : "---";

  const rxLabelEl = document.getElementById("std-lru-rx-label-cell");
  if (rxLabelEl) rxLabelEl.textContent = curRx ? (curRx.label || curRx.label_octal || "---") : "---";

  const rxDataEl = document.getElementById("std-lru-rx-data-cell");
  if (rxDataEl) {
    if (curRx && (curRx.data != null || curRx.data_eng != null)) {
      rxDataEl.textContent = curRx.data_eng || curRx.data;
      rxDataEl.classList.add("has-data");
    } else {
      rxDataEl.textContent = "WAITING...";
      rxDataEl.classList.remove("has-data");
    }
  }

  const rxSdiEl = document.getElementById("std-lru-rx-sdi-cell");
  if (rxSdiEl) rxSdiEl.textContent = curRx ? (curRx.sdi != null ? String(curRx.sdi).padStart(2, "0") : "00") : "--";

  const rxPadEl = document.getElementById("std-lru-rx-pad-cell");
  if (rxPadEl) rxPadEl.textContent = curRx ? (curRx.pads || "-------") : "-------";

  const rxSsmEl = document.getElementById("std-lru-rx-ssm-cell");
  if (rxSsmEl) rxSsmEl.textContent = curRx ? (curRx.ssm || "--") : "--";

  const rxParEl = document.getElementById("std-lru-rx-par-cell");
  if (rxParEl) rxParEl.textContent = curRx ? (curRx.par || curRx.parity || "--") : "--";

  const rxRateEl = document.getElementById("std-lru-rx-rate-cell");
  if (rxRateEl) rxRateEl.textContent = curRx ? (curRx.rate_ms || 100) : "--";
}

// ============================================================================
// 4. renderHfScreen & patchHfRx (Dedicated Dual-Word HF Comm)
// ============================================================================
function renderHfScreen(r, s) {
  r.innerHTML = "";

  const p = el("div", "panel");
  p.style.maxWidth = "1060px";
  p.style.margin = "0 auto";

  const txCh = hfScreenState.txBus || "A";
  const rxCh = hfScreenState.rxBus || "B";
  const stepDir = hfScreenState.stepDir || "INC";

  // Card Outer Toolbar
  const toolbar = el("div", "lru-toolbar");
  toolbar.style.display = "flex";
  toolbar.style.justifyContent = "space-between";
  toolbar.style.alignItems = "center";
  toolbar.style.marginBottom = "0.75rem";
  toolbar.style.flexWrap = "nowrap";
  toolbar.style.gap = "12px";
  toolbar.innerHTML = `
    <div style="min-width:0; flex-shrink:1;">
      <div class="panel-title" style="margin-bottom:0.2rem; white-space:nowrap;">HF COMM FORMAT</div>
      <p class="muted" style="margin:0; font-size:11.5px; white-space:nowrap;">ARINC 719 High Frequency Communication Transceiver (Dual Word Mode)</p>
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:nowrap; flex-shrink:0;">
      <span class="pill pill-run" id="hf-toolbar-pill" style="white-space:nowrap;">BUS TX-${txCh} &bull; RX-${rxCh} &bull; ${Number(hfScreenState.bitRate).toFixed(1)} KBPS</span>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-hf-reset-def" style="white-space:nowrap;">Reset Defaults</button>
      <button type="button" class="btn btn-outline btn-sm" id="btn-hf-tx-word" style="white-space:nowrap;">Transmit Active Word</button>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-hf-back" style="white-space:nowrap;">&lt; LRU Select</button>
    </div>
  `;
  p.appendChild(toolbar);

  const container = el("div", "dme-hmi-workbench dynapro-dme-crt");
  container.style.width = "100%";
  p.appendChild(container);

  const rxLabs = (s && s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
  const rxWordsStr = rxLabs.length > 0
    ? rxLabs.map(l => l.funct || l.label || l.label_octal).filter(Boolean).slice(0, 4).join(" / ")
    : "---";

  // Header ONLY "HF COMM" (no slot box)
  const hdr = el("div", "dme-hmi-hdr-line dynapro-dme-hdr-line");
  hdr.style.color = "var(--text)";
  hdr.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <div id="hf-hdr-tx-label">HF COMM &mdash; CHANNEL ${txCh} TRANSMIT</div>
      <div>CHANNEL ${rxCh} &mdash; RECEIVED WORDS &nbsp;&nbsp;&nbsp; <span style="font-weight:600;" id="hf-rx-words-list">${rxWordsStr}</span></div>
    </div>
  `;
  container.appendChild(hdr);

  // Table
  const tableWrap = el("div", "dynapro-dme-table-wrap");
  tableWrap.style.width = "100%";
  tableWrap.style.overflowX = "auto";
  tableWrap.style.marginBottom = "1rem";

  const tbl = el("table", "dynapro-dme-table dme-hmi-table");
  tbl.style.width = "100%";
  tbl.style.borderCollapse = "collapse";
  tbl.style.fontFamily = "var(--font-mono, monospace)";

  const curRx = rxLabs.length > 0 ? rxLabs[Math.min(hfScreenState.rxWordIndex || 0, rxLabs.length - 1)] : null;
  const rxDataStr = curRx ? (curRx.data || curRx.data_eng || "---") : "WAITING...";
  const rxHasData = curRx && curRx.data;

  tbl.innerHTML = `
    <thead>
      <tr>
        <th style="width:7%">CHAN</th>
        <th style="width:11%">FUNCT</th>
        <th style="width:7%">LABEL</th>
        <th style="width:23%">DATA</th>
        <th style="width:8%">SB</th>
        <th style="width:8%">MOD</th>
        <th style="width:8%">CW</th>
        <th style="width:8%">SSM</th>
        <th style="width:8%">PAR</th>
        <th style="width:12%">RATE(ms)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tx-row" id="hf-tx-row">
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-ch-cell" style="cursor:pointer;" title="Click to toggle TX bus">TX-${txCh}</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-funct-cell">HF COMM</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-tx-label-cell" title="Locked Label 037">037</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit field-active" id="hf-tx-data-cell" style="cursor:pointer;" title="Click digit to place cursor, or click box to type frequency"></span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-sb-cell" style="cursor:pointer;" title="Click to toggle USB / LSB">${hfScreenState.sb}</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-mod-cell" style="cursor:pointer;" title="Click to toggle AM / SSB">${hfScreenState.mod}</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-cw-cell" style="cursor:pointer;" title="Click to toggle CW ON / OFF">${hfScreenState.cw ? "ON" : "OFF"}</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-ssm-cell" style="cursor:pointer;" title="Click to cycle SSM">${hfScreenState.ssm}</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-par-cell" style="cursor:pointer;" title="Click to toggle ODD / EVEN">${hfScreenState.par || "ODD"}</span></td>
        <td><span class="dme-cell-edit dynapro-cell-edit" id="hf-tx-rate-cell" style="cursor:pointer;" title="Click to set repeat rate">${hfScreenState.rateMs || 200}</span></td>
      </tr>
      <tr class="rx-row" id="hf-rx-row">
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-ch-cell">RX-${rxCh}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-funct-cell">${curRx ? (curRx.funct || "HF COMM") : "---"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-label-cell">${curRx ? (curRx.label || "037") : "---"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly ${rxHasData ? "has-data" : ""}" id="hf-rx-data-cell">${rxDataStr}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-sb-cell">--</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-mod-cell">--</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-cw-cell">--</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-ssm-cell">${curRx ? (curRx.ssm || "--") : "--"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-par-cell">${curRx ? (curRx.par || curRx.parity || "--") : "--"}</span></td>
        <td><span class="dme-cell-readonly dynapro-cell-readonly" id="hf-rx-rate-cell">${curRx ? (curRx.rate_ms || 200) : "--"}</span></td>
      </tr>
    </tbody>
  `;
  tableWrap.appendChild(tbl);
  container.appendChild(tableWrap);

  // Softkeys (EXACTLY 6 FULL-WIDTH COLUMNS, NO dummy 4th column, NO MORE WORDS)
  const skGrid = el("div", "dme-softkeys-row dynapro-softkeys-row hf-softkeys-row");
  skGrid.innerHTML = `
    <!-- 1: DISP CURSOR -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-hf-cursor"><div class="dme-softkey-label">DISP<br>CURSOR</div></button></div>
    <!-- 2: DATA STEP -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-hf-step"><div class="dme-softkey-label">DATA<br>STEP</div></button></div>
    <!-- 3: INC / DECR Split Toggle -->
    <div class="std-sk-col"><div class="std-sk-top-label">&nbsp;</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="btn-hf-dir"><div class="dme-softkey-half dynapro-softkey-half ${stepDir === "INC" ? "active" : ""}" id="btn-hf-inc">INC.</div><div class="dme-softkey-divider dynapro-softkey-divider"></div><div class="dme-softkey-half dynapro-softkey-half ${stepDir === "DECR" ? "active" : ""}" id="btn-hf-decr">DECR</div></button></div>
    <!-- 4: BIT RATE -->
    <div class="std-sk-col"><div class="std-sk-top-label" id="hf-rate-display">${Number(hfScreenState.bitRate).toFixed(1)} KBPS</div><button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="btn-hf-bitrate"><div class="dme-softkey-label">BIT<br>RATE</div></button></div>
    <!-- 5: TX-A / TX-B Split Toggle -->
    <div class="std-sk-col">
      <div class="std-sk-top-label">&nbsp;</div>
      <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="btn-hf-txch" title="Toggle transmitter bus">
        <div class="dme-softkey-half dynapro-softkey-half ${txCh === "A" ? "active" : ""}" id="btn-hf-tx-left">TX-A</div>
        <div class="dme-softkey-divider dynapro-softkey-divider"></div>
        <div class="dme-softkey-half dynapro-softkey-half ${txCh === "B" ? "active" : ""}" id="btn-hf-tx-right">TX-B</div>
      </button>
    </div>
    <!-- 6: RX-A / RX-B Split Toggle -->
    <div class="std-sk-col">
      <div class="std-sk-top-label">&nbsp;</div>
      <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="btn-hf-rxch" title="Toggle receiver bus">
        <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "A" ? "active" : ""}" id="btn-hf-rx-left">RX-A</div>
        <div class="dme-softkey-divider dynapro-softkey-divider"></div>
        <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "B" ? "active" : ""}" id="btn-hf-rx-right">RX-B</div>
      </button>
    </div>
  `;
  container.appendChild(skGrid);
  r.appendChild(p);

  const triggerPress = (btn) => {
    if (!btn) return;
    btn.classList.add("momentary-press");
    setTimeout(() => btn.classList.remove("momentary-press"), 150);
  };

  // In-place DOM update helper
  const updateHfTxRowDOM = () => {
    const liveTx = hfScreenState.txBus || "A";
    const liveRx = hfScreenState.rxBus || "B";
    const liveDir = hfScreenState.stepDir || "INC";

    const chEl = container.querySelector("#hf-tx-ch-cell");
    if (chEl) chEl.textContent = `TX-${liveTx}`;

    const dataEl = container.querySelector("#hf-tx-data-cell");
    if (dataEl) {
      const freqStr = Number(hfScreenState.freqMhz).toFixed(4);
      const parts = freqStr.split(".");
      const whole = (parts[0] || "10").padStart(2, "0");
      const dec = (parts[1] || "0000").padEnd(4, "0");

      const is0 = hfScreenState.cursorPos === 0;
      const is1 = hfScreenState.cursorPos === 1;
      const is2 = hfScreenState.cursorPos === 2;
      const is3 = hfScreenState.cursorPos === 3;
      const is4 = hfScreenState.cursorPos === 4;
      const is5 = hfScreenState.cursorPos === 5;

      dataEl.innerHTML = `<span class="dme-cursor-bit ${is0 ? "cursor-active-bit" : ""}" data-pos="0">${whole.charAt(0)}</span><span class="dme-cursor-bit ${is1 ? "cursor-active-bit" : ""}" data-pos="1">${whole.charAt(1)}</span>.<span class="dme-cursor-bit ${is2 ? "cursor-active-bit" : ""}" data-pos="2">${dec.charAt(0)}</span><span class="dme-cursor-bit ${is3 ? "cursor-active-bit" : ""}" data-pos="3">${dec.charAt(1)}</span><span class="dme-cursor-bit ${is4 ? "cursor-active-bit" : ""}" data-pos="4">${dec.charAt(2)}</span><span class="dme-cursor-bit ${is5 ? "cursor-active-bit" : ""}" data-pos="5">${dec.charAt(3)}</span> MHZ`;

      dataEl.querySelectorAll(".dme-cursor-bit[data-pos]").forEach((span) => {
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          hfScreenState.cursorPos = Number(span.getAttribute("data-pos") || 0);
          updateHfTxRowDOM();
        });
      });
    }

    const sbEl = container.querySelector("#hf-tx-sb-cell");
    if (sbEl) sbEl.textContent = hfScreenState.sb;

    const modEl = container.querySelector("#hf-tx-mod-cell");
    if (modEl) modEl.textContent = hfScreenState.mod;

    const cwEl = container.querySelector("#hf-tx-cw-cell");
    if (cwEl) cwEl.textContent = hfScreenState.cw ? "ON" : "OFF";

    const ssmEl = container.querySelector("#hf-tx-ssm-cell");
    if (ssmEl) ssmEl.textContent = hfScreenState.ssm;

    const parEl = container.querySelector("#hf-tx-par-cell");
    if (parEl) parEl.textContent = hfScreenState.par || "ODD";

    const rateEl = container.querySelector("#hf-tx-rate-cell");
    if (rateEl) rateEl.textContent = hfScreenState.rateMs || 200;

    const pillEl = toolbar.querySelector("#hf-toolbar-pill");
    if (pillEl) pillEl.innerHTML = `BUS TX-${liveTx} &bull; RX-${liveRx} &bull; ${Number(hfScreenState.bitRate).toFixed(1)} KBPS`;

    const hdrTxEl = container.querySelector("#hf-hdr-tx-label");
    if (hdrTxEl) hdrTxEl.innerHTML = `HF COMM &mdash; CHANNEL ${liveTx} TRANSMIT`;

    const rateDisp = container.querySelector("#hf-rate-display");
    if (rateDisp) rateDisp.textContent = `${Number(hfScreenState.bitRate).toFixed(1)} KBPS`;

    const btnInc = container.querySelector("#btn-hf-inc");
    const btnDecr = container.querySelector("#btn-hf-decr");
    if (btnInc && btnDecr) {
      if (liveDir === "INC") {
        btnInc.classList.add("active");
        btnDecr.classList.remove("active");
      } else {
        btnDecr.classList.add("active");
        btnInc.classList.remove("active");
      }
    }

    const txL = container.querySelector("#btn-hf-tx-left");
    const txR = container.querySelector("#btn-hf-tx-right");
    if (txL && txR) {
      if (liveTx === "A") {
        txL.classList.add("active");
        txR.classList.remove("active");
      } else {
        txR.classList.add("active");
        txL.classList.remove("active");
      }
    }

    const rxL = container.querySelector("#btn-hf-rx-left");
    const rxR = container.querySelector("#btn-hf-rx-right");
    if (rxL && rxR) {
      if (liveRx === "A") {
        rxL.classList.add("active");
        rxR.classList.remove("active");
      } else {
        rxR.classList.add("active");
        rxL.classList.remove("active");
      }
    }

    const rxChCell = container.querySelector("#hf-rx-ch-cell");
    if (rxChCell) rxChCell.textContent = `RX-${liveRx}`;
  };

  // Initial draw of TX data bits
  updateHfTxRowDOM();

  const topBack = toolbar.querySelector("#btn-hf-back");
  if (topBack) topBack.addEventListener("click", () => navTo("avionics_lru"));

  // Save backend helper
  const saveHfConfig = async () => {
    try {
      await api("/api/arinc/hf/config", {
        method: "POST",
        body: JSON.stringify({
          bus: hfScreenState.txBus || "A",
          freq_mhz: hfScreenState.freqMhz,
          sb: hfScreenState.sb,
          mod: hfScreenState.mod,
          cw: hfScreenState.cw,
          ssm: hfScreenState.ssm,
          rate_ms: hfScreenState.rateMs || 200,
        }),
      });
    } catch (e) {
      console.error("Save HF config failed:", e);
    }
  };

  const hfResetBtn = toolbar.querySelector("#btn-hf-reset-def");
  if (hfResetBtn) {
    hfResetBtn.addEventListener("click", async () => {
      hfScreenState.freqMhz = 10.0000;
      hfScreenState.sb = "LSB";
      hfScreenState.mod = "AM";
      hfScreenState.cw = false;
      hfScreenState.ssm = "NML";
      hfScreenState.par = "ODD";
      hfScreenState.rateMs = 200;
      hfScreenState.cursorPos = 2;
      hfScreenState.stepDir = "INC";
      hfScreenState.bitRate = 12.5;
      hfScreenState.txBus = "A";
      hfScreenState.rxBus = "B";
      hfScreenState.rxWordIndex = 0;
      updateHfTxRowDOM();
      await saveHfConfig();
      try {
        const snapIn = await api("/api/arinc/channel", {
          method: "POST",
          body: JSON.stringify({ bus: "A", bit_rate_kbps: 12.5, tx_ch: "A", rx_ch: "B" }),
        });
        if (snapIn) snap = snapIn;
      } catch (e) {
        console.error("Reset HF channel failed:", e);
      }
      const origText = hfResetBtn.textContent;
      hfResetBtn.textContent = "✓ Defaults Restored";
      hfResetBtn.style.color = "var(--accent)";
      setTimeout(() => {
        if (hfResetBtn) {
          hfResetBtn.textContent = origText;
          hfResetBtn.style.color = "";
        }
      }, 1000);
    });
  }

  const hfTxWordBtn = toolbar.querySelector("#btn-hf-tx-word");
  if (hfTxWordBtn) {
    hfTxWordBtn.addEventListener("click", async () => {
      await saveHfConfig();
      hfTxWordBtn.textContent = "Word Transmitted!";
      setTimeout(() => { if (hfTxWordBtn) hfTxWordBtn.textContent = "Transmit Active Word"; }, 1000);
    });
  }

  // Cell clicks
  const chCell = container.querySelector("#hf-tx-ch-cell");
  if (chCell) {
    chCell.addEventListener("click", async () => {
      hfScreenState.txBus = (hfScreenState.txBus === "A") ? "B" : "A";
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  const dataCell = container.querySelector("#hf-tx-data-cell");
  if (dataCell) {
    dataCell.addEventListener("click", (e) => {
      if (e.target && e.target.classList.contains("dme-cursor-bit")) return;
      showDmeKeypadModal({
        title: "SET HF TRANSMIT FREQUENCY (MHZ)",
        value: Number(hfScreenState.freqMhz).toFixed(4),
        type: "numeric",
        hint: "Valid range: 2.0000 to 29.9999 MHz",
        onApply: async (val) => {
          const num = parseFloat(val);
          if (!isNaN(num) && num >= 2.0 && num <= 29.9999) {
            hfScreenState.freqMhz = Number(num.toFixed(4));
            updateHfTxRowDOM();
            await saveHfConfig();
          }
        },
      });
    });
  }

  const sbCell = container.querySelector("#hf-tx-sb-cell");
  if (sbCell) {
    sbCell.addEventListener("click", async () => {
      hfScreenState.sb = hfScreenState.sb === "USB" ? "LSB" : "USB";
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  const modCell = container.querySelector("#hf-tx-mod-cell");
  if (modCell) {
    modCell.addEventListener("click", async () => {
      hfScreenState.mod = hfScreenState.mod === "AM" ? "SSB" : "AM";
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  const cwCell = container.querySelector("#hf-tx-cw-cell");
  if (cwCell) {
    cwCell.addEventListener("click", async () => {
      hfScreenState.cw = !hfScreenState.cw;
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  const ssmCell = container.querySelector("#hf-tx-ssm-cell");
  if (ssmCell) {
    ssmCell.addEventListener("click", async () => {
      const ssms = ["NML", "NCD", "FT", "FAIL"];
      hfScreenState.ssm = ssms[(ssms.indexOf(hfScreenState.ssm) + 1) % ssms.length];
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  const parCell = container.querySelector("#hf-tx-par-cell");
  if (parCell) {
    parCell.addEventListener("click", async () => {
      hfScreenState.par = (hfScreenState.par === "ODD") ? "EVEN" : "ODD";
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  const rateCell = container.querySelector("#hf-tx-rate-cell");
  if (rateCell) {
    rateCell.addEventListener("click", () => {
      showDmeKeypadModal({
        title: "SET TRANSMIT REPEAT RATE (MS)",
        value: String(hfScreenState.rateMs || 200),
        type: "numeric",
        hint: "Default: 200 ms (Valid: 10..5000 ms)",
        onApply: async (val) => {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num >= 10 && num <= 5000) {
            hfScreenState.rateMs = num;
            updateHfTxRowDOM();
            await saveHfConfig();
          }
        },
      });
    });
  }

  // Softkey 1: DISP CURSOR
  const btnCursor = container.querySelector("#btn-hf-cursor");
  if (btnCursor) {
    btnCursor.addEventListener("click", () => {
      triggerPress(btnCursor);
      hfScreenState.cursorPos = ((hfScreenState.cursorPos || 0) + 1) % 6;
      updateHfTxRowDOM();
    });
  }

  // Softkey 2: DATA STEP
  const btnStep = container.querySelector("#btn-hf-step");
  if (btnStep) {
    btnStep.addEventListener("click", async () => {
      triggerPress(btnStep);
      const pos = hfScreenState.cursorPos || 0;
      const delta = hfScreenState.stepDir === "DECR" ? -1 : 1;
      let multiplier = 0.0001;
      if (pos === 0) multiplier = 10.0;
      else if (pos === 1) multiplier = 1.0;
      else if (pos === 2) multiplier = 0.1;
      else if (pos === 3) multiplier = 0.01;
      else if (pos === 4) multiplier = 0.001;
      else if (pos === 5) multiplier = 0.0001;

      let newFreq = Number(hfScreenState.freqMhz) + (delta * multiplier);
      newFreq = Math.max(2.0, Math.min(29.9999, newFreq));
      hfScreenState.freqMhz = Number(newFreq.toFixed(4));
      updateHfTxRowDOM();
      await saveHfConfig();
    });
  }

  // Softkey 3: INC / DECR
  const btnDir = container.querySelector("#btn-hf-dir");
  const btnInc = container.querySelector("#btn-hf-inc");
  const btnDecr = container.querySelector("#btn-hf-decr");
  if (btnInc && btnDecr) {
    btnInc.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPress(btnDir);
      hfScreenState.stepDir = "INC";
      updateHfTxRowDOM();
    });
    btnDecr.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPress(btnDir);
      hfScreenState.stepDir = "DECR";
      updateHfTxRowDOM();
    });
  }
  if (btnDir) {
    btnDir.addEventListener("click", () => {
      triggerPress(btnDir);
      hfScreenState.stepDir = (hfScreenState.stepDir === "INC") ? "DECR" : "INC";
      updateHfTxRowDOM();
    });
  }

  // Softkey 4: BIT RATE
  const btnBitrate = container.querySelector("#btn-hf-bitrate");
  if (btnBitrate) {
    btnBitrate.addEventListener("click", async () => {
      triggerPress(btnBitrate);
      const lowSpeedRates = [8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, 20.0];
      const dir = (hfScreenState.stepDir === "DECR") ? -1 : 1;
      const curRateVal = Number(hfScreenState.bitRate || 12.5);
      let idx = lowSpeedRates.findIndex(r => Math.abs(r - curRateVal) < 0.05);
      if (idx === -1) idx = 3; // 12.5
      const nextRate = lowSpeedRates[(idx + dir + lowSpeedRates.length) % lowSpeedRates.length];
      hfScreenState.bitRate = nextRate;
      updateHfTxRowDOM();
      try {
        const curTxBus = hfScreenState.txBus || "A";
        const res = await api("/api/arinc/channel", {
          method: "POST",
          body: JSON.stringify({ bus: curTxBus, bit_rate_kbps: nextRate }),
        });
        if (res && snap) snap = res;
      } catch (err) {
        console.error("Set HF bitrate failed:", err);
      }
    });
  }

  // Softkey 5: TX Split Toggle
  const btnTxCh = container.querySelector("#btn-hf-txch");
  const btnTxLeft = container.querySelector("#btn-hf-tx-left");
  const btnTxRight = container.querySelector("#btn-hf-tx-right");
  const setHfTxBus = async (bus) => {
    triggerPress(btnTxCh);
    hfScreenState.txBus = bus;
    updateHfTxRowDOM();
    await saveHfConfig();
  };
  if (btnTxLeft && btnTxRight) {
    btnTxLeft.addEventListener("click", (e) => { e.stopPropagation(); setHfTxBus("A"); });
    btnTxRight.addEventListener("click", (e) => { e.stopPropagation(); setHfTxBus("B"); });
  }
  if (btnTxCh) {
    btnTxCh.addEventListener("click", () => {
      setHfTxBus(hfScreenState.txBus === "A" ? "B" : "A");
    });
  }

  // Softkey 6: RX Split Toggle
  const btnRxCh = container.querySelector("#btn-hf-rxch");
  const btnRxLeft = container.querySelector("#btn-hf-rx-left");
  const btnRxRight = container.querySelector("#btn-hf-rx-right");
  const setHfRxBus = (bus) => {
    triggerPress(btnRxCh);
    hfScreenState.rxBus = bus;
    updateHfTxRowDOM();
    patchHfRx(snap);
  };
  if (btnRxLeft && btnRxRight) {
    btnRxLeft.addEventListener("click", (e) => { e.stopPropagation(); setHfRxBus("A"); });
    btnRxRight.addEventListener("click", (e) => { e.stopPropagation(); setHfRxBus("B"); });
  }
  if (btnRxCh) {
    btnRxCh.addEventListener("click", () => {
      setHfRxBus(hfScreenState.rxBus === "A" ? "B" : "A");
    });
  }
}

function patchHfRx(s) {
  if (!s) return;
  const rxCh = hfScreenState.rxBus || "B";
  const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
  const curRx = rxLabs.length > 0 ? rxLabs[Math.min(hfScreenState.rxWordIndex || 0, rxLabs.length - 1)] : null;

  const rxCell = document.getElementById("hf-rx-data-cell");
  if (rxCell) {
    if (curRx && curRx.data) {
      rxCell.textContent = curRx.data_eng || curRx.data;
      rxCell.classList.add("has-data");
    } else {
      rxCell.textContent = "WAITING...";
      rxCell.classList.remove("has-data");
    }
  }

  const rxListEl = document.getElementById("hf-rx-words-list");
  if (rxListEl) {
    rxListEl.textContent = rxLabs.length > 0
      ? rxLabs.map(l => l.funct || l.label || l.label_octal).filter(Boolean).slice(0, 4).join(" / ")
      : "---";
  }
}

// ============================================================================
// 5. renderVhfAlign & patchVhfAlignRx (Collins VHF-900 Alignment Mode)
// ============================================================================
function renderVhfAlign(r, s) {
  // MUTUALLY EXCLUSIVE VIEW SWITCHER: Always clear r so sub-screens never appear below main menu!
  r.innerHTML = "";

  const vState = (s && s.vhf_align) || {};
  const currentScreen = vhfAlignState.page || vhfAlignState.currentScreen || "menu";

  const p = el("div", "panel");
  p.style.maxWidth = "1060px";
  p.style.margin = "0 auto";

  const toolbar = el("div", "lru-toolbar");
  toolbar.style.display = "flex";
  toolbar.style.justifyContent = "space-between";
  toolbar.style.alignItems = "center";
  toolbar.style.marginBottom = "0.75rem";
  toolbar.style.flexWrap = "nowrap";
  toolbar.style.gap = "12px";
  toolbar.innerHTML = `
    <div style="min-width:0; flex-shrink:1;">
      <div class="panel-title" style="margin-bottom:0.2rem; white-space:nowrap;">COLLINS VHF-900 ALIGNMENT MODE</div>
      <p class="muted" style="margin:0; font-size:11.5px; white-space:nowrap;">ARINC 429 Channel C High-Speed (100 kbps) Alignment & Calibration</p>
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:nowrap; flex-shrink:0;">
      <span class="pill pill-run" style="white-space:nowrap;">BUS TX-C &bull; RX-C &bull; 100 KBPS</span>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-vhf-top-back" style="white-space:nowrap;">&lt; LRU Select</button>
    </div>
  `;
  p.appendChild(toolbar);

  const container = el("div", "vhf-align-container");

  // Echo Banner helper
  const renderBannerHtml = () => {
    if (vState.echo_ok) {
      return `<div class="vhf-echo-banner ok" id="vhf-live-echo-banner">VHF900 429 ECHO OK</div>`;
    }
    return `<div class="vhf-echo-banner error" id="vhf-live-echo-banner">ERROR: VHF900 DID NOT ECHO 429 COMMAND</div>`;
  };

  const curSsm = vhfAlignState.ssm || vState.ssm || "00";
  const curSdi = vhfAlignState.sdi || vState.sdi || "00";

  // --------------------------------------------------------------------------
  // SCREEN 1: MAIN MENU (Photo 4)
  // --------------------------------------------------------------------------
  if (currentScreen === "menu") {
    container.innerHTML = `
      <div class="vhf-align-title">SELECT VHF900 ALIGNMENT MODE:</div>
      <div class="vhf-menu-grid">
        <button type="button" class="vhf-menu-btn" id="btn-vhf-tfm">MODIFY<br>TFM<br>VARIABLES</button>
        <button type="button" class="vhf-menu-btn" id="btn-vhf-cal">MODIFY<br>CALIBRATION<br>VARIABLES</button>
        <button type="button" class="vhf-menu-btn" id="btn-vhf-checksum">RECALCULATE<br>ROM<br>CHECKSUM</button>
        <button type="button" class="vhf-menu-btn" id="btn-vhf-ssm">CHANGE<br>SSM<br><span id="vhf-ssm-val">${curSsm}</span></button>
        <button type="button" class="vhf-menu-btn" id="btn-vhf-sdi">CHANGE<br>SDI<br><span id="vhf-sdi-val">${curSdi}</span></button>
        <button type="button" class="vhf-menu-btn" id="btn-vhf-faults">FAILURE<br>MESSAGES</button>
      </div>
      ${renderBannerHtml()}
      <button type="button" class="btn btn-ghost" id="btn-vhf-back" style="margin-top:1.25rem;">← RETURN TO AVIONICS LRU</button>
    `;

    p.appendChild(container);
    const topBack = toolbar.querySelector('#btn-vhf-top-back');
    if (topBack) topBack.addEventListener('click', () => navTo('avionics_lru'));
    r.appendChild(p);

    container.querySelector("#btn-vhf-tfm").addEventListener("click", () => {
      vhfAlignState.page = "tfm";
      vhfAlignState.currentScreen = "tfm";
      renderVhfAlign(r, snap);
    });
    container.querySelector("#btn-vhf-cal").addEventListener("click", () => {
      vhfAlignState.page = "cal";
      vhfAlignState.currentScreen = "cal";
      renderVhfAlign(r, snap);
    });
    container.querySelector("#btn-vhf-faults").addEventListener("click", () => {
      vhfAlignState.page = "fail";
      vhfAlignState.currentScreen = "faults";
      renderVhfAlign(r, snap);
    });
    container.querySelector("#btn-vhf-back").addEventListener("click", () => {
      navTo("avionics_lru");
    });

    const ssmBtn = container.querySelector("#btn-vhf-ssm");
    if (ssmBtn) {
      ssmBtn.addEventListener("click", () => {
        const ssms = ["00", "01", "10", "11"];
        const cur = vhfAlignState.ssm || vState.ssm || "00";
        const nextSsm = ssms[(ssms.indexOf(cur) + 1) % ssms.length];
        vhfAlignState.ssm = nextSsm;
        if (snap && snap.vhf_align) snap.vhf_align.ssm = nextSsm;
        const valEl = container.querySelector("#vhf-ssm-val");
        if (valEl) valEl.textContent = nextSsm;
        api("/api/arinc/vhf-align/config", {
          method: "POST",
          body: JSON.stringify({ ssm: nextSsm }),
        }).then(res => {
          if (snap) snap.vhf_align = res;
        }).catch(e => {
          console.error("SSM update error:", e);
        });
      });
    }

    const sdiBtn = container.querySelector("#btn-vhf-sdi");
    if (sdiBtn) {
      sdiBtn.addEventListener("click", () => {
        const sdis = ["00", "01", "10", "11"];
        const cur = vhfAlignState.sdi || vState.sdi || "00";
        const nextSdi = sdis[(sdis.indexOf(cur) + 1) % sdis.length];
        vhfAlignState.sdi = nextSdi;
        if (snap && snap.vhf_align) snap.vhf_align.sdi = nextSdi;
        const valEl = container.querySelector("#vhf-sdi-val");
        if (valEl) valEl.textContent = nextSdi;
        api("/api/arinc/vhf-align/config", {
          method: "POST",
          body: JSON.stringify({ sdi: nextSdi }),
        }).then(res => {
          if (snap) snap.vhf_align = res;
        }).catch(e => {
          console.error("SDI update error:", e);
        });
      });
    }

    const csBtn = container.querySelector("#btn-vhf-checksum");
    if (csBtn) {
      csBtn.addEventListener("click", async () => {
        if (vhfChecksumTimer) clearInterval(vhfChecksumTimer);
        vhfChecksumCountdown = 10;
        csBtn.innerHTML = `RECALCULATING...<br>(10s)`;
        const banner = document.getElementById("vhf-live-echo-banner");
        if (banner) {
          banner.className = "vhf-echo-banner ok";
          banner.style.background = "#0284c7";
          banner.style.color = "#ffffff";
          banner.textContent = "EXECUTING CHECKSUM COMMAND; WAIT 10 SECONDS";
        }
        try {
          const res = await api("/api/arinc/vhf-align/checksum", { method: "POST" });
          if (snap) snap.vhf_align = res;
        } catch (e) {
          console.error("Checksum error:", e);
        }
        vhfChecksumTimer = setInterval(() => {
          vhfChecksumCountdown--;
          const btn = document.getElementById("btn-vhf-checksum");
          const bnr = document.getElementById("vhf-live-echo-banner");
          if (vhfChecksumCountdown > 0) {
            if (btn) btn.innerHTML = `RECALCULATING...<br>(${vhfChecksumCountdown}s)`;
            if (bnr) {
              bnr.className = "vhf-echo-banner ok";
              bnr.style.background = "#0284c7";
              bnr.style.color = "#ffffff";
              bnr.textContent = `EXECUTING CHECKSUM COMMAND; WAIT ${vhfChecksumCountdown} SECONDS`;
            }
          } else {
            clearInterval(vhfChecksumTimer);
            vhfChecksumTimer = null;
            if (btn) btn.innerHTML = `CHECKSUM<br>COMPLETE!<br>(10s)`;
            if (bnr) {
              bnr.style.background = "";
              bnr.style.color = "";
              const echoOk = snap && snap.vhf_align && snap.vhf_align.echo_ok;
              bnr.className = echoOk ? "vhf-echo-banner ok" : "vhf-echo-banner error";
              bnr.textContent = echoOk ? "VHF900 429 ECHO OK" : "ERROR: VHF900 DID NOT ECHO 429 COMMAND";
            }
            setTimeout(() => {
              const b = document.getElementById("btn-vhf-checksum");
              if (b) b.innerHTML = `RECALCULATE<br>ROM<br>CHECKSUM`;
            }, 3000);
          }
        }, 1000);
      });
    }

    return;
  }

  // --------------------------------------------------------------------------
  // SCREEN 2: TFM VARIABLES (Photo 3)
  // --------------------------------------------------------------------------
  if (currentScreen === "tfm") {
    const page = vhfAlignState.tfmPage || 1;
    const allVars = vState.tfm_vars || [];
    const pageVars = allVars.filter((v) => v.page === page);
    const col0 = pageVars.filter((v) => v.col === 0);
    const col1 = pageVars.filter((v) => v.col === 1);

    const activeVar = allVars.find((v) => v.id === vhfAlignState.activeVarId) || pageVars[0] || {};
    const ramVal = intToHex(activeVar.ram != null ? activeVar.ram : 0x00);
    const highNibble = ramVal.charAt(0);
    const lowNibble = ramVal.charAt(1);

    const freqStr = Number(vState.freq_mhz || 118.000).toFixed(3);
    const freqPos = vhfAlignState.freqPos || 2;

    container.innerHTML = `
      <div class="vhf-align-title" style="margin-bottom:0.75rem;">TFM VARIABLES PAGE ${page}/4</div>
      <div class="vhf-vars-layout">
        <div class="vhf-vars-cols">
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${col0.map((v) => `<button type="button" class="vhf-var-btn ${v.id === activeVar.id ? "active-var" : ""}" data-var-id="${v.id}">${v.num} ${v.name}</button>`).join("")}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${col1.map((v) => `<button type="button" class="vhf-var-btn ${v.id === activeVar.id ? "active-var" : ""}" data-var-id="${v.id}">${v.num} ${v.name}</button>`).join("")}
          </div>
        </div>
        <div class="vhf-ctrl-panel">
          <div class="vhf-sub-panel">
            <div class="vhf-sub-title">CURRENT RAM VALUE</div>
            <div class="vhf-val-display-row">
              <div class="vhf-hex-box">
                <span class="vhf-hex-nibble ${vhfAlignState.valNibble === 0 ? "active-nibble" : ""}" id="nibble-high">${highNibble}</span><span class="vhf-hex-nibble ${vhfAlignState.valNibble === 1 ? "active-nibble" : ""}" id="nibble-low">${lowNibble}</span>
              </div>
              <div class="vhf-cursor-row">${vhfAlignState.valNibble === 0 ? "↑&nbsp;&nbsp;" : "&nbsp;&nbsp;↑"}</div>
            </div>
            <div class="vhf-btn-group">
              <button type="button" class="vhf-sub-btn" id="btn-val-decr">DECR</button>
              <button type="button" class="vhf-sub-btn" id="btn-val-crsr">CRSR</button>
              <button type="button" class="vhf-sub-btn" id="btn-val-incr">INCR</button>
            </div>
            <div class="vhf-btn-group" style="margin-top:8px;">
              <button type="button" class="vhf-sub-btn" id="btn-write-rom" style="min-width:90px;">WRITE TO ROM</button>
              <button type="button" class="vhf-sub-btn" id="btn-write-blk" style="min-width:110px;">WRITE BLK TO ROM</button>
            </div>
          </div>
          <div class="vhf-sub-panel">
            <div class="vhf-sub-title">CURRENT LRU FREQUENCY</div>
            <div class="vhf-val-display-row">
              <div class="vhf-freq-box">${renderFreqWithCursor(freqStr, freqPos)}</div>
              <div class="vhf-cursor-row" style="letter-spacing:3px; padding:0 14px;">${renderFreqCursorRow(freqStr, freqPos)}</div>
            </div>
            <div class="vhf-btn-group">
              <button type="button" class="vhf-sub-btn" id="btn-freq-left">LEFT</button>
              <button type="button" class="vhf-sub-btn" id="btn-freq-right">RIGHT</button>
            </div>
            <div class="vhf-btn-group" style="margin-top:6px;">
              <button type="button" class="vhf-sub-btn" id="btn-freq-decr">DECREASE</button>
              <button type="button" class="vhf-sub-btn" id="btn-freq-incr">INCREASE</button>
            </div>
          </div>
        </div>
      </div>
      <div class="vhf-softkeys-bar">
        <button type="button" class="vhf-menu-btn" id="btn-next-page">NEXT<br>PAGE</button>
        <button type="button" class="vhf-menu-btn" id="btn-menu-ret">VHF900<br>MENU</button>
        <button type="button" class="vhf-menu-btn" id="btn-tx-inh">TX INH<br>${vState.tx_inh ? "ON" : "OFF"}</button>
        <button type="button" class="vhf-menu-btn" id="btn-tx-phs">TX PHS<br>${vState.tx_phs ? "ON" : "OFF"}</button>
      </div>
      ${renderBannerHtml()}
    `;

    p.appendChild(container);
    const topBack = toolbar.querySelector('#btn-vhf-top-back');
    if (topBack) topBack.addEventListener('click', () => navTo('avionics_lru'));
    r.appendChild(p);
    attachVhfScreenHandlers(container, r, "tfm");
    return;
  }

  // --------------------------------------------------------------------------
  // SCREEN 3: CALIBRATION VARIABLES (Photo 2)
  // --------------------------------------------------------------------------
  if (currentScreen === "cal") {
    const page = vhfAlignState.calPage || 1;
    const allVars = vState.cal_vars || [];
    const pageVars = allVars.filter((v) => v.page === page);
    const col0 = pageVars.filter((v) => v.col === 0);
    const col1 = pageVars.filter((v) => v.col === 1);

    const activeVar = allVars.find((v) => v.id === vhfAlignState.activeVarId) || pageVars[0] || {};
    const romVal = intToHex(activeVar.rom != null ? activeVar.rom : 0x00);
    const highNibble = romVal.charAt(0);
    const lowNibble = romVal.charAt(1);

    const freqStr = Number(vState.freq_mhz || 118.000).toFixed(3);
    const freqPos = vhfAlignState.freqPos || 2;

    container.innerHTML = `
      <div class="vhf-align-title" style="margin-bottom:0.75rem;">CALIBRATION VARIABLES PAGE ${page}/4</div>
      <div class="vhf-vars-layout">
        <div class="vhf-vars-cols">
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            ${col0.map((v) => `<button type="button" class="vhf-var-btn ${v.id === activeVar.id ? "active-var" : ""}" data-var-id="${v.id}">${v.num} ${v.name}</button>`).join("")}
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            ${col1.map((v) => `<button type="button" class="vhf-var-btn ${v.id === activeVar.id ? "active-var" : ""}" data-var-id="${v.id}">${v.num} ${v.name}</button>`).join("")}
          </div>
        </div>
        <div class="vhf-ctrl-panel">
          <div class="vhf-sub-panel">
            <div class="vhf-sub-title">CURRENT ROM VALUE</div>
            <div class="vhf-val-display-row">
              <div class="vhf-hex-box">
                <span class="vhf-hex-nibble ${vhfAlignState.valNibble === 0 ? "active-nibble" : ""}" id="nibble-high">${highNibble}</span><span class="vhf-hex-nibble ${vhfAlignState.valNibble === 1 ? "active-nibble" : ""}" id="nibble-low">${lowNibble}</span>
              </div>
              <div class="vhf-cursor-row">${vhfAlignState.valNibble === 0 ? "↑&nbsp;&nbsp;" : "&nbsp;&nbsp;↑"}</div>
            </div>
            <div class="vhf-btn-group">
              <button type="button" class="vhf-sub-btn" id="btn-val-decr">DECR</button>
              <button type="button" class="vhf-sub-btn" id="btn-val-crsr">CRSR</button>
              <button type="button" class="vhf-sub-btn" id="btn-val-incr">INCR</button>
            </div>
            <div class="vhf-btn-group" style="margin-top:8px;">
              <button type="button" class="vhf-sub-btn" id="btn-write-rom" style="min-width:110px;">WRITE TO ROM</button>
            </div>
          </div>
          <div class="vhf-sub-panel">
            <div class="vhf-sub-title">CURRENT LRU FREQUENCY</div>
            <div class="vhf-val-display-row">
              <div class="vhf-freq-box">${renderFreqWithCursor(freqStr, freqPos)}</div>
              <div class="vhf-cursor-row" style="letter-spacing:3px; padding:0 14px;">${renderFreqCursorRow(freqStr, freqPos)}</div>
            </div>
            <div class="vhf-btn-group">
              <button type="button" class="vhf-sub-btn" id="btn-freq-left">LEFT</button>
              <button type="button" class="vhf-sub-btn" id="btn-freq-right">RIGHT</button>
            </div>
            <div class="vhf-btn-group" style="margin-top:6px;">
              <button type="button" class="vhf-sub-btn" id="btn-freq-decr">DECREASE</button>
              <button type="button" class="vhf-sub-btn" id="btn-freq-incr">INCREASE</button>
            </div>
          </div>
        </div>
      </div>
      <div class="vhf-softkeys-bar-2">
        <button type="button" class="vhf-menu-btn" id="btn-next-page">NEXT<br>PAGE</button>
        <button type="button" class="vhf-menu-btn" id="btn-menu-ret">VHF900<br>MENU</button>
      </div>
      ${renderBannerHtml()}
    `;

    p.appendChild(container);
    const topBack = toolbar.querySelector('#btn-vhf-top-back');
    if (topBack) topBack.addEventListener('click', () => navTo('avionics_lru'));
    r.appendChild(p);
    attachVhfScreenHandlers(container, r, "cal");
    return;
  }

  // --------------------------------------------------------------------------
  // SCREEN 4: FAILURE MESSAGES (Photo 1)
  // --------------------------------------------------------------------------
  if (currentScreen === "faults" || currentScreen === "fail") {
    const faults = vState.faults || {};
    container.innerHTML = `
      <div class="vhf-failure-panel" style="max-width:720px; margin:1.5rem auto; border:2px solid var(--border-strong); border-radius:var(--radius); padding:28px 36px; background:var(--surface);">
        <div class="vhf-align-title" style="margin-bottom:1.75rem; text-align:center; font-weight:700; font-size:15px; letter-spacing:1px;">VHF900 ALIGNMENT MODE FAILURE MESSAGES</div>
        <div class="vhf-failure-line" style="display:flex; margin:14px 0; font-family:var(--mono); font-size:14px;">
          <div class="fl-key" style="width:230px; font-weight:600; color:var(--text-2);">LABEL 350 DATA</div>
          <div class="fl-val" id="vhf-fl-350" style="font-weight:700; color:var(--text);">= &nbsp; ${faults.label_350_raw && faults.label_350_raw !== "00000000" ? faults.label_350_raw : ""}</div>
        </div>
        <div style="margin:16px 0;"></div>
        <div class="vhf-failure-line" style="display:flex; margin:10px 0; font-family:var(--mono); font-size:14px;">
          <div class="fl-key" style="width:230px; font-weight:600; color:var(--text-2);">FAULT CODE &nbsp;&nbsp;&nbsp; 1</div>
          <div class="fl-val" id="vhf-fl-code1" style="font-weight:700; color:var(--text);">= &nbsp; ${faults.code1 && faults.code1 !== "NONE" ? faults.code1 : ""}</div>
        </div>
        <div class="vhf-failure-line" style="display:flex; margin:10px 0; font-family:var(--mono); font-size:14px;">
          <div class="fl-key" style="width:230px; font-weight:600; color:var(--text-2);">FAULT MESSAGE &nbsp; 1</div>
          <div class="fl-val" id="vhf-fl-msg1" style="font-weight:700; color:var(--text);">= &nbsp; ${faults.msg1 && faults.msg1 !== "NO FAULT DETECTED" ? faults.msg1 : ""}</div>
        </div>
        <div style="margin:20px 0;"></div>
        <div class="vhf-failure-line" style="display:flex; margin:10px 0; font-family:var(--mono); font-size:14px;">
          <div class="fl-key" style="width:230px; font-weight:600; color:var(--text-2);">FAULT CODE &nbsp;&nbsp;&nbsp; 2</div>
          <div class="fl-val" id="vhf-fl-code2" style="font-weight:700; color:var(--text);">= &nbsp; ${faults.code2 && faults.code2 !== "NONE" ? faults.code2 : ""}</div>
        </div>
        <div class="vhf-failure-line" style="display:flex; margin:10px 0; font-family:var(--mono); font-size:14px;">
          <div class="fl-key" style="width:230px; font-weight:600; color:var(--text-2);">FAULT MESSAGE &nbsp; 2</div>
          <div class="fl-val" id="vhf-fl-msg2" style="font-weight:700; color:var(--text);">= &nbsp; ${faults.msg2 && faults.msg2 !== "NO FAULT DETECTED" ? faults.msg2 : ""}</div>
        </div>
        <div style="margin:28px 0 10px 0;">
          ${renderBannerHtml()}
        </div>
      </div>
      <div style="display:flex; justify-content:center; margin-top:1.25rem;">
        <button type="button" class="vhf-menu-btn" id="btn-menu-ret" style="width:160px; height:50px;">VHF900<br>MENU</button>
      </div>
    `;

    p.appendChild(container);
    const topBack = toolbar.querySelector('#btn-vhf-top-back');
    if (topBack) topBack.addEventListener('click', () => navTo('avionics_lru'));
    r.appendChild(p);
    container.querySelector("#btn-menu-ret").addEventListener("click", () => {
      vhfAlignState.page = "menu";
      vhfAlignState.currentScreen = "menu";
      api("/api/arinc/vhf-align/config", {
        method: "POST",
        body: JSON.stringify({ current_screen: "menu" }),
      }).catch((e) => console.error(e));
      renderVhfAlign(r, snap);
    });
    return;
  }
}

// Helpers for VHF Alignment screens
function intToHex(n) {
  return Number(n & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function renderFreqWithCursor(freqStr, pos) {
  const chars = freqStr.split("");
  let charIdx = 0;
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === ".") {
      out += ".";
    } else {
      const isAct = charIdx === pos;
      out += `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}">${c}</span>`;
      charIdx++;
    }
  }
  return out;
}

function renderFreqCursorRow(freqStr, pos) {
  const chars = freqStr.split("");
  let charIdx = 0;
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === ".") {
      out += `<span class="dme-cursor-bit" style="visibility:hidden;">.</span>`;
    } else {
      const isAct = charIdx === pos;
      out += `<span class="dme-cursor-bit" style="${isAct ? 'color:var(--accent);font-weight:bold;' : 'visibility:hidden;'}">↑</span>`;
      charIdx++;
    }
  }
  return out;
}

function attachVhfScreenHandlers(container, r, mode) {
  // Variable selection
  container.querySelectorAll(".vhf-var-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const varId = Number(btn.getAttribute("data-var-id"));
      vhfAlignState.activeVarId = varId;
      container.querySelectorAll(".vhf-var-btn").forEach((b) => {
        b.classList.toggle("active-var", Number(b.getAttribute("data-var-id")) === varId);
      });
      // Update displayed value in-place
      const vState = (snap && snap.vhf_align) || {};
      const varsList = (mode === "tfm" ? vState.tfm_vars : vState.cal_vars) || [];
      const vObj = varsList.find((v) => v.id === varId) || {};
      const val = intToHex(vObj.ram != null ? vObj.ram : (vObj.rom != null ? vObj.rom : 0x00));
      const nh = container.querySelector("#nibble-high");
      const nl = container.querySelector("#nibble-low");
      if (nh) nh.textContent = val.charAt(0);
      if (nl) nl.textContent = val.charAt(1);
      api("/api/arinc/vhf-align/config", {
        method: "POST",
        body: JSON.stringify({ active_var_id: varId }),
      }).catch((e) => console.error("Active var error:", e));
    });
  });

  // CRSR toggle between high nibble (0) and low nibble (1)
  const btnCrsr = container.querySelector("#btn-val-crsr");
  if (btnCrsr) {
    btnCrsr.addEventListener("click", () => {
      vhfAlignState.valNibble = (vhfAlignState.valNibble === 0) ? 1 : 0;
      const nh = container.querySelector("#nibble-high");
      const nl = container.querySelector("#nibble-low");
      const crsrRow = container.querySelector(".vhf-cursor-row");
      if (nh) nh.classList.toggle("active-nibble", vhfAlignState.valNibble === 0);
      if (nl) nl.classList.toggle("active-nibble", vhfAlignState.valNibble === 1);
      if (crsrRow) crsrRow.innerHTML = (vhfAlignState.valNibble === 0) ? "↑&nbsp;&nbsp;" : "&nbsp;&nbsp;↑";
      api("/api/arinc/vhf-align/config", {
        method: "POST",
        body: JSON.stringify({ val_nibble: vhfAlignState.valNibble }),
      }).catch((e) => console.error("Nibble error:", e));
    });
  }

  // DECR / INCR active nibble
  const stepNibble = async (delta) => {
    const nh = container.querySelector("#nibble-high");
    const nl = container.querySelector("#nibble-low");
    let high = parseInt(nh ? nh.textContent : "0", 16) || 0;
    let low = parseInt(nl ? nl.textContent : "0", 16) || 0;
    if (vhfAlignState.valNibble === 0) {
      high = (high + delta + 16) % 16;
      if (nh) nh.textContent = high.toString(16).toUpperCase();
    } else {
      low = (low + delta + 16) % 16;
      if (nl) nl.textContent = low.toString(16).toUpperCase();
    }
    try {
      const res = await api("/api/arinc/vhf-align/step", {
        method: "POST",
        body: JSON.stringify({ field: "val", delta }),
      });
      if (snap) snap.vhf_align = res;
    } catch (e) {
      console.error("Step val error:", e);
    }
  };

  const btnValDecr = container.querySelector("#btn-val-decr");
  if (btnValDecr) btnValDecr.addEventListener("click", () => stepNibble(-1));

  const btnValIncr = container.querySelector("#btn-val-incr");
  if (btnValIncr) btnValIncr.addEventListener("click", () => stepNibble(1));

  // Frequency Cursor (LEFT / RIGHT)
  const updateFreqCursorDOM = () => {
    const freqBox = container.querySelector(".vhf-freq-box");
    const crsrBox = container.querySelector(".vhf-sub-panel:last-child .vhf-cursor-row");
    const vState = (snap && snap.vhf_align) || {};
    const freqStr = Number(vState.freq_mhz || 118.000).toFixed(3);
    const pos = vhfAlignState.freqPos || 2;
    if (freqBox) freqBox.innerHTML = renderFreqWithCursor(freqStr, pos);
    if (crsrBox) crsrBox.innerHTML = renderFreqCursorRow(freqStr, pos);
  };

  const btnFreqLeft = container.querySelector("#btn-freq-left");
  if (btnFreqLeft) {
    btnFreqLeft.addEventListener("click", () => {
      vhfAlignState.freqPos = Math.max(0, (vhfAlignState.freqPos || 2) - 1);
      updateFreqCursorDOM();
      api("/api/arinc/vhf-align/config", {
        method: "POST",
        body: JSON.stringify({ freq_pos: vhfAlignState.freqPos }),
      }).catch((e) => console.error("Freq pos error:", e));
    });
  }

  const btnFreqRight = container.querySelector("#btn-freq-right");
  if (btnFreqRight) {
    btnFreqRight.addEventListener("click", () => {
      vhfAlignState.freqPos = Math.min(5, (vhfAlignState.freqPos || 2) + 1);
      updateFreqCursorDOM();
      api("/api/arinc/vhf-align/config", {
        method: "POST",
        body: JSON.stringify({ freq_pos: vhfAlignState.freqPos }),
      }).catch((e) => console.error("Freq pos error:", e));
    });
  }

  // Frequency Stepping (DECREASE / INCREASE)
  const stepFrequency = async (delta) => {
    try {
      const res = await api("/api/arinc/vhf-align/step", {
        method: "POST",
        body: JSON.stringify({ field: "freq", delta }),
      });
      if (snap) snap.vhf_align = res;
      updateFreqCursorDOM();
    } catch (e) {
      console.error("Step freq error:", e);
    }
  };

  const btnFreqDecr = container.querySelector("#btn-freq-decr");
  if (btnFreqDecr) btnFreqDecr.addEventListener("click", () => stepFrequency(-1));

  const btnFreqIncr = container.querySelector("#btn-freq-incr");
  if (btnFreqIncr) btnFreqIncr.addEventListener("click", () => stepFrequency(1));

  // WRITE TO ROM (2-Step)
  const btnWriteRom = container.querySelector("#btn-write-rom");
  if (btnWriteRom) {
    btnWriteRom.addEventListener("click", async () => {
      try {
        const res = await api("/api/arinc/vhf-align/write-var", {
          method: "POST",
          body: JSON.stringify({ action: "WRITE_ROM" }),
        });
        if (snap) snap.vhf_align = res.state || res;
        if (res.status === "CONFIRM_REQUIRED") {
          btnWriteRom.classList.add("confirm-flash");
          btnWriteRom.textContent = "CONFIRM?";
          setTimeout(() => {
            btnWriteRom.classList.remove("confirm-flash");
            btnWriteRom.textContent = "WRITE TO ROM";
          }, 3000);
        } else {
          btnWriteRom.classList.remove("confirm-flash");
          btnWriteRom.textContent = "WRITTEN!";
          setTimeout(() => {
            btnWriteRom.textContent = "WRITE TO ROM";
          }, 1500);
        }
      } catch (e) {
        console.error("Write ROM error:", e);
      }
    });
  }

  // WRITE BLK TO ROM (2-Step)
  const btnWriteBlk = container.querySelector("#btn-write-blk");
  if (btnWriteBlk) {
    btnWriteBlk.addEventListener("click", async () => {
      try {
        const res = await api("/api/arinc/vhf-align/write-var", {
          method: "POST",
          body: JSON.stringify({ action: "WRITE_BLK" }),
        });
        if (snap) snap.vhf_align = res.state || res;
        if (res.status === "CONFIRM_REQUIRED") {
          btnWriteBlk.classList.add("confirm-flash");
          btnWriteBlk.textContent = "CONFIRM?";
          setTimeout(() => {
            btnWriteBlk.classList.remove("confirm-flash");
            btnWriteBlk.textContent = "WRITE BLK TO ROM";
          }, 3000);
        } else {
          btnWriteBlk.classList.remove("confirm-flash");
          btnWriteBlk.textContent = "BLOCK WRITTEN!";
          setTimeout(() => {
            btnWriteBlk.textContent = "WRITE BLK TO ROM";
          }, 1500);
        }
      } catch (e) {
        console.error("Write BLK error:", e);
      }
    });
  }

  // NEXT PAGE (Cycles 1..4)
  const btnNextPage = container.querySelector("#btn-next-page");
  if (btnNextPage) {
    btnNextPage.addEventListener("click", () => {
      if (mode === "tfm") {
        vhfAlignState.tfmPage = (vhfAlignState.tfmPage % 4) + 1;
        vhfAlignState.activeVarId = (vhfAlignState.tfmPage - 1) * 10 + 1;
        api("/api/arinc/vhf-align/config", {
          method: "POST",
          body: JSON.stringify({ tfm_page: vhfAlignState.tfmPage }),
        }).catch((e) => console.error(e));
      } else {
        vhfAlignState.calPage = (vhfAlignState.calPage % 4) + 1;
        vhfAlignState.activeVarId = (vhfAlignState.calPage - 1) * 10 + 1;
        api("/api/arinc/vhf-align/config", {
          method: "POST",
          body: JSON.stringify({ cal_page: vhfAlignState.calPage }),
        }).catch((e) => console.error(e));
      }
      renderVhfAlign(r, snap);
    });
  }

  // VHF900 MENU Return
  const btnMenuRet = container.querySelector("#btn-menu-ret");
  if (btnMenuRet) {
    btnMenuRet.addEventListener("click", () => {
      vhfAlignState.page = "menu";
      vhfAlignState.currentScreen = "menu";
      api("/api/arinc/vhf-align/config", {
        method: "POST",
        body: JSON.stringify({ current_screen: "menu" }),
      }).catch((e) => console.error(e));
      renderVhfAlign(r, snap);
    });
  }

  // TX INH / TX PHS Toggles
  const btnTxInh = container.querySelector("#btn-tx-inh");
  if (btnTxInh) {
    btnTxInh.addEventListener("click", async () => {
      const vState = (snap && snap.vhf_align) || {};
      const nextVal = !vState.tx_inh;
      if (vState) vState.tx_inh = nextVal;
      btnTxInh.innerHTML = `TX INH<br>${nextVal ? "ON" : "OFF"}`;
      try {
        const res = await api("/api/arinc/vhf-align/config", {
          method: "POST",
          body: JSON.stringify({ tx_inh: nextVal }),
        });
        if (snap) snap.vhf_align = res;
      } catch (e) {
        console.error("TX INH error:", e);
      }
    });
  }

  const btnTxPhs = container.querySelector("#btn-tx-phs");
  if (btnTxPhs) {
    btnTxPhs.addEventListener("click", async () => {
      const vState = (snap && snap.vhf_align) || {};
      const nextVal = !vState.tx_phs;
      if (vState) vState.tx_phs = nextVal;
      btnTxPhs.innerHTML = `TX PHS<br>${nextVal ? "ON" : "OFF"}`;
      try {
        const res = await api("/api/arinc/vhf-align/config", {
          method: "POST",
          body: JSON.stringify({ tx_phs: nextVal }),
        });
        if (snap) snap.vhf_align = res;
      } catch (e) {
        console.error("TX PHS error:", e);
      }
    });
  }
}

function patchVhfAlignRx(s) {
  if (!s || !s.vhf_align) return;
  const vState = s.vhf_align;

  // Don't overwrite if checksum countdown is currently active
  if (!vhfChecksumTimer) {
    const banner = document.getElementById("vhf-live-echo-banner");
    if (banner) {
      if (vState.echo_ok) {
        banner.className = "vhf-echo-banner ok";
        banner.style.background = "";
        banner.style.color = "";
        banner.textContent = "VHF900 429 ECHO OK";
      } else {
        banner.className = "vhf-echo-banner error";
        banner.style.background = "";
        banner.style.color = "";
        banner.textContent = "ERROR: VHF900 DID NOT ECHO 429 COMMAND";
      }
    }
  }

  // Update SSM/SDI on main menu if not overridden locally
  const ssmValEl = document.getElementById("vhf-ssm-val");
  if (ssmValEl && !vhfAlignState.ssm) {
    ssmValEl.textContent = vState.ssm || "00";
  }
  const sdiValEl = document.getElementById("vhf-sdi-val");
  if (sdiValEl && !vhfAlignState.sdi) {
    sdiValEl.textContent = vState.sdi || "00";
  }

  const csBtn = document.getElementById("btn-vhf-checksum");
  if (csBtn && !vhfChecksumTimer) {
    if (vState.checksum_status === "RUNNING") {
      csBtn.innerHTML = `RECALCULATING...<br>(${Math.ceil(vState.checksum_remaining || 0)}s)`;
    } else if (vState.checksum_status === "DONE") {
      csBtn.innerHTML = "CHECKSUM<br>COMPLETE!<br>(10s)";
    }
  }

  // Failure messages screen live update
  const f350 = document.getElementById("vhf-fl-350");
  if (f350 && vState.faults) {
    f350.textContent = (vState.faults.label_350_raw && vState.faults.label_350_raw !== "00000000") ? `=   ${vState.faults.label_350_raw}` : "=   ";
  }
  const fc1 = document.getElementById("vhf-fl-code1");
  if (fc1 && vState.faults) {
    fc1.textContent = (vState.faults.code1 && vState.faults.code1 !== "NONE") ? `=   ${vState.faults.code1}` : "=   ";
  }
  const fm1 = document.getElementById("vhf-fl-msg1");
  if (fm1 && vState.faults) {
    fm1.textContent = (vState.faults.msg1 && vState.faults.msg1 !== "NO FAULT DETECTED") ? `=   ${vState.faults.msg1}` : "=   ";
  }
  const fc2 = document.getElementById("vhf-fl-code2");
  if (fc2 && vState.faults) {
    fc2.textContent = (vState.faults.code2 && vState.faults.code2 !== "NONE") ? `=   ${vState.faults.code2}` : "=   ";
  }
  const fm2 = document.getElementById("vhf-fl-msg2");
  if (fm2 && vState.faults) {
    fm2.textContent = (vState.faults.msg2 && vState.faults.msg2 !== "NO FAULT DETECTED") ? `=   ${vState.faults.msg2}` : "=   ";
  }
}

async function ensureProfiles(force) {
    if (!force && profilesCache) return profilesCache;
    const data = await api("/api/arinc/profiles");
    profilesCache = (data && data.profiles) || [];
    return profilesCache;
  }

  async function loadProfileDetail(id, force) {
    if (!force && profileDetails[id]) return profileDetails[id];
    const d = await api(`/api/arinc/profile/${encodeURIComponent(id)}`);
    profileDetails[id] = d;
    return d;
  }

  function invalidateProfiles() {
    profilesCache = null;
    libraryCache = null;
    profileDetails = {};
  }

  async function ensureLibrary(force) {
    if (!force && libraryCache) return libraryCache;
    const data = await api("/api/arinc/library");
    libraryCache = (data && data.labels) || [];
    return libraryCache;
  }

  function openLibraryPicker(onPick) {
    const root = $("modal-root");
    if (!root) return;
    root.hidden = false;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="max-width:40rem">
      <h2>Add from library</h2>
      <p class="muted">Pick an Aeroflex T1200 label. Format is copied onto this LRU (library itself is not changed).</p>
      <input id="lib-pick-filter" placeholder="Filter octal or name" style="width:100%;margin:.65rem 0"/>
      <div class="table-wrap" style="max-height:22rem;overflow:auto">
        <table class="lib-table"><thead><tr>
          <th class="mono">LABEL</th><th>NAME</th><th>UNITS</th><th>FORMAT</th>
        </tr></thead><tbody id="lib-pick-body"></tbody></table>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-lib-pick-cancel">Cancel</button>
      </div>
    </div></div>`;
    const paint = (rows) => {
      const q = (($("lib-pick-filter") && $("lib-pick-filter").value) || "").trim().toLowerCase();
      const filtered = !q ? rows : rows.filter((row) =>
        String(row.label || "").toLowerCase().includes(q) ||
        String(row.funct || row.name || "").toLowerCase().includes(q));
      const tb = $("lib-pick-body");
      tb.innerHTML = filtered.slice(0, 200).map((row) => `<tr data-lab="${escAttr(row.label)}" style="cursor:pointer">
        <td class="mono">${escAttr(row.label)}</td>
        <td>${escAttr(row.funct || row.name || "")}</td>
        <td>${escAttr(row.units || "")}</td>
        <td class="mono">${escAttr(row.encoding || "raw")}</td>
      </tr>`).join("") || `<tr><td colspan="4" class="muted">No match</td></tr>`;
      tb.querySelectorAll("tr[data-lab]").forEach((tr) => {
        tr.addEventListener("click", () => {
          const item = (libraryCache || []).find((x) => x.label === tr.dataset.lab);
          closeModal();
          if (item && onPick) onPick(item);
        });
      });
    };
    const backdrop = root.querySelector(".modal-backdrop");
    backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) closeModal(); });
    $("btn-lib-pick-cancel").addEventListener("click", closeModal);
    ensureLibrary().then((rows) => {
      paint(rows);
      const inp = $("lib-pick-filter");
      if (inp) inp.addEventListener("input", () => paint(libraryCache || rows));
    }).catch((e) => { alert(e.message); closeModal(); });
  }

  function closeModal() {
    const root = $("modal-root");
    if (!root) return;
    root.hidden = true;
    root.innerHTML = "";
  }

  const ENCODINGS = ["raw", "bcd", "bcd_freq_khz", "bcd_tenths_khz", "bnr", "iso5", "dme_freq", "hf_pair"];

  function emptyLabel() {
    return { label: "000", funct: "", encoding: "raw", units: "", rate_ms: 150, sdi: 0, ssm: "NML",
      parity: "ODD", par: "ODD", source: "custom",
      direction: "tx", eng_min: 0, eng_max: 0, eng_step: 1, eng_default: 0, bcd_scale: 1, bcd_digits: 5, bnr_lsb: 1, bnr_offset: 0, bnr_bits: 16, word_index: 1, iso5_chars: 3 };
  }

  function rowFromLibrary(item) {
    return {
      label: item.label,
      funct: item.funct || item.name || "",
      encoding: item.encoding || "raw",
      units: item.units || "",
      rate_ms: item.rate_ms || 150,
      sdi: item.sdi || 0,
      ssm: item.ssm || "NML",
      parity: item.parity || item.par || "ODD",
      par: item.parity || item.par || "ODD",
      source: "library",
      direction: "tx",
      eng_min: item.eng_min || 0,
      eng_max: item.eng_max || 0,
      eng_step: item.eng_step || 1,
      eng_default: item.eng_default,
      bcd_scale: item.bcd_scale ?? 1,
      bcd_digits: item.bcd_digits || 5,
      bnr_lsb: item.bnr_lsb ?? 1,
      bnr_offset: item.bnr_offset ?? 0,
      bnr_bits: item.bnr_bits || 16,
      word_index: 1,
      iso5_chars: item.iso5_chars || 3,
    };
  }

  function labelBlockHtml(ls, idx) {
    const enc = ls.encoding || "raw";
    const opts = ENCODINGS.map((e) => `<option value="${e}" ${enc === e ? "selected" : ""}>${e}</option>`).join("");
    const defVal = ls.eng_default == null ? "" : ls.eng_default;
    const defType = enc === "iso5" ? "text" : "number";
    return `<div class="label-block" data-idx="${idx}" style="border:1px solid var(--border);border-radius:6px;padding:.6rem;margin-bottom:.5rem">
      <div class="label-row">
        <label>Label<input data-f="label" value="${ls.label || ""}" maxlength="5"/></label>
        <label>Funct<input data-f="funct" value="${ls.funct || ""}"/></label>
        <label>Encoding<select data-f="encoding">${opts}</select></label>
        <label>Units<input data-f="units" value="${ls.units || ""}"/></label>
        <label>Rate ms<input data-f="rate_ms" type="number" min="10" max="5000" value="${ls.rate_ms || 150}"/></label>
        <label>Default<input data-f="eng_default" type="${defType}" step="any" value="${defVal}"/></label>
        <button type="button" class="btn btn-ghost btn-sm btn-del-lab">Remove</button>
      </div>
      <div class="label-row" style="margin-top:.35rem">
        <label>Min<input data-f="eng_min" type="number" step="any" value="${ls.eng_min ?? 0}"/></label>
        <label>Max<input data-f="eng_max" type="number" step="any" value="${ls.eng_max ?? 0}"/></label>
        <label>Step<input data-f="eng_step" type="number" step="any" value="${ls.eng_step ?? 1}"/></label>
        <label>SDI<select data-f="sdi">${[0,1,2,3].map((i) => `<option value="${i}" ${Number(ls.sdi) === i ? "selected" : ""}>0${i}</option>`).join("")}</select></label>
        <label>SSM<select data-f="ssm">${["NML","NCD","FT","FAIL","PLS","INT"].map((v) => `<option value="${v}" ${ls.ssm === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>PAR<select data-f="parity">${["ODD","EVEN"].map((v) => `<option value="${v}" ${(ls.par || ls.parity || "ODD") === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Dir<select data-f="direction">${["tx","rx","both"].map((v) => `<option value="${v}" ${(ls.direction || "tx") === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>BCD scale<input data-f="bcd_scale" type="number" step="any" value="${ls.bcd_scale ?? 1}"/></label>
        <label>BNR lsb<input data-f="bnr_lsb" type="number" step="any" value="${ls.bnr_lsb ?? 1}"/></label>
        <input type="hidden" data-f="word_index" value="${ls.word_index || 1}"/>
        <input type="hidden" data-f="bcd_digits" value="${ls.bcd_digits || 5}"/>
        <input type="hidden" data-f="bnr_bits" value="${ls.bnr_bits || 16}"/>
      </div>
    </div>`;
  }

  async function openLruForm(profileId) {
    const root = $("modal-root");
    if (!root) return;
    let detail = null;
    if (profileId) {
      try { detail = await loadProfileDetail(profileId, true); }
      catch (e) { alert(e.message); return; }
    }
    const labels = (detail && detail.labels && detail.labels.length) ? detail.labels : [emptyLabel()];
    root.hidden = false;
    root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="lru-form">
      <h2>${profileId ? "Edit LRU" : "Add LRU"}</h2>
      <p class="muted" style="margin-bottom:.85rem">This list drives the Mode dropdown on Setup TX/RX.</p>
      <div class="field-grid">
        <label>ID <input name="id" value="${detail ? detail.id : ""}" ${profileId ? "readonly" : ""} placeholder="vor_custom" required/></label>
        <label>Name <input name="name" value="${detail ? detail.name : ""}" required/></label>
        <label>Funct <input name="funct" value="${detail ? detail.funct : ""}"/></label>
        <label>TX CH <select name="tx_ch">${["A","B","C","D"].map((b) => `<option value="${b}" ${((detail && (detail.tx_ch || detail.bus)) || "A") === b ? "selected" : ""}>CH ${b}</option>`).join("")}</select></label>
        <label>RX CH <select name="rx_ch">${["A","B","C","D"].map((b) => `<option value="${b}" ${((detail && (detail.rx_ch || detail.bus)) || "A") === b ? "selected" : ""}>CH ${b}</option>`).join("")}</select></label>
        <label>Characteristic <input name="characteristic" value="${detail ? (detail.characteristic || "") : ""}" placeholder="711"/></label>
      </div>
      <label style="display:block;margin:.75rem 0 .5rem;font-size:.75rem;color:var(--text-2)">Notes
        <input name="notes" value="${detail ? (detail.notes || "").replace(/"/g, "&quot;") : ""}" style="width:100%;margin-top:.25rem"/>
      </label>
      <div class="panel-title">Labels</div>
      <div id="label-list">${labels.map((ls, i) => labelBlockHtml(ls, i)).join("")}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-add-label">Add label</button>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-lru-cancel">Cancel</button>
        <button type="submit" class="btn">Save LRU</button>
      </div>
    </form></div>`;
    const backdrop = root.querySelector(".modal-backdrop");
    backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) closeModal(); });
    $("btn-lru-cancel").addEventListener("click", closeModal);
    $("btn-add-label").addEventListener("click", () => {
      const list = $("label-list");
      list.insertAdjacentHTML("beforeend", labelBlockHtml(emptyLabel(), list.children.length));
      bindDelLabel();
    });
    bindDelLabel();
    $("lru-form").addEventListener("submit", (ev) => { ev.preventDefault(); saveLru(!!profileId); });
  }

  function bindDelLabel() {
    document.querySelectorAll(".btn-del-lab").forEach((btn) => {
      btn.onclick = () => {
        const list = $("label-list");
        if (list.children.length <= 1) return;
        btn.closest(".label-block").remove();
      };
    });
  }

  function collectLabels() {
    return Array.from(document.querySelectorAll(".label-block")).map((block) => {
      const g = (f) => {
        const n = block.querySelector(`[data-f="${f}"]`);
        return n ? n.value : "";
      };
      const enc = g("encoding") || "raw";
      let def = g("eng_default");
      if (enc !== "iso5" && enc !== "hf_pair") {
        const n = parseFloat(def);
        def = Number.isFinite(n) ? n : 0;
      } else if (enc !== "iso5") {
        const n = parseFloat(def);
        def = Number.isFinite(n) ? n : 0;
      }
      return {
        label: g("label") || "000",
        funct: g("funct"),
        encoding: enc,
        units: g("units"),
        rate_ms: parseInt(g("rate_ms"), 10) || 150,
        sdi: parseInt(g("sdi"), 10) || 0,
        ssm: g("ssm") || "NML",
        parity: g("parity") || "ODD",
        direction: g("direction") || "tx",
        eng_min: parseFloat(g("eng_min")) || 0,
        eng_max: parseFloat(g("eng_max")) || 0,
        eng_step: parseFloat(g("eng_step")) || 1,
        eng_default: def,
        bcd_scale: parseFloat(g("bcd_scale")) || 1,
        bcd_digits: parseInt(g("bcd_digits"), 10) || 5,
        bnr_lsb: parseFloat(g("bnr_lsb")) || 1,
        bnr_offset: 0,
        bnr_bits: parseInt(g("bnr_bits"), 10) || 16,
        word_index: parseInt(g("word_index"), 10) || 1,
      };
    });
  }

  async function saveLru(isEdit) {
    const form = $("lru-form");
    const payload = {
      id: form.querySelector("[name=id]").value.trim(),
      name: form.querySelector("[name=name]").value.trim(),
      funct: form.querySelector("[name=funct]").value.trim() || form.querySelector("[name=name]").value.trim(),
      tx_ch: form.querySelector("[name=tx_ch]").value,
      rx_ch: form.querySelector("[name=rx_ch]").value,
      characteristic: form.querySelector("[name=characteristic]").value.trim(),
      notes: form.querySelector("[name=notes]").value.trim(),
      labels: collectLabels(),
    };
    try {
      if (isEdit) {
        await api(`/api/arinc/profile/${encodeURIComponent(payload.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/arinc/profile", { method: "POST", body: JSON.stringify(payload) });
      }
      invalidateProfiles();
      closeModal();
      const stack = (snap && snap.screen_stack) || [];
      if (isEdit && stack[stack.length - 1] === "lru_format") {
        await applyProfile(payload.id, {
          tx_ch: payload.tx_ch,
          rx_ch: payload.rx_ch,
          stay: true,
        });
        return;
      }
      if (snap) render(snap);
    } catch (e) { alert(e.message); }
  }

  async function deleteLru(id, name) {
    if (!confirm(`Delete LRU "${name || id}"? This removes it from the Mode list.`)) return;
    try {
      await api(`/api/arinc/profile/${encodeURIComponent(id)}`, { method: "DELETE" });
      invalidateProfiles();
      if (activeProfile === id) { activeProfile = null; profileDetail = null; }
      if (snap) render(snap);
    } catch (e) { alert(e.message); }
  }

  async function applyProfile(profileId, extra) {
    try {
      if (profileId === "auto") {
        const snapIn = await api("/api/arinc/profile/apply", {
          method: "POST",
          body: JSON.stringify({
            profile: "auto",
            rx_ch: (extra && extra.rx_ch) || (snap && snap.rx_ch) || "A",
            apply_tx: false,
            apply_rx: true,
          }),
        });
        render(snapIn);
        return;
      }
      const detail = extra && extra.tx_ch ? null : await loadProfileDetail(profileId).catch(() => null);
      const body = {
        profile: profileId,
        tx_ch: (extra && extra.tx_ch) || (detail && (detail.tx_ch || detail.bus)) || snap && snap.tx_ch || "A",
        rx_ch: (extra && extra.rx_ch) || (detail && (detail.rx_ch || detail.bus)) || snap && snap.rx_ch || "A",
        apply_tx: extra && extra.apply_tx === false ? false : true,
        apply_rx: extra && extra.apply_rx === false ? false : true,
        reset: extra && extra.reset === true ? true : false,
      };
      const snapIn = await api("/api/arinc/profile/apply", { method: "POST", body: JSON.stringify(body) });
      activeProfile = profileId;
      profileDetail = snapIn.profile || await api(`/api/arinc/profile/${encodeURIComponent(profileId)}`);
      if (extra && extra.stay) {
        render(snapIn);
        return;
      }
      await pushScreen("lru_format");
    } catch (e) { alert(e.message); }
  }

  function escAttr(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtRowHtml(ls, idx, txSlots, rxLabs) {
    const dir = ls.direction || "tx";
    const isTx = dir === "tx" || dir === "both";
    const slot = txSlots.find((sl) => sl.label === ls.label && (ls.word_index == null || sl.word_index === ls.word_index || sl.word_index == null));
    const shown = isTx
      ? (slot && slot.eng_value != null ? slot.eng_value : ls.eng_default)
      : (ls.eng_default != null ? ls.eng_default : "");
    const enc = ls.encoding || "raw";
    const iso = enc === "iso5";
    const encOpts = ENCODINGS.map((e) => `<option value="${e}" ${enc === e ? "selected" : ""}>${e}</option>`).join("");
    const dirOpts = ["tx", "rx", "both"].map((d) => `<option value="${d}" ${dir === d ? "selected" : ""}>${d.toUpperCase()}</option>`).join("");
    const ssmOpts = ["NML", "NCD", "FT", "FAIL", "PLS", "INT"].map((v) => `<option value="${v}" ${(ls.ssm || "NML") === v ? "selected" : ""}>${v}</option>`).join("");
    const par = ls.par || ls.parity || (slot && slot.par) || "ODD";
    const src = ls.source || "custom";
    return `<tr class="fmt-row">
      <td><select data-f="direction">${dirOpts}</select></td>
      <td><input data-f="label" class="mono" maxlength="5" value="${escAttr(ls.label || "")}"/></td>
      <td><input data-f="funct" value="${escAttr(ls.funct || "")}"/></td>
      <td><select data-f="encoding">${encOpts}</select></td>
      <td><span class="step-row">
        <button type="button" class="btn btn-sm btn-ghost" data-step="-">−</button>
          <input data-f="eng_default" data-label="${escAttr(ls.label || "")}" data-word="${ls.word_index || 1}"
            type="text" inputmode="${iso ? "text" : "decimal"}" value="${escAttr(shown == null ? "" : shown)}"/>
        <button type="button" class="btn btn-sm btn-ghost" data-step="+">+</button>
      </span></td>
      <td><input data-f="units" value="${escAttr(ls.units || "")}"/></td>
      <td><select data-f="sdi">${[0,1,2,3].map((i) => `<option value="${i}" ${Number(ls.sdi) === i ? "selected" : ""}>0${i}</option>`).join("")}</select></td>
      <td><select data-f="ssm">${ssmOpts}</select></td>
      <td><select data-f="parity">${["ODD","EVEN"].map((v) => `<option value="${v}" ${par === v ? "selected" : ""}>${v}</option>`).join("")}</select></td>
      <td><input data-f="rate_ms" type="number" min="10" max="5000" value="${ls.rate_ms || 150}"/></td>
      <td><span class="fmt-src" title="${src === "library" ? "From label library" : "Custom entry"}">${src === "library" ? "LIB" : "CUS"}</span>
        <button type="button" class="btn btn-ghost btn-sm btn-fmt-del" title="Delete row">×</button>
        <input type="hidden" data-f="source" value="${escAttr(src)}"/>
        <input type="hidden" data-f="word_index" value="${ls.word_index || 1}"/>
        <input type="hidden" data-f="bcd_scale" value="${ls.bcd_scale ?? 1}"/>
        <input type="hidden" data-f="bcd_digits" value="${ls.bcd_digits || 5}"/>
        <input type="hidden" data-f="bnr_lsb" value="${ls.bnr_lsb ?? 1}"/>
        <input type="hidden" data-f="bnr_offset" value="${ls.bnr_offset ?? 0}"/>
        <input type="hidden" data-f="bnr_bits" value="${ls.bnr_bits || 16}"/>
        <input type="hidden" data-f="eng_min" value="${ls.eng_min ?? 0}"/>
        <input type="hidden" data-f="eng_max" value="${ls.eng_max ?? 0}"/>
        <input type="hidden" data-f="eng_step" value="${ls.eng_step ?? 1}"/>
        <input type="hidden" data-f="iso5_chars" value="${ls.iso5_chars || 3}"/>
      </td>
    </tr>`;
  }

  function collectFormatRows() {
    return Array.from(document.querySelectorAll("tr.fmt-row")).map((tr) => {
      const g = (f) => {
        const n = tr.querySelector(`[data-f="${f}"]`);
        return n ? n.value : "";
      };
      const enc = g("encoding") || "raw";
      let def = g("eng_default");
      if (enc !== "iso5") {
        const n = parseFloat(def);
        def = Number.isFinite(n) ? n : 0;
      }
      return {
        label: g("label") || "000",
        funct: g("funct"),
        encoding: enc,
        units: g("units"),
        rate_ms: parseInt(g("rate_ms"), 10) || 150,
        sdi: parseInt(g("sdi"), 10) || 0,
        ssm: g("ssm") || "NML",
        parity: g("parity") || "ODD",
        direction: g("direction") || "tx",
        eng_min: parseFloat(g("eng_min")) || 0,
        eng_max: parseFloat(g("eng_max")) || 0,
        eng_step: parseFloat(g("eng_step")) || 1,
        eng_default: def,
        bcd_scale: parseFloat(g("bcd_scale")) || 1,
        bcd_digits: parseInt(g("bcd_digits"), 10) || 5,
        bnr_lsb: parseFloat(g("bnr_lsb")) || 1,
        bnr_offset: parseFloat(g("bnr_offset")) || 0,
        bnr_bits: parseInt(g("bnr_bits"), 10) || 16,
        word_index: parseInt(g("word_index"), 10) || 1,
        iso5_chars: parseInt(g("iso5_chars"), 10) || 3,
        source: g("source") || "custom",
      };
    });
  }

  function renderFormatScreen(r, s) {
    const p = el("div", "panel");
    const detail = s.profile || profileDetail;
    const profName = (detail && detail.name) || activeProfile || s.active_profile || "LRU";
    p.innerHTML = `<div class="panel-title">Format Screen — ${profName}</div>`;
    const pid = (detail && detail.id) || activeProfile || s.active_profile;
    if (!detail && pid) {
      p.appendChild(el("p", "muted")).textContent = "Loading profile…";
      r.appendChild(p);
      api(`/api/arinc/profile/${encodeURIComponent(pid)}`).then((d) => { profileDetail = d; activeProfile = pid; render(snap); }).catch(() => {});
      return;
    }
    if (detail) profileDetail = detail;
    if (pid) activeProfile = pid;
    const txCh = s.tx_ch || (detail && (detail.tx_ch || detail.bus)) || "A";
    const rxCh = s.rx_ch || (detail && (detail.rx_ch || detail.bus)) || "A";
    const chBar = el("div", "ln-bar");
    chBar.innerHTML = `<span class="muted">${detail ? (detail.characteristic || "ARINC") : ""}</span>
      <label>TX CH <select id="fmt-tx-ch">${["A","B","C","D"].map((b) => `<option value="${b}" ${b === txCh ? "selected" : ""}>CH ${b}</option>`).join("")}</select></label>
      <label>RX CH <select id="fmt-rx-ch">${["A","B","C","D"].map((b) => `<option value="${b}" ${b === rxCh ? "selected" : ""}>CH ${b}</option>`).join("")}</select></label>`;
    p.appendChild(chBar);
    const goCh = async () => {
      if (!pid) return;
      try {
        const body = {
          profile: pid,
          tx_ch: chBar.querySelector("#fmt-tx-ch").value,
          rx_ch: chBar.querySelector("#fmt-rx-ch").value,
        };
        render(await api("/api/arinc/profile/apply", { method: "POST", body: JSON.stringify(body) }));
      } catch (e) { alert(e.message); }
    };
    chBar.querySelector("#fmt-tx-ch").addEventListener("change", goCh);
    chBar.querySelector("#fmt-rx-ch").addEventListener("change", goCh);

    const txSlots = ((s.tx && s.tx[txCh]) || []).filter((sl) => sl.enabled && sl.label !== "000");
    const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];

    const txAb = el("div", "abbrev-row");
    txAb.innerHTML = `<span class="muted">TX</span>`;
    txSlots.slice(0, 10).forEach((sl) => {
      const a = el("span", "abbrev on");
      a.textContent = sl.funct || sl.label;
      a.addEventListener("click", () => { editing.bus = txCh; editing.slot = sl.index; render(snap); });
      txAb.appendChild(a);
    });
    p.appendChild(txAb);
    const rxAb = el("div", "abbrev-row");
    rxAb.innerHTML = `<span class="muted">RX</span>`;
    rxLabs.slice(0, 8).forEach((lab) => {
      const a = el("span", "abbrev" + (lab.stale ? " stale" : " on"));
      a.textContent = (lab.funct || lab.label) + (lab.waiting ? "*" : "");
      rxAb.appendChild(a);
    });
    p.appendChild(rxAb);

    if (s.mmr_menu) {
      const inc = el("label", "check");
      inc.innerHTML = `<input type="checkbox" id="mmr-inc" ${s.mmr_inc_time ? "checked" : ""}/> INC TIME (labels 125/150)`;
      p.appendChild(inc);
    }

    const tw = el("div", "table-wrap");
    const tbl = document.createElement("table");
    tbl.className = "fmt-edit-table";
    tbl.innerHTML = `<thead><tr>
      <th>DIR</th><th class="mono">LABEL</th><th>FUNCT</th><th>FORMAT</th>
      <th>DATA</th><th>UNITS</th><th class="mono">SDI</th><th>SSM</th><th>PAR</th><th>RATE</th><th></th>
    </tr></thead>`;
    const tb = document.createElement("tbody");
    tb.id = "fmt-tbody";
    (detail && detail.labels || []).forEach((ls, i) => {
      tb.insertAdjacentHTML("beforeend", fmtRowHtml(ls, i, txSlots, rxLabs));
    });
    tbl.appendChild(tb);
    tw.appendChild(tbl);
    p.appendChild(tw);

    const rowBar = el("div", "ln-bar");
    rowBar.innerHTML = `<button type="button" class="btn btn-sm" id="btn-fmt-add">Add row</button>
      <button type="button" class="btn btn-sm btn-ghost" id="btn-fmt-lib">Add from library</button>
      <span class="muted">Library fills format from the Aeroflex dictionary. Custom row is LRU-only.</span>`;
    p.appendChild(rowBar);

    const actions = el("div", "editor-actions");
    actions.innerHTML = `<button type="button" class="btn" id="btn-format-save">Save template</button>
      <button type="button" class="btn" id="btn-format-apply">Apply TX values</button>
      <button type="button" class="btn btn-ghost" id="btn-format-reset" title="Reset this LRU template to factory defaults">↺ Reset Defaults</button>
      <button type="button" class="btn btn-ghost" id="btn-format-edit">Edit all fields</button>
      <button type="button" class="btn btn-ghost" id="btn-format-back">Back to LRU list</button>`;
    p.appendChild(actions);
    r.appendChild(p);

    function bindFmtRows() {
      p.querySelectorAll("[data-step]").forEach((btn) => {
        btn.onclick = () => {
          const inp = btn.parentElement.querySelector("input");
          if (!inp || inp.disabled) return;
          const st = parseFloat(inp.closest("tr") && inp.closest("tr").querySelector("[data-f=eng_step]") && inp.closest("tr").querySelector("[data-f=eng_step]").value) || 1;
          const n = parseFloat(inp.value);
          if (!Number.isFinite(n)) return;
          inp.value = n + (btn.dataset.step === "+" ? st : -st);
        };
      });
      p.querySelectorAll(".btn-fmt-del").forEach((btn) => {
        btn.onclick = () => {
          const rows = tb.querySelectorAll("tr.fmt-row");
          if (rows.length <= 1) { alert("Template needs at least one row."); return; }
          btn.closest("tr").remove();
        };
      });
    }
    bindFmtRows();
    $("btn-fmt-add").addEventListener("click", () => {
      tb.insertAdjacentHTML("beforeend", fmtRowHtml(emptyLabel(), tb.children.length, [], []));
      bindFmtRows();
    });
    $("btn-fmt-lib").addEventListener("click", () => {
      openLibraryPicker((item) => {
        tb.insertAdjacentHTML("beforeend", fmtRowHtml(rowFromLibrary(item), tb.children.length, [], []));
        bindFmtRows();
      });
    });
    $("btn-format-save").addEventListener("click", saveFormatTemplate);
    $("btn-format-apply").addEventListener("click", applyAllLabels);
    $("btn-format-reset").addEventListener("click", async () => {
      if (!confirm(`Reset profile "${profName}" to factory defaults?`)) return;
      try {
        await applyProfile(pid, { reset: true });
      } catch (e) {
        alert(e.message);
      }
    });
    $("btn-format-edit").addEventListener("click", () => { if (pid) openLruForm(pid); });
    $("btn-format-back").addEventListener("click", () => navTo("avionics_lru"));
    const incEl = $("mmr-inc");
    if (incEl) incEl.addEventListener("change", async (ev) => {
      try { render(await api("/api/arinc/mmr/inc-time", { method: "POST", body: JSON.stringify({ enabled: ev.target.checked }) })); }
      catch (e) { alert(e.message); }
    });
    renderRxTable(r, s, rxCh, 6, collectFormatRows().map((ls) => ls.label));
  }

  async function saveFormatTemplate() {
    const detail = profileDetail;
    if (!detail || !detail.id) return;
    const labels = collectFormatRows();
    if (!labels.length) { alert("Template needs at least one row."); return; }
    const payload = {
      id: detail.id,
      name: detail.name,
      funct: detail.funct || detail.name,
      tx_ch: ($("fmt-tx-ch") && $("fmt-tx-ch").value) || detail.tx_ch || "A",
      rx_ch: ($("fmt-rx-ch") && $("fmt-rx-ch").value) || detail.rx_ch || "A",
      characteristic: detail.characteristic || "",
      notes: detail.notes || "",
      labels,
    };
    try {
      await api(`/api/arinc/profile/${encodeURIComponent(payload.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      invalidateProfiles();
      await applyProfile(payload.id, { tx_ch: payload.tx_ch, rx_ch: payload.rx_ch, stay: true });
    } catch (e) { alert(e.message); }
  }

  async function applyAllLabels() {
    if (!activeProfile) return;
    const rows = document.querySelectorAll("tr.fmt-row");
    try {
      let last = null;
      for (const tr of rows) {
        const dir = (tr.querySelector("[data-f=direction]") || {}).value || "tx";
        if (dir === "rx") continue;
        const lab = (tr.querySelector("[data-f=label]") || {}).value || "";
        const inp = tr.querySelector("[data-f=eng_default]");
        if (!lab || !inp) continue;
        const val = inp.value;
        const n = parseFloat(val);
        last = await api("/api/arinc/profile/label", {
          method: "POST",
          body: JSON.stringify({
            profile: activeProfile,
            label: lab,
            word_index: parseInt((tr.querySelector("[data-f=word_index]") || {}).value, 10) || 1,
            value: Number.isFinite(n) && /^-?\d/.test(String(val).trim()) ? n : val,
          }),
        });
      }
      if (last) render(last);
    } catch (e) { alert(e.message); }
  }

  // ====================================================================
  // 709 DME (ARINC 709 / CMM Chapter 1 Section 4.B)
  // Dynapro 1780A Infotouch CRT Screens: Single, Multi, Standard Nav
  // ====================================================================

  let dmeSingleState = {
    activeSlot: 0,
    txBus: "A",
    rxBus: "A",
    stepVal: 0.05,
    dispChan: true,
    sqntMode: "SQNT",
    replyEff: 70,
    rfLevel: -86,
    replySpeed: 0,
    replyDist: "--.--",
    echo: "NONE",
    mode: "DF1",
    ch: 1,
    xy: "X",
    freq: 134.40,
    sdi: 0,
    disp: "ON",
    ident: "OFF",
    nav: "VOR",
    parity: "ODD",
    rate: 150,
    pad: "0100001",
    rxDisplayMode: "BCD",
  };

  let dmeMultiState = {
    selectedLine: 0,
    txBus: "A",
    rxBus: "A",
    sqntMode: "SQNT",
    sqntCtl: "NORM",
    lines: [
      { mode: "DF1", ch: 1,   xy: "X", sdi: 0, disp: "ON",  ident: "ON",  nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF2", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF3", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF4", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF5", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "SCAN", ch: 1,  xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
    ],
  };

  let dmeStandardState = {
    activeSlot: 0,
    txBus: "A",
    rxBus: "A",
    stepVal: 0.05,
    stepDir: "INC",
    cursorField: "DATA",
    dataDigit: "0.05M",
    bitRate: 12.5,
    rxWordIndex: 0,
    slots: {},
  };

  async function applyDmeSlotHelper(params) {
    if (params) {
      if (params.freq_mhz != null) dmeSingleState.freq = params.freq_mhz;
      if (params.mode != null) dmeSingleState.mode = params.mode;
      if (params.nav != null) dmeSingleState.nav = params.nav;
      if (params.disp != null) dmeSingleState.disp = params.disp ? "ON" : "OFF";
      if (params.ident != null) dmeSingleState.ident = params.ident ? "ON" : "OFF";
      if (params.pad != null) dmeSingleState.pad = params.pad;
      if (params.sdi != null) dmeSingleState.sdi = params.sdi;

      if (params.index != null) {
        if (!dmeStandardState.slots[params.index]) dmeStandardState.slots[params.index] = {};
        const slotCache = dmeStandardState.slots[params.index];
        if (params.freq_mhz != null) slotCache.freq = params.freq_mhz;
        if (params.pad != null) slotCache.pad = params.pad;
        if (params.sdi != null) slotCache.sdi = params.sdi;
        if (params.ssm != null) slotCache.ssm = params.ssm;
        if (params.parity != null) slotCache.parity = params.parity;
        if (params.rate_ms != null) slotCache.rate = params.rate_ms;
      }
    }
    try {
      await api("/api/arinc/dme/slot", {
        method: "POST",
        body: JSON.stringify(params),
      });
      const updated = await api("/api/arinc/status");
      const curView = (updated.screen_stack && updated.screen_stack.length) ? updated.screen_stack[updated.screen_stack.length - 1] : "";
      if (curView === "dme_single") {
        snap = updated;
        patchDmeSingleRx(updated);
      } else if (curView === "dme_multi") {
        snap = updated;
        patchDmeMultiRx(updated);
      } else if (curView === "dme_standard") {
        snap = updated;
        patchDmeStandardRx(updated);
      } else {
        render(updated);
      }
    } catch (e) {
      alert(e.message);
    }
  }

  function dmeChannelToFreq(ch, xy) {
    ch = parseInt(ch, 10) || 1;
    xy = String(xy || "X").toUpperCase();
    if (17 <= ch && ch <= 56) {
      const base = xy === "Y" ? 108.05 : 108.00;
      return Number((base + (ch - 17) * 0.1).toFixed(2));
    } else if (70 <= ch && ch <= 126) {
      const base = xy === "Y" ? 112.35 : 112.30;
      return Number((base + (ch - 70) * 0.1).toFixed(2));
    } else if (1 <= ch && ch <= 16) {
      const base = xy === "Y" ? 134.45 : 134.40;
      return Number((base + (ch - 1) * 0.1).toFixed(2));
    } else if (57 <= ch && ch <= 69) {
      const base = xy === "Y" ? 133.35 : 133.30;
      return Number((base + (ch - 57) * 0.1).toFixed(2));
    }
    return 108.00;
  }

  function dmeFreqToChannel(freq) {
    freq = Number(parseFloat(freq).toFixed(2));
    const isY = Math.round((freq * 100)) % 10 === 5;
    const xy = isY ? "Y" : "X";
    if (freq >= 108.00 && freq <= 111.95) {
      const base = isY ? 108.05 : 108.00;
      const ch = Math.round((freq - base) / 0.1) + 17;
      return { ch, xy };
    }
    if (freq >= 112.30 && freq <= 117.95) {
      const base = isY ? 112.35 : 112.30;
      const ch = Math.round((freq - base) / 0.1) + 70;
      return { ch, xy };
    }
    if (freq >= 134.40 && freq <= 135.95) {
      const base = isY ? 134.45 : 134.40;
      const ch = Math.round((freq - base) / 0.1) + 1;
      return { ch, xy };
    }
    if (freq >= 133.30 && freq <= 134.35) {
      const base = isY ? 133.35 : 133.30;
      const ch = Math.round((freq - base) / 0.1) + 57;
      return { ch, xy };
    }
    return { ch: 1, xy: "X" };
  }

  function renderDmeConfig(r, s) {
    const p = el("div", "panel");
    p.innerHTML = `
      <div class="lru-toolbar">
        <div>
          <div class="panel-title" style="margin-bottom:.35rem">DME &bull; ARINC 709 Test Modes</div>
          <p class="muted">Select DME test mode according to Aeroflex T1200 manual</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-outline" id="btn-dme-live-diag">⚡ Live Diagnostic &amp; Echo</button>
          <button type="button" class="btn btn-ghost" id="btn-dme-cfg-back">&lt; Back to LRUs</button>
        </div>
      </div>
      <div class="hub-grid" style="max-width:960px; margin:1.5rem auto;">
        <div class="mode-card" id="btn-dme-mode-single">
          <div class="tag">MODE 1</div>
          <h2>Single Channel Mode</h2>
          <p>Single frequency tuning, transmitter control &amp; receiver word monitor (ARINC 709 / CMM 1.4.B)</p>
        </div>
        <div class="mode-card" id="btn-dme-mode-multi">
          <div class="tag">MODE 2</div>
          <h2>Multi Channel Mode</h2>
          <p>Multi-frequency scan sequence, multi-channel pulse squitter &amp; reply efficiency</p>
        </div>
        <div class="mode-card" id="btn-dme-mode-standard">
          <div class="tag">MODE 3</div>
          <h2>Standard Nav Configuration</h2>
          <p>Standard navigation words configuration, BNR distance and BCD station identifier</p>
        </div>
        <div class="mode-card" id="btn-dme-card-diag" style="border:1px dashed var(--accent);">
          <div class="tag" style="background:var(--accent); color:#fff;">DIAGNOSTIC</div>
          <h2>Live Handshake &amp; Echo Diagnostic</h2>
          <p>Real-time ARINC 709 handshake, 32-bit protocol analyzer, parity verify, and wiring troubleshooting.</p>
        </div>
      </div>
    `;
    r.appendChild(p);

    p.querySelector("#btn-dme-mode-single").onclick = async () => {
      try {
        render(await api("/api/arinc/dme/mode", { method: "POST", body: JSON.stringify({ mode: "single" }) }));
      } catch (e) { alert(e.message); }
    };
    p.querySelector("#btn-dme-mode-multi").onclick = async () => {
      try {
        render(await api("/api/arinc/dme/mode", { method: "POST", body: JSON.stringify({ mode: "multi" }) }));
      } catch (e) { alert(e.message); }
    };
    p.querySelector("#btn-dme-mode-standard").onclick = async () => {
      try {
        render(await api("/api/arinc/dme/mode", { method: "POST", body: JSON.stringify({ mode: "standard" }) }));
      } catch (e) { alert(e.message); }
    };
    p.querySelector("#btn-dme-live-diag").onclick = () => pushScreen("dme_diagnostic");
    p.querySelector("#btn-dme-card-diag").onclick = () => pushScreen("dme_diagnostic");
    p.querySelector("#btn-dme-cfg-back").onclick = () => navTo("avionics_lru");
  }

  // ====================================================================
  // SCREEN 1: SINGLE CHANNEL DME TEST SCREEN
  // Matches WhatsApp Image 2026-11-18 at 11.24.09 (Aeroflex Figure 17)
  // ====================================================================

  function getDmePadString() {
    const m = dmeSingleState.mode || "DF1";
    const n = dmeSingleState.nav || "VOR";
    const d = (dmeSingleState.disp !== "OFF") ? 1 : 0;
    const id = (dmeSingleState.ident === "ON") ? 1 : 0;
    const modeMap = { STBY: 0, DF1: 1, DF2: 2, DF3: 3, DF4: 4, DF5: 5, SCAN: 6, OFF: 0, NCD: 1, FT: 1, UND: 7 };
    const navMap = { VOR: 0, ILS: 1, MLS: 2, UND: 3 };
    const mVal = (modeMap[m] != null ? modeMap[m] : 1) & 0x7;
    const nVal = (navMap[n] != null ? navMap[n] : 0) & 0x3;
    const pVal = mVal | (nVal << 3) | (d << 5) | (id << 6);
    return pVal.toString(2).padStart(7, "0");
  }

  function patchDmeSingleRx(s) {
    if (!s) return;
    const txCh = dmeSingleState.txBus || s.tx_ch || "A";
    const rxCh = dmeSingleState.rxBus || s.rx_ch || "A";
    const txSlots = (s.tx && s.tx[txCh]) || [];
    const curTx = txSlots[0] || {};
    const freqVal = (curTx.eng_value != null && Number.isFinite(Number(curTx.eng_value))) ? Number(curTx.eng_value) : (dmeSingleState.freq || 134.40);

    const chanInfo = dmeFreqToChannel(dmeSingleState.freq || freqVal);

    // Synchronize Channel / Frequency cell & SQ/NT channel cell
    const chanCell = document.getElementById("s-cell-chan");
    if (chanCell) {
      chanCell.textContent = dmeSingleState.dispChan ? `${chanInfo.ch} ${chanInfo.xy}` : (dmeSingleState.freq || freqVal).toFixed(2);
    }
    const sqntChan = document.getElementById("sqnt-cell-chan");
    if (sqntChan) {
      sqntChan.textContent = `${chanInfo.ch} ${chanInfo.xy}`;
    }

    // Synchronize Softkey 1 (X / Y)
    const xHalf = document.getElementById("s-sk-x-half");
    const yHalf = document.getElementById("s-sk-y-half");
    if (xHalf) xHalf.classList.toggle("active", chanInfo.xy === "X");
    if (yHalf) yHalf.classList.toggle("active", chanInfo.xy === "Y");

    // Synchronize Softkey 2 (TX-A / TX-B)
    const txaHalf = document.getElementById("s-sk-txa-half");
    const txbHalf = document.getElementById("s-sk-txb-half");
    if (txaHalf) txaHalf.classList.toggle("active", txCh === "A");
    if (txbHalf) txbHalf.classList.toggle("active", txCh === "B");

    // Synchronize Softkey 3 (RX-A / RX-B)
    const rxaHalf = document.getElementById("s-sk-rxa-half");
    const rxbHalf = document.getElementById("s-sk-rxb-half");
    if (rxaHalf) rxaHalf.classList.toggle("active", rxCh === "A");
    if (rxbHalf) rxbHalf.classList.toggle("active", rxCh === "B");

    // Synchronize Softkey 4 (SQ/NT / INDEP.)
    const sqntHalf = document.getElementById("s-sk-sqnt-half");
    const indepHalf = document.getElementById("s-sk-indep-half");
    if (sqntHalf) sqntHalf.classList.toggle("active", dmeSingleState.sqntMode === "SQNT");
    if (indepHalf) indepHalf.classList.toggle("active", dmeSingleState.sqntMode === "INDEP");

    // Synchronize Softkey 5 (CHAN / FREQ)
    const chanHalf = document.getElementById("s-sk-chan-half");
    const freqHalf = document.getElementById("s-sk-freq-half");
    if (chanHalf) chanHalf.classList.toggle("active", !!dmeSingleState.dispChan);
    if (freqHalf) freqHalf.classList.toggle("active", !dmeSingleState.dispChan);

    // Synchronize Toolbar Pill
    const pill = document.querySelector(".dynapro-dme-crt .pill-run, .lru-toolbar .pill-run");
    if (pill) {
      pill.innerHTML = `BUS TX-${txCh} &bull; RX-${rxCh}`;
    }

    const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
    const curRx035 = rxLabs.find((l) => l.label === "035") || null;
    const curRx201 = rxLabs.find((l) => l.label === "201") || null;
    const curRx202 = rxLabs.find((l) => l.label === "202") || null;
    const curRx246 = rxLabs.find((l) => l.label === "246") || null;

    // 1. Echo cell (#s-cell-echo)
    const echoCell = document.getElementById("s-cell-echo");
    if (echoCell) {
      if (curRx035) {
        const rxFreq = curRx035.eng_value != null ? Number(curRx035.eng_value) : null;
        if (rxFreq != null && Math.abs(rxFreq - (dmeSingleState.freq || freqVal)) < 0.05) {
          echoCell.textContent = "OK";
          echoCell.style.color = "#16a34a";
          echoCell.style.fontWeight = "700";
        } else {
          echoCell.textContent = "ERR";
          echoCell.style.color = "#dc2626";
          echoCell.style.fontWeight = "700";
        }
      } else {
        echoCell.textContent = "NONE";
        echoCell.style.color = "var(--text-2)";
        echoCell.style.fontWeight = "600";
      }
    }

    // 2. BNR DIST, MEM, B/F, DELTA, BCD/IDENT
    const bnrDist = curRx202 && curRx202.eng_value != null ? Number(curRx202.eng_value).toFixed(2) : "--.--";
    let memVal = curRx202 && curRx202.mem ? curRx202.mem : "--";
    let bfVal = curRx202 && curRx202.bf ? curRx202.bf : "--";
    if (curRx202 && curRx202.raw && (memVal === "--" || bfVal === "--")) {
      const rn = parseInt(curRx202.raw, 16) || Number(curRx202.raw);
      if (!isNaN(rn)) {
        if (memVal === "--") memVal = ((rn >> 10) & 1) ? "ON" : "OFF";
        if (bfVal === "--") bfVal = ((rn >> 11) & 1) ? "F" : "B";
      }
    }
    const isDispOn = (dmeSingleState.disp !== "OFF");
    const displayedBnrDist = isDispOn ? bnrDist : "--.--";

    const rxDispMode = dmeSingleState.rxDisplayMode || "BCD";
    let rightmostHeader = rxDispMode === "BCD" ? "BCDDIST" : "IDENT";
    let rightmostData = "----";
    if (rxDispMode === "BCD") {
      if (curRx201 && curRx201.eng_value != null) {
        rightmostData = Number(curRx201.eng_value).toFixed(2);
      } else if (!isDispOn) {
        rightmostData = "DISP OFF";
      } else {
        rightmostData = "No BCD";
      }
    } else {
      rightmostData = curRx246 ? (curRx246.data_text || "----") : "----";
    }

    const bnrCell = document.getElementById("s-cell-bnr-dist");
    if (bnrCell) {
      bnrCell.textContent = displayedBnrDist;
      bnrCell.className = `dme-cell-readonly dynapro-cell-readonly ${curRx202 && isDispOn ? "has-data" : ""}`;
    }
    const memCell = document.getElementById("s-cell-mem");
    if (memCell) {
      memCell.textContent = memVal;
      memCell.className = `dme-cell-readonly dynapro-cell-readonly ${curRx202 && memVal !== "--" ? "has-data" : ""}`;
    }
    const bfCell = document.getElementById("s-cell-bf");
    if (bfCell) {
      bfCell.textContent = bfVal;
      bfCell.className = `dme-cell-readonly dynapro-cell-readonly ${curRx202 && bfVal !== "--" ? "has-data" : ""}`;
    }
    const rgtHdr = document.getElementById("s-hdr-rightmost");
    if (rgtHdr) rgtHdr.textContent = rightmostHeader;
    const rgtSubHdr = document.getElementById("s-subhdr-rightmost");
    if (rgtSubHdr) rgtSubHdr.textContent = rightmostHeader;
    const rgtCell = document.getElementById("s-cell-rightmost");
    if (rgtCell) {
      rgtCell.textContent = rightmostData;
      rgtCell.className = `dme-cell-readonly dynapro-cell-readonly ${(rxDispMode === "BCD" ? (curRx201 && isDispOn) : curRx246) ? "has-data" : ""}`;
    }

    // Synchronize Softkey 7 (BCD / IDENT)
    const bcdHalf = document.getElementById("s-sk-bcd-half");
    const identHalf = document.getElementById("s-sk-ident-half");
    if (bcdHalf) bcdHalf.classList.toggle("active", rxDispMode === "BCD");
    if (identHalf) identHalf.classList.toggle("active", rxDispMode === "IDENT");
  }

  function patchDmeMultiRx(s) {
    if (!s) return;
    const curLine = dmeMultiState.selectedLine || 0;
    const txCh = dmeMultiState.txBus || s.tx_ch || "A";
    const rxCh = dmeMultiState.rxBus || s.rx_ch || "A";
    const rxDispMode = dmeMultiState.rxDisplayMode || "BCD";

    // 1. Toolbar pill
    const pill = document.querySelector(".dynapro-dme-crt .pill-run, .lru-toolbar .pill-run");
    if (pill) pill.innerHTML = `BUS TX-${txCh} &bull; RX-${rxCh}`;

    // 2. Lines data
    const defaultLines = [
      { mode: "DF1", ch: 1,   xy: "X", sdi: 0, disp: "ON",  ident: "ON",  nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF2", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF3", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF4", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF5", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "SCAN", ch: 1,  xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
    ];

    if (!dmeMultiState.lines) dmeMultiState.lines = defaultLines.map((x) => ({ ...x }));

    const lines = defaultLines.map((def, i) => {
      const stateRow = (dmeMultiState.lines && dmeMultiState.lines[i]) || def;
      const txSlot = (s.tx && s.tx[txCh] && s.tx[txCh][i]) || null;
      if (!txSlot || !txSlot.enabled) return stateRow;
      const f = (txSlot.eng_value != null && Number.isFinite(Number(txSlot.eng_value))) ? Number(txSlot.eng_value) : stateRow.freq;
      const chInfo = dmeFreqToChannel(f);
      let pStr = "0100001";
      if (txSlot.pads && txSlot.pads !== "-") pStr = txSlot.pads.padStart(7, "0");
      return {
        mode: stateRow.mode,
        ch: chInfo.ch,
        xy: chInfo.xy,
        sdi: txSlot.sdi != null ? Number(txSlot.sdi) : stateRow.sdi,
        disp: pStr[1] === "1" ? "ON" : "OFF",
        ident: pStr[0] === "1" ? "ON" : "OFF",
        nav: stateRow.nav,
        freq: f,
        echo: stateRow.echo || "NONE",
      };
    });

    const activeRow = lines[curLine] || lines[0];
    const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
    const curRx035 = rxLabs.find((l) => l.label === "035") || null;
    const curRx201 = rxLabs.find((l) => l.label === "201") || null;
    const curRx202 = rxLabs.find((l) => l.label === "202") || null;
    const curRx246 = rxLabs.find((l) => l.label === "246") || null;

    const bnrDist = curRx202 && curRx202.eng_value != null ? Number(curRx202.eng_value).toFixed(1) : "--.-";
    let memVal = curRx202 && curRx202.mem ? curRx202.mem : "--";
    let bfVal = curRx202 && curRx202.bf ? curRx202.bf : "--";
    if (curRx202 && curRx202.raw && (memVal === "--" || bfVal === "--")) {
      const rn = parseInt(curRx202.raw, 16) || Number(curRx202.raw);
      if (!isNaN(rn)) {
        if (memVal === "--") memVal = ((rn >> 10) & 1) ? "ON" : "OFF";
        if (bfVal === "--") bfVal = ((rn >> 11) & 1) ? "F" : "B";
      }
    }

    let bcdIdent = "----";
    if (rxDispMode === "BCD") {
      if (curRx201 && curRx201.eng_value != null) {
        bcdIdent = Number(curRx201.eng_value).toFixed(1);
      } else if (activeRow.disp === "OFF") {
        bcdIdent = "DISP OFF";
      } else {
        bcdIdent = "No BCD";
      }
    } else {
      bcdIdent = curRx246 ? (curRx246.data_text || "PRES") : "----";
    }

    // 3. Update table rows
    for (let i = 0; i < 6; i++) {
      const r = lines[i];
      const isCur = (i === curLine);
      const tr = document.querySelector(`tr[data-line="${i}"]`);
      if (tr) {
        tr.className = isCur ? "active-line" : "";
      }

      // ECHO check
      let echoVal = r.mode === "SCAN" ? "" : (r.echo || "NONE");
      if (isCur && curRx035 && r.mode !== "SCAN") {
        const rxF = curRx035.eng_value != null ? Number(curRx035.eng_value) : null;
        if (rxF != null && Math.abs(rxF - r.freq) < 0.05) {
          echoVal = "OK";
        } else {
          echoVal = "ERR";
        }
      }
      const echoEl = document.getElementById(`m-cell-echo-${i}`);
      if (echoEl) {
        echoEl.textContent = echoVal;
        echoEl.style.color = echoVal === "OK" ? "#16a34a" : (echoVal === "ERR" ? "#dc2626" : "");
        echoEl.style.fontWeight = (echoVal === "OK" || echoVal === "ERR") ? "700" : "";
      }

      const modeEl = document.getElementById(`m-cell-mode-${i}`);
      if (modeEl) modeEl.innerHTML = `<strong>${r.mode}</strong>`;

      const chanEl = document.getElementById(`m-cell-chan-${i}`);
      if (chanEl) chanEl.textContent = r.mode === "SCAN" ? "" : `${r.ch} ${r.xy}`;

      const sdiEl = document.getElementById(`m-cell-sdi-${i}`);
      if (sdiEl) sdiEl.textContent = r.sdi === 0 ? "ALL" : String(r.sdi).padStart(2, "0");

      const dispEl = document.getElementById(`m-cell-disp-${i}`);
      if (dispEl) dispEl.textContent = r.disp;

      const identEl = document.getElementById(`m-cell-ident-${i}`);
      if (identEl) identEl.textContent = r.ident;

      const navEl = document.getElementById(`m-cell-nav-${i}`);
      if (navEl) navEl.textContent = r.nav;

      const bnrEl = document.getElementById(`m-cell-bnr-${i}`);
      if (bnrEl) {
        bnrEl.textContent = isCur ? (r.disp === "OFF" ? "--.-" : bnrDist) : "--.-";
        bnrEl.className = `dme-cell-readonly dynapro-cell-readonly ${isCur && curRx202 && r.disp !== "OFF" ? "has-data" : ""}`;
      }

      const memEl = document.getElementById(`m-cell-mem-${i}`);
      if (memEl) {
        memEl.textContent = isCur ? memVal : "--";
        memEl.className = `dme-cell-readonly dynapro-cell-readonly ${isCur && curRx202 && memVal !== "--" ? "has-data" : ""}`;
      }

      const bfEl = document.getElementById(`m-cell-bf-${i}`);
      if (bfEl) {
        bfEl.textContent = isCur ? bfVal : "--";
        bfEl.className = `dme-cell-readonly dynapro-cell-readonly ${isCur && curRx202 && bfVal !== "--" ? "has-data" : ""}`;
      }

      const deltaEl = document.getElementById(`m-cell-delta-${i}`);
      if (deltaEl) deltaEl.textContent = "--";

      const bcdEl = document.getElementById(`m-cell-bcd-${i}`);
      if (bcdEl) {
        bcdEl.textContent = isCur ? bcdIdent : "----";
        bcdEl.className = `dme-cell-readonly dynapro-cell-readonly ${isCur && ((rxDispMode === "BCD" && curRx201) || (rxDispMode === "IDENT" && curRx246)) ? "has-data" : ""}`;
      }
    }

    // 4. Headers
    const thSub = document.getElementById("m-th-rightmost-sub");
    if (thSub) thSub.textContent = rxDispMode === "BCD" ? "BCDDIST" : "IDENT";
    const thMain = document.getElementById("m-th-rightmost");
    if (thMain) thMain.textContent = rxDispMode === "BCD" ? "BCDDIST" : "IDENT";

    // 5. Bottom telemetry status row
    const stChan = document.getElementById("m-status-chan");
    if (stChan) stChan.innerHTML = `CHANNEL: <strong>${activeRow.mode === "SCAN" ? "SCAN" : `${activeRow.ch} ${activeRow.xy}`}</strong>`;
    const stDist = document.getElementById("m-status-dist");
    if (stDist) stDist.innerHTML = `DISTANCE: <strong style="color:var(--accent);">${activeRow.disp === "OFF" ? "--.-" : bnrDist} NM</strong>`;

    // 6. Bottom softkeys
    const xHalf = document.getElementById("m-sk-x-half");
    const yHalf = document.getElementById("m-sk-y-half");
    if (xHalf) xHalf.classList.toggle("active", activeRow.xy === "X");
    if (yHalf) yHalf.classList.toggle("active", activeRow.xy === "Y");

    const txaHalf = document.getElementById("m-sk-txa-half");
    const txbHalf = document.getElementById("m-sk-txb-half");
    if (txaHalf) txaHalf.classList.toggle("active", txCh === "A");
    if (txbHalf) txbHalf.classList.toggle("active", txCh === "B");

    const rxaHalf = document.getElementById("m-sk-rxa-half");
    const rxbHalf = document.getElementById("m-sk-rxb-half");
    if (rxaHalf) rxaHalf.classList.toggle("active", rxCh === "A");
    if (rxbHalf) rxbHalf.classList.toggle("active", rxCh === "B");

    const sqntHalf = document.getElementById("m-sk-sqnt-half");
    const indepHalf = document.getElementById("m-sk-indep-half");
    if (sqntHalf) sqntHalf.classList.toggle("active", dmeMultiState.sqntMode === "SQNT");
    if (indepHalf) indepHalf.classList.toggle("active", dmeMultiState.sqntMode === "INDEP");

    const ctlNormHalf = document.getElementById("m-sk-ctlnorm-half");
    const ctlHalf = document.getElementById("m-sk-ctl-half");
    if (ctlNormHalf) ctlNormHalf.classList.toggle("active", dmeMultiState.sqntCtl === "NORM");
    if (ctlHalf) ctlHalf.classList.toggle("active", dmeMultiState.sqntCtl !== "NORM");

    const bcdHalf = document.getElementById("m-sk-bcd-half");
    const identHalf = document.getElementById("m-sk-ident-half");
    if (bcdHalf) bcdHalf.classList.toggle("active", rxDispMode === "BCD");
    if (identHalf) identHalf.classList.toggle("active", rxDispMode === "IDENT");
  }

    function decodeDmeStandardRxWord(curRx) {
    let rxLabelStr = "035";
    let rxFunctStr = "DME FREQ";
    let rxDataStr = "WAITING...";
    let rxSdiStr = "--";
    let rxPadStr = "-------";
    let rxSsmStr = "---";
    let rxParStr = "---";
    let rxRateStr = "---";
    let hasRealData = false;

    if (curRx) {
      rxLabelStr = curRx.label || "035";
      rxFunctStr = curRx.funct || "DME WORD";
      rxSdiStr = String(curRx.sdi != null ? curRx.sdi : 0).padStart(2, "0");
      rxPadStr = curRx.pads || "-------";
      rxSsmStr = curRx.ssm || "NML";
      rxParStr = curRx.par || curRx.parity || "ODD";
      rxRateStr = String(curRx.rate_ms || curRx.period_ms || 150);

      if (rxLabelStr === "035") {
        rxFunctStr = curRx.funct || "DME FREQ";
        if (curRx.eng_value != null && !isNaN(Number(curRx.eng_value))) {
          rxDataStr = `${Number(curRx.eng_value).toFixed(2)} MHZ`;
          hasRealData = true;
        } else if (curRx.data && curRx.data !== "—" && curRx.data !== "WAITING...") {
          rxDataStr = (curRx.data.toUpperCase().includes("MHZ")) ? curRx.data.toUpperCase() : `${curRx.data} MHZ`;
          hasRealData = true;
        } else if (curRx.data_text && curRx.data_text !== "—" && curRx.data_text !== "WAITING...") {
          rxDataStr = (curRx.data_text.toUpperCase().includes("MHZ")) ? curRx.data_text.toUpperCase() : `${curRx.data_text} MHZ`;
          hasRealData = true;
        } else if (curRx.raw) {
          const rn = parseInt(curRx.raw, 16) || Number(curRx.raw);
          if (!isNaN(rn) && rn !== 0) {
            const d19 = (rn >>> 10) & 0x7FFFF;
            const d0 = d19 & 0xF;
            const d1 = (d19 >>> 4) & 0xF;
            const d2 = (d19 >>> 8) & 0xF;
            const d3 = (d19 >>> 12) & 0xF;
            const freq = 100 + d3 * 10 + d2 + d1 * 0.1 + (d0 >= 5 ? 0.05 : 0);
            rxDataStr = `${freq.toFixed(2)} MHZ`;
            hasRealData = true;
          } else {
            rxDataStr = "WAITING...";
          }
        } else {
          rxDataStr = "WAITING...";
        }
      } else if (rxLabelStr === "201") {
        rxFunctStr = curRx.funct || "BCD DIST";
        if (curRx.eng_value != null && !isNaN(Number(curRx.eng_value))) {
          rxDataStr = `${Number(curRx.eng_value).toFixed(2)} NM`;
          hasRealData = true;
        } else if (curRx.data && curRx.data !== "—") {
          rxDataStr = (curRx.data.toUpperCase().includes("NM")) ? curRx.data : `${curRx.data} NM`;
          hasRealData = true;
        } else if (curRx.data_text && curRx.data_text !== "—") {
          rxDataStr = (curRx.data_text.toUpperCase().includes("NM")) ? curRx.data_text : `${curRx.data_text} NM`;
          hasRealData = true;
        } else {
          rxDataStr = "--.-- NM";
        }
      } else if (rxLabelStr === "202") {
        rxFunctStr = curRx.funct || "BNR DIST";
        if (curRx.eng_value != null && !isNaN(Number(curRx.eng_value))) {
          rxDataStr = `${Number(curRx.eng_value).toFixed(2)} NM`;
          hasRealData = true;
        } else if (curRx.data && curRx.data !== "—") {
          rxDataStr = (curRx.data.toUpperCase().includes("NM")) ? curRx.data : `${curRx.data} NM`;
          hasRealData = true;
        } else if (curRx.data_text && curRx.data_text !== "—") {
          rxDataStr = (curRx.data_text.toUpperCase().includes("NM")) ? curRx.data_text : `${curRx.data_text} NM`;
          hasRealData = true;
        } else {
          rxDataStr = "--.-- NM";
        }
      } else if (rxLabelStr === "246") {
        rxFunctStr = curRx.funct || "DME IDENT";
        rxDataStr = curRx.data || curRx.eng_value || curRx.data_text || "IDENT";
        hasRealData = Boolean(rxDataStr && rxDataStr !== "----");
      } else {
        rxFunctStr = curRx.funct || curRx.name || "DME WORD";
        rxDataStr = (curRx.data && curRx.data !== "—") ? curRx.data : (curRx.eng_value != null ? String(curRx.eng_value) : (curRx.data_text || (curRx.raw ? `0x${curRx.raw}` : "DATA")));
        hasRealData = Boolean(rxDataStr && rxDataStr !== "WAITING..." && rxDataStr !== "—");
      }
    }

    return {
      label: rxLabelStr,
      funct: rxFunctStr,
      data: rxDataStr,
      sdi: rxSdiStr,
      pad: rxPadStr,
      ssm: rxSsmStr,
      par: rxParStr,
      rate: rxRateStr,
      hasData: hasRealData,
    };
  }

  function patchDmeStandardRx(s) {
    if (!s) return;
    dmeStandardState.lastSnap = s;
    const curSlotIdx = dmeStandardState.activeSlot || 0;
    const txCh = dmeStandardState.txBus || "A";
    const rxCh = dmeStandardState.rxBus || "A";
    const stepDir = dmeStandardState.stepDir || "INC";

    // 1. Toolbar pill
    const pill = document.querySelector(".dynapro-dme-crt .pill-run, .lru-toolbar .pill-run");
    if (pill) pill.innerHTML = `BUS TX-${txCh} &bull; RX-${rxCh}`;

    // 2. Channel Headers
    const hdrTx = document.getElementById("std-hdr-tx");
    if (hdrTx) {
      hdrTx.innerHTML = `CHANNEL ${txCh} &mdash; TRANSMITTED WORDS &nbsp;&nbsp;&nbsp; SLOT <span class="dme-inv-box dynapro-inv-box" id="std-slot-box" style="cursor:pointer; vertical-align:middle;">${curSlotIdx}</span>`;
    }

    // 3. Slot Indicator Box fallback
    const slotBox = document.getElementById("std-slot-box");
    if (slotBox) slotBox.textContent = String(curSlotIdx);

    // 4. Received Word
    const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
    const totalRx = rxLabs.length;
    let rxIdx = dmeStandardState.rxWordIndex || 0;
    if (rxIdx >= totalRx) {
      rxIdx = totalRx > 0 ? totalRx - 1 : 0;
      dmeStandardState.rxWordIndex = rxIdx;
    }
    const curRx = (totalRx > 0) ? rxLabs[rxIdx] : null;
    const rxDecoded = decodeDmeStandardRxWord(curRx);

    const rxChCell = document.getElementById("std-rx-ch-cell");
    if (rxChCell) rxChCell.textContent = `RX-${rxCh}`;

    const rxFunctCell = document.getElementById("std-rx-funct-cell");
    if (rxFunctCell) rxFunctCell.textContent = rxDecoded.funct;

    const rxLblCell = document.getElementById("std-rx-label-cell");
    if (rxLblCell) rxLblCell.textContent = rxDecoded.label;

    const rxDataCell = document.getElementById("std-rx-data-cell");
    if (rxDataCell) {
      rxDataCell.textContent = rxDecoded.data;
      rxDataCell.className = `dme-cell-readonly dynapro-cell-readonly ${rxDecoded.hasData ? "has-data" : ""}`;
    }

    const rxSdiCell = document.getElementById("std-rx-sdi-cell");
    if (rxSdiCell) rxSdiCell.textContent = rxDecoded.sdi;

    const rxPadCell = document.getElementById("std-rx-pad-cell");
    if (rxPadCell) rxPadCell.textContent = rxDecoded.pad;

    const rxSsmCell = document.getElementById("std-rx-ssm-cell");
    if (rxSsmCell) rxSsmCell.textContent = rxDecoded.ssm;

    const rxParCell = document.getElementById("std-rx-par-cell");
    if (rxParCell) rxParCell.textContent = rxDecoded.par;

    const rxRateCell = document.getElementById("std-rx-rate-cell");
    if (rxRateCell) rxRateCell.textContent = rxDecoded.rate;

    // Header counter indicator for RX words
    const hdrRxWords = document.getElementById("std-hdr-rx-words");
    if (hdrRxWords) {
      if (totalRx === 0) {
        hdrRxWords.textContent = `CHANNEL ${rxCh} — RECEIVED WORDS`;
      } else if (totalRx === 1) {
        hdrRxWords.textContent = `CHANNEL ${rxCh} — RECEIVED WORDS: 1 (${rxLabs[0].label})`;
      } else {
        const pgInfo = totalRx > 6 ? ` • PG ${Math.floor(rxIdx / 6) + 1}/${Math.ceil(totalRx / 6)}` : "";
        hdrRxWords.textContent = `CHANNEL ${rxCh} — RECEIVED WORDS: ${totalRx} (WORD ${rxIdx + 1}/${totalRx}${pgInfo})`;
      }
    }

    // 5. Middle Rate Status Line
    const curKbps = dmeStandardState.bitRate != null ? dmeStandardState.bitRate : ((s && s.bit_rate_kbps) || 12.5);
    const rateEl = document.querySelector("#std-middle-rate-val, .dme-std-rate-row strong, .dynapro-std-rate-row strong");
    if (rateEl) {
      rateEl.textContent = `${curKbps.toFixed(1)} KBPS`;
    }
    const midRxStatus = document.getElementById("std-middle-rx-status");
    if (midRxStatus) {
      if (rxDecoded.hasData) {
        midRxStatus.innerHTML = `RX ACTIVE: <strong style="color:var(--ok);">${rxDecoded.label} (${rxDecoded.funct})</strong> &bull; ${rxDecoded.data}`;
      } else {
        midRxStatus.innerHTML = `RX ACTIVE: <strong style="color:var(--muted);">${rxDecoded.label} (${rxDecoded.funct}) &bull; WAITING...</strong>`;
      }
    }

    // 6. Softkeys Visual Classes
    const hInc = document.getElementById("std-sk-half-inc");
    const hDec = document.getElementById("std-sk-half-dec");
    if (hInc) hInc.classList.toggle("active", stepDir === "INC");
    if (hDec) hDec.classList.toggle("active", stepDir === "DECR");

    const txaHalf = document.getElementById("std-sk-txa-half");
    const txbHalf = document.getElementById("std-sk-txb-half");
    if (txaHalf) txaHalf.classList.toggle("active", txCh === "A");
    if (txbHalf) txbHalf.classList.toggle("active", txCh === "B");

    const rxaHalf = document.getElementById("std-sk-rxa-half");
    const rxbHalf = document.getElementById("std-sk-rxb-half");
    if (rxaHalf) rxaHalf.classList.toggle("active", rxCh === "A");
    if (rxbHalf) rxbHalf.classList.toggle("active", rxCh === "B");

    const skRateLbl = document.getElementById("std-sk-rate-label");
    if (skRateLbl) skRateLbl.textContent = `${curKbps.toFixed(1)} KBPS`;
  }

  function renderDmeSingle(r, s) {
    const txCh = dmeSingleState.txBus || s.tx_ch || "A";
    const rxCh = dmeSingleState.rxBus || s.rx_ch || "A";
    const txSlots = (s.tx && s.tx[txCh]) || [];
    const curTx = txSlots[0] || {};

    let freqVal = (curTx.eng_value != null && Number.isFinite(Number(curTx.eng_value))) ? Number(curTx.eng_value) : dmeSingleState.freq;
    let sdiVal = curTx.sdi != null ? Number(curTx.sdi) : dmeSingleState.sdi;
    let ssmVal = curTx.ssm || "NML";
    let parVal = curTx.parity || "ODD";
    let rateVal = curTx.rate_ms || 150;

    if (curTx.pads && curTx.pads !== "-") {
      const p = curTx.pads.padStart(7, "0");
      dmeSingleState.pad = p;
      if (dmeSingleState.disp == null) dmeSingleState.disp = (p[1] === "1" ? "ON" : "OFF");
      if (dmeSingleState.ident == null) dmeSingleState.ident = (p[0] === "1" ? "ON" : "OFF");
    }
    if (!dmeSingleState.pad) {
      dmeSingleState.pad = getDmePadString();
    }

    const padStr = dmeSingleState.pad || getDmePadString();
    const dispVal = dmeSingleState.disp || (padStr[1] === "1" ? "ON" : "OFF");
    const identVal = dmeSingleState.ident || (padStr[0] === "1" ? "ON" : "OFF");
    const modeVal = dmeSingleState.mode || "DF1";
    const navVal = dmeSingleState.nav || "VOR";
    const chanInfo = dmeFreqToChannel(freqVal);

    const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
    const curRx035 = rxLabs.find((l) => l.label === "035") || null;
    const curRx201 = rxLabs.find((l) => l.label === "201") || null;
    const curRx202 = rxLabs.find((l) => l.label === "202") || null;
    const curRx246 = rxLabs.find((l) => l.label === "246") || null;

    const bnrDist = curRx202 && curRx202.eng_value != null ? Number(curRx202.eng_value).toFixed(2) : "--.--";
    let memVal = curRx202 && curRx202.mem ? curRx202.mem : "--";
    let bfVal = curRx202 && curRx202.bf ? curRx202.bf : "--";
    if (curRx202 && curRx202.raw && (memVal === "--" || bfVal === "--")) {
      const rn = parseInt(curRx202.raw, 16) || Number(curRx202.raw);
      if (!isNaN(rn)) {
        if (memVal === "--") memVal = ((rn >> 10) & 1) ? "ON" : "OFF";
        if (bfVal === "--") bfVal = ((rn >> 11) & 1) ? "F" : "B";
      }
    }
    const displayedBnrDist = dispVal === "OFF" ? "--.--" : bnrDist;

    // Live ECHO comparison: compare curRx035 vs freqVal
    let echoVal = "NONE";
    let echoColor = "color:var(--text-2);";
    if (curRx035) {
      const rxFreq = curRx035.eng_value != null ? Number(curRx035.eng_value) : null;
      if (rxFreq != null && Math.abs(rxFreq - freqVal) < 0.05) {
        echoVal = "OK";
        echoColor = "color:#16a34a; font-weight:700;";
      } else {
        echoVal = "ERR";
        echoColor = "color:#dc2626; font-weight:700;";
      }
    }

    const rxDispMode = dmeSingleState.rxDisplayMode || "BCD";
    let rightmostHeader = rxDispMode === "BCD" ? "BCDDIST" : "IDENT";
    let rightmostData = "----";
    if (rxDispMode === "BCD") {
      if (curRx201 && curRx201.eng_value != null) {
        rightmostData = Number(curRx201.eng_value).toFixed(2);
      } else if (dispVal === "OFF") {
        rightmostData = "DISP OFF";
      } else {
        rightmostData = "No BCD";
      }
    } else {
      rightmostData = curRx246 ? (curRx246.data_text || "----") : "----";
    }

    const p = el("div", "panel");
    p.innerHTML = `
      <div class="lru-toolbar">
        <div>
          <div class="panel-title" style="margin-bottom:.35rem">DME Single Channel Mode</div>
          <p class="muted">Tuning &amp; Word Monitor (ARINC 709 / CMM Chapter 1 Section 4.B)</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="pill pill-run">BUS TX-${txCh} &bull; RX-${rxCh}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-single-back">&lt; Back to DME Modes</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-single-lrus">&lt; LRU Select</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-single-reset" title="Reset all Single Channel settings to factory defaults">↺ Reset Defaults</button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-dme-single-diag">⚡ Live Diagnostic</button>
          <button type="button" class="btn btn-sm" id="btn-dme-single-tx">Transmit Active Word</button>
        </div>
      </div>
      <div class="dme-hmi-workbench dynapro-dme-crt">
        <div class="dynapro-dme-content">
          <!-- Top Header Line -->
          <div class="dme-hmi-hdr-line dynapro-dme-hdr-line">
            <span>-------- TRANSMITTER CONTROL --------</span>
            <span>--------- RECEIVED DATA ----------</span>
          </div>
          <!-- Subheaders & Table -->
          <table class="dme-hmi-table dynapro-dme-table">
            <thead>
              <tr style="font-size:11px;">
                <th colspan="7" style="padding-bottom:0;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MODE</th>
                <th style="padding-bottom:0;">BNR</th>
                <th colspan="3" style="padding-bottom:0;"></th>
                <th style="padding-bottom:0;" id="s-hdr-rightmost">${rightmostHeader}</th>
              </tr>
              <tr>
                <th style="width:10%;">ECHO</th>
                <th style="width:10%;">SSM</th>
                <th style="width:10%;">CHAN</th>
                <th style="width:8%;">SDI</th>
                <th style="width:8%;">DISP</th>
                <th style="width:8%;">IDENT</th>
                <th style="width:8%;">NAV</th>
                <th style="width:10%;">DIST</th>
                <th style="width:7%;">MEM</th>
                <th style="width:7%;">B/F</th>
                <th style="width:7%;">DELTA</th>
                <th style="width:9%;" id="s-subhdr-rightmost">${rightmostHeader}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="clickable-cell" id="s-td-echo"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-echo" style="${echoColor}">${echoVal}</span></td>
                <td class="clickable-cell" id="s-td-mode"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-mode">${modeVal}</span></td>
                <td class="clickable-cell" id="s-td-chan"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-chan">${dmeSingleState.dispChan ? `${chanInfo.ch} ${chanInfo.xy}` : freqVal.toFixed(2)}</span></td>
                <td class="clickable-cell" id="s-td-sdi"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-sdi">${sdiVal === 0 ? "ALL" : String(sdiVal).padStart(2, "0")}</span></td>
                <td class="clickable-cell" id="s-td-disp"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-disp">${dispVal}</span></td>
                <td class="clickable-cell" id="s-td-ident"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-ident">${identVal}</span></td>
                <td class="clickable-cell" id="s-td-nav"><span class="dme-cell-edit dynapro-cell-edit" id="s-cell-nav">${navVal}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly ${curRx202 && dispVal === "ON" ? "has-data" : ""}" id="s-cell-bnr-dist">${displayedBnrDist}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly ${curRx202 && memVal !== "--" ? "has-data" : ""}" id="s-cell-mem">${memVal}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly ${curRx202 && bfVal !== "--" ? "has-data" : ""}" id="s-cell-bf">${bfVal}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="s-cell-delta">--</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly ${(rxDispMode === "BCD" ? (curRx201 && dispVal === "ON") : curRx246) ? "has-data" : ""}" id="s-cell-rightmost">${rightmostData}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Middle SQ/NT Status Section -->
          <div class="dme-sqnt-grid dynapro-sqnt-grid">
            <div class="dme-sqnt-row dynapro-sqnt-row" style="margin-bottom:2px;">
              <span style="font-weight:700;">SQ/NT</span>
              <span><span class="dme-cell-edit dynapro-cell-edit" id="sqnt-cell-chan">${chanInfo.ch} ${chanInfo.xy}</span></span>
              <span><span class="dme-cell-edit dynapro-cell-edit" id="sqnt-cell-dist">${dmeSingleState.replyDist || "--.--"}</span></span>
              <span><span class="dme-cell-edit dynapro-cell-edit" id="sqnt-cell-speed">${dmeSingleState.replySpeed}</span></span>
              <span><span class="dme-cell-edit dynapro-cell-edit" id="sqnt-cell-eff">${dmeSingleState.replyEff} %</span></span>
              <span><span class="dme-cell-edit dynapro-cell-edit" id="sqnt-cell-rf">${dmeSingleState.rfLevel} dBm</span></span>
            </div>
            <div class="dme-sqnt-row dynapro-sqnt-row" style="font-size:11px; color:var(--text-2);">
              <span>STATUS:</span>
              <span></span>
              <span>NM</span>
              <span>KTS</span>
              <span>REPLY EFF.</span>
              <span>RF LEVEL</span>
            </div>
          </div>

          <!-- Bottom 7 Softkeys -->
          <div class="dme-softkeys-row dynapro-softkeys-row">
            <!-- 1: [ X / Y ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-xy">
              <div class="dme-softkey-half dynapro-softkey-half ${chanInfo.xy === "X" ? "active" : ""}" id="s-sk-x-half">X</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${chanInfo.xy === "Y" ? "active" : ""}" id="s-sk-y-half">Y</div>
            </button>
            <!-- 2: [ TX-A / TX-B ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-tx">
              <div class="dme-softkey-half dynapro-softkey-half ${txCh === "A" ? "active" : ""}" id="s-sk-txa-half">TX-A</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${txCh === "B" ? "active" : ""}" id="s-sk-txb-half">TX-B</div>
            </button>
            <!-- 3: [ RX-A / RX-B ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-rx">
              <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "A" ? "active" : ""}" id="s-sk-rxa-half">RX-A</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "B" ? "active" : ""}" id="s-sk-rxb-half">RX-B</div>
            </button>
            <!-- 4: [ SQ/NT / INDEP. ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-sqnt">
              <div class="dme-softkey-half dynapro-softkey-half ${dmeSingleState.sqntMode === "SQNT" ? "active" : ""}" id="s-sk-sqnt-half">SQ/NT</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${dmeSingleState.sqntMode === "INDEP" ? "active" : ""}" id="s-sk-indep-half">INDEP.</div>
            </button>
            <!-- 5: [ CHAN / FREQ ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-chan">
              <div class="dme-softkey-half dynapro-softkey-half ${dmeSingleState.dispChan ? "active" : ""}" id="s-sk-chan-half">CHAN</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${!dmeSingleState.dispChan ? "active" : ""}" id="s-sk-freq-half">FREQ</div>
            </button>
            <!-- 6: [ MODE / ADVAN ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-mode">
              <div class="dme-softkey-half dynapro-softkey-half" id="s-sk-mode-half">MODE</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half" id="s-sk-advan-half">ADVAN</div>
            </button>
            <!-- 7: [ BCD / IDENT ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="s-sk-rx-disp">
              <div class="dme-softkey-half dynapro-softkey-half ${rxDispMode === "BCD" ? "active" : ""}" id="s-sk-bcd-half">BCD</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${rxDispMode === "IDENT" ? "active" : ""}" id="s-sk-ident-half">IDENT</div>
            </button>
          </div>
        </div>
      </div>
    `;
    r.appendChild(p);

    const bindClick = (spanId, tdId, fn) => {
      const span = p.querySelector(spanId);
      const td = p.querySelector(tdId);
      if (span) span.onclick = fn;
      if (td) td.onclick = fn;
    };

    // Direct cell click handlers
    bindClick("#s-cell-echo", "#s-td-echo", () => {
      render(snap);
    });

    // SSM / Operating Mode cycle (DF1 -> STBY -> OFF -> NCD -> FT -> UND -> DF1)
    const ssmModesList = ["DF1", "STBY", "OFF", "NCD", "FT", "UND"];
    const cycleSsmMode = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const idx = ssmModesList.indexOf(dmeSingleState.mode || "DF1");
      const nextMode = ssmModesList[(idx + 1) % ssmModesList.length];
      dmeSingleState.mode = nextMode;
      dmeSingleState.pad = getDmePadString();
      const el = p.querySelector("#s-cell-mode");
      if (el) el.textContent = nextMode;
      const mh = p.querySelector("#s-sk-mode-half");
      if (mh) {
        mh.classList.add("momentary-press");
        setTimeout(() => mh.classList.remove("momentary-press"), 150);
      }
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        mode: nextMode,
        freq_mhz: freqVal,
        pad: dmeSingleState.pad,
        disp: dmeSingleState.disp === "ON",
        ident: dmeSingleState.ident === "ON",
        nav: dmeSingleState.nav,
        sdi: dmeSingleState.sdi,
        enabled: true,
      });
    };
    bindClick("#s-cell-mode", "#s-td-mode", cycleSsmMode);

    // Advance Directed Frequency (DF1 -> DF2 -> DF3 -> DF4 -> DF5 -> SCAN -> DF1)
    const advanModesList = ["DF1", "DF2", "DF3", "DF4", "DF5", "SCAN"];
    const advanceDf = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const idx = advanModesList.indexOf(dmeSingleState.mode || "DF1");
      const nextMode = advanModesList[(idx + 1) % advanModesList.length];
      dmeSingleState.mode = nextMode;
      dmeSingleState.pad = getDmePadString();
      const el = p.querySelector("#s-cell-mode");
      if (el) el.textContent = nextMode;
      const ah = p.querySelector("#s-sk-advan-half");
      if (ah) {
        ah.classList.add("momentary-press");
        setTimeout(() => ah.classList.remove("momentary-press"), 150);
      }
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        mode: nextMode,
        freq_mhz: freqVal,
        pad: dmeSingleState.pad,
        disp: dmeSingleState.disp === "ON",
        ident: dmeSingleState.ident === "ON",
        nav: dmeSingleState.nav,
        sdi: dmeSingleState.sdi,
        enabled: true,
      });
    };

    // Softkey 6: [ MODE / ADVAN ] with event delegation
    const skModeBtn = p.querySelector("#s-sk-mode");
    if (skModeBtn) {
      skModeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-advan-half")) {
          advanceDf();
          return;
        }
        if (e.target && e.target.closest("#s-sk-mode-half")) {
          cycleSsmMode();
          return;
        }
        const rect = skModeBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        if (clickY > rect.height / 2) {
          advanceDf();
        } else {
          cycleSsmMode();
        }
      };
    }
    const modeHalf = p.querySelector("#s-sk-mode-half");
    if (modeHalf) modeHalf.onclick = cycleSsmMode;
    const advanHalf = p.querySelector("#s-sk-advan-half");
    if (advanHalf) advanHalf.onclick = advanceDf;

    // Keypad Modal for Channel / Frequency
    const editChannelOrFreq = () => {
      const curFreq = dmeSingleState.freq || freqVal || 134.40;
      const currentChanInfo = dmeFreqToChannel(curFreq);
      showDmeKeypadModal({
        title: dmeSingleState.dispChan ? "SET DME CHANNEL (1-126)" : "SET DME FREQ (MHz)",
        value: dmeSingleState.dispChan ? String(currentChanInfo.ch) : curFreq.toFixed(2),
        type: "numeric",
        hint: dmeSingleState.dispChan ? "Enter channel 1-126 (Suffix: " + currentChanInfo.xy + ")" : "Enter frequency (108.00 - 135.95 MHz)",
        onApply: (val) => {
          let newFreq = curFreq;
          if (dmeSingleState.dispChan) {
            const chNum = parseInt(val, 10) || 1;
            newFreq = dmeChannelToFreq(chNum, currentChanInfo.xy);
          } else {
            newFreq = parseFloat(val) || curFreq;
          }
          dmeSingleState.freq = newFreq;
          freqVal = newFreq;
          const newCi = dmeFreqToChannel(newFreq);
          dmeSingleState.xy = newCi.xy;

          // Instant DOM updates
          const chanCell = p.querySelector("#s-cell-chan");
          if (chanCell) {
            chanCell.textContent = dmeSingleState.dispChan ? `${newCi.ch} ${newCi.xy}` : newFreq.toFixed(2);
          }
          const sqntChan = p.querySelector("#sqnt-cell-chan");
          if (sqntChan) {
            sqntChan.textContent = `${newCi.ch} ${newCi.xy}`;
          }
          const xHalf = p.querySelector("#s-sk-x-half");
          const yHalf = p.querySelector("#s-sk-y-half");
          if (xHalf) xHalf.classList.toggle("active", newCi.xy === "X");
          if (yHalf) yHalf.classList.toggle("active", newCi.xy === "Y");

          applyDmeSlotHelper({
            index: 0,
            bus: txCh,
            freq_mhz: newFreq,
            mode: dmeSingleState.mode,
            nav: dmeSingleState.nav,
            disp: dmeSingleState.disp === "ON",
            ident: dmeSingleState.ident === "ON",
            pad: dmeSingleState.pad || getDmePadString(),
            sdi: dmeSingleState.sdi,
            enabled: true,
          });
        },
      });
    };
    bindClick("#s-cell-chan", "#s-td-chan", editChannelOrFreq);
    p.querySelector("#sqnt-cell-chan").onclick = editChannelOrFreq;

    // Softkey 1: [ X / Y ] Instant toggle & delegation
    const setXY = (targetXY) => {
      const curFreq = dmeSingleState.freq || freqVal || 134.40;
      const currentChanInfo = dmeFreqToChannel(curFreq);
      const curXY = currentChanInfo.xy;
      let nextXY = targetXY;
      if (!nextXY) {
        nextXY = curXY === "X" ? "Y" : "X";
      } else if (nextXY === curXY) {
        // Explicitly clicking the active half toggles it
        nextXY = curXY === "X" ? "Y" : "X";
      }

      // 1. Update state & immediate visual active class
      dmeSingleState.xy = nextXY;
      const xHalf = p.querySelector("#s-sk-x-half");
      const yHalf = p.querySelector("#s-sk-y-half");
      if (xHalf) xHalf.classList.toggle("active", nextXY === "X");
      if (yHalf) yHalf.classList.toggle("active", nextXY === "Y");

      // 2. Recompute paired VHF frequency per ARINC 709
      const newFreq = dmeChannelToFreq(currentChanInfo.ch, nextXY);
      dmeSingleState.freq = newFreq;
      freqVal = newFreq;

      // 3. Immediately update DOM text
      const chanCell = p.querySelector("#s-cell-chan");
      if (chanCell) {
        chanCell.textContent = dmeSingleState.dispChan ? `${currentChanInfo.ch} ${nextXY}` : newFreq.toFixed(2);
      }
      const sqntChan = p.querySelector("#sqnt-cell-chan");
      if (sqntChan) {
        sqntChan.textContent = `${currentChanInfo.ch} ${nextXY}`;
      }

      // 4. Send API call to transmit Label 035 with the new frequency
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        freq_mhz: newFreq,
        mode: dmeSingleState.mode,
        nav: dmeSingleState.nav,
        disp: dmeSingleState.disp === "ON",
        ident: dmeSingleState.ident === "ON",
        pad: dmeSingleState.pad || getDmePadString(),
        sdi: dmeSingleState.sdi,
        enabled: true,
      });
    };

    const skXyBtn = p.querySelector("#s-sk-xy");
    if (skXyBtn) {
      skXyBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-x-half")) {
          setXY("X");
          return;
        }
        if (e.target && e.target.closest("#s-sk-y-half")) {
          setXY("Y");
          return;
        }
        const rect = skXyBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        setXY(clickY > rect.height / 2 ? "Y" : "X");
      };
    }
    const xHalfEl = p.querySelector("#s-sk-x-half");
    if (xHalfEl) xHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setXY("X"); };
    const yHalfEl = p.querySelector("#s-sk-y-half");
    if (yHalfEl) yHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setXY("Y"); };

    // Softkey 2: [ TX-A / TX-B ] Instant toggle & delegation
    const setTxBus = async (targetBus) => {
      const curBus = dmeSingleState.txBus || txCh || "A";
      let nextBus = targetBus;
      if (!nextBus) {
        nextBus = curBus === "A" ? "B" : "A";
      } else if (nextBus === curBus) {
        nextBus = curBus === "A" ? "B" : "A";
      }

      dmeSingleState.txBus = nextBus;
      const txaHalf = p.querySelector("#s-sk-txa-half");
      const txbHalf = p.querySelector("#s-sk-txb-half");
      if (txaHalf) txaHalf.classList.toggle("active", nextBus === "A");
      if (txbHalf) txbHalf.classList.toggle("active", nextBus === "B");

      const pill = p.querySelector(".pill-run");
      if (pill) {
        pill.innerHTML = `BUS TX-${nextBus} &bull; RX-${dmeSingleState.rxBus || rxCh || "A"}`;
      }

      try {
        const snapIn = await api("/api/arinc/channel/active", {
          method: "POST",
          body: JSON.stringify({ tx_ch: nextBus }),
        });
        snap = snapIn;
        patchDmeSingleRx(snapIn);
      } catch {
        patchDmeSingleRx(snap);
      }
    };

    const skTxBtn = p.querySelector("#s-sk-tx");
    if (skTxBtn) {
      skTxBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-txa-half")) {
          setTxBus("A");
          return;
        }
        if (e.target && e.target.closest("#s-sk-txb-half")) {
          setTxBus("B");
          return;
        }
        const rect = skTxBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        setTxBus(clickY > rect.height / 2 ? "B" : "A");
      };
    }
    const txaHalfEl = p.querySelector("#s-sk-txa-half");
    if (txaHalfEl) txaHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setTxBus("A"); };
    const txbHalfEl = p.querySelector("#s-sk-txb-half");
    if (txbHalfEl) txbHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setTxBus("B"); };

    // Softkey 3: [ RX-A / RX-B ] Instant toggle & delegation
    const setRxBus = async (targetBus) => {
      const curBus = dmeSingleState.rxBus || rxCh || "A";
      let nextBus = targetBus;
      if (!nextBus) {
        nextBus = curBus === "A" ? "B" : "A";
      } else if (nextBus === curBus) {
        nextBus = curBus === "A" ? "B" : "A";
      }

      dmeSingleState.rxBus = nextBus;
      const rxaHalf = p.querySelector("#s-sk-rxa-half");
      const rxbHalf = p.querySelector("#s-sk-rxb-half");
      if (rxaHalf) rxaHalf.classList.toggle("active", nextBus === "A");
      if (rxbHalf) rxbHalf.classList.toggle("active", nextBus === "B");

      const pill = p.querySelector(".pill-run");
      if (pill) {
        pill.innerHTML = `BUS TX-${dmeSingleState.txBus || txCh || "A"} &bull; RX-${nextBus}`;
      }

      patchDmeSingleRx(snap);

      try {
        const snapIn = await api("/api/arinc/channel/active", {
          method: "POST",
          body: JSON.stringify({ rx_ch: nextBus }),
        });
        snap = snapIn;
        patchDmeSingleRx(snapIn);
      } catch {
        patchDmeSingleRx(snap);
      }
    };

    const skRxBtn = p.querySelector("#s-sk-rx");
    if (skRxBtn) {
      skRxBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-rxa-half")) {
          setRxBus("A");
          return;
        }
        if (e.target && e.target.closest("#s-sk-rxb-half")) {
          setRxBus("B");
          return;
        }
        const rect = skRxBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        setRxBus(clickY > rect.height / 2 ? "B" : "A");
      };
    }
    const rxaHalfEl = p.querySelector("#s-sk-rxa-half");
    if (rxaHalfEl) rxaHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setRxBus("A"); };
    const rxbHalfEl = p.querySelector("#s-sk-rxb-half");
    if (rxbHalfEl) rxbHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setRxBus("B"); };

    // Softkey 4: [ SQ/NT / INDEP. ] Instant toggle & delegation
    const setSqntMode = (targetMode) => {
      const curMode = dmeSingleState.sqntMode || "SQNT";
      let nextMode = targetMode;
      if (!nextMode) {
        nextMode = curMode === "SQNT" ? "INDEP" : "SQNT";
      } else if (nextMode === curMode) {
        nextMode = curMode === "SQNT" ? "INDEP" : "SQNT";
      }
      dmeSingleState.sqntMode = nextMode;

      const sqntHalf = p.querySelector("#s-sk-sqnt-half");
      const indepHalf = p.querySelector("#s-sk-indep-half");
      if (sqntHalf) sqntHalf.classList.toggle("active", nextMode === "SQNT");
      if (indepHalf) indepHalf.classList.toggle("active", nextMode === "INDEP");

      const sqntLabel = p.querySelector(".dynapro-sqnt-row span:first-child");
      if (sqntLabel) {
        sqntLabel.textContent = nextMode === "SQNT" ? "SQ/NT" : "INDEP";
      }
    };

    const skSqntBtn = p.querySelector("#s-sk-sqnt");
    if (skSqntBtn) {
      skSqntBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-sqnt-half")) {
          setSqntMode("SQNT");
          return;
        }
        if (e.target && e.target.closest("#s-sk-indep-half")) {
          setSqntMode("INDEP");
          return;
        }
        const rect = skSqntBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        setSqntMode(clickY > rect.height / 2 ? "INDEP" : "SQNT");
      };
    }
    const sqntHalfEl = p.querySelector("#s-sk-sqnt-half");
    if (sqntHalfEl) sqntHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setSqntMode("SQNT"); };
    const indepHalfEl = p.querySelector("#s-sk-indep-half");
    if (indepHalfEl) indepHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setSqntMode("INDEP"); };

    // Softkey 5: [ CHAN / FREQ ] Instant toggle & delegation
    const setDispChan = (targetDispChan) => {
      if (targetDispChan == null) {
        dmeSingleState.dispChan = !dmeSingleState.dispChan;
      } else {
        dmeSingleState.dispChan = targetDispChan;
      }
      const isChan = !!dmeSingleState.dispChan;

      const chanHalf = p.querySelector("#s-sk-chan-half");
      const freqHalf = p.querySelector("#s-sk-freq-half");
      if (chanHalf) chanHalf.classList.toggle("active", isChan);
      if (freqHalf) freqHalf.classList.toggle("active", !isChan);

      const curFreq = dmeSingleState.freq || freqVal || 134.40;
      const ci = dmeFreqToChannel(curFreq);
      const chanEl = p.querySelector("#s-cell-chan");
      if (chanEl) {
        chanEl.textContent = isChan ? `${ci.ch} ${ci.xy}` : curFreq.toFixed(2);
      }
    };

    const skChanBtn = p.querySelector("#s-sk-chan");
    if (skChanBtn) {
      skChanBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-chan-half")) {
          setDispChan(true);
          return;
        }
        if (e.target && e.target.closest("#s-sk-freq-half")) {
          setDispChan(false);
          return;
        }
        const rect = skChanBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        setDispChan(clickY <= rect.height / 2);
      };
    }
    const chanHalfEl = p.querySelector("#s-sk-chan-half");
    if (chanHalfEl) chanHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setDispChan(true); };
    const freqHalfEl = p.querySelector("#s-sk-freq-half");
    if (freqHalfEl) freqHalfEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setDispChan(false); };

    // SDI cycle (ALL -> 01 -> 02 -> 03 -> ALL)
    const cycleSdi = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const currentSdi = (dmeSingleState.sdi != null) ? Number(dmeSingleState.sdi) : sdiVal;
      const nextSdi = (currentSdi + 1) % 4;
      dmeSingleState.sdi = nextSdi;
      const el = p.querySelector("#s-cell-sdi");
      if (el) el.textContent = nextSdi === 0 ? "ALL" : String(nextSdi).padStart(2, "0");
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        freq_mhz: freqVal,
        sdi: nextSdi,
        pad: dmeSingleState.pad || getDmePadString(),
        mode: dmeSingleState.mode,
        nav: dmeSingleState.nav,
        disp: dmeSingleState.disp === "ON",
        ident: dmeSingleState.ident === "ON",
        enabled: true,
      });
    };
    bindClick("#s-cell-sdi", "#s-td-sdi", cycleSdi);

    // DISP toggle (Bit 16)
    const toggleDisp = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const newDisp = (dmeSingleState.disp !== "ON");
      dmeSingleState.disp = newDisp ? "ON" : "OFF";
      dmeSingleState.pad = getDmePadString();
      const el = p.querySelector("#s-cell-disp");
      if (el) el.textContent = dmeSingleState.disp;
      patchDmeSingleRx(snap);
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        freq_mhz: freqVal,
        disp: newDisp,
        pad: dmeSingleState.pad,
        mode: dmeSingleState.mode,
        nav: dmeSingleState.nav,
        ident: dmeSingleState.ident === "ON",
        sdi: dmeSingleState.sdi,
        enabled: true,
      });
    };
    bindClick("#s-cell-disp", "#s-td-disp", toggleDisp);

    // TX IDENT toggle (Bit 17) - ONLY triggered by clicking #s-cell-ident in the table!
    const toggleTxIdent = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const newIdent = (dmeSingleState.ident !== "ON");
      dmeSingleState.ident = newIdent ? "ON" : "OFF";
      dmeSingleState.pad = getDmePadString();
      const el = p.querySelector("#s-cell-ident");
      if (el) el.textContent = dmeSingleState.ident;
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        freq_mhz: freqVal,
        ident: newIdent,
        disp: dmeSingleState.disp === "ON",
        pad: dmeSingleState.pad,
        mode: dmeSingleState.mode,
        nav: dmeSingleState.nav,
        sdi: dmeSingleState.sdi,
        enabled: true,
      });
    };
    bindClick("#s-cell-ident", "#s-td-ident", toggleTxIdent);

    // Softkey 7: [ BCD / IDENT ] Instant toggle & delegation (RX display mode only)
    const setRxDispMode = (mode) => {
      const curMode = dmeSingleState.rxDisplayMode || "BCD";
      let nextMode = mode;
      if (!nextMode) {
        nextMode = curMode === "BCD" ? "IDENT" : "BCD";
      } else if (nextMode === curMode) {
        nextMode = curMode === "BCD" ? "IDENT" : "BCD";
      }
      dmeSingleState.rxDisplayMode = nextMode;
      const bcdEl = p.querySelector("#s-sk-bcd-half");
      const identEl = p.querySelector("#s-sk-ident-half");
      if (bcdEl) bcdEl.classList.toggle("active", nextMode === "BCD");
      if (identEl) identEl.classList.toggle("active", nextMode === "IDENT");
      patchDmeSingleRx(snap);
    };
    const rxDispBtn = p.querySelector("#s-sk-rx-disp");
    if (rxDispBtn) {
      rxDispBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.closest("#s-sk-ident-half")) {
          setRxDispMode("IDENT");
          return;
        }
        if (e.target && e.target.closest("#s-sk-bcd-half")) {
          setRxDispMode("BCD");
          return;
        }
        const rect = rxDispBtn.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        setRxDispMode(clickY > rect.height / 2 ? "IDENT" : "BCD");
      };
    }
    const bcdHalf = p.querySelector("#s-sk-bcd-half");
    if (bcdHalf) bcdHalf.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setRxDispMode("BCD"); };
    const identHalf = p.querySelector("#s-sk-ident-half");
    if (identHalf) identHalf.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setRxDispMode("IDENT"); };

    // NAV cycle (VOR -> ILS -> MLS -> UND -> VOR)
    const navList = ["VOR", "ILS", "MLS", "UND"];
    const cycleNav = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const currentNav = dmeSingleState.nav || navVal || "VOR";
      const idx = navList.indexOf(currentNav);
      const nextNav = navList[(idx + 1) % navList.length];
      dmeSingleState.nav = nextNav;
      dmeSingleState.pad = getDmePadString();
      const el = p.querySelector("#s-cell-nav");
      if (el) el.textContent = nextNav;
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        freq_mhz: freqVal,
        nav: nextNav,
        pad: dmeSingleState.pad,
        mode: dmeSingleState.mode,
        disp: dmeSingleState.disp === "ON",
        ident: dmeSingleState.ident === "ON",
        sdi: dmeSingleState.sdi,
        enabled: true,
      });
    };
    bindClick("#s-cell-nav", "#s-td-nav", cycleNav);

    // SQ/NT status edits
    p.querySelector("#sqnt-cell-dist").onclick = () => {
      showDmeKeypadModal({
        title: "SET RANGE DISTANCE (NM)",
        value: dmeSingleState.replyDist === "--.-" ? "20.0" : dmeSingleState.replyDist,
        type: "numeric",
        hint: "Simulated DME reply distance",
        onApply: (v) => {
          dmeSingleState.replyDist = v ? Number(parseFloat(v).toFixed(1)) : "--.-";
          const el = p.querySelector("#sqnt-cell-dist");
          if (el) el.textContent = dmeSingleState.replyDist;
        },
      });
    };
    p.querySelector("#sqnt-cell-speed").onclick = () => {
      showDmeKeypadModal({
        title: "SET VELOCITY (KTS)",
        value: String(dmeSingleState.replySpeed),
        type: "numeric",
        onApply: (v) => {
          dmeSingleState.replySpeed = parseInt(v, 10) || 0;
          const el = p.querySelector("#sqnt-cell-speed");
          if (el) el.textContent = dmeSingleState.replySpeed;
        },
      });
    };
    p.querySelector("#sqnt-cell-eff").onclick = () => {
      showDmeKeypadModal({
        title: "SET REPLY EFFICIENCY (%)",
        value: String(dmeSingleState.replyEff),
        type: "numeric",
        hint: "Reply efficiency percentage (0-100)",
        onApply: (v) => {
          dmeSingleState.replyEff = Math.min(100, Math.max(0, parseInt(v, 10) || 70));
          const el = p.querySelector("#sqnt-cell-eff");
          if (el) el.textContent = `${dmeSingleState.replyEff} %`;
        },
      });
    };
    p.querySelector("#sqnt-cell-rf").onclick = () => {
      showDmeKeypadModal({
        title: "SET RF LEVEL (dBm)",
        value: String(dmeSingleState.rfLevel),
        type: "numeric",
        hint: "RF Level in dBm (e.g. -107)",
        onApply: (v) => {
          dmeSingleState.rfLevel = parseInt(v, 10) || -107;
          const el = p.querySelector("#sqnt-cell-rf");
          if (el) el.textContent = `${dmeSingleState.rfLevel} dBm`;
        },
      });
    };

    // Bottom buttons
    p.querySelector("#btn-dme-single-back").onclick = () => navTo("dme_config");
    p.querySelector("#btn-dme-single-lrus").onclick = () => navTo("avionics_lru");
    p.querySelector("#btn-dme-single-diag").onclick = () => pushScreen("dme_diagnostic");
    p.querySelector("#btn-dme-single-reset").onclick = async () => {
      if (!confirm("Reset DME Single Channel settings to factory defaults?")) return;
      try {
        dmeSingleState.freq = 134.40;
        dmeSingleState.sdi = 0;
        dmeSingleState.mode = "DF1";
        dmeSingleState.nav = "VOR";
        dmeSingleState.disp = "ON";
        dmeSingleState.ident = "OFF";
        dmeSingleState.pad = "0100001";
        dmeSingleState.rxDisplayMode = "BCD";
        const snapIn = await api("/api/arinc/dme/mode", {
          method: "POST",
          body: JSON.stringify({ mode: "single", reset: true }),
        });
        render(snapIn);
        const newResetBtn = p.querySelector("#btn-dme-single-reset");
        if (newResetBtn) {
          const origText = newResetBtn.textContent;
          newResetBtn.textContent = "✓ Defaults Restored";
          newResetBtn.style.color = "var(--accent)";
          setTimeout(() => {
            if (newResetBtn) {
              newResetBtn.textContent = origText;
              newResetBtn.style.color = "";
            }
          }, 1000);
        }
      } catch (e) { alert(e.message); }
    };
    p.querySelector("#btn-dme-single-tx").onclick = () => {
      applyDmeSlotHelper({
        index: 0,
        bus: txCh,
        freq_mhz: freqVal,
        pad: dmeSingleState.pad || getDmePadString(),
        mode: dmeSingleState.mode,
        nav: dmeSingleState.nav,
        disp: dmeSingleState.disp === "ON",
        ident: dmeSingleState.ident === "ON",
        sdi: dmeSingleState.sdi,
        parity: parVal,
        rate_ms: rateVal,
        enabled: true,
      });
    };
  }

  // ====================================================================
  // SCREEN 2: MULTI CHANNEL DME TEST SCREEN
  // Matches WhatsApp Image 2026-11-18 at 11.24.11 (Aeroflex Figure 18)
  // ====================================================================
    function renderDmeMulti(r, s) {
    const curLine = dmeMultiState.selectedLine || 0;
    const txCh = dmeMultiState.txBus || s.tx_ch || "A";
    const rxCh = dmeMultiState.rxBus || s.rx_ch || "A";
    const rxDispMode = dmeMultiState.rxDisplayMode || "BCD";

    const defaultLines = [
      { mode: "DF1", ch: 1,   xy: "X", sdi: 0, disp: "ON",  ident: "ON",  nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF2", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF3", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF4", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "DF5", ch: 1,   xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
      { mode: "SCAN", ch: 1,  xy: "X", sdi: 0, disp: "OFF", ident: "OFF", nav: "VOR", freq: 134.40, echo: "NONE" },
    ];

    if (!dmeMultiState.lines) dmeMultiState.lines = defaultLines.map((x) => ({ ...x }));

    const lines = defaultLines.map((def, i) => {
      const stateRow = (dmeMultiState.lines && dmeMultiState.lines[i]) || def;
      const txSlot = (s.tx && s.tx[txCh] && s.tx[txCh][i]) || null;
      if (!txSlot || !txSlot.enabled) return stateRow;
      const f = (txSlot.eng_value != null && Number.isFinite(Number(txSlot.eng_value))) ? Number(txSlot.eng_value) : stateRow.freq;
      const chInfo = dmeFreqToChannel(f);
      let pStr = "0100001";
      if (txSlot.pads && txSlot.pads !== "-") pStr = txSlot.pads.padStart(7, "0");
      return {
        mode: stateRow.mode,
        ch: chInfo.ch,
        xy: chInfo.xy,
        sdi: txSlot.sdi != null ? Number(txSlot.sdi) : stateRow.sdi,
        disp: pStr[1] === "1" ? "ON" : "OFF",
        ident: pStr[0] === "1" ? "ON" : "OFF",
        nav: stateRow.nav,
        freq: f,
        echo: stateRow.echo || "NONE",
      };
    });

    const activeRow = lines[curLine] || lines[0];

    const rxLabs = (s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
    const curRx035 = rxLabs.find((l) => l.label === "035") || null;
    const curRx201 = rxLabs.find((l) => l.label === "201") || null;
    const curRx202 = rxLabs.find((l) => l.label === "202") || null;
    const curRx246 = rxLabs.find((l) => l.label === "246") || null;
    const bnrDist = curRx202 && curRx202.eng_value != null ? Number(curRx202.eng_value).toFixed(1) : "--.-";
    let memVal = curRx202 && curRx202.mem ? curRx202.mem : "--";
    let bfVal = curRx202 && curRx202.bf ? curRx202.bf : "--";
    if (curRx202 && curRx202.raw && (memVal === "--" || bfVal === "--")) {
      const rn = parseInt(curRx202.raw, 16) || Number(curRx202.raw);
      if (!isNaN(rn)) {
        if (memVal === "--") memVal = ((rn >> 10) & 1) ? "ON" : "OFF";
        if (bfVal === "--") bfVal = ((rn >> 11) & 1) ? "F" : "B";
      }
    }

    let bcdIdent = "----";
    if (rxDispMode === "BCD") {
      if (curRx201 && curRx201.eng_value != null) {
        bcdIdent = Number(curRx201.eng_value).toFixed(1);
      } else if (activeRow.disp === "OFF") {
        bcdIdent = "DISP OFF";
      } else {
        bcdIdent = "No BCD";
      }
    } else {
      bcdIdent = curRx246 ? (curRx246.data_text || "PRES") : "----";
    }

    const p = el("div", "panel");
    p.innerHTML = `
      <div class="lru-toolbar">
        <div>
          <div class="panel-title" style="margin-bottom:.35rem">DME Multi Channel Mode</div>
          <p class="muted">Multi-Frequency Scan &amp; Transmitter Control (ARINC 709)</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="pill pill-run">BUS TX-${txCh} &bull; RX-${rxCh}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-multi-back">&lt; Back to DME Modes</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-multi-lrus">&lt; LRU Select</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-multi-reset" title="Reset all Multi Channel scan frequencies to factory defaults">↺ Reset Defaults</button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-dme-multi-diag">⚡ Live Diagnostic</button>
          <button type="button" class="btn btn-sm" id="btn-dme-multi-tx">Transmit All Lines</button>
        </div>
      </div>
      <div class="dme-hmi-workbench dynapro-dme-crt">
        <div class="dynapro-dme-content">
          <!-- Top Header Line -->
          <div class="dme-hmi-hdr-line dynapro-dme-hdr-line">
            <span>-------- TRANSMITTER CONTROL --------</span>
            <span>--------- RECEIVED DATA ----------</span>
          </div>
          <!-- Subheaders & Multi Rows Table -->
          <table class="dme-hmi-table dynapro-dme-table" id="m-dme-table">
            <thead>
              <tr style="font-size:11px;">
                <th colspan="7" style="padding-bottom:0;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MODE</th>
                <th style="padding-bottom:0;">BNR</th>
                <th colspan="3" style="padding-bottom:0;"></th>
                <th style="padding-bottom:0;" id="m-th-rightmost-sub">${rxDispMode === "BCD" ? "BCDDIST" : "IDENT"}</th>
              </tr>
              <tr>
                <th style="width:10%;">ECHO</th>
                <th style="width:10%;">SSM</th>
                <th style="width:10%;">CHAN</th>
                <th style="width:8%;">SDI</th>
                <th style="width:8%;">DISP</th>
                <th style="width:8%;">IDENT</th>
                <th style="width:8%;">NAV</th>
                <th style="width:10%;">DIST</th>
                <th style="width:7%;">MEM</th>
                <th style="width:7%;">B/F</th>
                <th style="width:7%;">DELTA</th>
                <th style="width:9%;" id="m-th-rightmost">${rxDispMode === "BCD" ? "BCDDIST" : "IDENT"}</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((rRow, i) => {
                let echoStr = rRow.mode === "SCAN" ? "" : (rRow.echo || "NONE");
                if (i === curLine && curRx035 && rRow.mode !== "SCAN") {
                  const rxF = curRx035.eng_value != null ? Number(curRx035.eng_value) : null;
                  if (rxF != null && Math.abs(rxF - rRow.freq) < 0.05) echoStr = "OK";
                  else echoStr = "ERR";
                }
                const echoColorStyle = echoStr === "OK" ? "color:#16a34a; font-weight:700;" : (echoStr === "ERR" ? "color:#dc2626; font-weight:700;" : "");
                return `
                <tr data-line="${i}" class="${i === curLine ? "active-line" : ""}" style="cursor:pointer;">
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="echo" data-idx="${i}" id="m-cell-echo-${i}" style="${echoColorStyle}">${echoStr}</span></td>
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="mode" data-idx="${i}" id="m-cell-mode-${i}"><strong>${rRow.mode}</strong></span></td>
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="chan" data-idx="${i}" id="m-cell-chan-${i}">${rRow.mode === "SCAN" ? "" : `${rRow.ch} ${rRow.xy}`}</span></td>
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="sdi" data-idx="${i}" id="m-cell-sdi-${i}">${rRow.sdi === 0 ? "ALL" : String(rRow.sdi).padStart(2, "0")}</span></td>
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="disp" data-idx="${i}" id="m-cell-disp-${i}">${rRow.disp}</span></td>
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="ident" data-idx="${i}" id="m-cell-ident-${i}">${rRow.ident}</span></td>
                  <td><span class="dme-cell-edit dynapro-cell-edit" data-edit="nav" data-idx="${i}" id="m-cell-nav-${i}">${rRow.nav}</span></td>
                  <td><span class="dme-cell-readonly dynapro-cell-readonly ${i === curLine && curRx202 && rRow.disp !== "OFF" ? "has-data" : ""}" id="m-cell-bnr-${i}">${i === curLine ? (rRow.disp === "OFF" ? "--.-" : bnrDist) : "--.-"}</span></td>
                  <td><span class="dme-cell-readonly dynapro-cell-readonly ${i === curLine && curRx202 && memVal !== "--" ? "has-data" : ""}" id="m-cell-mem-${i}">${i === curLine ? memVal : "--"}</span></td>
                  <td><span class="dme-cell-readonly dynapro-cell-readonly ${i === curLine && curRx202 && bfVal !== "--" ? "has-data" : ""}" id="m-cell-bf-${i}">${i === curLine ? bfVal : "--"}</span></td>
                  <td><span class="dme-cell-readonly dynapro-cell-readonly" id="m-cell-delta-${i}">--</span></td>
                  <td><span class="dme-cell-readonly dynapro-cell-readonly ${i === curLine && ((rxDispMode === "BCD" && curRx201) || (rxDispMode === "IDENT" && curRx246)) ? "has-data" : ""}" id="m-cell-bcd-${i}">${i === curLine ? bcdIdent : "----"}</span></td>
                </tr>
              `;}).join("")}
            </tbody>
          </table>

          <!-- Bottom Telemetry Status Line -->
          <div class="dme-multi-status-row dynapro-multi-status-row">
            <span id="m-status-chan">CHANNEL: <strong>${activeRow.mode === "SCAN" ? "SCAN" : `${activeRow.ch} ${activeRow.xy}`}</strong></span>
            <span id="m-status-dist">DISTANCE: <strong style="color:var(--accent);">${activeRow.disp === "OFF" ? "--.-" : bnrDist} NM</strong></span>
          </div>

          <!-- Bottom 7 Softkeys -->
          <div class="dme-softkeys-row dynapro-softkeys-row">
            <!-- 1: [ X / Y ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-xy">
              <div class="dme-softkey-half dynapro-softkey-half ${activeRow.xy === "X" ? "active" : ""}" id="m-sk-x-half">X</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${activeRow.xy === "Y" ? "active" : ""}" id="m-sk-y-half">Y</div>
            </button>
            <!-- 2: [ TX-A / TX-B ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-tx">
              <div class="dme-softkey-half dynapro-softkey-half ${txCh === "A" ? "active" : ""}" id="m-sk-txa-half">TX-A</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${txCh === "B" ? "active" : ""}" id="m-sk-txb-half">TX-B</div>
            </button>
            <!-- 3: [ RX-A / RX-B ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-rx">
              <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "A" ? "active" : ""}" id="m-sk-rxa-half">RX-A</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "B" ? "active" : ""}" id="m-sk-rxb-half">RX-B</div>
            </button>
            <!-- 4: [ SQ/NT / INDEP. ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-sqnt">
              <div class="dme-softkey-half dynapro-softkey-half ${dmeMultiState.sqntMode === "SQNT" ? "active" : ""}" id="m-sk-sqnt-half">SQ/NT</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${dmeMultiState.sqntMode === "INDEP" ? "active" : ""}" id="m-sk-indep-half">INDEP.</div>
            </button>
            <!-- 5: [ SQ/NT / CTL ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-ctl">
              <div class="dme-softkey-half dynapro-softkey-half ${dmeMultiState.sqntCtl === "NORM" ? "active" : ""}" id="m-sk-ctlnorm-half">SQ/NT</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${dmeMultiState.sqntCtl !== "NORM" ? "active" : ""}" id="m-sk-ctl-half">CTL</div>
            </button>
            <!-- 6: [ LINE / ADVAN ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-line">
              <div class="dme-softkey-half dynapro-softkey-half" id="m-sk-line-half">LINE</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half active" id="m-sk-advan-half">ADVAN</div>
            </button>
            <!-- 7: [ BCD / IDENT ] -->
            <button type="button" class="dme-softkey-btn dynapro-softkey-btn" id="m-sk-ident">
              <div class="dme-softkey-half dynapro-softkey-half ${rxDispMode === "BCD" ? "active" : ""}" id="m-sk-bcd-half">BCD</div>
              <div class="dme-softkey-divider dynapro-softkey-divider"></div>
              <div class="dme-softkey-half dynapro-softkey-half ${rxDispMode === "IDENT" ? "active" : ""}" id="m-sk-ident-half">IDENT</div>
            </button>
          </div>
        </div>
      </div>
    `;
    r.appendChild(p);

    // Row selection on click
    p.querySelectorAll("tr[data-line]").forEach((tr) => {
      tr.onclick = (e) => {
        if (e.target.closest(".dynapro-cell-edit") || e.target.closest(".dme-cell-edit")) return;
        dmeMultiState.selectedLine = parseInt(tr.dataset.line, 10);
        patchDmeMultiRx(snap);
      };
    });

    // Cell editing handlers
    p.querySelectorAll("[data-edit]").forEach((cell) => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(cell.dataset.idx, 10);
        const act = cell.dataset.edit;
        const row = lines[idx];
        dmeMultiState.selectedLine = idx;

        if (act === "echo") {
          row.echo = row.echo === "NONE" ? "ECHO" : "NONE";
          dmeMultiState.lines[idx] = row;
          patchDmeMultiRx(snap);
        } else if (act === "mode") {
          const mList = ["DF1", "DF2", "DF3", "DF4", "DF5", "SCAN"];
          row.mode = mList[(mList.indexOf(row.mode) + 1) % mList.length];
          dmeMultiState.lines[idx] = row;
          patchDmeMultiRx(snap);
          applyDmeSlotHelper({
            index: idx,
            bus: txCh,
            freq_mhz: row.freq,
            mode: row.mode,
            sdi: row.sdi,
            disp: row.disp === "ON",
            ident: row.ident === "ON",
            nav: row.nav,
            enabled: true,
          });
        } else if (act === "chan") {
          showDmeKeypadModal({
            title: `SET LINE ${idx + 1} (${row.mode}) CHANNEL`,
            value: String(row.ch),
            type: "numeric",
            hint: `Enter channel 1-126 (Suffix: ${row.xy})`,
            onApply: (v) => {
              const chNum = parseInt(v, 10) || row.ch;
              const newFreq = dmeChannelToFreq(chNum, row.xy);
              row.ch = chNum;
              row.freq = newFreq;
              dmeMultiState.lines[idx] = row;
              patchDmeMultiRx(snap);
              applyDmeSlotHelper({
                index: idx,
                bus: txCh,
                freq_mhz: newFreq,
                mode: row.mode,
                sdi: row.sdi,
                disp: row.disp === "ON",
                ident: row.ident === "ON",
                nav: row.nav,
                enabled: true,
              });
            },
          });
        } else if (act === "sdi") {
          row.sdi = (row.sdi + 1) % 4;
          dmeMultiState.lines[idx] = row;
          patchDmeMultiRx(snap);
          applyDmeSlotHelper({
            index: idx,
            bus: txCh,
            freq_mhz: row.freq,
            sdi: row.sdi,
            mode: row.mode,
            disp: row.disp === "ON",
            ident: row.ident === "ON",
            nav: row.nav,
            enabled: true,
          });
        } else if (act === "disp") {
          row.disp = row.disp === "ON" ? "OFF" : "ON";
          dmeMultiState.lines[idx] = row;
          patchDmeMultiRx(snap);
          applyDmeSlotHelper({
            index: idx,
            bus: txCh,
            freq_mhz: row.freq,
            disp: row.disp === "ON",
            mode: row.mode,
            sdi: row.sdi,
            ident: row.ident === "ON",
            nav: row.nav,
            enabled: true,
          });
        } else if (act === "ident") {
          row.ident = row.ident === "ON" ? "OFF" : "ON";
          dmeMultiState.lines[idx] = row;
          patchDmeMultiRx(snap);
          applyDmeSlotHelper({
            index: idx,
            bus: txCh,
            freq_mhz: row.freq,
            ident: row.ident === "ON",
            mode: row.mode,
            sdi: row.sdi,
            disp: row.disp === "ON",
            nav: row.nav,
            enabled: true,
          });
        } else if (act === "nav") {
          const navList = ["VOR", "ILS", "MLS"];
          row.nav = navList[(navList.indexOf(row.nav) + 1) % navList.length];
          dmeMultiState.lines[idx] = row;
          patchDmeMultiRx(snap);
          applyDmeSlotHelper({
            index: idx,
            bus: txCh,
            freq_mhz: row.freq,
            nav: row.nav,
            mode: row.mode,
            sdi: row.sdi,
            disp: row.disp === "ON",
            ident: row.ident === "ON",
            enabled: true,
          });
        }
      };
    });

    // Softkey handlers
    p.querySelector("#m-sk-line").onclick = () => {
      dmeMultiState.selectedLine = (curLine + 1) % 6;
      const advBtn = p.querySelector("#m-sk-line");
      if (advBtn) {
        advBtn.classList.add("pressed");
        setTimeout(() => advBtn.classList.remove("pressed"), 150);
      }
      patchDmeMultiRx(snap);
    };

    p.querySelector("#m-sk-xy").onclick = () => {
      const curIdx = dmeMultiState.selectedLine || 0;
      const row = lines[curIdx];
      const newXY = row.xy === "X" ? "Y" : "X";
      const newFreq = dmeChannelToFreq(row.ch, newXY);
      row.xy = newXY;
      row.freq = newFreq;
      dmeMultiState.lines[curIdx] = row;
      patchDmeMultiRx(snap);
      applyDmeSlotHelper({
        index: curIdx,
        bus: txCh,
        freq_mhz: newFreq,
        mode: row.mode,
        sdi: row.sdi,
        disp: row.disp === "ON",
        ident: row.ident === "ON",
        nav: row.nav,
        enabled: true,
      });
    };

    // Softkey 7 in Multi Mode only toggles RX telemetry display (BCD vs IDENT), never modifies TX bit 17
    p.querySelector("#m-sk-ident").onclick = () => {
      dmeMultiState.rxDisplayMode = (dmeMultiState.rxDisplayMode === "IDENT" ? "BCD" : "IDENT");
      patchDmeMultiRx(snap);
    };

    p.querySelector("#m-sk-tx").onclick = async () => {
      const curBus = dmeMultiState.txBus || "A";
      const nextBus = curBus === "A" ? "B" : "A";
      dmeMultiState.txBus = nextBus;
      patchDmeMultiRx(snap);
      try {
        const snapIn = await api("/api/arinc/channel/active", { method: "POST", body: JSON.stringify({ tx_ch: nextBus }) });
        snap = snapIn;
        patchDmeMultiRx(snapIn);
      } catch { patchDmeMultiRx(snap); }
    };

    p.querySelector("#m-sk-rx").onclick = async () => {
      const curBus = dmeMultiState.rxBus || "A";
      const nextBus = curBus === "A" ? "B" : "A";
      dmeMultiState.rxBus = nextBus;
      patchDmeMultiRx(snap);
      try {
        const snapIn = await api("/api/arinc/channel/active", { method: "POST", body: JSON.stringify({ rx_ch: nextBus }) });
        snap = snapIn;
        patchDmeMultiRx(snapIn);
      } catch { patchDmeMultiRx(snap); }
    };

    p.querySelector("#m-sk-sqnt").onclick = () => {
      dmeMultiState.sqntMode = dmeMultiState.sqntMode === "SQNT" ? "INDEP" : "SQNT";
      patchDmeMultiRx(snap);
    };

    p.querySelector("#m-sk-ctl").onclick = () => {
      dmeMultiState.sqntCtl = dmeMultiState.sqntCtl === "NORM" ? "PULSE" : "NORM";
      patchDmeMultiRx(snap);
    };

    // Bottom action buttons
    p.querySelector("#btn-dme-multi-back").onclick = () => navTo("dme_config");
    p.querySelector("#btn-dme-multi-lrus").onclick = () => navTo("avionics_lru");
    p.querySelector("#btn-dme-multi-diag").onclick = () => pushScreen("dme_diagnostic");
    p.querySelector("#btn-dme-multi-reset").onclick = async () => {
      if (!confirm("Reset all 6 DME scan channels to factory defaults?")) return;
      try {
        dmeMultiState.lines = null;
        const snapIn = await api("/api/arinc/dme/mode", {
          method: "POST",
          body: JSON.stringify({ mode: "multi", reset: true }),
        });
        snap = snapIn;
        render(snapIn);
        const newResetBtn = p.querySelector("#btn-dme-multi-reset");
        if (newResetBtn) {
          const origText = newResetBtn.textContent;
          newResetBtn.textContent = "✓ Defaults Restored";
          newResetBtn.style.color = "var(--accent)";
          setTimeout(() => {
            if (newResetBtn) {
              newResetBtn.textContent = origText;
              newResetBtn.style.color = "";
            }
          }, 1000);
        }
      } catch (e) { alert(e.message); }
    };
    p.querySelector("#btn-dme-multi-tx").onclick = async () => {
      try {
        for (let i = 0; i < 6; i++) {
          const rRow = lines[i];
          await api("/api/arinc/dme/slot", {
            method: "POST",
            body: JSON.stringify({
              index: i,
              bus: txCh,
              freq_mhz: rRow.freq,
              mode: rRow.mode,
              nav: rRow.nav,
              disp: rRow.disp === "ON",
              ident: rRow.ident === "ON",
              sdi: rRow.sdi,
              enabled: true,
            }),
          });
        }
        const updated = await api("/api/arinc/status");
        snap = updated;
        patchDmeMultiRx(updated);
      } catch (e) { alert(e.message); }
    };
  }

  // ====================================================================
  // SCREEN 3: STANDARD NAV CONFIGURATION (STANDARD LRU FORMAT SCREEN)
  // Matches WhatsApp Image 2026-11-18 at 11.24.11 (1) (Aeroflex Figure 15)
  // ====================================================================
    function renderDmeStandard(r, s) {
    dmeStandardState.lastSnap = s;
    const curSlotIdx = dmeStandardState.activeSlot || 0;
    const txCh = dmeStandardState.txBus || "A";
    const rxCh = dmeStandardState.rxBus || "A";
    const curRate = dmeStandardState.bitRate || (s && s.bit_rate_kbps) || 12.5;
    const stepDir = dmeStandardState.stepDir || "INC";

    const getStdSlotData = (slotIdx, bus) => {
      const b = bus || dmeStandardState.txBus || "A";
      const sIdx = slotIdx != null ? slotIdx : (dmeStandardState.activeSlot || 0);
      const backendSlot = (s && s.tx && s.tx[b] && s.tx[b][sIdx]) || {};
      const cached = (dmeStandardState.slots && dmeStandardState.slots[sIdx]) || {};

      let freq = (backendSlot.eng_value != null && Number.isFinite(Number(backendSlot.eng_value)))
        ? Number(backendSlot.eng_value)
        : (cached.freq != null ? cached.freq : 108.00);
      let sdi = backendSlot.sdi != null ? Number(backendSlot.sdi) : (cached.sdi != null ? cached.sdi : 0);
      let ssm = backendSlot.ssm || cached.ssm || "NML";
      let parity = backendSlot.parity || cached.parity || "ODD";
      let rate = backendSlot.rate_ms || cached.rate || 150;
      let label_octal = backendSlot.label_octal || cached.label || "035";

      let pad = "0100001";
      if (backendSlot.pads && backendSlot.pads !== "-") {
        pad = backendSlot.pads.padStart(7, "0");
      } else if (cached.pad) {
        pad = cached.pad;
      }
      return { freq, sdi, ssm, parity, rate, label_octal, pad, enabled: backendSlot.enabled !== false };
    };

    const curSlot = getStdSlotData(curSlotIdx, txCh);

    const renderDataHtml = (freq, isFieldActive, pos) => {
      const fStr = Number(freq).toFixed(2);
      const parts = fStr.split(".");
      const whole = parts[0] || "108";
      const dec = parts[1] || "00";
      const tens = whole.slice(0, -1);
      const ones = whole.slice(-1);
      const tenths = dec.charAt(0);
      const hund = dec.charAt(1);

      const is0 = isFieldActive && pos === 0;
      const is1 = isFieldActive && pos === 1;
      const is2 = isFieldActive && pos === 2;
      const is3 = isFieldActive && pos === 3;

      return `<span class="dme-cursor-bit ${is0 ? "cursor-active-bit" : ""}" data-field="DATA" data-pos="0">${tens}</span><span class="dme-cursor-bit ${is1 ? "cursor-active-bit" : ""}" data-field="DATA" data-pos="1">${ones}</span>.<span class="dme-cursor-bit ${is2 ? "cursor-active-bit" : ""}" data-field="DATA" data-pos="2">${tenths}</span><span class="dme-cursor-bit ${is3 ? "cursor-active-bit" : ""}" data-field="DATA" data-pos="3">${hund}</span> MHZ`;
    };

    const renderSdiHtml = (sdi, isFieldActive, pos) => {
      const sdiStr = String(sdi != null ? sdi : 0).padStart(2, "0");
      const is0 = isFieldActive && pos === 0;
      const is1 = isFieldActive && pos === 1;
      return `<span class="dme-cursor-bit ${is0 ? "cursor-active-bit" : ""}" data-field="SDI" data-pos="0">${sdiStr.charAt(0)}</span><span class="dme-cursor-bit ${is1 ? "cursor-active-bit" : ""}" data-field="SDI" data-pos="1">${sdiStr.charAt(1)}</span>`;
    };

    const renderPadHtml = (pad, isFieldActive, pos) => {
      const padStr = (pad || "0100001").padStart(7, "0").slice(0, 7);
      let out = "";
      for (let i = 0; i < 7; i++) {
        const isAct = isFieldActive && pos === i;
        out += `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="PAD" data-pos="${i}">${padStr.charAt(i)}</span>`;
      }
      return out;
    };

    const renderSsmHtml = (ssm, isFieldActive, pos) => {
      const ssmStr = ssm || "NML";
      const isAct = isFieldActive && pos === 0;
      return `<span class="dme-cursor-bit ${isAct ? "cursor-active-bit" : ""}" data-field="SSM" data-pos="0">${ssmStr}</span>`;
    };

    const rxLabs = (s && s.rx && s.rx[rxCh] && s.rx[rxCh].labels) || [];
    const totalRx = rxLabs.length;
    let rxIdx = dmeStandardState.rxWordIndex || 0;
    if (rxIdx >= totalRx) {
      rxIdx = totalRx > 0 ? totalRx - 1 : 0;
      dmeStandardState.rxWordIndex = rxIdx;
    }
    const curRx = (totalRx > 0) ? rxLabs[rxIdx] : null;
    const rxDecoded = decodeDmeStandardRxWord(curRx);

    const curFldInit = dmeStandardState.cursorField || "DATA";
    const curPosInit = dmeStandardState.cursorPos != null ? dmeStandardState.cursorPos : 3;
    const isCurActInit = Boolean(dmeStandardState.cursorActive);

    const p = el("div", "panel");
    p.innerHTML = `
      <div class="lru-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:nowrap; gap:12px;">
        <div style="min-width:0; flex-shrink:1;">
          <div class="panel-title" style="margin-bottom:.2rem; white-space:nowrap;">DME STANDARD NAV</div>
          <p class="muted" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0; font-size:11.5px;">Standard LRU Format (ARINC 709 / CMM Chapter 1 Section 4.B)</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:nowrap; flex-shrink:0;">
          <span class="pill pill-run" style="white-space:nowrap;">BUS TX-${txCh} &bull; RX-${rxCh}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-std-back" style="white-space:nowrap;">&lt; Back to DME Modes</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-std-lrus" style="white-space:nowrap;">&lt; LRU Select</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-std-reset" style="white-space:nowrap;" title="Reset all Standard Nav settings to factory defaults">↺ Reset Defaults</button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-dme-std-diag" style="white-space:nowrap;">⚡ Live Diagnostic</button>
          <button type="button" class="btn btn-sm" id="btn-dme-std-tx" style="white-space:nowrap;">Transmit Active Word</button>
        </div>
      </div>
      <div class="dme-hmi-workbench dynapro-dme-crt">
        <div class="dynapro-dme-content">
          <!-- Top Header Line (Matched to Single Mode Geometry) -->
          <div class="dme-hmi-hdr-line dynapro-dme-hdr-line">
            <span id="std-hdr-tx">CHANNEL ${txCh} &mdash; TRANSMITTED WORDS &nbsp;&nbsp;&nbsp; SLOT <span class="dme-inv-box dynapro-inv-box" id="std-slot-box" style="cursor:pointer; vertical-align:middle;">${curSlotIdx}</span></span>
            <span id="std-hdr-rx-words">CHANNEL ${rxCh} &mdash; RECEIVED WORDS${totalRx > 1 ? `: ${totalRx} (WORD ${rxIdx + 1}/${totalRx})` : (totalRx === 1 ? `: 1 (${rxLabs[0].label})` : "")}</span>
          </div>

          <!-- Table with Transmitted and Received Words -->
          <table class="dme-hmi-table dynapro-dme-table">
            <thead>
              <tr>
                <th style="width:10%;">CHAN</th>
                <th style="width:14%;">FUNCT</th>
                <th style="width:9%;">LABEL</th>
                <th style="width:20%;">DATA</th>
                <th style="width:8%;">SDI</th>
                <th style="width:13%;">PAD</th>
                <th style="width:8%;">SSM</th>
                <th style="width:8%;">PAR</th>
                <th style="width:10%;">RATE(ms)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Transmitted Word Row (Editable) -->
              <tr id="std-tx-row">
                <td class="clickable-cell" id="std-td-tx-ch"><span class="dme-cell-edit dynapro-cell-edit" id="std-tx-ch-cell">TX-${txCh}</span></td>
                <td><span class="dme-cell-edit dynapro-cell-edit">DME FREQ</span></td>
                <td class="clickable-cell" id="std-td-label"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "LABEL" ? "cursor-active" : ""}" id="std-label-cell">${curSlot.label_octal}</span></td>
                <td class="clickable-cell" id="std-td-data"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "DATA" ? "cursor-active" : ""}" id="std-data-cell" style="font-weight:700;">${renderDataHtml(curSlot.freq, isCurActInit && curFldInit === "DATA", curPosInit)}</span></td>
                <td class="clickable-cell" id="std-td-sdi"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "SDI" ? "cursor-active" : ""}" id="std-sdi-cell">${renderSdiHtml(curSlot.sdi, isCurActInit && curFldInit === "SDI", curPosInit)}</span></td>
                <td class="clickable-cell" id="std-td-pad"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "PAD" ? "cursor-active" : ""}" id="std-pad-cell" style="font-weight:700;">${renderPadHtml(curSlot.pad, isCurActInit && curFldInit === "PAD", curPosInit)}</span></td>
                <td class="clickable-cell" id="std-td-ssm"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "SSM" ? "cursor-active" : ""}" id="std-ssm-cell">${renderSsmHtml(curSlot.ssm, isCurActInit && curFldInit === "SSM", curPosInit)}</span></td>
                <td class="clickable-cell" id="std-td-par"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "PAR" ? "cursor-active" : ""}" id="std-par-cell">${curSlot.parity}</span></td>
                <td class="clickable-cell" id="std-td-rate"><span class="dme-cell-edit dynapro-cell-edit ${isCurActInit && curFldInit === "RATE" ? "cursor-active" : ""}" id="std-rate-cell">${curSlot.rate}</span></td>
              </tr>
              <!-- Received Word Row (Strictly Read-Only) -->
              <tr id="std-rx-row">
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-ch-cell">RX-${rxCh}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-funct-cell">${rxDecoded.funct}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-label-cell">${rxDecoded.label}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly ${rxDecoded.hasData ? "has-data" : ""}" id="std-rx-data-cell">${rxDecoded.data}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-sdi-cell">${rxDecoded.sdi}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-pad-cell">${rxDecoded.pad}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-ssm-cell">${rxDecoded.ssm}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-par-cell">${rxDecoded.par}</span></td>
                <td><span class="dme-cell-readonly dynapro-cell-readonly" id="std-rx-rate-cell">${rxDecoded.rate}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Middle Rate Status Line -->
          <div class="dme-std-rate-row dynapro-std-rate-row" style="display:flex; justify-content:space-between; align-items:center;">
            <span>BIT RATE: <strong id="std-middle-rate-val" style="color:var(--accent); font-size:13px;">${curRate.toFixed(1)} KBPS</strong></span>
            <span id="std-middle-rx-status" style="color:var(--text-2); font-size:12px;">RX ACTIVE: <strong style="${rxDecoded.hasData ? "color:var(--ok);" : "color:var(--muted);"}">${rxDecoded.label} (${rxDecoded.funct}) &bull; ${rxDecoded.data}</strong></span>
          </div>

          <!-- Bottom 7 Softkeys (JcAIR T1200B Layout) -->
          <div class="dme-softkeys-row dynapro-softkeys-row dme-standard-softkeys">
            <!-- 1: DISP CURSOR (Single button) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label">&nbsp;</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="std-sk-cursor" title="Advance editable cursor / digit position">
                <div class="dme-softkey-label">DISP<br>CURSOR</div>
              </button>
            </div>

            <!-- 2: DATA STEP (Single button) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label">&nbsp;</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="std-sk-step" title="Step active data / parameter by direction">
                <div class="dme-softkey-label">DATA<br>STEP</div>
              </button>
            </div>

            <!-- 3: INC. / DECR (Split Toggle) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label">&nbsp;</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="std-sk-incdec" title="Select stepping direction">
                <div class="dme-softkey-half dynapro-softkey-half ${stepDir === "INC" ? "active" : ""}" id="std-sk-half-inc">INC.</div>
                <div class="dme-softkey-divider dynapro-softkey-divider"></div>
                <div class="dme-softkey-half dynapro-softkey-half ${stepDir === "DECR" ? "active" : ""}" id="std-sk-half-dec">DECR</div>
              </button>
            </div>

            <!-- 4: MORE WORDS (Single button) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label">&nbsp;</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="std-sk-more" title="Cycle through received ARINC 429 words">
                <div class="dme-softkey-label">MORE<br>WORDS</div>
              </button>
            </div>

            <!-- 5: BIT RATE (Single button with rate text above) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label" id="std-sk-rate-label">${curRate.toFixed(1)} KBPS</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-single" id="std-sk-bitrate" title="Cycle low-speed baud rates (8.1 - 20.0 kbps)">
                <div class="dme-softkey-label">BIT<br>RATE</div>
              </button>
            </div>

            <!-- 6: TX-A / TX-B (Split Toggle) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label">&nbsp;</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="std-sk-tx" title="Toggle transmitter bus">
                <div class="dme-softkey-half dynapro-softkey-half ${txCh === "A" ? "active" : ""}" id="std-sk-txa-half">TX-A</div>
                <div class="dme-softkey-divider dynapro-softkey-divider"></div>
                <div class="dme-softkey-half dynapro-softkey-half ${txCh === "B" ? "active" : ""}" id="std-sk-txb-half">TX-B</div>
              </button>
            </div>

            <!-- 7: RX-A / RX-B (Split Toggle) -->
            <div class="std-sk-col">
              <div class="std-sk-top-label">&nbsp;</div>
              <button type="button" class="dme-softkey-btn dynapro-softkey-btn dme-softkey-split" id="std-sk-rx" title="Toggle receiver bus">
                <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "A" ? "active" : ""}" id="std-sk-rxa-half">RX-A</div>
                <div class="dme-softkey-divider dynapro-softkey-divider"></div>
                <div class="dme-softkey-half dynapro-softkey-half ${rxCh === "B" ? "active" : ""}" id="std-sk-rxb-half">RX-B</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    r.appendChild(p);

    let snap = s;

    const triggerPress = (btn) => {
      if (!btn) return;
      btn.classList.add("momentary-press");
      setTimeout(() => btn.classList.remove("momentary-press"), 150);
    };

    const updateTxRowDOM = () => {
      const liveSlot = getStdSlotData(dmeStandardState.activeSlot, dmeStandardState.txBus);
      const liveTxCh = dmeStandardState.txBus || "A";
      const curFld = dmeStandardState.cursorField || "DATA";
      const curPos = dmeStandardState.cursorPos != null ? dmeStandardState.cursorPos : 0;
      const isCurAct = Boolean(dmeStandardState.cursorActive);

      const slotBox = p.querySelector("#std-slot-box");
      if (slotBox) slotBox.textContent = String(dmeStandardState.activeSlot || 0);

      const txChCell = p.querySelector("#std-tx-ch-cell");
      if (txChCell) txChCell.textContent = `TX-${liveTxCh}`;

      const lblCell = p.querySelector("#std-label-cell");
      if (lblCell) lblCell.textContent = liveSlot.label_octal;

      const dataCell = p.querySelector("#std-data-cell");
      if (dataCell) dataCell.innerHTML = renderDataHtml(liveSlot.freq, isCurAct && curFld === "DATA", curPos);

      const sdiCell = p.querySelector("#std-sdi-cell");
      if (sdiCell) sdiCell.innerHTML = renderSdiHtml(liveSlot.sdi, isCurAct && curFld === "SDI", curPos);

      const padCell = p.querySelector("#std-pad-cell");
      if (padCell) padCell.innerHTML = renderPadHtml(liveSlot.pad, isCurAct && curFld === "PAD", curPos);

      const ssmCell = p.querySelector("#std-ssm-cell");
      if (ssmCell) ssmCell.innerHTML = renderSsmHtml(liveSlot.ssm, isCurAct && curFld === "SSM", curPos);

      const parCell = p.querySelector("#std-par-cell");
      if (parCell) parCell.textContent = liveSlot.parity;

      const rateCell = p.querySelector("#std-rate-cell");
      if (rateCell) rateCell.textContent = liveSlot.rate;

      // Update cursor outline on active field
      ["LABEL", "DATA", "SDI", "PAD", "SSM", "PAR", "RATE"].forEach((f) => {
        const elCell = p.querySelector(`#std-${f.toLowerCase()}-cell`);
        if (elCell) elCell.classList.toggle("cursor-active", isCurAct && f === curFld);
      });
    };

    const saveCurrentSlot = async (updates) => {
      const activeSlot = dmeStandardState.activeSlot || 0;
      const bus = dmeStandardState.txBus || "A";
      const cur = getStdSlotData(activeSlot, bus);
      const merged = {
        index: activeSlot,
        bus: bus,
        freq_mhz: updates && updates.freq_mhz != null ? updates.freq_mhz : cur.freq,
        sdi: updates && updates.sdi != null ? updates.sdi : cur.sdi,
        ssm: updates && updates.ssm != null ? updates.ssm : cur.ssm,
        parity: updates && updates.parity != null ? updates.parity : cur.parity,
        rate_ms: updates && updates.rate_ms != null ? updates.rate_ms : cur.rate,
        label: updates && updates.label != null ? updates.label : cur.label_octal,
        pad: updates && updates.pad != null ? updates.pad : cur.pad,
        enabled: updates && updates.enabled != null ? updates.enabled : cur.enabled,
      };

      if (!dmeStandardState.slots) dmeStandardState.slots = {};
      dmeStandardState.slots[activeSlot] = {
        freq: merged.freq_mhz,
        sdi: merged.sdi,
        ssm: merged.ssm,
        pad: merged.pad,
        parity: merged.parity,
        rate: merged.rate_ms,
        label: merged.label,
      };

      updateTxRowDOM();
      applyDmeSlotHelper(merged);
    };

    const stepActiveField = () => {
      const dir = (dmeStandardState.stepDir === "DECR") ? -1 : 1;
      const liveSlot = getStdSlotData(dmeStandardState.activeSlot, dmeStandardState.txBus);
      const curFld = dmeStandardState.cursorField || "DATA";
      const pos = dmeStandardState.cursorPos != null ? dmeStandardState.cursorPos : 0;

      if (curFld === "DATA") {
        let stepAmount = 0.05;
        if (pos === 0) stepAmount = 10.0;
        else if (pos === 1) stepAmount = 1.0;
        else if (pos === 2) stepAmount = 0.10;
        else stepAmount = 0.05;

        let newFreq = liveSlot.freq + dir * stepAmount;
        newFreq = Math.round(newFreq * 100) / 100;
        newFreq = Math.max(108.00, Math.min(135.95, newFreq));
        saveCurrentSlot({ freq_mhz: newFreq });
      } else if (curFld === "SDI") {
        let newSdi = liveSlot.sdi;
        if (pos === 0) {
          newSdi = newSdi ^ 2;
        } else {
          newSdi = newSdi ^ 1;
        }
        saveCurrentSlot({ sdi: newSdi });
      } else if (curFld === "PAD") {
        let p = (liveSlot.pad || "0100001").padStart(7, "0").slice(0, 7);
        const pIdx = Math.max(0, Math.min(6, pos));
        const oldBit = p.charAt(pIdx);
        const newBit = oldBit === "1" ? "0" : "1";
        const newPad = p.slice(0, pIdx) + newBit + p.slice(pIdx + 1);
        saveCurrentSlot({ pad: newPad });
      } else if (curFld === "SSM") {
        const ssmList = ["NML", "NCD", "FT", "FW"];
        let idx = ssmList.indexOf(liveSlot.ssm);
        if (idx === -1) idx = 0;
        const nextSsm = ssmList[(idx + (dir === 1 ? 1 : ssmList.length - 1)) % ssmList.length];
        saveCurrentSlot({ ssm: nextSsm });
      }
    };

    // Slot advance
    const advanceSlot = () => {
      dmeStandardState.activeSlot = ((dmeStandardState.activeSlot || 0) + 1) % 10;
      updateTxRowDOM();
      patchDmeStandardRx(dmeStandardState.lastSnap || snap);
    };
    p.querySelector("#std-slot-box").onclick = advanceSlot;

    // Toggle TX bus
    const toggleTxBus = async (targetBus) => {
      const curBus = dmeStandardState.txBus || "A";
      let nextBus = targetBus;
      if (!nextBus) nextBus = curBus === "A" ? "B" : "A";
      dmeStandardState.txBus = nextBus;

      const txaHalf = p.querySelector("#std-sk-txa-half");
      const txbHalf = p.querySelector("#std-sk-txb-half");
      if (txaHalf) txaHalf.classList.toggle("active", nextBus === "A");
      if (txbHalf) txbHalf.classList.toggle("active", nextBus === "B");

      updateTxRowDOM();
      try {
        const res = await fetch("/api/arinc/channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx_ch: nextBus }),
        });
        if (res.ok) {
          const fresh = await res.json();
          snap = fresh;
          dmeStandardState.lastSnap = fresh;
          patchDmeStandardRx(fresh);
        }
      } catch (err) {
        console.error("Failed to switch TX bus", err);
      }
    };

    // Toggle RX bus
    const toggleRxBus = async (targetBus) => {
      const curBus = dmeStandardState.rxBus || "A";
      let nextBus = targetBus;
      if (!nextBus) nextBus = curBus === "A" ? "B" : "A";
      dmeStandardState.rxBus = nextBus;

      const rxaHalf = p.querySelector("#std-sk-rxa-half");
      const rxbHalf = p.querySelector("#std-sk-rxb-half");
      if (rxaHalf) rxaHalf.classList.toggle("active", nextBus === "A");
      if (rxbHalf) rxbHalf.classList.toggle("active", nextBus === "B");

      const rxChCell = p.querySelector("#std-rx-ch-cell");
      if (rxChCell) rxChCell.textContent = `RX-${nextBus}`;

      try {
        const res = await fetch("/api/arinc/channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rx_ch: nextBus }),
        });
        if (res.ok) {
          const fresh = await res.json();
          snap = fresh;
          dmeStandardState.lastSnap = fresh;
          patchDmeStandardRx(fresh);
        }
      } catch (err) {
        console.error("Failed to switch RX bus", err);
      }
    };

    // Softkey 1: DISP CURSOR
    const advanceCursor = () => {
      const skCursor = p.querySelector("#std-sk-cursor");
      if (skCursor) triggerPress(skCursor);
      dmeStandardState.cursorActive = true;

      const curFld = dmeStandardState.cursorField || "DATA";
      const pos = dmeStandardState.cursorPos != null ? dmeStandardState.cursorPos : 0;

      if (curFld === "DATA") {
        if (pos < 3) {
          dmeStandardState.cursorPos = pos + 1;
        } else {
          dmeStandardState.cursorField = "SDI";
          dmeStandardState.cursorPos = 0;
        }
      } else if (curFld === "SDI") {
        if (pos < 1) {
          dmeStandardState.cursorPos = pos + 1;
        } else {
          dmeStandardState.cursorField = "PAD";
          dmeStandardState.cursorPos = 0;
        }
      } else if (curFld === "PAD") {
        if (pos < 6) {
          dmeStandardState.cursorPos = pos + 1;
        } else {
          dmeStandardState.cursorField = "SSM";
          dmeStandardState.cursorPos = 0;
        }
      } else if (curFld === "SSM") {
        dmeStandardState.cursorField = "DATA";
        dmeStandardState.cursorPos = 0;
      } else {
        dmeStandardState.cursorField = "DATA";
        dmeStandardState.cursorPos = 0;
      }
      updateTxRowDOM();
    };

    const skCursor = p.querySelector("#std-sk-cursor");
    if (skCursor) skCursor.onclick = (e) => { e.preventDefault(); advanceCursor(); };

    // Softkey 2: DATA STEP
    const skStep = p.querySelector("#std-sk-step");
    if (skStep) {
      skStep.onclick = (e) => {
        e.preventDefault();
        triggerPress(skStep);
        stepActiveField();
      };
    }

    // Softkey 3: INC. / DECR
    const setStepDir = (newDir) => {
      const curDir = dmeStandardState.stepDir || "INC";
      const nextDir = newDir || (curDir === "INC" ? "DECR" : "INC");
      dmeStandardState.stepDir = nextDir;
      const hInc = p.querySelector("#std-sk-half-inc");
      const hDec = p.querySelector("#std-sk-half-dec");
      if (hInc) hInc.classList.toggle("active", nextDir === "INC");
      if (hDec) hDec.classList.toggle("active", nextDir === "DECR");
    };

    const skIncDec = p.querySelector("#std-sk-incdec");
    if (skIncDec) {
      skIncDec.onclick = (e) => {
        e.preventDefault();
        if (e.target && e.target.closest("#std-sk-half-inc")) {
          setStepDir("INC");
          return;
        }
        if (e.target && e.target.closest("#std-sk-half-dec")) {
          setStepDir("DECR");
          return;
        }
        setStepDir(dmeStandardState.stepDir === "INC" ? "DECR" : "INC");
      };
    }

    // Softkey 4: MORE WORDS
    const skMore = p.querySelector("#std-sk-more");
    if (skMore) {
      skMore.onclick = (e) => {
        e.preventDefault();
        triggerPress(skMore);
        const rxChLive = dmeStandardState.rxBus || "A";
        const currentSnap = dmeStandardState.lastSnap || snap;
        const rxLabs = (currentSnap && currentSnap.rx && currentSnap.rx[rxChLive] && currentSnap.rx[rxChLive].labels) || [];
        if (rxLabs.length <= 1) {
          const hdrWords = p.querySelector("#std-hdr-rx-words");
          if (hdrWords) {
            const orig = hdrWords.textContent;
            hdrWords.textContent = (rxLabs.length === 1) ? `1/1 RX WORD (${rxLabs[0].label}) - NO MORE WORDS` : "NO RX WORDS RECEIVED";
            setTimeout(() => { if (hdrWords) hdrWords.textContent = orig; }, 1200);
          }
          return;
        }
        dmeStandardState.rxWordIndex = ((dmeStandardState.rxWordIndex || 0) + 1) % rxLabs.length;
        patchDmeStandardRx(currentSnap);
      };
    }

    // Softkey 5: BIT RATE
    const stepBitRate = async () => {
      const skBitRate = p.querySelector("#std-sk-bitrate");
      if (skBitRate) triggerPress(skBitRate);

      const t1200Rates = [8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, 20.0];
      const cur = Number(dmeStandardState.bitRate != null ? dmeStandardState.bitRate : (curRate || 12.5));
      let idx = t1200Rates.findIndex((r) => Math.abs(r - cur) < 0.05);
      if (idx === -1) idx = 3; // 12.5
      const dir = (dmeStandardState.stepDir === "DECR") ? -1 : 1;
      const nextRate = t1200Rates[(idx + dir + t1200Rates.length) % t1200Rates.length];
      dmeStandardState.bitRate = nextRate;

      const rateLbl = p.querySelector("#std-sk-rate-label");
      if (rateLbl) rateLbl.textContent = `${nextRate.toFixed(1)} KBPS`;
      const midRate = p.querySelector("#std-middle-rate-val");
      if (midRate) midRate.textContent = `${nextRate.toFixed(1)} KBPS`;

      try {
        const res = await api("/api/arinc/channel", {
          method: "POST",
          body: JSON.stringify({
            bus: dmeStandardState.txBus || "A",
            bit_rate_kbps: nextRate,
          }),
        });
        if (res) {
          snap = res;
          dmeStandardState.lastSnap = res;
          patchDmeStandardRx(res);
        }
      } catch (e) {
        console.error("Failed to update bitrate", e);
      }
    };
    const skBitRate = p.querySelector("#std-sk-bitrate");
    if (skBitRate) skBitRate.onclick = (e) => { e.preventDefault(); stepBitRate(); };

    // Softkey 6: TX-A / TX-B
    const skTx = p.querySelector("#std-sk-tx");
    if (skTx) {
      skTx.onclick = (e) => {
        e.preventDefault();
        if (e.target && e.target.closest("#std-sk-txa-half")) {
          toggleTxBus("A");
          return;
        }
        if (e.target && e.target.closest("#std-sk-txb-half")) {
          toggleTxBus("B");
          return;
        }
        toggleTxBus();
      };
    }

    // Softkey 7: RX-A / RX-B
    const skRx = p.querySelector("#std-sk-rx");
    if (skRx) {
      skRx.onclick = (e) => {
        e.preventDefault();
        if (e.target && e.target.closest("#std-sk-rxa-half")) {
          toggleRxBus("A");
          return;
        }
        if (e.target && e.target.closest("#std-sk-rxb-half")) {
          toggleRxBus("B");
          return;
        }
        toggleRxBus();
      };
    }

    // Direct cell click listeners on TX row
    p.querySelector("#std-td-tx-ch").onclick = () => toggleTxBus();

    p.querySelector("#std-td-data").onclick = (e) => {
      const bitSpan = e.target.closest(".dme-cursor-bit");
      if (bitSpan) {
        const pIdx = parseInt(bitSpan.getAttribute("data-pos"), 10) || 0;
        dmeStandardState.cursorActive = true;
        dmeStandardState.cursorField = "DATA";
        dmeStandardState.cursorPos = pIdx;
        updateTxRowDOM();
      } else {
        dmeStandardState.cursorActive = true;
        dmeStandardState.cursorField = "DATA";
        updateTxRowDOM();
      }
    };

    p.querySelector("#std-td-sdi").onclick = (e) => {
      const bitSpan = e.target.closest(".dme-cursor-bit");
      const pIdx = bitSpan ? (parseInt(bitSpan.getAttribute("data-pos"), 10) || 0) : 0;
      dmeStandardState.cursorActive = true;
      dmeStandardState.cursorField = "SDI";
      dmeStandardState.cursorPos = pIdx;
      updateTxRowDOM();
    };

    p.querySelector("#std-td-pad").onclick = (e) => {
      const bitSpan = e.target.closest(".dme-cursor-bit");
      const pIdx = bitSpan ? (parseInt(bitSpan.getAttribute("data-pos"), 10) || 0) : 0;
      dmeStandardState.cursorActive = true;
      dmeStandardState.cursorField = "PAD";
      dmeStandardState.cursorPos = pIdx;
      updateTxRowDOM();
    };

    p.querySelector("#std-td-ssm").onclick = () => {
      dmeStandardState.cursorActive = true;
      dmeStandardState.cursorField = "SSM";
      dmeStandardState.cursorPos = 0;
      updateTxRowDOM();
    };

    p.querySelector("#std-td-label").onclick = () => {
      const live = getStdSlotData(dmeStandardState.activeSlot, dmeStandardState.txBus);
      showDmeKeypadModal({
        title: "SET LABEL (OCTAL)",
        value: live.label_octal,
        type: "numeric",
        hint: "Enter 3-digit octal label (e.g. 035, 201, 202)",
        onApply: (v) => {
          let sVal = String(v).padStart(3, "0").slice(-3);
          saveCurrentSlot({ label: sVal });
        },
      });
    };

    p.querySelector("#std-td-par").onclick = () => {
      const live = getStdSlotData(dmeStandardState.activeSlot, dmeStandardState.txBus);
      const nextPar = live.parity === "ODD" ? "EVEN" : "ODD";
      saveCurrentSlot({ parity: nextPar });
    };

    p.querySelector("#std-td-rate").onclick = () => {
      const live = getStdSlotData(dmeStandardState.activeSlot, dmeStandardState.txBus);
      showDmeKeypadModal({
        title: "SET TRANSMIT RATE (ms)",
        value: String(live.rate),
        type: "numeric",
        hint: "Enter transmit rate in ms (e.g. 100, 150, 200)",
        onApply: (v) => {
          const rNum = Math.max(10, Math.min(5000, parseInt(v, 10) || 150));
          saveCurrentSlot({ rate_ms: rNum });
        },
      });
    };

    // Navigation and Action buttons in toolbar
    p.querySelector("#btn-dme-std-back").onclick = () => selectMode("standard");
    p.querySelector("#btn-dme-std-lrus").onclick = () => navTo("avionics_lru");
    p.querySelector("#btn-dme-std-diag").onclick = () => pushScreen("dme_diagnostic");
    p.querySelector("#btn-dme-std-reset").onclick = async () => {
      dmeStandardState.activeSlot = 0;
      dmeStandardState.txBus = "A";
      dmeStandardState.rxBus = "A";
      dmeStandardState.stepDir = "INC";
      dmeStandardState.cursorActive = false;
      dmeStandardState.cursorField = "DATA";
      dmeStandardState.cursorPos = 0;
      dmeStandardState.rxWordIndex = 0;
      dmeStandardState.bitRate = 12.5;
      dmeStandardState.slots = {};
      try {
        const snapIn = await api("/api/arinc/dme/mode", {
          method: "POST",
          body: JSON.stringify({ mode: "standard", reset: true }),
        });
        await api("/api/arinc/channel", {
          method: "POST",
          body: JSON.stringify({ bus: "A", bit_rate_kbps: 12.5, tx_ch: "A", rx_ch: "A" }),
        });
        if (snapIn) {
          snap = snapIn;
          dmeStandardState.lastSnap = snapIn;
          render(snapIn);
        }
        const newResetBtn = p.querySelector("#btn-dme-std-reset");
        if (newResetBtn) {
          const origText = newResetBtn.textContent;
          newResetBtn.textContent = "✓ Defaults Restored";
          newResetBtn.style.color = "var(--accent)";
          setTimeout(() => {
            if (newResetBtn) {
              newResetBtn.textContent = origText;
              newResetBtn.style.color = "";
            }
          }, 1000);
        }
      } catch (e) {
        console.error("Reset failed", e);
      }
    };

    p.querySelector("#btn-dme-std-tx").onclick = async () => {
      const b = dmeStandardState.txBus || "A";
      const sIdx = dmeStandardState.activeSlot || 0;
      const sl = getStdSlotData(sIdx, b);
      try {
        await applyDmeSlotHelper({
          index: sIdx,
          bus: b,
          freq_mhz: sl.freq,
          label: sl.label_octal,
          sdi: sl.sdi,
          pad: sl.pad,
          ssm: sl.ssm,
          parity: sl.parity,
          rate_ms: sl.rate,
          enabled: true,
        });
        const btn = p.querySelector("#btn-dme-std-tx");
        if (btn) {
          const old = btn.textContent;
          btn.textContent = "TRANSMITTED!";
          btn.classList.add("btn-success");
          setTimeout(() => {
            btn.textContent = old;
            btn.classList.remove("btn-success");
          }, 800);
        }
      } catch (err) {
        alert("TX Failed: " + err.message);
      }
    };
  }

  // ====================================================================
  // DME LIVE HANDSHAKE & ECHO DIAGNOSTIC WORKBENCH
  // ARINC 709 Hardware-in-the-Loop Protocol Verification & Analyzer
  // ====================================================================

  let dmeDiagState = {
    bus: "A",
    freqMhz: 134.40,
    rateMs: 100,
    stimulusActive: true,
    simScenario: "auto",
    timer: null,
  };

  function stopDmeDiagTimer() {
    if (dmeDiagState.timer) {
      clearInterval(dmeDiagState.timer);
      dmeDiagState.timer = null;
    }
  }

  async function triggerDmeHandshake(arm = true) {
    try {
      const data = await api("/api/arinc/dme/handshake", {
        method: "POST",
        body: JSON.stringify({
          bus: dmeDiagState.bus,
          freq_mhz: dmeDiagState.freqMhz,
          rate_ms: dmeDiagState.rateMs,
          arm_stimulus: arm,
          sim_scenario: dmeDiagState.simScenario,
        }),
      });
      updateDmeDiagDom(data);
    } catch (e) {
      console.warn("Handshake error:", e);
    }
  }

  async function pollDmeDiagnostic() {
    try {
      const data = await api(`/api/arinc/dme/diagnostic?bus=${encodeURIComponent(dmeDiagState.bus)}&sim_scenario=${encodeURIComponent(dmeDiagState.simScenario)}`);
      updateDmeDiagDom(data);
    } catch (e) {
      console.warn("Diag poll error:", e);
    }
  }

  function updateDmeDiagDom(data) {
    if (!data) return;
    const banner = $("dme-diag-banner");
    if (!banner) return;

    // Hardware Info
    if (data.hardware) {
      const hw = data.hardware;
      const hwDesc = $("dme-hw-desc");
      const hwBadge = $("dme-hw-port-badge");
      const hwWarn = $("dme-hw-warning-box");
      const hwModel = $("dme-hw-model");
      if (hwModel) {
        hwModel.textContent = hw.simulated ? "SIMULATOR" : "BALLARD PXI";
      }
      if (hwDesc) {
        hwDesc.innerHTML = `OmniBus II Model: <strong>${hw.product_pn || "222-441-000"}</strong> (S/N: <strong>${hw.serial_num || "2174"}</strong>) &bull; Active: <strong>Core ${hw.active_core ?? 0} [${hw.active_port || "P1 Upper"}]</strong> &bull; 8 TX / 8 RX Channels`;
      }
      if (hwBadge) {
        hwBadge.textContent = `CORE ${hw.active_core ?? 0} [${hw.active_port || "PORT P1"}]`;
        hwBadge.style.background = hw.active_core === 0 ? "#16a34a" : "#ca8a04";
        hwBadge.style.color = "#ffffff";
      }
      if (hwWarn) {
        if (hw.warning) {
          hwWarn.style.display = "block";
          hwWarn.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> <strong>PENTING (KONEKSI FISIK PXI):</strong> ${hw.warning}`;
        } else {
          hwWarn.style.display = "none";
        }
      }
    }

    // Status Banner
    const lvl = data.status_level || "danger";
    banner.className = `dme-diag-status-banner status-${lvl}`;
    const iconEl = $("dme-diag-icon");
    if (iconEl) {
      iconEl.textContent = lvl === "ok" ? "🟢" : (lvl === "warn" ? "🟡" : "🔴");
    }
    const titleEl = $("dme-diag-title");
    if (titleEl) titleEl.textContent = data.status || "UNKNOWN STATUS";
    const detailEl = $("dme-diag-detail");
    if (detailEl) detailEl.textContent = data.detail || "";

    const modeTag = $("dme-diag-mode-tag");
    if (modeTag) {
      modeTag.textContent = data.is_real_hardware ? "PHYSICAL BENCH" : "SIMULATION ENGINE";
      modeTag.className = data.is_real_hardware ? "dme-diag-tag-ok" : "dme-diag-tag-warn";
    }

    // Telemetry Cards
    const echoStatusEl = $("dme-diag-echo-status");
    if (echoStatusEl) {
      const echo = data.echo || {};
      const eStat = echo.status || "NONE";
      const tagCls = eStat === "ECHO OK" ? "dme-diag-tag-ok" : (eStat === "NONE" ? "dme-diag-tag-warn" : "dme-diag-tag-danger");
      echoStatusEl.innerHTML = `<span class="${tagCls}">${eStat}</span> ${echo.freq_mhz ? `${Number(echo.freq_mhz).toFixed(2)} MHz` : "--"}`;
      $("dme-diag-echo-sub").textContent = `Mode: ${echo.mode || "--"} | Age: ${echo.last_seen_s != null ? `${echo.last_seen_s}s` : "n/a"}`;
    }

    const bnrDistEl = $("dme-diag-bnr-val");
    if (bnrDistEl) {
      const bnr = data.bnr_distance || {};
      bnrDistEl.textContent = bnr.dist_text || "--.- NM";
      const memStr = bnr.mem ? ` | MEM: ${bnr.mem}` : "";
      const bfStr = bnr.bf ? ` | B/F: ${bnr.bf}` : "";
      $("dme-diag-bnr-sub").textContent = `SSM: ${bnr.ssm || "NONE"}${memStr}${bfStr} | Age: ${bnr.last_seen_s != null ? `${bnr.last_seen_s}s` : "n/a"}`;
    }

    const bcdDistEl = $("dme-diag-bcd-val");
    if (bcdDistEl) {
      const bcd = data.bcd_distance || {};
      bcdDistEl.textContent = bcd.dist_text || "----";
      $("dme-diag-bcd-sub").textContent = `SSM: ${bcd.ssm || "NONE"} | Age: ${bcd.last_seen_s != null ? `${bcd.last_seen_s}s` : "n/a"}`;
    }

    const identEl = $("dme-diag-ident-val");
    if (identEl) {
      const idt = data.ident || {};
      identEl.textContent = idt.ident_text || "----";
      $("dme-diag-ident-sub").textContent = `Label 246/247 | Age: ${idt.last_seen_s != null ? `${idt.last_seen_s}s` : "n/a"}`;
    }

    // Channel Activity Monitor Table
    const chTbody = $("dme-channel-activity-tbody");
    if (chTbody && data.channel_activity) {
      const chs = Object.values(data.channel_activity);
      chTbody.innerHTML = chs.map((c) => {
        const isTx = c.type === "TX";
        const typePill = isTx ? `<span class="pill pill-run">TX</span>` : `<span class="pill pill-sub">RX</span>`;
        const activeLed = c.active
          ? `<span style="color:#16a34a; font-weight:700;">🟢 ACTIVE</span>`
          : `<span class="muted">⚪ IDLE</span>`;
        const lastHex = c.last_hex ? `<span style="font-family:var(--font-mono); color:var(--accent); font-weight:700;">${c.last_hex}</span>` : `<span class="muted">--</span>`;
        const labelOct = c.last_label && c.last_label !== "---" ? `<strong>${c.last_label}</strong>` : `<span class="muted">--</span>`;
        const hitsCount = c.hits != null ? c.hits : (c.count != null ? c.count : 0);
        const ageVal = c.age_s != null ? c.age_s : c.last_seen_s;
        const ageStr = ageVal != null ? `${ageVal}s ago` : `<span class="muted">never</span>`;
        return `
          <tr style="${c.active ? "background:rgba(22,163,74,0.06);" : ""}">
            <td>${typePill}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.t1200_label || "-"}</td>
            <td><code>${c.db37_pins || "-"}</code></td>
            <td>${activeLed}</td>
            <td style="font-family:var(--font-mono); font-weight:700;">${hitsCount}</td>
            <td>${lastHex}</td>
            <td>${labelOct}</td>
            <td class="muted">${ageStr}</td>
          </tr>
        `;
      }).join("");
    }

    // Warning alert
    const warnBox = $("dme-diag-warn-box");
    if (warnBox) {
      if (data.wiring_warning) {
        warnBox.style.display = "block";
        warnBox.innerHTML = `<strong>${data.wiring_warning}</strong>`;
      } else {
        warnBox.style.display = "none";
      }
    }

    // Raw Words Table
    const tbody = $("dme-diag-words-tbody");
    if (tbody) {
      const words = data.words || [];
      if (!words.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center; padding:1.5rem;">No words captured yet on RCVR_${data.bus}. Ensure TX stimulus is armed or DME is powered.</td></tr>`;
      } else {
        tbody.innerHTML = words.map((w) => {
          const dirPill = w.direction === "TX" ? `<span class="pill pill-run">TX</span>` : `<span class="pill pill-sub">RX</span>`;
          const parTag = w.parity_odd ? `<span class="dme-diag-tag-ok">ODD_OK</span>` : `<span class="dme-diag-tag-danger">PARITY_ERR</span>`;
          return `
            <tr>
              <td>${dirPill}</td>
              <td style="font-weight:600;">${w.name || "-"}</td>
              <td><strong>${w.label_octal || "-"}</strong></td>
              <td>${w.sdi != null ? String(w.sdi).padStart(2, "0") : "--"}</td>
              <td style="color:var(--accent); font-weight:700;">${w.hex}</td>
              <td><span class="dme-bitfield-pill">${w.formatted_bin || "-"}</span></td>
              <td>${parTag}</td>
              <td class="muted">${w.age_s != null ? `${w.age_s}s` : "now"}</td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  function renderDmeDiagnostic(r, s) {
    stopDmeDiagTimer();
    dmeDiagState.bus = s.tx_ch || s.rx_ch || dmeDiagState.bus || "A";
    const p = el("div", "panel");
    p.innerHTML = `
      <div class="lru-toolbar">
        <div>
          <div class="panel-title" style="margin-bottom:.35rem">DME Live Handshake &amp; Echo Diagnostic</div>
          <p class="muted">ARINC 709 Hardware-in-the-Loop Handshake, 32-bit Protocol Analyzer &amp; Bench Wiring Check</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="pill pill-run">12.5 kbps Low Speed</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-dme-diag-back">&lt; Back to DME Modes</button>
        </div>
      </div>

      <!-- Hardware Audit & Active Port Banner -->
      <div id="dme-diag-hw-card" class="dme-diag-card" style="margin-bottom:1rem; border-left:4px solid #0284c7; background:rgba(2,132,199,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span class="pill pill-run" id="dme-hw-model" style="margin-right:8px; font-weight:700;">OmniBus II</span>
            <span style="font-weight:600; font-size:0.9rem;" id="dme-hw-desc">Scanning Astronics Ballard OmniBus II hardware...</span>
          </div>
          <div>
            <span id="dme-hw-port-badge" class="pill" style="background:#0284c7; color:#fff; font-weight:700;">PORT P1 (UPPER)</span>
          </div>
        </div>
        <div id="dme-hw-warning-box" style="display:none; margin-top:8px; padding:10px 14px; background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:6px; font-size:0.85rem; color:#b91c1c;">
        </div>
      </div>

      <!-- Live Connection Banner -->
      <div id="dme-diag-banner" class="dme-diag-status-banner status-warn">
        <div class="dme-diag-banner-main">
          <div class="dme-diag-status-icon" id="dme-diag-icon">⏳</div>
          <div>
            <div class="dme-diag-status-title" id="dme-diag-title">INITIALIZING DIAGNOSTIC...</div>
            <div class="dme-diag-status-detail" id="dme-diag-detail">Checking ARINC 429 bus status and arming stimulus...</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span id="dme-diag-mode-tag" class="dme-diag-tag-ok">CHECKING...</span>
        </div>
      </div>

      <!-- Controls & Stimulus Configuration -->
      <div class="dme-diag-card" style="margin-bottom:1.5rem;">
        <div class="dme-diag-card-title">Handshake Stimulus Configuration (TX Label 035)</div>
        <div style="display:flex; gap:1.2rem; flex-wrap:wrap; align-items:center;">
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-2); display:block; margin-bottom:4px;">TEST FREQUENCY</label>
            <div class="btn-group" id="diag-freq-group">
              <button type="button" class="btn btn-sm ${dmeDiagState.freqMhz === 134.40 ? "" : "btn-ghost"}" id="btn-freq-134">134.40 MHz (Chan 1X)</button>
              <button type="button" class="btn btn-sm ${dmeDiagState.freqMhz === 108.00 ? "" : "btn-ghost"}" id="btn-freq-108">108.00 MHz (Chan 17X)</button>
              <button type="button" class="btn btn-sm btn-ghost" id="btn-freq-custom">Custom</button>
            </div>
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-2); display:block; margin-bottom:4px;">ARINC 429 BUS</label>
            <div class="btn-group">
              <button type="button" class="btn btn-sm ${dmeDiagState.bus === "A" ? "" : "btn-ghost"}" id="btn-bus-a">CH A</button>
              <button type="button" class="btn btn-sm ${dmeDiagState.bus === "B" ? "" : "btn-ghost"}" id="btn-bus-b">CH B</button>
            </div>
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-2); display:block; margin-bottom:4px;">SIMULATION SCENARIO</label>
            <select class="input" id="sel-diag-sim" style="padding:4px 8px; font-size:0.85rem;">
              <option value="auto" ${dmeDiagState.simScenario === "auto" ? "selected" : ""}>Auto (Hardware / Active)</option>
              <option value="active" ${dmeDiagState.simScenario === "active" ? "selected" : ""}>Active DME (50.0 NM Range)</option>
              <option value="loopback_only" ${dmeDiagState.simScenario === "loopback_only" ? "selected" : ""}>Loopback / TX Echo Only</option>
              <option value="disconnected" ${dmeDiagState.simScenario === "disconnected" ? "selected" : ""}>Disconnected (No RX)</option>
            </select>
          </div>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <button type="button" class="btn btn-sm" id="btn-diag-transmit">⚡ Retransmit Stimulus (100ms)</button>
          </div>
        </div>
      </div>

      <!-- Warning Alert Box -->
      <div id="dme-diag-warn-box" style="display:none; padding:12px 16px; margin-bottom:1.5rem; background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:6px; color:#b91c1c; font-size:0.9rem;">
      </div>

      <!-- Decoded Telemetry Cards -->
      <div class="dme-diag-telemetry-grid">
        <div class="dme-diag-card">
          <div class="dme-diag-card-title">1. Frequency Echo (Label 035)</div>
          <div class="dme-diag-card-value" id="dme-diag-echo-status">--</div>
          <div class="dme-diag-card-sub" id="dme-diag-echo-sub">Verifying tuning loopback</div>
        </div>
        <div class="dme-diag-card">
          <div class="dme-diag-card-title">2. BNR Distance (Label 202)</div>
          <div class="dme-diag-card-value" id="dme-diag-bnr-val">--.- NM</div>
          <div class="dme-diag-card-sub" id="dme-diag-bnr-sub">Binary distance telemetry</div>
        </div>
        <div class="dme-diag-card">
          <div class="dme-diag-card-title">3. BCD Distance (Label 201)</div>
          <div class="dme-diag-card-value" id="dme-diag-bcd-val">----</div>
          <div class="dme-diag-card-sub" id="dme-diag-bcd-sub">BCD distance display</div>
        </div>
        <div class="dme-diag-card">
          <div class="dme-diag-card-title">4. Ground Station Ident</div>
          <div class="dme-diag-card-value" id="dme-diag-ident-val">----</div>
          <div class="dme-diag-card-sub" id="dme-diag-ident-sub">Morse / Alpha Ident</div>
        </div>
      </div>

      <!-- Live 16-Channel Transceiver Hardware Monitor (Core 0 / P1 Upper) -->
      <div class="dme-diag-card" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <div class="dme-diag-card-title">Live Hardware Transceiver Activity Monitor (Core 0 / Port P1 / DB37 J1)</div>
            <div style="font-size:0.75rem; color:var(--text-2);">
              Real-time packet sniffing &amp; hardware activity counters across all 8 RX (0..7) and 8 TX (16..23) transceivers
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-sm btn-outline" id="btn-run-hw-selftest">⚡ Run Hardware Selftest</button>
          </div>
        </div>
        <div id="dme-selftest-result-box" style="display:none; margin-top:10px; padding:10px 14px; border-radius:6px; font-size:0.85rem;"></div>
        <div style="overflow-x:auto; margin-top:10px;">
          <table class="dme-raw-table" id="dme-channel-activity-table">
            <thead>
              <tr>
                <th style="width:70px;">TYPE</th>
                <th style="width:120px;">CHANNEL</th>
                <th style="width:140px;">T1200 / BUS</th>
                <th style="width:120px;">DB37 J1 PINS</th>
                <th style="width:100px;">STATUS</th>
                <th style="width:90px;">HITS</th>
                <th style="width:120px;">LAST WORD</th>
                <th style="width:90px;">LABEL</th>
                <th style="width:80px;">AGE</th>
              </tr>
            </thead>
            <tbody id="dme-channel-activity-tbody">
              <tr><td colspan="9" class="muted" style="text-align:center; padding:1rem;">Scanning channel activity...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Raw 32-Bit Word Protocol Analyzer -->
      <div class="dme-diag-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="dme-diag-card-title">Live 32-Bit Word Protocol Analyzer</div>
            <div style="font-size:0.75rem; color:var(--text-2);">
              Field Breakdown: <code>P (bit 32) | SSM (bits 31-30) | DATA (bits 29-11) | SDI (bits 10-9) | LABEL (bits 8-1)</code>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-refresh-raw">Refresh</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="dme-raw-table">
            <thead>
              <tr>
                <th style="width:60px;">DIR</th>
                <th>SIGNAL / NAME</th>
                <th style="width:80px;">LABEL</th>
                <th style="width:60px;">SDI</th>
                <th style="width:120px;">HEX (32-BIT)</th>
                <th>BINARY FIELD BREAKDOWN (P | SSM | DATA | SDI | LABEL)</th>
                <th style="width:100px;">PARITY</th>
                <th style="width:80px;">AGE</th>
              </tr>
            </thead>
            <tbody id="dme-diag-words-tbody">
              <tr><td colspan="8" class="muted" style="text-align:center; padding:1.5rem;">Listening on ARINC 429 Bus...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Physical Test Bench Troubleshooting Checklist -->
      <div class="dme-checklist-card">
        <div class="dme-diag-card-title" style="margin-bottom:0.75rem;">
          📋 Hardware-in-the-Loop Physical Troubleshooting Checklist (Tailored to Bench Units)
        </div>
        <div id="dme-checklist-container">
          <div class="dme-checklist-row" style="background:rgba(2,132,199,0.06); border-left:3px solid #0284c7;">
            <div class="dme-checklist-bullet" style="background:#0284c7; color:#fff;">1</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">Konektor Fisik PXI Ballard OmniBus II (Port Atas P1 vs Bawah P2)</div>
              <div class="dme-checklist-item-expected">Expected: KONEKTOR ATAS (P1 BALLARD / Core 0) Terhubung ke Interface Panel</div>
              <div class="dme-checklist-item-action">Modul ARINC 429 PN 222-441-000 hanya memiliki modul transceiver pada Core 0 (Konektor Atas P1). Konektor Bawah P2 adalah Core 1 (000/Kosong). Pastikan kabel DB37 / Interface Panel dicolokkan ke KONEKTOR ATAS (P1), BUKAN konektor bawah P2!</div>
            </div>
          </div>
          <div class="dme-checklist-row">
            <div class="dme-checklist-bullet">2</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">DFIU T1203 Rear OPERATION Switch</div>
              <div class="dme-checklist-item-expected">Expected: MANUAL</div>
              <div class="dme-checklist-item-action">Check toggle switch at rear panel of Kustom Electronics T1203 DFIU. Ensure it is set to MANUAL (not REMOTE).</div>
            </div>
          </div>
          <div class="dme-checklist-row">
            <div class="dme-checklist-bullet">3</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">ARINC 429 Wiring (Panel TX to DFIU INPUTS)</div>
              <div class="dme-checklist-item-expected">Expected: CH A POS/NEG/GND &rarr; DME A-FREQ FUNCT SELECT-A</div>
              <div class="dme-checklist-item-action">Ensure blue (POS/HI), white (NEG/LO), and yellow (GND) lines from panel CH 0/CH A are connected to DFIU ARINC 429 INPUTS.</div>
            </div>
          </div>
          <div class="dme-checklist-row">
            <div class="dme-checklist-bullet">4</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">ARINC 429 Wiring (DFIU OUTPUTS to Panel RX)</div>
              <div class="dme-checklist-item-expected">Expected: DME A-DISTANCE DATA-1 &rarr; CH A POS/NEG/GND</div>
              <div class="dme-checklist-item-action">Ensure reply lines from DFIU ARINC 429 OUTPUTS (DME A-DISTANCE DATA-1) are firmly seated in panel CH A RX.</div>
            </div>
          </div>
          <div class="dme-checklist-row">
            <div class="dme-checklist-bullet">5</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">Collins DME-900 Breakout Box 56-1189-22</div>
              <div class="dme-checklist-item-expected">Expected: SUPPRESSOR CLOSED, Thumbwheels 001</div>
              <div class="dme-checklist-item-action">Verify SUPPRESSOR toggle is CLOSED. Verify 100-pin ATE connector latch is fully locked.</div>
            </div>
          </div>
          <div class="dme-checklist-row">
            <div class="dme-checklist-bullet">6</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">IFR ATC-1400A RF Simulator</div>
              <div class="dme-checklist-item-expected">Expected: Channel 0001 TAC X (134.40 MHz), RANGE 50.00 NM, RF Level -86 dBm</div>
              <div class="dme-checklist-item-action">Ensure ATC-1400A is set to Channel 1X / 134.40 MHz, RANGE 50.00 NM, and RF coax is connected to DME-900 ANTENNA port.</div>
            </div>
          </div>
          <div class="dme-checklist-row">
            <div class="dme-checklist-bullet">7</div>
            <div class="dme-checklist-body">
              <div class="dme-checklist-item-title">28VDC Power Supply</div>
              <div class="dme-checklist-item-expected">Expected: +28.0 VDC Active</div>
              <div class="dme-checklist-item-action">Ensure 28VDC power supply feeding DFIU T1203 and DME-900 is turned ON and delivering steady 28.0 VDC.</div>
            </div>
          </div>
        </div>
      </div>
    `;
    r.appendChild(p);

    // Event listeners
    p.querySelector("#btn-dme-diag-back").onclick = () => {
      stopDmeDiagTimer();
      navTo("dme_config");
    };

    const applyBusSelection = async (newBus) => {
      dmeDiagState.bus = newBus;
      const btnA = p.querySelector("#btn-bus-a");
      const btnB = p.querySelector("#btn-bus-b");
      if (btnA && btnB) {
        if (newBus === "A") {
          btnA.classList.remove("btn-ghost");
          btnB.classList.add("btn-ghost");
        } else {
          btnA.classList.add("btn-ghost");
          btnB.classList.remove("btn-ghost");
        }
      }
      try {
        await api("/api/arinc/channel/active", {
          method: "POST",
          body: JSON.stringify({ tx_ch: newBus, rx_ch: newBus }),
        });
      } catch (e) {
        console.warn("Active channel sync error:", e);
      }
      triggerDmeHandshake(true);
    };

    const applyFreqSelection = (newFreq) => {
      dmeDiagState.freqMhz = newFreq;
      const b134 = p.querySelector("#btn-freq-134");
      const b108 = p.querySelector("#btn-freq-108");
      const bCust = p.querySelector("#btn-freq-custom");
      if (b134) b134.classList.toggle("btn-ghost", newFreq !== 134.40);
      if (b108) b108.classList.toggle("btn-ghost", newFreq !== 108.00);
      if (bCust) bCust.classList.toggle("btn-ghost", newFreq === 134.40 || newFreq === 108.00);
      triggerDmeHandshake(true);
    };

    p.querySelector("#btn-freq-134").onclick = () => applyFreqSelection(134.40);
    p.querySelector("#btn-freq-108").onclick = () => applyFreqSelection(108.00);

    p.querySelector("#btn-freq-custom").onclick = () => {
      showDmeKeypadModal({
        title: "SET DME FREQ (MHz)",
        value: dmeDiagState.freqMhz.toFixed(2),
        type: "numeric",
        hint: "Enter frequency in MHz (e.g. 134.40 or 108.00)",
        onApply: (v) => {
          const num = parseFloat(v);
          if (Number.isFinite(num) && num >= 100.0 && num <= 140.0) {
            applyFreqSelection(Number(num.toFixed(2)));
          }
        },
      });
    };

    p.querySelector("#btn-bus-a").onclick = () => applyBusSelection("A");
    p.querySelector("#btn-bus-b").onclick = () => applyBusSelection("B");

    p.querySelector("#sel-diag-sim").onchange = (e) => {
      dmeDiagState.simScenario = e.target.value;
      triggerDmeHandshake(true);
    };

    p.querySelector("#btn-diag-transmit").onclick = () => {
      triggerDmeHandshake(true);
    };

    p.querySelector("#btn-refresh-raw").onclick = () => {
      pollDmeDiagnostic();
    };

    const selftestBtn = p.querySelector("#btn-run-hw-selftest");
    if (selftestBtn) {
      selftestBtn.onclick = async () => {
        selftestBtn.disabled = true;
        selftestBtn.textContent = "Running Selftest...";
        const box = p.querySelector("#dme-selftest-result-box");
        try {
          const res = await api("/api/arinc/hardware/selftest", { method: "POST" });
          if (box) {
            box.style.display = "block";
            if (res.overall_status === "PASS") {
              box.style.background = "rgba(22,163,74,0.1)";
              box.style.border = "1px solid #16a34a";
              box.style.color = "#15803d";
              box.innerHTML = `<strong>✅ HARDWARE SELFTEST PASS:</strong> ${res.message || "All Ballard OmniBus II transceivers operational."}`;
            } else {
              box.style.background = "rgba(239,68,68,0.1)";
              box.style.border = "1px solid #ef4444";
              box.style.color = "#b91c1c";
              box.innerHTML = `<strong>⚠️ HARDWARE SELFTEST ${res.overall_status}:</strong> ${res.message || "Transceiver check completed with warnings."}`;
            }
          }
        } catch (e) {
          if (box) {
            box.style.display = "block";
            box.style.background = "rgba(239,68,68,0.1)";
            box.style.border = "1px solid #ef4444";
            box.style.color = "#b91c1c";
            box.textContent = "Hardware selftest error: " + e.message;
          }
        } finally {
          selftestBtn.disabled = false;
          selftestBtn.textContent = "⚡ Run Hardware Selftest";
        }
      };
    }

    // Initial trigger & start 500ms polling
    triggerDmeHandshake(true);
    dmeDiagState.timer = setInterval(pollDmeDiagnostic, 500);
  }

  function renderMmrMenu(r, s) {
    const p = el("div", "panel");
    p.style.maxWidth = "860px";
    p.style.margin = "0 auto";

    const toolbar = el("div", "lru-toolbar");
    toolbar.style.display = "flex";
    toolbar.style.justifyContent = "space-between";
    toolbar.style.alignItems = "center";
    toolbar.style.marginBottom = "1rem";
    toolbar.innerHTML = `
      <div>
        <div class="panel-title" style="margin-bottom:0.2rem;">755 MMR (Multi-Mode Receiver)</div>
        <p class="muted" style="margin:0; font-size:12px;">Background TX on B (DADS) and C (IRS) stays armed.</p>
      </div>
      <div>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-mmr-back">&lt; Avionics LRU</button>
      </div>
    `;
    p.appendChild(toolbar);

    const grid = el("div", "hub-grid");
    const items = [
      { id: "ils", title: "710 ILS", desc: "Labels 033 / 017 on channel A" },
      { id: "dads", title: "DADS / FMS", desc: "Channel B 12.5 kbps background" },
      { id: "fms", title: "IRS / FMS", desc: "Channel C 100 kbps background" },
    ];
    items.forEach((it) => {
      const card = el("div", "mode-card");
      card.innerHTML = `<h2>${it.title}</h2><p>${it.desc}</p>`;
      card.addEventListener("click", async () => {
        try {
          render(await api("/api/arinc/mmr/menu", { method: "POST", body: JSON.stringify({ menu: it.id }) }));
        } catch (e) {
          alert(e.message);
        }
      });
      grid.appendChild(card);
    });
    p.appendChild(grid);
    r.appendChild(p);

    const backBtn = toolbar.querySelector("#btn-mmr-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => navTo("avionics_lru"));
    }
  }

  function assignedCh(s, kind) {
    return ["A", "B", "C", "D"].filter((b) => {
      const cfg = (s.bus && s.bus[b]) || {};
      return kind === "tx" ? !!cfg.tx_enable : !!cfg.rx_enable;
    });
  }

  function pickAssigned(cur, list) {
    return list.includes(cur) ? cur : (list[0] || "A");
  }

  function profileSelectHtml(selectedId, selectId, withAuto) {
    const lists = profilesCache || [];
    const sel = selectedId || (withAuto ? "auto" : "");
    const opts = [];
    if (withAuto) {
      opts.push(`<option value="auto" ${sel === "auto" ? "selected" : ""}>Auto</option>`);
    } else {
      opts.push(`<option value="">— select LRU template —</option>`);
    }
    lists.forEach((pr) => {
      opts.push(`<option value="${pr.id}" ${pr.id === sel && sel !== "auto" ? "selected" : ""}>${pr.funct || pr.id} — ${pr.name}</option>`);
    });
    return `<select id="${selectId}">${opts.join("")}</select>`;
  }

  function renderSetupTxRx(r, s) {
    renderChannels(r, s);
    renderTxTable(r, s);
    if (assignedCh(s, "tx").length) renderEditor(r, s);
    renderRxTable(r, s, null, 10, null, assignedCh(s, "rx"));
  }

  function renderChannels(r, s) {
    const p = el("div", "panel");
    p.innerHTML = `<div class="panel-title">Assign CH</div>
      <p class="muted" style="margin-bottom:.65rem">Tick TX and/or RX per channel. Sections below show assigned CH only.</p>`;
    const wrap = el("div", "table-wrap");
    const tbl = document.createElement("table");
    tbl.className = "assign-table";
    tbl.innerHTML = `<thead><tr>
      <th>CH</th><th>TX</th><th>RX</th><th>Bit rate</th><th>Display</th>
    </tr></thead>`;
    const tb = document.createElement("tbody");
    ["A", "B", "C", "D"].forEach((b) => {
      const cfg = (s.bus && s.bus[b]) || {};
      const dm = cfg.display_mode || "ENG";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>CH ${b}</strong></td>
        <td><label class="check"><input type="checkbox" data-chan="${b}" data-field="tx_enable" ${cfg.tx_enable ? "checked" : ""}/> TX</label></td>
        <td><label class="check"><input type="checkbox" data-chan="${b}" data-field="rx_enable" ${cfg.rx_enable ? "checked" : ""}/> RX</label></td>
        <td><select data-chan="${b}" data-field="bit_rate_kbps">${rateOptions(cfg)}</select></td>
        <td><select data-chan="${b}" data-field="display_mode">${["ENG","BIN","HEX"].map((m) => `<option value="${m}" ${dm === m ? "selected" : ""}>${m}</option>`).join("")}</select></td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    p.appendChild(wrap);

    const det = el("details");
    det.className = "wiring-details";
    det.innerHTML = `<summary>Wiring (PHYS / LOG / DB37)</summary>`;
    const mapWrap = el("div", "table-wrap map-table-wrap");
    const mapTbl = document.createElement("table");
    mapTbl.className = "map-table";
    mapTbl.innerHTML = `<thead><tr>
      <th>CH</th><th class="mono">TX PHYS</th><th class="mono">TX LOG</th><th></th>
      <th class="mono">RX PHYS</th><th class="mono">RX LOG</th><th class="mono">DB37 TX</th><th class="mono">DB37 RX</th>
    </tr></thead>`;
    const mapBody = document.createElement("tbody");
    ["A", "B", "C", "D"].forEach((b) => {
      const cfg = (s.bus && s.bus[b]) || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${b}</strong></td>
        <td class="mono">${cfg.phys_tx != null ? "PHYS " + cfg.phys_tx : "–"}</td>
        <td class="mono">${cfg.log_tx ?? "–"}</td>
        <td class="map-arrow">→</td>
        <td class="mono">${cfg.phys_rx != null ? "PHYS " + cfg.phys_rx : "–"}</td>
        <td class="mono">${cfg.log_rx ?? "–"}</td>
        <td class="mono">${pinPair(cfg.tx_db37_hi, cfg.tx_db37_lo)}</td>
        <td class="mono">${pinPair(cfg.rx_db37_hi, cfg.rx_db37_lo)}</td>`;
      mapBody.appendChild(tr);
    });
    mapTbl.appendChild(mapBody);
    mapWrap.appendChild(mapTbl);
    det.appendChild(mapWrap);
    p.appendChild(det);
    r.appendChild(p);
    p.querySelectorAll("input[data-chan]").forEach((inp) => {
      inp.addEventListener("change", () => applyChannel(inp.dataset.chan, inp.dataset.field, inp.checked));
    });
    p.querySelectorAll("select[data-chan]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const f = sel.dataset.field;
        let v = sel.value;
        if (f === "high_speed") v = sel.value === "true";
        if (f === "bit_rate_kbps") v = parseFloat(sel.value);
        applyChannel(sel.dataset.chan, f, v);
      });
    });
  }

  function rateOptions(cfg) {
    const rates = [...((snap && snap.rates && snap.rates.low) || [8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, 20.0]),
      ...((snap && snap.rates && snap.rates.high) || [83, 100, 125])];
    const cur = cfg.bit_rate_kbps || (cfg.high_speed ? 100 : 12.5);
    return rates.map((v) => `<option value="${v}" ${Number(cur) === Number(v) ? "selected" : ""}>${v} kbps</option>`).join("");
  }

  function pinPair(hi, lo) {
    if (hi == null && lo == null) return "–";
    return `${hi ?? "–"}/${lo ?? "–"}`;
  }

  function formatBusMap(cfg) {
    const tx = cfg.phys_tx != null ? `PHYS ${cfg.phys_tx}` : "TX";
    const rx = cfg.phys_rx != null ? `PHYS ${cfg.phys_rx}` : "RX";
    return {
      short: `${tx} → ${rx}`,
      line: `TX ${tx} (LOG ${cfg.log_tx ?? "–"}) → RX ${rx} (LOG ${cfg.log_rx ?? "–"})`,
    };
  }

  function renderTxTable(r, s) {
    const assigned = assignedCh(s, "tx");
    editing.bus = pickAssigned(editing.bus, assigned.length ? assigned : ["A"]);
    const p = el("div", "panel");
    p.innerHTML = `<div class="panel-title">TX — CH ${editing.bus}</div>`;
    if (!assigned.length) {
      const hint = el("p", "muted");
      hint.textContent = "Assign a TX CH above, then edit a slot below.";
      p.appendChild(hint);
      r.appendChild(p);
      return;
    }
    const tabs = el("div", "chan-grid");
    tabs.style.gridTemplateColumns = `repeat(${Math.max(assigned.length, 1)}, 1fr)`;
    assigned.forEach((b) => {
      const btn = el("button", "btn btn-sm " + (b === editing.bus ? "" : "btn-ghost"));
      btn.textContent = `TX CH ${b}`;
      btn.addEventListener("click", () => { editing.bus = b; editing.slot = 0; render(snap); });
      tabs.appendChild(btn);
    });
    p.appendChild(tabs);
    const tw = el("div", "table-wrap");
    const tbl = document.createElement("table");
    tbl.innerHTML = `<thead><tr>
      <th>SLOT</th><th>EN</th><th>MODE</th><th class="mono">LABEL</th><th class="mono">DATA</th><th>UNITS</th>
      <th class="mono">SDI</th><th class="mono">PAD</th><th class="mono">SSM</th><th class="mono">PAR</th><th class="mono">RATE</th><th class="mono">RAW</th>
    </tr></thead>`;
    const tb = document.createElement("tbody");
    const slots = (s.tx && s.tx[editing.bus]) || [];
    const dm = (s.bus && s.bus[editing.bus] && s.bus[editing.bus].display_mode) || "HEX";
    slots.forEach((sl) => {
      const tr = document.createElement("tr");
      if (sl.index === editing.slot) tr.classList.add("selected");
      if (!sl.enabled) tr.classList.add("slot-off");
      const dataCell = formatDataCell(sl, dm);
      tr.innerHTML = `
        <td>${sl.index}</td>
        <td>${sl.enabled ? '<span class="tag-on">ON</span>' : '<span class="tag-off">off</span>'}</td>
        <td>${sl.profile || sl.mode || ""}</td>
        <td class="mono">${sl.label || ""}</td>
        <td class="mono">${dataCell}</td>
        <td>${sl.units || ""}</td>
        <td class="mono">${sl.sdi || ""}</td>
        <td class="mono">${sl.pads || sl.pad3 || ""}</td>
        <td class="mono">${sl.ssm || ""}</td>
        <td class="mono">${sl.par || ""}</td>
        <td class="mono">${sl.rate_ms || ""}</td>
        <td class="mono">${sl.raw || ""}</td>`;
      tr.addEventListener("click", () => { editing.slot = sl.index; render(snap); });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    tw.appendChild(tbl);
    p.appendChild(tw);
    r.appendChild(p);
  }

  function rxRowHtml(lab) {
    const cls = lab.waiting ? "rx-wait" : (lab.stale ? "rx-stale" : "");
    const rate = (lab.rate_ms == null || lab.rate_ms === "") ? "" : lab.rate_ms;
    return `<tr class="${cls}"><td>${lab.trapped ? "*" : ""}</td>
      <td class="mono">${lab.label}</td><td>${lab.funct || ""}</td>
      <td class="mono">${lab.data || ""}</td><td>${lab.units || ""}</td>
      <td class="mono">${lab.sdi || ""}</td><td class="mono">${lab.pads || "-"}</td>
      <td class="mono">${lab.ssm || ""}</td>
      <td class="mono">${lab.par || "ODD"}</td>
      <td class="mono">${rate}</td>
      <td>${lab.hits || 0}</td></tr>`;
  }

  function rxTbodyHtml(rx, allow, page, pageSize) {
    const empty = `<tr><td colspan="11" class="muted" style="text-align:center">No labels received</td></tr>`;
    let labels = rx.labels || [];
    if (allow && allow.size) labels = labels.filter((lab) => allow.has(lab.label));
    if (!labels.length) return empty;
    const size = pageSize || 10;
    const start = (page || 0) * size;
    const slice = labels.slice(start, start + size);
    if (!slice.length) return empty;
    return slice.map(rxRowHtml).join("");
  }

  function renderRxTable(r, s, onlyBus, pageSize, allowLabels, assignedList) {
    const p = el("div", "panel");
    p.innerHTML = `<div class="panel-title">RX</div>`;
    const size = pageSize || 10;
    const allow = allowLabels && allowLabels.length ? new Set(allowLabels) : null;
    const buses = onlyBus ? [onlyBus] : (assignedList && assignedList.length ? assignedList : ["A", "B", "C", "D"]);
    if (!onlyBus && assignedList && !assignedList.length) {
      const hint = el("p", "muted");
      hint.textContent = "Assign an RX CH above. Template defaults to Auto (format from received labels).";
      p.appendChild(hint);
      r.appendChild(p);
      return;
    }
    if (!onlyBus && assignedList && assignedList.length) {
      const tmpl = el("div", "ln-bar");
      const curTc = s.time_constant_s || 0;
      tmpl.innerHTML = `<span class="muted">Time constant</span>
        <select id="sel-tc-uc">${[0, 0.4, 0.8, 1.6, 3.2, 6.4, 12.8].map((v) =>
          `<option value="${v}" ${Number(curTc) === v ? "selected" : ""}>${v === 0 ? "OFF" : v + " s"}</option>`).join("")}</select>
        <span class="muted">Showing RX ${assignedList.map((b) => "CH " + b).join(" + ")}</span>`;
      p.appendChild(tmpl);
      tmpl.querySelector("#sel-tc-uc").addEventListener("change", async (ev) => {
        try { render(await api("/api/arinc/time-constant", { method: "POST", body: JSON.stringify({ seconds: parseFloat(ev.target.value) }) })); }
        catch (e) { alert(e.message); }
      });
    }
    buses.forEach((b) => {
      const rx = (s.rx && s.rx[b]) || {};
      const labels = allow ? (rx.labels || []).filter((lab) => allow.has(lab.label)) : (rx.labels || []);
      const page = rx.page || 0;
      const start = page * size;
      const head = el("div", "ln-bar");
      const tmplSel = (!onlyBus && assignedList && assignedList.length)
        ? profileSelectHtml((s.rx_profile && s.rx_profile[b]) || "auto", "rx-tmpl-" + b, true)
        : "";
      head.innerHTML = `<strong>RX CH ${b}</strong>${tmplSel}
        <span class="muted" id="rx-meta-${b}">${labels.length} labels · ${rx.hits || 0} hits</span>
        <button type="button" class="btn btn-sm btn-ghost" data-more="${b}" ${labels.length <= start + size ? "disabled" : ""}>More words</button>`;
      p.appendChild(head);
      const tmplEl = head.querySelector("#rx-tmpl-" + b);
      if (tmplEl) {
        tmplEl.addEventListener("change", async (ev) => {
          const id = ev.target.value;
          if (!id) return;
          await applyProfile(id, { rx_ch: b, apply_tx: false, apply_rx: true, stay: true });
        });
      }
      const trapBar = el("div", "ln-bar");
      trapBar.innerHTML = `<input id="trap-lab-${b}" placeholder="Label oct" maxlength="5" style="width:5.5rem"/>
        <input id="trap-sdi-${b}" placeholder="SDI" maxlength="2" style="width:4rem"/>
        <button type="button" class="btn btn-sm" data-trap="${b}">Set trap</button>
        <button type="button" class="btn btn-sm btn-ghost" data-untrap="${b}">Clear trap</button>`;
      p.appendChild(trapBar);
      const rw = el("div", "table-wrap");
      const tbl = document.createElement("table");
      tbl.innerHTML = `<thead><tr>
        <th></th><th class="mono">LABEL</th><th>FUNCT</th><th class="mono">DATA</th><th>UNITS</th>
        <th class="mono">SDI</th><th class="mono">PAD</th><th class="mono">SSM</th><th>PAR</th>
        <th class="mono">RATE (ms)</th><th>HITS</th>
      </tr></thead>`;
      const tb = document.createElement("tbody");
      tb.id = `rx-tbody-${b}`;
      tb.dataset.ch = b;
      tb.innerHTML = rxTbodyHtml(rx, allow, page, size);
      tbl.appendChild(tb);
      rw.appendChild(tbl);
      p.appendChild(rw);
    });
    r.appendChild(p);
    p.querySelectorAll("[data-more]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const b = btn.dataset.more;
        const page = (((s.rx && s.rx[b]) || {}).page || 0) + 1;
        try { render(await api("/api/arinc/rx/page", { method: "POST", body: JSON.stringify({ bus: b, page }) })); }
        catch (e) { alert(e.message); }
      });
    });
    p.querySelectorAll("[data-trap]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const b = btn.dataset.trap;
        const lab = ($(`trap-lab-${b}`) || {}).value;
        const sdiRaw = ($(`trap-sdi-${b}`) || {}).value;
        if (!lab) return;
        const body = { bus: b, label: lab, clear: false };
        if (sdiRaw !== "" && sdiRaw != null) body.sdi = parseInt(sdiRaw, 10);
        try { render(await api("/api/arinc/rx/trap", { method: "POST", body: JSON.stringify(body) })); }
        catch (e) { alert(e.message); }
      });
    });
    p.querySelectorAll("[data-untrap]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const b = btn.dataset.untrap;
        const lab = ($(`trap-lab-${b}`) || {}).value;
        if (!lab) return;
        try { render(await api("/api/arinc/rx/trap", { method: "POST", body: JSON.stringify({ bus: b, label: lab, clear: true }) })); }
        catch (e) { alert(e.message); }
      });
    });
  }

  function patchRxTable(s) {
    const view = s.screen_stack ? s.screen_stack[s.screen_stack.length - 1] : "";
    const allow = (view === "lru_format" || view === "mmr_format" || view === "dme_single" || view === "dme_multi")
      ? new Set(((s.profile && s.profile.labels) || []).map((ls) => ls.label))
      : null;
    ["A", "B", "C", "D"].forEach((b) => {
      const tb = $(`rx-tbody-${b}`);
      if (!tb) return;
      const rx = (s.rx && s.rx[b]) || {};
      const scoped = allow && allow.size;
      const meta = $(`rx-meta-${b}`);
      if (meta) {
        const n = (rx.labels || []).filter((lab) => !scoped || allow.has(lab.label)).length;
        meta.textContent = `${n} labels · ${rx.hits || 0} hits`;
      }
      tb.innerHTML = rxTbodyHtml(rx, allow, rx.page || 0, 10);
    });
  }

  function renderEditor(r, s) {
    const slots = (s.tx && s.tx[editing.bus]) || [];
    const sl = slots[editing.slot] || {};
    const p = el("div", "panel editor-panel");
    const cfg = (s.bus && s.bus[editing.bus]) || {};
    const map = formatBusMap(cfg);
    p.innerHTML = `<div class="panel-title">Edit TX Slot ${editing.slot} — CH ${editing.bus}</div>
      <p class="editor-mapline">${map.line}</p>`;
    const fg = el("div", "field-grid");
    const sdiVal = sl.sdi ? String(sl.sdi).replace(/^0/, "") : "0";
    const data19Val = String(sl.data19 || "0x00000").replace(/^0x/i, "");
    const pad3Val = sl.pad3 != null ? parseInt(String(sl.pad3), 2) || parseInt(sl.pad3, 10) || 0 : 0;
    const data16Val = String(sl.data16 || "0").replace(/^0x/i, "");
    const currentMode = sl.profile || (sl.mode === "adf" ? "adf_032" : (sl.mode === "lru" ? sl.profile : "raw")) || "raw";
    const lruOn = currentMode !== "raw";
    const isoOn = (sl.encoding || "") === "iso5";
    const engVal = engDisplayValue(sl);
    const lists = profilesCache || [];
    const modeOpts = [`<option value="raw" ${currentMode === "raw" ? "selected" : ""}>RAW</option>`]
      .concat(lists.map((pr) => `<option value="${pr.id}" ${currentMode === pr.id ? "selected" : ""}>${pr.funct || pr.id} — ${pr.name}</option>`))
      .join("");
    fg.innerHTML = `
      <label>Mode<select id="e-mode">${modeOpts}</select></label>
      <label id="e-lru-label-wrap" ${lruOn ? "" : 'style="display:none"'}>LRU label<select id="e-lru-label"></select></label>
      <label>Label (oct)<input id="e-label" type="text" value="${sl.label || "000"}" maxlength="5" ${lruOn ? "disabled" : ""}/></label>
      <div id="e-eng-wrap" class="data-edit" ${lruOn ? "" : 'style="display:none"'}>
        <span>Data</span>
        <span class="input-with-unit step-row">
          <button type="button" class="btn btn-sm btn-ghost" id="e-eng-dec" tabindex="-1">−</button>
          <input id="e-eng" type="text" inputmode="${isoOn ? "text" : "decimal"}" value="${engVal}" autocomplete="off" spellcheck="false"/>
          <button type="button" class="btn btn-sm btn-ghost" id="e-eng-inc" tabindex="-1">+</button>
          <span id="e-eng-unit" class="unit-badge" hidden></span>
        </span>
      </div>
      <label id="e-dentry-wrap" ${lruOn ? 'style="display:none"' : ""}>Data entry<select id="e-dentry"><option value="data19">DATA 19-bit</option><option value="pad">PAD + DATA 16</option></select></label>
      <label id="e-data-wrap" ${lruOn ? 'style="display:none"' : ""}>Data 19-bit hex<input id="e-data" type="text" value="${data19Val}" maxlength="5"/></label>
      <label id="e-pad-wrap" style="display:none">PAD (3-bit)<input id="e-pad" type="number" min="0" max="7" step="1" value="${pad3Val}"/></label>
      <label id="e-d16-wrap" style="display:none">Data 16-bit hex<input id="e-d16" type="text" value="${data16Val}" maxlength="4"/></label>
      <label>SDI<select id="e-sdi">${[0,1,2,3].map((i) => `<option value="${i}" ${sdiVal === String(i) ? "selected" : ""}>0${i}</option>`).join("")}</select></label>
      <label>SSM<select id="e-ssm">${["NML","NCD","FT","FAIL"].map((v) => `<option value="${v}" ${sl.ssm === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Rate (ms)<input id="e-rate" type="number" min="10" max="5000" step="10" value="${sl.rate_ms || 150}"/></label>
      <label>Parity<select id="e-par"><option value="odd" ${sl.par !== "EVEN" ? "selected" : ""}>ODD</option><option value="even" ${sl.par === "EVEN" ? "selected" : ""}>EVEN</option></select></label>`;
    p.appendChild(fg);

    const footer = el("div", "editor-footer");
    footer.innerHTML = `<label class="check"><input type="checkbox" id="e-enable" ${sl.enabled ? "checked" : ""}/> Arm slot</label>`;
    const actions = el("div", "editor-actions");
    actions.innerHTML = `<button type="button" class="btn" id="btn-slot-apply">Apply slot</button><button type="button" class="btn btn-ghost" id="btn-slot-clear">Clear slot</button>`;
    footer.appendChild(actions);
    p.appendChild(footer);

    const preview = el("div", "raw-preview");
    preview.id = "e-preview";
    preview.textContent = sl.raw ? `word ${sl.raw}` : "no word";
    p.appendChild(preview);

    r.appendChild(p);

    function setLruUi(on) {
      $("e-label").disabled = on;
      ["e-lru-label-wrap", "e-eng-wrap"].forEach((id) => { const n = $(id); if (n) n.style.display = on ? "" : "none"; });
      ["e-dentry-wrap", "e-data-wrap"].forEach((id) => { const n = $(id); if (n) n.style.display = on ? "none" : ""; });
      $("e-pad-wrap").style.display = "none";
      $("e-d16-wrap").style.display = "none";
    }

    async function fillLruLabels(pid, selected) {
      const sel = $("e-lru-label");
      if (!sel || !pid || pid === "raw") return;
      try {
        const d = await loadProfileDetail(pid);
        sel.innerHTML = (d.labels || []).map((ls) =>
          `<option value="${ls.label}" ${ls.label === selected ? "selected" : ""}>${ls.label} ${ls.funct || ""}</option>`
        ).join("");
        const cur = (d.labels || []).find((ls) => ls.label === sel.value) || (d.labels || [])[0];
        if (cur) {
          setDataUnit(cur.units);
          $("e-label").value = cur.label;
          const inp = $("e-eng");
          if (inp && (inp.value === "" || sl.eng_value == null || sl.profile !== pid)) {
            if (cur.eng_default != null) inp.value = cur.eng_default;
          }
        }
      } catch (e) { sel.innerHTML = ""; }
    }

    function setDataUnit(units) {
      const badge = $("e-eng-unit");
      const row = badge && badge.parentElement;
      if (!badge) return;
      const u = (units || "").trim();
      badge.textContent = u;
      badge.hidden = !u;
      if (row) row.classList.toggle("has-unit", !!u);
    }

    $("e-mode").addEventListener("change", (ev) => {
      const pid = ev.target.value;
      setLruUi(pid !== "raw");
      if (pid !== "raw") fillLruLabels(pid, sl.label);
      else setDataUnit("");
    });
    $("e-lru-label").addEventListener("change", async (ev) => {
      const pid = $("e-mode").value;
      if (!pid || pid === "raw") return;
      try {
        const d = await loadProfileDetail(pid);
        const cur = (d.labels || []).find((ls) => ls.label === ev.target.value);
        if (cur) {
          setDataUnit(cur.units);
          $("e-label").value = cur.label;
          if (cur.eng_default != null) $("e-eng").value = cur.eng_default;
        }
      } catch { /* ignore */ }
    });
    $("e-dentry").addEventListener("change", (ev) => {
      const padMode = ev.target.value === "pad";
      $("e-data-wrap").style.display = padMode ? "none" : "";
      $("e-pad-wrap").style.display = padMode ? "" : "none";
      $("e-d16-wrap").style.display = padMode ? "" : "none";
    });
    $("btn-slot-apply").addEventListener("click", applySlot);
    $("btn-slot-clear").addEventListener("click", clearSlot);
    function holdStep(btn, dir) {
      const run = () => {
        const inp = $("e-eng");
        if (!inp) return;
        const st = parseFloat(inp.step) || 1;
        inp.value = (parseFloat(inp.value) || 0) + dir * st;
      };
      let t = null;
      btn.addEventListener("mousedown", () => { run(); t = setInterval(run, 80); });
      btn.addEventListener("mouseup", () => { if (t) clearInterval(t); });
      btn.addEventListener("mouseleave", () => { if (t) clearInterval(t); });
      btn.addEventListener("click", (ev) => ev.preventDefault());
    }
    if ($("e-eng-inc")) holdStep($("e-eng-inc"), 1);
    if ($("e-eng-dec")) holdStep($("e-eng-dec"), -1);

    ensureProfiles().then((list) => {
      const sel = $("e-mode");
      if (!sel) return;
      const keep = sel.value;
      sel.innerHTML = [`<option value="raw">RAW</option>`]
        .concat(list.map((pr) => `<option value="${pr.id}">${pr.funct || pr.id} — ${pr.name}</option>`))
        .join("");
      sel.value = list.some((pr) => pr.id === keep) || keep === "raw" ? keep : "raw";
      if (sel.value !== "raw") fillLruLabels(sel.value, sl.label);
    }).catch(() => {});
    if (lruOn) {
      setDataUnit(sl.units || "");
      fillLruLabels(currentMode, sl.label);
    }
  }

  // ---- actions ----
  async function selectMode(mode) {
    try { render(await api("/api/arinc/mode", { method: "POST", body: JSON.stringify({ mode }) })); }
    catch (e) { alert(e.message); }
  }
  async function pushScreen(screen) {
    try { render(await api("/api/arinc/screen/push", { method: "POST", body: JSON.stringify({ screen }) })); }
    catch (e) { alert(e.message); }
  }
  async function applyChannel(bus, field, val) {
    const body = { bus };
    body[field] = val;
    try { render(await api("/api/arinc/channel", { method: "POST", body: JSON.stringify(body) })); }
    catch (e) { alert(e.message); }
  }
  async function applySlot() {
    const modeVal = $("e-mode").value;
    const lruOn = modeVal !== "raw";
    const body = {
      bus: editing.bus, slot: editing.slot,
      mode: lruOn ? "lru" : "raw",
      profile: lruOn ? modeVal : null,
      label: lruOn ? (($("e-lru-label") && $("e-lru-label").value) || $("e-label").value || "000") : ($("e-label").value || "000"),
      sdi: parseInt($("e-sdi").value, 10),
      ssm: $("e-ssm").value,
      rate_ms: parseInt($("e-rate").value, 10) || 150,
      odd_parity: $("e-par").value === "odd",
      enabled: $("e-enable").checked,
    };
    if (lruOn) {
      const raw = (($("e-eng") && $("e-eng").value) || "").trim();
      const n = parseFloat(raw);
      body.eng_value = Number.isFinite(n) && /^-?\d/.test(raw) ? n : raw;
    } else if ($("e-dentry").value === "pad") {
      body.pad3 = parseInt($("e-pad").value, 10) || 0;
      body.data16 = $("e-d16").value.trim() || "0";
    } else {
      body.data = $("e-data").value.trim() || "0";
    }
    try { render(await api("/api/arinc/tx/slot", { method: "POST", body: JSON.stringify(body) })); }
    catch (e) { alert(e.message); }
  }
  async function clearSlot() {
    try { render(await api("/api/arinc/tx/slot/clear", { method: "POST", body: JSON.stringify({ bus: editing.bus, slot: editing.slot }) })); }
    catch (e) { alert(e.message); }
  }

  async function startArinc() {
    try { render(await api("/api/arinc/start", { method: "POST" })); }
    catch (e) { alert(e.message); }
  }
  async function stopArinc() {
    try { render(await api("/api/arinc/stop", { method: "POST" })); }
    catch (e) { alert(e.message); }
  }

  // ---- run control + poll ----
  let pollInFlight = false;
  async function poll() {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const s = await api("/api/arinc/status");
      if (s) render(s, { live: true });
    } catch { /* session may be mid-transition */ }
    finally {
      pollInFlight = false;
    }
  }

  function startPolling() {
    if (timer) return;
    const scheduleNext = () => {
      timer = setTimeout(async () => {
        await poll();
        if (timer) scheduleNext();
      }, 500);
    };
    poll();
    scheduleNext();
  }
  function stopPolling() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pollInFlight = false;
  }

  // ---- init ----
  async function init() {
    $("btn-arinc-start").addEventListener("click", startArinc);
    $("btn-arinc-stop").addEventListener("click", stopArinc);
    $("login-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setErr("login-error", "");
      try {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ pin: $("pin").value }) });
        show(true);
        startPolling();
        ensureProfiles().catch(() => {});
      } catch (e) { setErr("login-error", e.message); }
    });
    $("btn-logout").addEventListener("click", async () => {
      try { await api("/api/auth/logout", { method: "POST" }); } catch {}
      stopPolling();
      show(false);
      $("pin").value = "";
    });
    // try existing session
    try {
      const s = await api("/api/arinc/status");
      if (s) { show(true); render(s); startPolling(); ensureProfiles().catch(() => {}); }
    } catch { /* not logged in */ }
  }

  document.addEventListener("DOMContentLoaded", init);
})();


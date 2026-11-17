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
  selectedLru: CFDS_LRU_TABLE[12], // TCAS
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

// 1. CFDS LRU SELECTION (Figure 47)
function renderCfdsLruSelection(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head" style="margin-bottom:12px">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CFDS LRU SELECTION</h2>
        <p class="muted">Aeroflex JcAIR T1200B Operation Manual Figure 47 (Section 4.F)</p>
      </div>
      <input type="text" id="cfds-lru-filter" placeholder="Search LRU by code or name..."
        class="category-select" style="min-width:240px" value="${escAttr(cfdsState.searchFilter)}" />
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="mono" style="width:100px">EQ CODE</th>
            <th style="width:160px">NAME</th>
            <th>DESCRIPTION</th>
            <th style="width:120px;text-align:right">ACTION</th>
          </tr>
        </thead>
        <tbody id="cfds-lru-tbody"></tbody>
      </table>
    </div>
  `;
  c.appendChild(p);

  const tbody = p.querySelector("#cfds-lru-tbody");
  const filterInput = p.querySelector("#cfds-lru-filter");

  function updateLruTable() {
    const q = (filterInput.value || "").trim().toLowerCase();
    const filtered = CFDS_LRU_TABLE.filter(
      (item) => item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );

    tbody.innerHTML = filtered.map((lru) => {
      const isSelected = cfdsState.selectedLru && cfdsState.selectedLru.code === lru.code;
      return `
        <tr style="${isSelected ? 'background:var(--teal-bg, #f0fdfa);font-weight:600' : ''}">
          <td class="mono" style="color:var(--teal-primary, #0d9488);font-weight:700">0x${escAttr(lru.code)}</td>
          <td><strong>${escAttr(lru.name)}</strong></td>
          <td class="muted">${escAttr(lru.description)}</td>
          <td style="text-align:right">
            <button type="button" class="btn btn-sm ${isSelected ? 'btn-sm primary' : 'btn-ghost'}" data-lru="${escAttr(lru.code)}">
              ${isSelected ? 'Selected' : 'Select'}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("button[data-lru]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-lru");
        const found = CFDS_LRU_TABLE.find((item) => item.code === code);
        if (found) {
          cfdsState.selectedLru = found;
          cfdsState.currentView = "MODE_SELECT";
          renderCfdsHub(r, s);
        }
      });
    });
  }

  filterInput.addEventListener("input", () => {
    cfdsState.searchFilter = filterInput.value;
    updateLruTable();
  });

  updateLruTable();
}

// 2. CFDS SUBMODE SELECTION
function renderCfdsSubmodeSelect(c, r, s) {
  const p = el("div", "panel");
  p.innerHTML = `
    <div class="panel-head" style="margin-bottom:16px">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700">CFDS OPERATION MODE SELECT</h2>
        <p class="muted">Interrogating: <strong style="color:var(--teal-primary, #0d9488)">${escAttr(cfdsState.selectedLru.name)}</strong> (Eq Code: 0x${escAttr(cfdsState.selectedLru.code)})</p>
      </div>
    </div>
    <div class="mode-grid">
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
      avionics_lru: "Avionics LRU", lru_format: "LRU Format",
      dme_config: "DME Config", dme_single: "DME Single", dme_multi: "DME Multi",
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
      for (let i = 0; i < pops; i++) {
        try { render(await api("/api/arinc/screen/pop", { method: "POST" })); }
        catch (e) { alert(e.message); break; }
      }
    } else {
      await pushScreen(screen);
    }
  }

  function renderTopbar(s) {
    const rp = $("run-pill");
    rp.textContent = s.running ? "RUNNING" : "STOPPED";
    rp.className = "pill " + (s.running ? "pill-run" : "pill-stop");
    $("rate-pill").textContent = `${s.bit_rate_kbps || 12.5} kbps`;
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
      view === "dme_single" || view === "dme_multi" || view === "lru_format" || view === "mmr_format";
  }

  function render(s, opts) {
    const force = !(opts && opts.live);
    if (snap && s && s !== snap) s = Object.assign({}, snap, s);
    snap = s;
    renderTopbar(s);
    const key = viewKey(s);
    const view = s.screen_stack ? s.screen_stack[s.screen_stack.length - 1] : "mode_select";
    if (!force && key === lastViewKey) {
      if (isWorkbench(view)) patchRxTable(s);
      const catEmpty = view === "avionics_lru" && (s.catalog || []).length &&
        !document.querySelector(".catalog-btn");
      if (!catEmpty) return;
    }
    lastViewKey = key;
    renderBreadcrumb(s.screen_stack);
    const r = root();
    r.innerHTML = "";
    if (view === "mode_select") renderModeSelect(r, s);
    else if (view === "label_library") renderLabelLibrary(r, s);
    else if (view === "standard") renderStandardHub(r, s);
    else if (isWorkbench(view) && view !== "dme_single" && view !== "dme_multi" && view !== "lru_format" && view !== "mmr_format") renderSetupTxRx(r, s);
    else if (view === "avionics_lru" || view === "cfds_lru") renderLruPicker(r, s);
    else if (view === "lru_format" || view === "mmr_format") renderFormatScreen(r, s);
    else if (view === "dme_config") renderDmeConfig(r, s);
    else if (view === "dme_single") renderDmeSingle(r, s);
    else if (view === "dme_multi") renderDmeMulti(r, s);
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
      { id: "dynapro_console", title: "Dynapro 1780A Infotouch", desc: "Dynamic STANDARD MODE per LRU (CRT Retro Console)", special: true },
      { id: "user_configure", title: "User Configure", desc: "Setup TX/RX channels" },
      { id: "avionics_lru", title: "Avionics LRU", desc: "LRU test profiles" },
    ];
    items.forEach((it) => {
      const card = el("div", "mode-card");
      if (it.special) {
        card.style.borderColor = "var(--accent, #059669)";
        card.style.background = "rgba(16, 185, 129, 0.08)";
      }
      card.innerHTML = `<h2 style="${it.special ? 'color:#10b981;' : ''}">${it.title}</h2><p>${it.desc}</p>`;
      card.addEventListener("click", () => {
        if (it.id === "dynapro_console") {
          openDynaproConsole();
        } else {
          pushScreen(it.id);
        }
      });
      grid.appendChild(card);
    });
    r.appendChild(grid);
  }

  function openDynaproConsole() {
    const modal = $("dynapro-modal");
    if (!modal) return;
    modal.style.display = "block";
    const btnClose = $("btn-close-dynapro");
    if (btnClose) {
      btnClose.onclick = () => {
        modal.style.display = "none";
      };
    }
  }

  function renderLruPicker(r, s) {
    const p = el("div", "panel");
    p.innerHTML = `<div class="lru-toolbar">
      <div>
        <div class="panel-title" style="margin-bottom:.35rem">Avionics LRU</div>
        <p class="muted">T1200 characteristic set. Custom profiles stay below.</p>
      </div>
      <button type="button" class="btn" id="btn-lru-add">Add LRU</button>
    </div>`;
    const cat = el("div", "catalog-grid");
    p.appendChild(cat);
    function paintCatalog(items) {
      cat.innerHTML = "";
      (items || []).forEach((c) => {
        const b = el("button", "catalog-btn");
        b.type = "button";
        b.innerHTML = `<span class="char">${c.char}</span><span class="ttl">${c.title}</span>`;
        b.addEventListener("click", () => selectCatalog(c));
        cat.appendChild(b);
      });
    }
    paintCatalog(s.catalog);
    if (!(s.catalog || []).length) {
      api("/api/arinc/catalog").then((d) => paintCatalog(d.catalog || [])).catch(() => {});
    }
    const tc = el("div", "ln-bar");
    const curTc = s.time_constant_s || 0;
    tc.innerHTML = `<span class="muted">Time constant (VOR/ILS/ADF RX filter)</span>
      <select id="sel-tc">${[0, 0.4, 0.8, 1.6, 3.2, 6.4, 12.8].map((v) =>
        `<option value="${v}" ${Number(curTc) === v ? "selected" : ""}>${v === 0 ? "OFF" : v + " s"}</option>`).join("")}</select>`;
    p.appendChild(tc);
    const grid = el("div", "mode-grid");
    grid.style.maxWidth = "960px";
    const customTitle = el("div", "panel-title");
    customTitle.textContent = "Custom LRUs";
    customTitle.style.margin = "1rem 0 .5rem";
    p.appendChild(customTitle);
    p.appendChild(grid);
    r.appendChild(p);
    $("btn-lru-add").addEventListener("click", () => openLruForm(null));
    $("sel-tc").addEventListener("change", async (ev) => {
      try { render(await api("/api/arinc/time-constant", { method: "POST", body: JSON.stringify({ seconds: parseFloat(ev.target.value) }) })); }
      catch (e) { alert(e.message); }
    });

    function fill(list) {
      grid.innerHTML = "";
      const custom = (list || []).filter((pr) => !pr.catalog);
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
      const add = el("div", "mode-card add-card");
      add.textContent = "+ Add LRU";
      add.addEventListener("click", () => openLruForm(null));
      grid.appendChild(add);
    }
    ensureProfiles().then(fill).catch(() => { grid.innerHTML = `<p class="err">Could not load profiles.</p>`; });
  }

  async function selectCatalog(c) {
    try {
      if (c.kind === "dme") {
        await pushScreen("dme_config");
        return;
      }
      if (c.kind === "mmr") {
        render(await api("/api/arinc/mmr/menu", { method: "POST", body: JSON.stringify({ menu: "ils" }) }));
        return;
      }
      await applyProfile(c.id);
    } catch (e) { alert(e.message); }
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

  function renderDmeConfig(r, s) {
    renderHub(r, "709 DME", "Choose test format. Squawk/Naut RF is not on this station.", [
      { id: "_dme_std", title: "Standard Nav", desc: "Generic LRU format with label 035" },
      { id: "_dme_single", title: "Single Channel", desc: "Mode bits, echo NONE/OK/ERR, BNR distance" },
      { id: "_dme_multi", title: "Multi Channel", desc: "Five directed frequencies plus SCAN" },
    ]);
    r.querySelectorAll(".mode-card").forEach((card, i) => {
      const modes = ["standard", "single", "multi"];
      card.onclick = async () => {
        try { render(await api("/api/arinc/dme/mode", { method: "POST", body: JSON.stringify({ mode: modes[i] }) })); }
        catch (e) { alert(e.message); }
      };
    });
  }

  function renderDmeSingle(r, s) {
    const dme = s.dme || { rows: [] };
    const p = el("div", "panel");
    p.innerHTML = `<div class="panel-title">DME Single Channel</div>
      <p class="muted">Label 035 @ 134.40 MHz. SQ/NT RF controls are disabled.</p>`;
    const tw = el("div", "table-wrap");
    const tbl = document.createElement("table");
    tbl.innerHTML = `<thead><tr><th>ECHO</th><th>TX</th><th>RX</th><th>BNR DIST</th><th>IDENT</th></tr></thead>
      <tbody>${(dme.rows || []).map((row) => `<tr>
        <td><strong>${row.echo}</strong></td><td class="mono">${row.tx_data}</td>
        <td class="mono">${row.rx_data}</td><td class="mono">${dme.bnr_dist || "—"}</td>
        <td class="mono">${dme.ident || "—"}</td></tr>`).join("") || "<tr><td colspan='5' class='muted'>Arm TX and Start</td></tr>"}</tbody>`;
    tw.appendChild(tbl);
    p.appendChild(tw);
    const fg = el("div", "field-grid");
    const sl = ((s.tx && s.tx.A) || [])[0] || {};
    fg.innerHTML = `
      <label>Freq MHz<input id="dme-freq" type="number" step="0.05" value="${sl.eng_value || 134.4}"/></label>
      <label>Mode<select id="dme-mode">${["DF1","DF2","DF3","DF4","DF5","SCAN","STBY"].map((m) => `<option>${m}</option>`).join("")}</select></label>
      <label>NAV<select id="dme-nav">${["VOR","ILS","MLS","UND"].map((m) => `<option>${m}</option>`).join("")}</select></label>
      <label class="check"><input type="checkbox" id="dme-disp"/> DISP</label>
      <label class="check"><input type="checkbox" id="dme-ident"/> IDENT</label>
      <label>SDI<select id="dme-sdi">${[0,1,2,3].map((i) => `<option value="${i}">${i === 0 ? "ALL" : i}</option>`).join("")}</select></label>`;
    p.appendChild(fg);
    const actions = el("div", "editor-actions");
    actions.innerHTML = `<button type="button" class="btn" id="dme-apply">Apply</button>
      <button type="button" class="btn btn-ghost" id="dme-back">Back</button>`;
    p.appendChild(actions);
    const sq = el("p", "muted sqnt-off");
    sq.textContent = "SQUAWK/NAUT NM / KTS / REPLY EFF / RF LEVEL — not on this station.";
    p.appendChild(sq);
    r.appendChild(p);
    renderRxTable(r, s, "A", 10, ["035", "202", "246", "247"]);
    $("dme-apply").addEventListener("click", async () => {
      try {
        render(await api("/api/arinc/dme/slot", { method: "POST", body: JSON.stringify({
          index: 0,
          freq_mhz: parseFloat($("dme-freq").value),
          mode: $("dme-mode").value,
          nav: $("dme-nav").value,
          disp: $("dme-disp").checked,
          ident: $("dme-ident").checked,
          sdi: parseInt($("dme-sdi").value, 10),
          enabled: true,
        }) }));
      } catch (e) { alert(e.message); }
    });
    $("dme-back").addEventListener("click", () => navTo("dme_config"));
  }

  function renderDmeMulti(r, s) {
    const dme = s.dme || { rows: [], line: 0 };
    const p = el("div", "panel");
    p.innerHTML = `<div class="panel-title">DME Multi Channel</div>
      <p class="muted">Six label 035 words. Line advance selects which word to edit.</p>`;
    const tw = el("div", "table-wrap");
    const tbl = document.createElement("table");
    tbl.innerHTML = `<thead><tr><th></th><th>ECHO</th><th>TX</th><th>RX SSM</th></tr></thead>`;
    const tb = document.createElement("tbody");
    (dme.rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      if (row.slot === dme.line) tr.classList.add("selected");
      tr.innerHTML = `<td>${row.slot}</td><td>${row.echo}</td><td class="mono">${row.tx_data}</td><td class="mono">${row.rx_ssm || ""}</td>`;
      tr.addEventListener("click", async () => {
        try { render(await api("/api/arinc/dme/slot", { method: "POST", body: JSON.stringify({ index: row.slot }) })); }
        catch (e) { alert(e.message); }
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    tw.appendChild(tbl);
    p.appendChild(tw);
    const sl = ((s.tx && s.tx.A) || [])[dme.line || 0] || {};
    const fg = el("div", "field-grid");
    fg.innerHTML = `
      <label>Freq MHz<input id="dme-freq" type="number" step="0.05" value="${sl.eng_value || 134.4}"/></label>
      <label>Mode<select id="dme-mode">${["DF1","DF2","DF3","DF4","DF5","SCAN","STBY"].map((m) => `<option>${m}</option>`).join("")}</select></label>
      <label>NAV<select id="dme-nav">${["VOR","ILS","MLS","UND"].map((m) => `<option>${m}</option>`).join("")}</select></label>`;
    p.appendChild(fg);
    const actions = el("div", "editor-actions");
    actions.innerHTML = `<button type="button" class="btn" id="dme-apply">Apply line</button>
      <button type="button" class="btn btn-ghost" id="dme-adv">Line advance</button>
      <button type="button" class="btn btn-ghost" id="dme-back">Back</button>`;
    p.appendChild(actions);
    const sq = el("p", "muted sqnt-off");
    sq.textContent = "SQUAWK/NAUT control — not on this station.";
    p.appendChild(sq);
    r.appendChild(p);
    renderRxTable(r, s, "A", 10, ["035", "202", "246", "247"]);
    $("dme-apply").addEventListener("click", async () => {
      try {
        render(await api("/api/arinc/dme/slot", { method: "POST", body: JSON.stringify({
          index: dme.line || 0,
          freq_mhz: parseFloat($("dme-freq").value),
          mode: $("dme-mode").value,
          nav: $("dme-nav").value,
          enabled: true,
        }) }));
      } catch (e) { alert(e.message); }
    });
    $("dme-adv").addEventListener("click", async () => {
      const nxt = ((dme.line || 0) + 1) % 6;
      try { render(await api("/api/arinc/dme/slot", { method: "POST", body: JSON.stringify({ index: nxt }) })); }
      catch (e) { alert(e.message); }
    });
    $("dme-back").addEventListener("click", () => navTo("dme_config"));
  }

  function renderMmrMenu(r, s) {
    renderHub(r, "755 MMR", "Background TX on B (DADS) and C (IRS) stays armed.", [
      { id: "_ils", title: "710 ILS", desc: "Labels 033 / 017 on channel A" },
      { id: "_dads", title: "DADS / FMS", desc: "Channel B 12.5 kbps background" },
      { id: "_fms", title: "IRS / FMS", desc: "Channel C 100 kbps background" },
    ]);
    r.querySelectorAll(".mode-card").forEach((card, i) => {
      const menus = ["ils", "dads", "fms"];
      card.onclick = async () => {
        try { render(await api("/api/arinc/mmr/menu", { method: "POST", body: JSON.stringify({ menu: menus[i] }) })); }
        catch (e) { alert(e.message); }
      };
    });
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
  async function poll() {
    try {
      const s = await api("/api/arinc/status");
      if (s) render(s, { live: true });
    } catch { /* session may be mid-transition */ }
  }

  function startPolling() {
    if (timer) return;
    poll();
    timer = setInterval(poll, 400);
  }
  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

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


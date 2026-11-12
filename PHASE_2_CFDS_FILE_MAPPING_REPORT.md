# PHASE 2 — CFDS FILE MAPPING & ARCHITECTURE AUDIT REPORT

**Date:** 2026-11-12  
**Branch:** `integration/cfds-feature`  
**Source Workspace (Read-Only):** `C:\Users\USER\Downloads\ARINC429\ARINC429 FINAL`  
**Target Workspace:** `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION`

---

## 1. Summary of Architecture & Findings

The source implementation of CFDS Mode (`ARINC429 FINAL\hmi\frontend\src\cfds\`) consists of **25 TypeScript/TSX modules** developed across Phases 6A–6F strictly against the Aeroflex JcAIR T1200B Operation Manual (Section 4.F, Figures 47–74, pp. 1-4-85 to 1-4-115). Previously, the source had no dedicated backend CFDS endpoint (`features/cfds`), while the target repository (`ARINC429 INTEGRATION`) provides a Feature-Based Modular Architecture (`features/cfds/` frontend + `features/cfds/` backend + `core/arinc429/coordinator.py`).

### Critical Compatibility Finding: Protected `core/arinc429/codec.py`
- Inspecting `hmi/backend/core/arinc429/codec.py` (which MUST NOT be edited under protected `core/` rules) showed that `encode_cfds_command_227` currently masks `lru_code_hex` to `8 bits` (`& 0xFF`), shifts `cmd_code` to bits 19–25 instead of bits 25–31, and hardcodes `ssm="NO"` (`0b11`).
- **Clean Modular Resolution (Zero `core/` edits):** Backend `features/cfds/service.py` calls the general-purpose `encode_arinc429_word("227", sdi=sdi, data_19bit=..., ssm=ssm_bits, parity="ODD")` from `core.arinc429` with accurate 12-bit equipment packing:
  - `data_19bit = ((command_code & 0x1F) << 14) | ((eq_val & 0xFFF) << 2) | (bit12 << 1) | ready`
  - `ssm_val = (command_code >> 5) & 0b11`
- Verified exact 32-bit hex outputs match `cfdsProtocol.ts` across all tested cases:
  - TCAS `735` Ground (`0x00`): `0x807350E9`
  - TCAS `735` Air Transition (`0x12`): `0x927350E9`
  - TCAS `735` Air Steady (`0x11`): `0x917350E9`
  - Menu Key `'1'` (`0x70`, `sdi=2`, `ready=1`): `0x707356E9`
  - Interactive `CLR` (`0x08`, `bit12=0`, `ready=1`): `0x087350E9`
  - Interactive `SHFT+CLR` (`0x08`, `bit12=1`, `ready=1`): `0x887358E9`

---

## 2. Complete Source-to-Target File Mapping (25 Source Files -> Modular Target)

| # | Source File (`ARINC429 FINAL\hmi\frontend\src\cfds\...`) | Target Destination (`ARINC429 INTEGRATION\...`) | Action / Integration Strategy |
|---|-----------------------------------------------------------|--------------------------------------------------|-------------------------------|
| 1 | `index.ts` | `hmi/frontend/src/features/cfds/index.ts` | Refactor barrel export to expose `CfdsModePage`, `CfdsMode`, types, hooks, services, utils, config |
| 2 | `data/lruDefinitions.ts` | `hmi/frontend/src/features/cfds/utils/lruDefinitions.ts` | Migrate verified LRU table (`CFDS_LRU_TABLE`, TCAS `735`) + export via `utils/index.ts` & `types/` |
| 3 | `data/cfdsDefaults.ts` | `hmi/frontend/src/features/cfds/utils/cfdsDefaults.ts` | Migrate defaults (`DEFAULT_CFDS_TX_PARAMS`, `DEFAULT_AIRCRAFT_CONFIG`, `FLIGHT_PHASE_NAMES`, `CFDS_TRANSMIT_LABELS`) |
| 4 | `services/cfdsProtocol.ts` | `hmi/frontend/src/features/cfds/utils/cfdsProtocol.ts` | Migrate client Label 227 encoder & constants (`FLIGHT_PHASE_CMD`, `CFDS_DEFAULT_AIRCRAFT_TYPE_NAME`, etc.) |
| 5 | `services/normalModeParser.ts` | `hmi/frontend/src/features/cfds/utils/normalModeParser.ts` | Migrate Label 356 parser + `FIGURE_58_TEST_BURST` / `FIGURE_58_COUNT_ERR_BURST` |
| 6 | `services/menuModeService.ts` | `hmi/frontend/src/features/cfds/services/menuModeService.ts` | Migrate Menu Mode ABD0018 command builders (`70h–7Dh`) + simulation helper |
| 7 | `services/interactiveModeParser.ts` | `hmi/frontend/src/features/cfds/utils/interactiveModeParser.ts` | Migrate Interactive Mode state machine (`ACK`, `NAK` 3x, `CLR`/`SHFT+CLR`) |
| 8 | `services/interactiveModeService.ts` | `hmi/frontend/src/features/cfds/services/interactiveModeService.ts` | Migrate 6x7 touch matrix (`INTERACTIVE_KEY_MATRIX`), `3R=7Ah`, `MENU` `NEEDS VERIFICATION` boundary |
| 9 | `services/discreteModeParser.ts` | `hmi/frontend/src/features/cfds/utils/discreteModeParser.ts` | Migrate Label 355 11-field record validator & `PREV/NEXT` indexer |
| 10 | `services/discreteModeService.ts` | `hmi/frontend/src/features/cfds/services/discreteModeService.ts` | Migrate Discrete Mode constants (`DISCRETE_TIMEOUT_1S_MS=1000`) & simulation helpers |
| 11 | `components/CFDSLayout.tsx` | `hmi/frontend/src/features/cfds/components/CFDSLayout.tsx` | Adapt inside `CfdsModeView.tsx` using `useCfdsController` hook + backend API sync |
| 12 | `components/LRUSelection.tsx` | `hmi/frontend/src/features/cfds/components/LRUSelection.tsx` | Migrate with CSS class scoping and backend `/api/cfds/lru` sync |
| 13 | `components/CFDSModeSelect.tsx` | `hmi/frontend/src/features/cfds/components/CFDSModeSelect.tsx` | Migrate Figure 48 hub; add honest `SIMULATION / NO HW RX` indicator badge |
| 14 | `components/EditCFDSTXData.tsx` | `hmi/frontend/src/features/cfds/components/EditCFDSTXData.tsx` | Migrate Figures 49–52 TX parameter editor + sync `/api/cfds/tx-params` |
| 15 | `components/ConfigureChannels.tsx` | `hmi/frontend/src/features/cfds/components/ConfigureChannels.tsx` | Migrate Figures 53–54 CFDS channel slot editor + wire shared `arincApi.configureChannel` |
| 16 | `components/EnterDateShopCode.tsx` | `hmi/frontend/src/features/cfds/components/EnterDateShopCode.tsx` | Migrate Figure 55 submode launcher (`ABD0018`: Normal/Menu; `ABD0048`: Normal/Interactive/Discrete) |
| 17 | `components/NormalModeView.tsx` | `hmi/frontend/src/features/cfds/components/NormalModeView.tsx` | Migrate shared Normal Mode view + sync Label 227 TX & Fig 58 SIM bursts via `/api/cfds` |
| 18 | `components/NormalModeABD0018.tsx` | `hmi/frontend/src/features/cfds/components/NormalModeABD0018.tsx` | Thin wrapper configuring `standard="ABD0018"` |
| 19 | `components/NormalModeABD0048.tsx` | `hmi/frontend/src/features/cfds/components/NormalModeABD0048.tsx` | Thin wrapper configuring `standard="ABD0048"` |
| 20 | `components/menu/MenuModeView.tsx` | `hmi/frontend/src/features/cfds/components/menu/MenuModeView.tsx` | Migrate Figures 59–61 + sync Label 227 commands via `/api/cfds/bite-command` |
| 21 | `components/menu/MenuModeABD0018.tsx` | `hmi/frontend/src/features/cfds/components/menu/MenuModeABD0018.tsx` | Wrapper for Menu Mode ABD0018 |
| 22 | `components/interactive/InteractiveModeView.tsx` | `hmi/frontend/src/features/cfds/components/interactive/InteractiveModeView.tsx` | Migrate Figures 62–70 (6x7 matrix, 3s->30s, ACK/NAK, CLR Bit 12) + `/api/cfds` TX logging |
| 23 | `components/interactive/InteractiveModeABD0048.tsx` | `hmi/frontend/src/features/cfds/components/interactive/InteractiveModeABD0048.tsx` | Wrapper for Interactive Mode ABD0048 |
| 24 | `components/discrete/DiscreteModeView.tsx` | `hmi/frontend/src/features/cfds/components/discrete/DiscreteModeView.tsx` | Migrate Figures 71–74 (Label 355 1s watchdog, 11 CRT fields, PREV/NEXT) + `/api/cfds/discrete/simulate` |
| 25 | `components/discrete/DiscreteModeABD0048.tsx` | `hmi/frontend/src/features/cfds/components/discrete/DiscreteModeABD0048.tsx` | Wrapper for Discrete Mode ABD0048 |

### New / Expanded Target Modules (`ARINC429 INTEGRATION`)

- **Frontend (`hmi/frontend/src/features/cfds/`):**
  - `types/index.ts`: Consolidated TypeScript interfaces & backend API payload/response types.
  - `config/index.ts`: `CFDS_MODE_CONFIG`, timeout constants, `NEEDS VERIFICATION` boundary constants.
  - `services/cfdsApi.ts`: REST client wrapping `/api/cfds/*` via `shared/api`.
  - `hooks/useCfdsController.ts` & `hooks/index.ts`: Coordinated CFDS state, hardware/simulation source sync, and API actions.
  - `styles/cfds.css`: Scoped `.cfds-workbench` styling so CFDS components integrate seamlessly inside `AppShell` without mutating `styles/global.css`.
  - `pages/CfdsModePage.tsx`: Page container integrating `<CfdsMode />` cleanly with `AppShell` navigation (`navigateToRoute("/")`).

- **Backend (`hmi/backend/features/cfds/`):**
  - `schemas.py`: Pydantic v2 request/response contracts (`CfdsModeMetadata`, `CfdsLruSelectRequest`, `CfdsTxParamsRequest`, `CfdsBiteCommandRequest`, `CfdsNormalSimulateRequest`, `CfdsDiscreteSimulateRequest`, `CfdsStateResponse`).
  - `service.py`: Stateful CFDS coordinator service using `core.arinc429.encode_arinc429_word`, `decode_iso5_pair_356`, and `core.runtime.arinc_coordinator` (`acquire_mode("CFDS")`, `transmit_word`, `record_rx_word`).
  - `router.py`: Session-authenticated endpoints (`Depends(require_session)`) under `/api/cfds`.

- **Minimal Global Integration (`Phase 5`):**
  - `hmi/frontend/src/app/configuration/modes.ts`: Change CFDS descriptor `status` from `"development"` to `"active"`. No other global router or shell files need invasive edits.

---

## 3. Preserved `NEEDS VERIFICATION` Boundaries (Zero Protocol Fabrication)

1. Interactive Mode `MENU` key (Row 3 Col 3 in Fig 62–70) has no documented Label 227 Bits 25–31 command code -> explicitly marked `NEEDS VERIFICATION`.
2. ABD0048 Interactive RX ACK/NAK & Menu payload framing is not specified in manual pp. 1-4-101 to 1-4-111 -> simulated interactively with explicit `source: "SIMULATION"` tagging.
3. ABD0048 Discrete Mode Label 355 exact bits 9–29 layout and unillustrated `FAILURE TYPE CODE` enum values are not detailed in pp. 1-4-111 to 1-4-115 -> simulated Fig 73/74 records tagged `source: "SIMULATION"`.
4. Air/Ground manual toggle inside Normal Mode UI (`cmd=0x12/0x11` Air vs `0x00` Ground) preserves the verified `cfdsProtocol.ts` mapping cleanly across both frontend and backend encoders.


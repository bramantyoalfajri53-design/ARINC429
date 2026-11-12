# CFDS Mode Integration Documentation

**Repository:** `https://github.com/bramantyoalfajri53-design/ARINC429.git`  
**Branch:** `integration/cfds-feature` (based on `main` @ `8f22bcd`)  
**Workspace:** `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION`

---

## 1. Feature-Based Modular Architecture Overview

The CFDS (Centralized Fault Display System, Airbus ABD0018 / ABD0048) module from `ARINC429 FINAL` has been cleanly integrated into the modular Feature-Based Architecture without modifying any protected modules (`standard`, `cmc`, `power-console`, `power`, `shared`, or `core`).

### Frontend Module Structure (`hmi/frontend/src/features/cfds/`)
- `config/index.ts`: Exports `CFDS_MODE_CONFIG`, `CFDS_TIMEOUTS_MS` (`3000`, `30000`, `1000`, `100`), and `CFDS_VERIFIED_COMMANDS` (`0x00`, `0x12`, `0x11`, `0x08`, `0x76`, `0x77`).
- `types/index.ts`: Consolidated TypeScript interfaces for LRU definitions, TX parameters, 17 subsystem config flags, backend state contracts, and view navigation.
- `utils/`:
  - `lruDefinitions.ts`: 19 verified LRUs from Manual Figure 47 (`707 LRA` through `755 MMR`, including `735 TCAS`).
  - `cfdsDefaults.ts`: 18 CFDS TX labels (`040`–`304`), `FLIGHT_PHASE_NAMES` (0–12), default TX params, and aircraft subsystem config.
  - `cfdsProtocol.ts`: Label `227` BITE Command Word encoder (`encodeBiteCommandWord`) & `formatHex32`.
  - `normalModeParser.ts`: Label `356` burst parser (`parseLabel356Block`), `FIGURE_58_TEST_BURST`, `FIGURE_58_COUNT_ERR_BURST`, and `getFlightPhaseCommandCode`.
  - `interactiveModeParser.ts`: Pending char / `CLR` / `SHFT+CLR` state machine + `ACK` / 3x `NAK` retry rules.
  - `discreteModeParser.ts`: 11-field Label `355` failure record validation & `PREV` / `NEXT` stepper.
- `services/`:
  - `cfdsApi.ts`: REST client using `shared` `api` wrapper for `/api/cfds/*`.
  - `menuModeService.ts`: Menu Mode ABD0018 command encoding (`70h`–`7Dh`, `PAGE`=`77h`) and simulation pages.
  - `interactiveModeService.ts`: 6x7 key matrix (`1L`–`6L`, `1R`–`6R` with `3R=7Ah`, `PRV=76h`, `NXT=77h`, `SHFT`, `CLR=08h`, `SP=20h`, `MENU` marked `NEEDS VERIFICATION`).
  - `discreteModeService.ts`: Discrete Mode ABD0048 (`Label 355`, `1000 ms` watchdog, simulation records).
- `hooks/useCfdsController.ts`: Central state controller syncing LRU selection, TX parameters, BITE commands, simulation injections, and shared ARINC 429 coordinator status.
- `styles/cfds.css`: Scoped `.cfds-workbench` container styling isolated from global AppShell CSS.
- `components/`: All Figure 47–74 UI screens (`LRUSelection`, `CFDSModeSelect`, `EditCFDSTXData`, `ConfigureChannels`, `EnterDateShopCode`, `NormalModeView`, `NormalModeABD0018`, `NormalModeABD0048`, `menu/MenuModeView`, `menu/MenuModeABD0018`, `interactive/InteractiveModeView`, `interactive/InteractiveModeABD0048`, `discrete/DiscreteModeView`, `discrete/DiscreteModeABD0048`, `CFDSLayout`, `CfdsModeView`).
- `pages/CfdsModePage.tsx`: Top-level route page mounted by `AppRouter` at `/cfds`.

### Backend Module Structure (`hmi/backend/features/cfds/`)
- `schemas.py`: Pydantic v2 models (`CfdsModeMetadata`, `CfdsLruSelectRequest`, `CfdsTxParamsRequest`, `CfdsBiteCommandRequest`, `CfdsNormalSimulateRequest`, `CfdsDiscreteSimulateRequest`, `CfdsChannelConfigRequest`).
- `service.py`: Coordinator-backed business logic (`acquire_mode("CFDS")`, `transmit_word`, `record_rx_word`, `encode_cfds_bite_word` via protected `core.arinc429.encode_arinc429_word`, Label `356` burst validation, Discrete Fig 73/74 simulation).
- `router.py`: Session-authenticated FastAPI endpoints under `/api/cfds`.

### Minimal Global App Configuration Change
- Only `hmi/frontend/src/app/configuration/modes.ts` was updated (`cfds` status changed from `"development"` to `"active"`).

---

## 2. Simulation vs Hardware Honesty Boundary & `NEEDS VERIFICATION` Items

- All simulated RX bursts (`FIGURE_58_TEST_BURST`, `FIGURE_58_COUNT_ERR_BURST`, Menu pages, Interactive ACK/NAK/prompts, Discrete Fig 73/74 Label 355 records) are explicitly tagged `source: "SIMULATION"`.
- Both UI (`[data-testid="cfds-coordinator-source"]`) and backend coordinator (`/api/cfds/state`) display `SIMULATION (NO HW RX)` whenever hardware is unavailable.
- Unspecified manual items remain documented as `NEEDS VERIFICATION`:
  1. Interactive Mode `MENU` key Label `227` hex code (Row 3 Col 3 in Fig 62–70).
  2. Exact ARINC 429 RX bit framing for ABD0018/ABD0048 Menu rows and Interactive ACK/NAK.
  3. Exact Label `355` bits 9–29 packing and unillustrated `FAILURE TYPE CODE` enum strings for ABD0048 Discrete Mode.

# Dokumentasi Modul Web HMI

Ringkasan tanggung jawab, public exports, dan endpoint masing-masing modul di bawah `hmi/`.

---

## 1. `power-console` (Aktif)

- **Fungsi:** Kontrol dan monitoring catu daya DC **Keysight N5746A** (0–40 V / 0–19 A) dan sumber daya AC **Keysight AC6803B** (0–270 Vrms / 45–500 Hz).
- **Frontend:** `hmi/frontend/src/features/power-console/`
  - Export publik: `PowerConsolePage`, `DcTelemetry`, `AcTelemetry`, `DcPreset`, `AcPreset`, `ChartSeries`
  - Komponen: `DcSupplyPanel`, `AcSupplyPanel`
  - Hook: `usePowerTelemetryHistory` (buffer 100 sampel untuk strip chart)
- **Backend:** `hmi/backend/features/power/` + `hmi/backend/ate_power/`
  - Endpoints: `/api/dc/setpoint`, `/api/dc/output`, `/api/dc/preset`, `/api/ac/setpoint`, `/api/ac/output`, `/api/ac/preset`, `/api/estop`, `/api/gpib/rescan`, `/api/mode/simulation`
  - Safety interlocks: HV confirm (`>35 VDC` / `>130 Vrms`), OVP clamping, frequency band drop protection, emergency stop.

---

## 2. `standard` (Kerangka Siap Pengembangan — Developer A)

- **Fungsi:** Modul independen untuk **Standard Mode** perangkat Aeroflex JcAIR T1200 / T1200B.
- **Frontend:** `hmi/frontend/src/features/standard/` (`StandardModePage`, `STANDARD_MODE_CONFIG`, `standardApi`)
- **Backend:** `hmi/backend/features/standard/` (`router` prefix `/api/standard`, `service.py`, `schemas.py`)
- **Route SPA:** `/standard`

---

## 3. `cfds` (Kerangka Siap Pengembangan — Developer B)

- **Fungsi:** Modul independen untuk **CFDS Mode** (Centralized Fault Display System).
- **Frontend:** `hmi/frontend/src/features/cfds/` (`CfdsModePage`, `CFDS_MODE_CONFIG`, `cfdsApi`)
- **Backend:** `hmi/backend/features/cfds/` (`router` prefix `/api/cfds`, `service.py`, `schemas.py`)
- **Route SPA:** `/cfds`

---

## 4. `cmc` (Kerangka Siap Pengembangan — Developer C)

- **Fungsi:** Modul independen untuk **CMC Mode** (Central Maintenance Computer).
- **Frontend:** `hmi/frontend/src/features/cmc/` (`CmcModePage`, `CMC_MODE_CONFIG`, `cmcApi`)
- **Backend:** `hmi/backend/features/cmc/` (`router` prefix `/api/cmc`, `service.py`, `schemas.py`)
- **Route SPA:** `/cmc`

---

## 5. `shared` (Frontend) & `core` (Backend)

- **Frontend `shared/`:**
  - `components/`: `LoginView`, `AppShell` (di `app/layouts/`), `ConfirmModal`, `LogViewer`, `Meter`, `SetpointInput`, `StatusPill`, `StripChart`
  - `hooks/`: `useAuthSession`, `useControlLease`, `useTelemetryStream`, `useCommandAction`, `useAppSession`
  - `services/`: `api()`, `parseHvConflict()`, `telemetryWsUrl()`
- **Backend `core/`:**
  - Auth & session cookie (`/api/auth/*`)
  - Single-operator lease (`/api/control/*`)
  - Global telemetry (`/api/state`, `/ws/telemetry`)
  - SPA asset & fallback serving (`spa.py`)


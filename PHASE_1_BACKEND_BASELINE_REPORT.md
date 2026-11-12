# PHASE 1 — BACKEND BASELINE REPORT
**Tanggal:** 2026-11-12  
**Branch Git:** `integration/cfds-feature` (dari `8f22bcd`)  
**Interpreter:** `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\hmi\backend\.venv\Scripts\python.exe`

---

## 1. Perbaikan Test-Only yang Dilakukan
Sesuai rekomendasi Phase 0D (Opsi 1), perbaikan hanya dilakukan pada 2 file test `hmi/backend/tests/shared/` tanpa menyentuh `app.py`, router produksi, `requirements.txt`, versi FastAPI, maupun modul `Standard`/`CMC`/`Power`/`CFDS`/`core/`:

1. **`hmi/backend/tests/shared/test_app_routes_and_auth.py` (`test_expected_routes_registered`):**
   - Mengganti `{route.path for route in backend_app.app.routes}` dengan pengecekan 16 endpoint HTTP pada kontrak publik `backend_app.app.openapi().get("paths", {}).keys()`.
   - Menambahkan helper ASGI WebSocket `_asgi_websocket_unauthorized("/ws/telemetry")` untuk memverifikasi langsung bahwa endpoint `/ws/telemetry` menerima koneksi, mengirim `{"error": "unauthorized"}`, dan menutup dengan close code `4401` saat tidak terautentikasi, serta menguji `GET /api/state` mengembalikan `401` tanpa cookie.
2. **`hmi/backend/tests/shared/test_arinc429_coordinator.py` (`test_arinc429_http_routes_registered_and_auth_protected`):**
   - Mengganti `{route.path for route in backend_app.app.routes}` dengan verifikasi ke-14 path & HTTP method (`GET`/`POST`) pada `backend_app.app.openapi().get("paths", {})`.
   - Memverifikasi langsung lewat `_asgi_request` bahwa ke-14 endpoint mengembalikan `401` saat dipanggil tanpa session cookie.

## 2. Hasil Eksekusi `pytest -v` (Full Backend Suite)
- Perintah: `.\.venv\Scripts\python.exe -m pytest -v` (di `hmi/backend/`)
- Hasil: **`23 passed in 2.19s` (`PYTEST_EXIT=0`, 0 failed, 0 skipped)**
  - `tests/cfds/`: `1 passed`
  - `tests/cmc/`: `4 passed`
  - `tests/standard/`: `2 passed`
  - `tests/power/`: `11 passed`
  - `tests/shared/`: `5 passed`


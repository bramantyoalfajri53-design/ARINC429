# PHASE 0D — FASTAPI ROUTE TEST FAILURE INVESTIGATION REPORT
**Tanggal:** 2026-11-12  
**Workspace Integrasi:** `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION` (commit `8f22bcd`)  
**Status:** Investigasi Selesai (Read-Only — Belum Ada File Kode atau Test yang Diubah)

---

## 1. Root Cause Kedua Kegagalan

Kedua test pada `hmi/backend/tests/shared/` gagal karena **asumsi inspeksi internal FastAPI**: kedua test mengambil atribut `.path` secara langsung dari setiap item di `backend_app.app.routes`:

```python
paths = {route.path for route in backend_app.app.routes}
```

Pada **FastAPI `0.162.5`** (diinstal dari constraint `fastapi>=0.115` di `requirements.txt`), pemanggilan `app.include_router(...)` tidak lagi meratakan (*flatten*) seluruh `APIRoute` menjadi item langsung di `app.routes`. Sebagai gantinya, FastAPI menyimpan instance **`fastapi.routing._IncludedRouter`** (subclass `BaseRoute`, bertipe dataclass internal) di dalam `app.routes`. Objek `_IncludedRouter` **tidak memiliki atribut `.path`**, sehingga ekspresi `route.path` langsung melempar:

```text
AttributeError: '_IncludedRouter' object has no attribute 'path'
```

---

## 2. Versi & Konfigurasi Dependency yang Relevan

- **Interpreter:** `Python 3.13.13` (`hmi/backend/.venv\Scripts\python.exe`)
- **FastAPI terpasang:** `0.162.5`
- **Starlette terpasang:** `1.10.0`
- **Pydantic terpasang:** `2.14.3`
- **Constraint di `hmi/backend/requirements.txt`:**
  - `fastapi>=0.115`
  - `uvicorn[standard]>=0.32`
  - `itsdangerous>=2.2`
  - `python-multipart>=0.0.12`
- **Konfigurasi di `hmi/backend/pyproject.toml`:**
  - `pythonpath = ["."]`
  - `testpaths = ["tests"]`

---

## 3. Bukti Teknis Hasil Investigasi

### A. Struktur Aktual `backend_app.app.routes` pada `fastapi 0.162.5`
Saat `hmi/backend/app.py` (baris 24–33) memanggil `app.include_router(...)` untuk 8 router (`auth_router`, `control_router`, `telemetry_router`, `arinc429_router`, `power_router`, `standard_router`, `cfds_router`, `cmc_router`) dan `register_spa(app)`, isi `backend_app.app.routes` terobservasi sebagai berikut:

```text
('Route', 'starlette.routing')            -> /openapi.json
('Route', 'starlette.routing')            -> /docs
('Route', 'starlette.routing')            -> /docs/oauth2-redirect
('Route', 'starlette.routing')            -> /redoc
('_IncludedRouter', 'fastapi.routing')    -> (auth_router)
('_IncludedRouter', 'fastapi.routing')    -> (control_router)
('_IncludedRouter', 'fastapi.routing')    -> (telemetry_router)
('_IncludedRouter', 'fastapi.routing')    -> (arinc429_router)
('_IncludedRouter', 'fastapi.routing')    -> (power_router)
('_IncludedRouter', 'fastapi.routing')    -> (standard_router)
('_IncludedRouter', 'fastapi.routing')    -> (cfds_router)
('_IncludedRouter', 'fastapi.routing')    -> (cmc_router)
('Mount', 'starlette.routing')            -> /assets
('APIRoute', 'fastapi.routing')           -> /{full_path:path}
```

### B. Perilaku Internal `_IncludedRouter` dan Jebakan WebSocket
Dari inspeksi sumber `fastapi.routing._IncludedRouter`:
- `_IncludedRouter` menyimpan `original_router: APIRouter` dan `include_context: _RouterIncludeContext` serta metode privat `effective_route_contexts()`.
- Pada uji baca `_EffectiveRouteContext`, seluruh 30 endpoint HTTP dapat ditemukan lewat `effective_route_contexts()` maupun **`app.openapi()["paths"]`**.
- **Temuan Penting WebSocket (`/ws/telemetry`):**
  1. `app.openapi()["paths"]` menghasilkan **31 path** (seluruh **30 HTTP endpoints** + `/{full_path}`), **tetapi tidak menyertakan rute WebSocket `/ws/telemetry`** karena skema OpenAPI hanya mendokumentasikan endpoint HTTP.
  2. Bahkan pada `_EffectiveRouteContext` milik `APIWebSocketRoute` (`/ws/telemetry`), `ctx.path_format` bernilai `""` (string kosong), sementara path sebenarnya berada di `ctx.original_route.path == "/ws/telemetry"`. Ini membuktikan bahwa menelusuri struktur internal `_IncludedRouter` / `_EffectiveRouteContext` sangat rentan (*fragile*) terhadap perubahan internal FastAPI.

### C. Daftar Endpoint Terdaftar Aktual (via `app.openapi()` + `core/routers/telemetry.py`)
Seluruh endpoint yang ditargetkan oleh kedua test **memang benar-benar terdaftar dan aktif**, antara lain:
- Auth & Control: `/api/auth/login` (`POST`), `/api/auth/logout` (`POST`), `/api/auth/session` (`GET`), `/api/control/acquire` (`POST`), `/api/control/heartbeat` (`POST`), `/api/control/release` (`POST`).
- Power Console & Telemetry: `/api/state` (`GET`), `/api/dc/{setpoint,output,preset}` (`POST`), `/api/ac/{setpoint,output,preset}` (`POST`), `/api/estop` (`POST`), `/api/gpib/rescan` (`POST`), `/api/mode/simulation` (`POST`), dan WebSocket `/ws/telemetry` (`telemetry.py` baris 25).
- ARINC 429 & Features: `/api/arinc429/{status,export}` (`GET`), `/api/arinc429/{mode,bus,channels}` (`POST`), `/api/standard/status` (`GET`), `/api/standard/transmit` (`POST`), `/api/cfds/status` (`GET`), `/api/cmc/state` (`GET`), `/api/cmc/{lru,command,fault-summary,request-config-data,request-shop-faults}` (`POST`).

---

## 4. Analisis Masing-Masing Test

### Test 1: `test_expected_routes_registered` (`hmi/backend/tests/shared/test_app_routes_and_auth.py` baris 59–80)
- **Tujuan test:** Memverifikasi bahwa seluruh 17 endpoint inti aplikasi (16 HTTP + 1 WebSocket `/ws/telemetry`) terdaftar setelah modularisasi `app.py`.
- **Metode saat ini:** Membaca `{route.path for route in backend_app.app.routes}` (inspeksi internal yang tidak stabil di FastAPI `0.162.5`).
- **Perbandingan dengan test lain yang berhasil:** Test tepat di bawahnya (`test_auth_control_and_hv_interlock_flow`, baris 83–137) menggunakan helper `_asgi_request(method, path, body, cookie)` untuk mengeksekusi ASGI lifecycle secara langsung terhadap `backend_app.app`, dan test tersebut **PASSED** pada FastAPI `0.162.5`.
- **Kelayakan pengujian publik / ASGI:**
  - Ke-16 endpoint HTTP dapat diverifikasi lewat kontrak publik **`backend_app.app.openapi()["paths"]`** (sekaligus memverifikasi method HTTP-nya) atau via `_asgi_request`.
  - Endpoint WebSocket **`/ws/telemetry`** dapat diverifikasi langsung menggunakan handshake ASGI WebSocket scope (`type="websocket"`, `path="/ws/telemetry"`), memverifikasi server menerima koneksi (`websocket.accept`) dan menutup dengan `4401` + pesan `{"error": "unauthorized"}` ketika tidak terautentikasi — lebih bermakna sekaligus bebas dari detail internal `app.routes`.

### Test 2: `test_arinc429_http_routes_registered_and_auth_protected` (`hmi/backend/tests/shared/test_arinc429_coordinator.py` baris 49–73)
- **Tujuan test:**
  1. Memverifikasi 14 endpoint HTTP ARINC 429, Standard, CFDS, dan CMC terdaftar di aplikasi (baris 50–67).
  2. Memverifikasi proteksi autentikasi (`401` tanpa session cookie) pada `/api/arinc429/status` (baris 69–73).
- **Metode saat ini:** Baris 50 membaca `{route.path for route in backend_app.app.routes}`, lalu baris 70 sudah memanggil `_asgi_request("GET", "/api/arinc429/status")`.
- **Kelayakan pengujian publik / ASGI:** Seluruh 14 endpoint pada test ini adalah HTTP route, sehingga dapat diverifikasi langsung via **`backend_app.app.openapi()["paths"]`** (antarmuka publik resmi FastAPI) dan/atau dengan mengirimkan `_asgi_request(method, path)` tanpa cookie untuk membuktikan seluruhnya terdaftar (bukan `404`) dan mengembalikan `401` saat belum login!

---

## 5. Alternatif Solusi & Analisis Risiko

| Alternatif | Deskripsi | Risiko | Kesimpulan |
| :--- | :--- | :--- | :--- |
| **Opsi 1 (Rekomendasi Terbaik): Public Interface (`app.openapi()`) + ASGI Verification** | Ganti inspeksi `app.routes` pada ke-2 test dengan pengecekan kontrak publik `backend_app.app.openapi()["paths"]` untuk seluruh HTTP route (+ pengecekan ASGI `401` tanpa cookie) serta ASGI WebSocket scope untuk `/ws/telemetry`. | **Sangat Rendah:** Tidak bergantung pada kelas internal FastAPI (`_IncludedRouter`), tidak mengubah `requirements.txt`, tidak menyentuh kode produksi (`app.py`, `Standard`, `CMC`, `CFDS`, `Power`, `core/`). | **DIREKOMENDASIKAN** |
| **Opsi 2: Helper Rekursif Traversal `_IncludedRouter` / `original_router.routes`** | Tulis helper yang membaca `route.path`, atau jika tidak ada, menelusuri `route.original_router.routes` beserta `include_context.prefix`. | **Sedang:** Tetap mengakses atribut internal `_IncludedRouter` (`original_router`, `include_context`) yang dapat berubah lagi di rilis FastAPI berikutnya. | Kurang disarankan dibanding Opsi 1 |
| **Opsi 3: Pin/Downgrade `fastapi` di `requirements.txt`** | Memaksa versi FastAPI lama sebelum `_IncludedRouter` (mis. `<0.130`). | **Tinggi:** Mengubah `requirements.txt` & menurunkan versi library utama hanya demi test yang rapuh; memicu konflik jika tim lain memakai FastAPI terbaru. | Tidak disarankan |
| **Opsi 4: Ubah `app.py` agar tidak memakai `include_router`** | Mendaftarkan semua route langsung di `app` tanpa `include_router`. | **Sangat Tinggi:** Merusak arsitektur modular yang baru dibangun pada commit `8f22bcd`. | Ditolak |

---

## 6. Rekomendasi Perbaikan & File yang Perlu Diubah Jika Disetujui

- **Rekomendasi Utama:** Gunakan **Opsi 1** (kombinasi `backend_app.app.openapi()["paths"]` + pengujian ASGI langsung terhadap HTTP auth guard & WebSocket `/ws/telemetry`).
- **File yang perlu diubah (hanya 2 file test pada `tests/shared/` — 0 file produksi diubah):**
  1. `hmi/backend/tests/shared/test_app_routes_and_auth.py` (memperbarui fungsi `test_expected_routes_registered` + opsional helper ASGI WebSocket untuk memverifikasi `/ws/telemetry`).
  2. `hmi/backend/tests/shared/test_arinc429_coordinator.py` (memperbarui baris 50 pada `test_arinc429_http_routes_registered_and_auth_protected` menggunakan `app.openapi()["paths"]` dan verifikasi `_asgi_request` `401` pada endpoint ber-auth).
- **Perilaku API, Standard Mode, CMC Mode, CFDS scaffold, Power Console, `core/`, dan `requirements.txt`:** **100% tidak berubah.**

---

## Stop Condition Phase 0D Terpenuhi
- Tidak ada source code aplikasi, file test, `requirements.txt`, maupun dependency yang diubah.
- Tidak ada migrasi CFDS, tidak ada perubahan pada `ARINC429 FINAL`, dan tidak ada `git commit` atau `git push`.

Menunggu persetujuan Anda apakah perbaikan **Opsi 1** pada kedua file test `tests/shared/` tersebut diizinkan untuk diterapkan sebelum melanjutkan ke **Phase 1 — CFDS Migration & Integration**.


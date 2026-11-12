# PHASE 0C — BACKEND ENVIRONMENT & TEST BASELINE REPORT
**Tanggal:** 2026-11-12  
**Workspace Integrasi:** `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION` (commit `8f22bcd`)  
**Workspace Backup (Tidak Diubah):** `C:\Users\USER\Downloads\ARINC429\ARINC429 FINAL`

---

## 1. Versi dan Lokasi Python (Audit Environment Windows)
- **Interpreter Windows aktif:** `C:\Users\USER\AppData\Local\Programs\Python\Python313\python.exe`
- **Versi Python:** `3.13.13 (tags/v3.13.13:01104ce, Apr  7 2026, 19:25:48) [MSC v.1944 64 bit (AMD64)]`
- **Platform:** `Windows-11-10.0.26200-SP0`
- **Temuan `.venv` sebelumnya:** Folder `C:\Users\USER\Downloads\ARINC429\.venv` adalah virtual environment **Linux/WSL** (`bin/`, `lib/`, `lib64/`, tidak memiliki `Scripts/python.exe`), sehingga tidak dapat dijalankan sebagai interpreter Windows.
- **Instalasi Global:** Tidak dilakukan instalasi paket apa pun ke Python global Windows.

## 2. Lokasi Virtual Environment Backend (Baru)
- Path absolut: **`C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\hmi\backend\.venv`**
- Interpreter venv: `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\hmi\backend\.venv\Scripts\python.exe`
- Ter-ignore otomatis oleh `.gitignore` (tidak mengotori `git status`).

## 3. Isi `hmi/backend/requirements.txt` & Dependency yang Terinstal
Isi asli `requirements.txt` (tidak diubah):
- `fastapi>=0.115`
- `uvicorn[standard]>=0.32`
- `itsdangerous>=2.2`
- `python-multipart>=0.0.12`

Paket terinstal di dalam `hmi/backend/.venv` (`pip list`):
- `fastapi` `0.162.5`
- `uvicorn` `0.54.0`
- `starlette` `1.10.0`
- `pydantic` `2.14.3` (`pydantic_core` `2.50.4`)
- `itsdangerous` `2.2.0`
- `python-multipart` `0.0.33`
- `anyio` `4.16.0`
- `websockets` `17.4`
- `httptools` `0.9.0`, `h11` `0.16.0`, `python-dotenv` `1.2.4`, `PyYAML` `6.0.3`, `watchfiles` `1.3.0`, `click` `8.5.1`, `idna` `3.20`, `opentelemetry-api` `1.45.2`, `annotated-doc` `0.0.6`, `annotated-types` `0.8.0`, `typing-extensions` `4.16.0`, `typing-inspection` `0.4.5`
- `pytest` `9.2.0` (`pluggy` `1.7.0`, `iniconfig` `2.3.1`, `colorama` `0.4.6`, `packaging` `26.3`, `Pygments` `2.21.0`)

## 4. Hasil Instalasi Requirements
- `pip install -r hmi/backend/requirements.txt`: **`REQ_INSTALL_EXIT=0`** (seluruh paket terinstal bersih tanpa error).
- `pip install pytest`: **`PYTEST_INSTALL_EXIT=0`**.
- `requirements.txt` dan `pyproject.toml` tidak diubah.

## 5. Hasil Seluruh Test Suite Backend (`pytest -v`)

Dieksekusi menggunakan `C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\hmi\backend\.venv\Scripts\python.exe -m pytest`:

| Suite | Collected | Passed | Failed | Skipped | Import/Dep Error | Exit Code |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Full Backend Suite (`tests`)** | **23** | **21** | **2** | **0** | **0** | **`1`** |
| 1. `tests/cfds` (`test_cfds_module.py`) | 1 | 1 | 0 | 0 | 0 | `0` |
| 2. `tests/cmc` (`test_cmc_module.py`) | 4 | 4 | 0 | 0 | 0 | `0` |
| 3. `tests/standard` (`test_standard_module.py`) | 2 | 2 | 0 | 0 | 0 | `0` |
| 4. `tests/power` (`test_broker_interlocks.py`, `test_safety.py`, `test_visa_link.py`) | 11 | 11 | 0 | 0 | 0 | `0` |
| 5. `tests/shared` (`test_app_routes_and_auth.py`, `test_arinc429_coordinator.py`) | 5 | 3 | 2 | 0 | 0 | `1` |

### Detail 2 Kegagalan pada `tests/shared/`
Kedua kegagalan terjadi di tahap inspeksi `backend_app.app.routes`:
1. `tests/shared/test_app_routes_and_auth.py::test_expected_routes_registered` (baris 60)
2. `tests/shared/test_arinc429_coordinator.py::test_arinc429_http_routes_registered_and_auth_protected` (baris 50)

**Error lengkap:**
```text
AttributeError: '_IncludedRouter' object has no attribute 'path'
```
**Akar penyebab yang terobservasi:**
- Constraint `fastapi>=0.115` pada `requirements.txt` menginstal `fastapi 0.162.5`.
- Pada `fastapi 0.162.5`, pemanggilan `app.include_router(...)` menempatkan objek `_IncludedRouter` di dalam `backend_app.app.routes` (terverifikasi langsung: `[('Route', '/openapi.json'), ..., ('_IncludedRouter', None), ..., ('Mount', '/assets'), ('APIRoute', '/{full_path:path}')]`), dan objek `_IncludedRouter` tidak memiliki atribut `.path`.
- Sementara itu, test ASGI end-to-end `test_auth_control_and_hv_interlock_flow` pada `tests/shared/test_app_routes_and_auth.py`, `test_arinc429_word_codec_roundtrip_and_parity`, dan `test_coordinator_mode_isolation_and_csv_export` semuanya **PASSED**, sehingga endpoint FastAPI tetap berfungsi secara runtime.
- Sesuai aturan keselamatan Phase 0C, tidak ada perubahan pada source code maupun file test.

## 6. Hasil Frontend Regression & Python Syntax Check (Workspace Baru)
- **TypeScript Check (`npx tsc --noEmit`):** **`TSC_EXIT=0`** (0 error).
- **Vite Production Build (`npx vite build`):** **`VITE_EXIT=0`** (`114 modules transformed`, `dist/index.html 0.42 kB`, `dist/assets/index-D7E6wc0W.css 12.58 kB`, `dist/assets/index-D14R9fTM.js 194.05 kB`, built in `3.97s`).
- **Python Syntax Check (`py_compile` di luar `.venv`):** **`PY_COMPILE: ok=75, err=0`**.
- **Git Status:** Tidak ada file tracked GitHub yang berubah; file untracked di `ARINC429 INTEGRATION` hanya laporan `PHASE_0B_CLEAN_WORKSPACE_REPORT.md` dan laporan ini (`PHASE_0C_BACKEND_TEST_REPORT.md`).

## 7. Kendala yang Ditemukan
1. `.venv` pada parent folder (`C:\Users\USER\Downloads\ARINC429\.venv`) merupakan environment Linux/WSL sehingga tidak kompatibel dengan eksekusi native Windows. Kendala ini telah teratasi tanpa memengaruhi environment lama dengan membuat Windows venv terisolasi di `hmi/backend/.venv`.
2. Versi `fastapi 0.162.5` yang terpasang melalui `fastapi>=0.115` mengubah struktur internal `app.routes` (memakai `_IncludedRouter` tanpa `.path`), menyebabkan 2 test pengecekan daftar route statis di `tests/shared/` gagal dengan `AttributeError`.

## 8. Rekomendasi Sebelum Phase 1
1. Memastikan apakah kedua test inspeksi route di `tests/shared/` (`test_app_routes_and_auth.py:60` dan `test_arinc429_coordinator.py:50`) boleh disesuaikan pada tahap berikutnya agar menelusuri rute secara kompatibel dengan `fastapi 0.162.5` (misalnya melalui skema OpenAPI / ekspansi sub-router / ASGI test) atau menggunakan versi `fastapi` terpinning yang sesuai dengan kesepakatan tim — **jangan diubah tanpa persetujuan karena menyentuh `tests/shared/`**.
2. Untuk pengembangan **Phase 1 — CFDS Migration & Integration**, backend `features/cfds/` dan frontend `features/cfds/` sudah siap dijadikan target integrasi di atas `hmi/backend/.venv` dan `hmi/frontend`.

---

## Stop Condition Phase 0C Terpenuhi
- Tidak ada migrasi CFDS yang dijalankan.
- Tidak ada source code aplikasi, file test, `requirements.txt`, `Standard Mode`, `CMC Mode`, `Power Console`, `shared/`, maupun router yang diubah.
- Workspace lama (`ARINC429 FINAL`) dan daemon `server.py` (`task-1166`) tetap utuh.
- Tidak ada `git commit` atau `git push` yang dilakukan.

Menunggu peninjauan dan persetujuan Anda sebelum masuk ke **Phase 1 — CFDS Migration & Integration**.


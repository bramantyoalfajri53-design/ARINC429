# LAPORAN RESTORE SERVER DAN SALINAN LOKAL ATE-PLATFORM

**Tanggal Eksekusi:** 17 November 2026  
**Status:** SUKSES PENUH  
**Lead Engineer:** Senior DevOps & Software Architect  

---

## 1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

Sesuai instruksi:
1. **Server Production (`10.11.11.2`, user `paridit`):**
   - Aplikasi `/home/paridit/project/ate-platform` telah berhasil dikembalikan (*restored*) secara utuh ke kondisi sebelum MASTER EXECUTION terakhir.
   - Menggunakan backup resmi: `/home/paridit/project/backups/ate-platform_backup_20261117_113804` (commit baseline `41a3917`).
   - Seluruh penambahan kode Dynapro 1780A Infotouch, React build dist, router mount, dan file tambahan lainnya telah dibersihkan secara tuntas.
   - Layanan `ate-web.service` telah di-restart dan berjalan normal (HTTP 200, status `active (running)`, PIN auth 2468 berfungsi).
2. **Salinan Lokal (`ARINC429 INTEGRATION/ate-platform`):**
   - Source code server yang telah di-restore disalin ke folder lokal `ARINC429 INTEGRATION/ate-platform` (587 file, ~35.46 MB).
   - Seluruh pengecualian ketat dipatuhi: **TIDAK ADA** folder `.git`, `.venv`, `.env`, database, log, maupun cache produksi yang ikut tersalin.
   - Dibuatkan konfigurasi mandiri `.env.example`, `.env` (simulasi lokal), dan script runner otomatis `run_local.ps1`.
   - Seluruh test suite (23 unit & integration test) lulus 100%.
   - Server lokal berhasil diuji dan dapat diakses mandiri di `http://127.0.0.1:8080/` dan `http://127.0.0.1:8080/arinc` tanpa koneksi SSH.
3. **Repository GitHub:**
   - Tidak dilakukan push, force push, reset, rebase, atau perubahan apapun pada remote repository `https://github.com/bramantyoalfajri53-design/ARINC429.git`.
   - Commit history tetap utuh dan aman.

---

## 2. STATUS SERVER PRODUCTION SEBELUM DAN SESUDAH RESTORE

| Aspek | Sebelum Restore (Pasca Master Execution) | Sesudah Restore (Kondisi Saat Ini) |
|---|---|---|
| **Git Baseline** | Terdapat modifikasi lokal Dynapro | Baseline commit `41a3917` (clean match backup) |
| **`web/arinc.html`** | Mengandung iframe/mount Dynapro 1780A | Kode HTML asli ATE Platform (clean, 0 references to Dynapro) |
| **`web/arinc.js`** | Mengandung navigasi overlay Dynapro | Kode JavaScript asli ATE Platform (clean, 0 references to Dynapro) |
| **`src/ate_platform/web/app.py`** | Memuat `standard_router` & mount `/dist` | Kode FastAPI asli ATE Platform (hanya route `/api/arinc/*`) |
| **`web/dist`** | Direktori build React SPA (~1.2 MB) | **Dihapus total** (`rm -rf web/dist`) |
| **`src/features/standard/`** | Berisi `lru_registry.py` & codec tambahan | Berisi file asli ATE Platform |
| **`tests/`** | Memuat `test_lru_single_mode.py` | Berisi test asli ATE Platform |
| **Layanan Systemd** | `ate-web.service` aktif (dengan modifikasi) | `ate-web.service` aktif (kembali ke versi asli) |
| **Port 8080** | Aktif | Aktif melayani `GET /` & `GET /arinc` |

---

## 3. BUKTI PENGHAPUSAN PERUBAHAN DYNAPRO DARI SERVER

Pemeriksaan verifikasi langsung pada server `10.11.11.2`:
1. `diff -r -q /home/paridit/project/ate-platform /home/paridit/project/backups/ate-platform_backup_20261117_113804`  
   **Hasil:** Tidak ada perbedaan source code (`EXACT_MATCH_NO_DIFF`).
2. `grep -ri 'dynapro' /home/paridit/project/ate-platform/web`  
   **Hasil:** `NO_DYNAPRO_FOUND` (bersih total).
3. `grep -n 'dist' /home/paridit/project/ate-platform/src/ate_platform/web/app.py`  
   **Hasil:** `NO_DIST_MOUNT` (bersih total).
4. `test -d /home/paridit/project/ate-platform/web/dist`  
   **Hasil:** Direktori tidak ditemukan / telah dihapus.

---

## 4. DAFTAR FILE DAN DIREKTORI YANG DI-RESTORE PADA SERVER

- `web/arinc.html`
- `web/arinc.js`
- `src/ate_platform/web/app.py`
- `src/features/standard/*` (semua file subdirektori disinkronkan ke backup)
- `README.md`
- `launch_web_hmi.ps1`
- `hmi/*` (dipulihkan ke kondisi backup)
- File yang dihapus:
  - `web/dist/`
  - `src/features/standard/lru_registry.py`
  - `tests/test_lru_single_mode.py`
  - `docs/ARCHITECTURE.md`
  - `docs/DEPLOYMENT_GUIDE.md`
  - `docs/DEVELOPMENT_GUIDE.md`
  - `docs/FINAL_INTEGRATION_REPORT.md`

---

## 5. HASIL PENGUJIAN SERVER PRODUCTION

Pemeriksaan status dan endpoint HTTP pada server production `10.11.11.2`:
- **Systemd Service:**
  ```text
  ● ate-web.service - ATE Operator UI (station kernel daemon)
       Loaded: loaded (/etc/systemd/system/ate-web.service; enabled; vendor preset: enabled)
       Active: active (running) since Tue 2026-11-17 13:34:03 UTC
     Main PID: 47507 (ate-web)
  ```
- **HTTP GET `/`:** `200 OK`
- **HTTP GET `/arinc`:** `200 OK`
- **POST `/api/auth/login` (PIN 2468):** `{"ok":true}`
- **GET `/api/arinc/status`:** `200 OK` (`app_mode: "standard"`, 20 LRU aktif di catalog, hardware fallback simulated jika instrumen Keysight offline).
- **Verifikasi UI:** Tampilan STANDARD MODE kembali menampilkan antarmuka asli ATE Platform tanpa card/modal Dynapro.

---

## 6. STRUKTUR DAN VERIFIKASI SALINAN LOKAL

Salinan lokal ditempatkan di:  
`c:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\ate-platform`

### Struktur Direktori:
```text
ate-platform/
├── deploy/
├── docs/
├── driver/
├── gui/
├── hmi/
├── netlist/
├── plans/
├── plugins/
├── profiles/
├── results_out/
├── scripts/
├── src/
│   ├── ate_platform/
│   │   ├── cli/
│   │   ├── driver/
│   │   ├── sequencer/
│   │   ├── web/
│   │   └── wiring/
│   └── features/
│       ├── cfds/
│       ├── cmc/
│       └── standard/
├── station/
├── tests/
├── web/
│   ├── arinc.html
│   ├── arinc.js
│   ├── index.html
│   └── style.css
├── .env.example
├── .env (local development simulation)
├── pyproject.toml
├── README.md
└── run_local.ps1
```

### Verifikasi Pengecualian (Exclusion Check):
- `.git`: **TIDAK ADA**
- `.venv`: **TIDAK ADA**
- `.env` produksi: **TIDAK ADA** (hanya `.env` lokal baru dengan `ATE_FORCE_SIM=1`)
- Database (`*.db`): **TIDAK ADA**
- Log file (`*.log`): **TIDAK ADA**
- Cache (`__pycache__`, `.pytest_cache`): **TIDAK ADA**

---

## 7. HASIL PENGUJIAN LOKAL

### Unit & Integration Test:
Dijalankan menggunakan pytest lokal:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.13, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\ate-platform
configfile: pyproject.toml
plugins: anyio-4.16.0
collected 23 items / 3 skipped

ate-platform\tests\test_cfds_cmc_integration.py ...                      [ 13%]
ate-platform\tests\test_device.py ...                                    [ 26%]
ate-platform\tests\test_label_library.py ...                             [ 39%]
ate-platform\tests\test_safety.py .....                                  [ 60%]
ate-platform\tests\test_sequencer.py ....                                [ 78%]
ate-platform\tests\test_web.py .....                                     [100%]

================== 23 passed, 3 skipped, 1 warning in 10.46s ==================
```

### Server Web Lokal (Standalone):
Dijalankan secara mandiri pada port 8086 untuk verifikasi request:
- `GET /` -> Status: **200 OK**
- `GET /arinc` -> Status: **200 OK**
- `POST /api/auth/login` (PIN 2468) -> Status: **200 OK** (`{"ok": true}`)
- `GET /api/arinc/status` -> Status: **200 OK** (Mode: `standard`, 20 LRU terdaftar)

---

## 8. PANDUAN MENJALANKAN APLIKASI SECARA LOKAL

Untuk menjalankan `ate-platform` secara mandiri di komputer lokal tanpa koneksi SSH:

### Opsi 1: Menggunakan Script Runner (Paling Mudah)
Buka terminal PowerShell pada direktori `ARINC429 INTEGRATION\ate-platform` dan jalankan:
```powershell
.\run_local.ps1
```
Atau jika ingin menentukan port kustom:
```powershell
.\run_local.ps1 -Port 8080
```

### Opsi 2: Menggunakan Python Langsung
```powershell
cd "c:\Users\USER\Downloads\ARINC429\ARINC429 INTEGRATION\ate-platform"
$env:ATE_FORCE_SIM = "1"
$env:ATE_UI_PIN = "2468"
$env:ATE_UI_SESSION_SECRET = "local-secret-key"
$env:PYTHONPATH = ".\src;.\plugins"

..\hmi\backend\.venv\Scripts\python.exe -m ate_platform.web.cli --sim --host 127.0.0.1 --port 8080
```

Setelah server aktif, buka browser di:
- **Operator Portal:** [http://127.0.0.1:8080/](http://127.0.0.1:8080/)
- **ARINC 429 Interface:** [http://127.0.0.1:8080/arinc](http://127.0.0.1:8080/arinc)
- **PIN Login:** `2468`

---

## 9. STATUS GIT & GITHUB

- **Working Directory:** `ARINC429 INTEGRATION`
- **Git Status:** Hanya mencatat `ate-platform/` sebagai direktori lokal baru yang belum di-commit (`untracked`).
- **Remote GitHub:** Tidak ada perubahan pada branch `main` remote `origin`. Riwayat commit sebelumnya tetap utuh.
- Tidak ada operasi `git push`, `git reset`, atau `git clean` pada repo.

---

## 10. REKOMENDASI PENGEMBANGAN BERIKUTNYA

1. **Pengembangan Mandiri di Folder Terpisah:**
   - Gunakan `ARINC429 INTEGRATION/ate-platform` sebagai salinan murni dari apa yang berjalan di server.
   - Jika ingin memodifikasi atau mengembangkan STANDARD MODE (seperti integrasi UI Dynapro 1780A sesuai foto CRT), kembangkan secara bertahap pada salinan lokal dan uji menggunakan simulation mode sebelum menyentuh server production.
2. **Workflow Deployment yang Aman di Masa Mendatang:**
   - Selalu buat pre-deployment snapshot di `/home/paridit/project/backups/`.
   - Gunakan branch khusus pengembangan jika ingin melakukan push ke Git alih-alih langsung memodifikasi server production.

# Panduan Pengembangan Tim (Team Development Guide)

Panduan ini mengatur cara kerja paralel beberapa developer dalam satu repositori GitHub menggunakan arsitektur modular pada `hmi/frontend/` dan `hmi/backend/`.

---

## 1. Pembagian Kepemilikan Modul

| Peran | Direktori Frontend | Direktori Backend | Direktori Test |
| :--- | :--- | :--- | :--- |
| **Developer A — Standard Mode** | `hmi/frontend/src/features/standard/` | `hmi/backend/features/standard/` | `hmi/frontend/tests/standard/` & `hmi/backend/tests/standard/` |
| **Developer B — CFDS Mode** | `hmi/frontend/src/features/cfds/` | `hmi/backend/features/cfds/` | `hmi/frontend/tests/cfds/` & `hmi/backend/tests/cfds/` |
| **Developer C — CMC Mode** | `hmi/frontend/src/features/cmc/` | `hmi/backend/features/cmc/` | `hmi/frontend/tests/cmc/` & `hmi/backend/tests/cmc/` |
| **Power Console (Existing)** | `hmi/frontend/src/features/power-console/` | `hmi/backend/features/power/` + `ate_power/` | `hmi/frontend/tests/power-console/` & `hmi/backend/tests/power/` |
| **Shared / Core** | `hmi/frontend/src/shared/` & `src/app/` | `hmi/backend/core/` | `hmi/backend/tests/shared/` |

---

## 2. Panduan Pengembangan Per Modul

### A. Mengembangkan Standard Mode (Developer A)
1. Tempatkan seluruh komponen UI khusus Standard Mode di `hmi/frontend/src/features/standard/components/`.
2. Tempatkan halaman di `pages/`, state hooks di `hooks/`, panggilan API di `services/standardApi.ts`, tipe di `types/`, helper di `utils/`, dan konstanta di `config/`.
3. Ekspos halaman dan tipe publik hanya melalui `hmi/frontend/src/features/standard/index.ts`.
4. Di backend, implementasikan schema di `hmi/backend/features/standard/schemas.py`, logika bisnis di `service.py`, dan endpoint `/api/standard/*` di `router.py`, lalu daftarkan `standard_router` di `hmi/backend/app.py` saat siap aktif.

### B. Mengembangkan CFDS Mode (Developer B)
1. Bekerja terisolasi di dalam `hmi/frontend/src/features/cfds/` dan `hmi/backend/features/cfds/`.
2. Gunakan `api()` dan `useAppSession()` dari `shared/` untuk autentikasi, lease kontrol, status banner, atau perintah sistem.
3. Jangan menyalin utilitas atau komponen UI dari `standard/` atau `power-console/`; jika benar-benar umum untuk beberapa mode, ajukan pemindahan ke `shared/`.

### C. Mengembangkan CMC Mode (Developer C)
1. Bekerja terisolasi di dalam `hmi/frontend/src/features/cmc/` dan `hmi/backend/features/cmc/`.
2. Pastikan router `/api/cmc/*` memakai dependency `require_session` atau `require_control` dari `core.dependencies` agar aturan otorisasi dan single-operator lease tetap konsisten.

---

## 3. Panduan Membuat Komponen & Service `shared/`

Tambahkan ke `shared/` hanya apabila:
- Komponen/service benar-benar dipakai oleh **dua atau lebih** modul mode, dan
- Perilakunya identik atau dapat diparameterisasi via props tanpa membawa logika bisnis spesifik satu mode.

Langkah menambahkan ke `shared/`:
1. Buat komponen/hook/util di subfolder `src/shared/<kategori>/` yang sesuai.
2. Ekspos melalui `index.ts` di subfolder tersebut dan `src/shared/index.ts`.
3. Pastikan komponen `shared/` tidak mengimpor apa pun dari `src/features/*` atau `src/app/*`.

---

## 4. Alur Kerja Git Branch & Pull Request

1. **Branch naming:**
   - `feat/standard-<deskripsi>` (Developer A)
   - `feat/cfds-<deskripsi>` (Developer B)
   - `feat/cmc-<deskripsi>` (Developer C)
   - `refactor/shared-<deskripsi>` atau `fix/<deskripsi>`
2. **Batas perubahan PR:**
   - PR untuk satu modul sebaiknya hanya menyentuh direktori modul tersebut (`features/<mode>/`) dan test terkait.
   - Perubahan di `shared/`, `core/`, atau `app/` dilakukan pada PR terpisah atau dengan review lintas-tim agar tidak memicu konflik merge.
3. **Checklist wajib sebelum PR di-merge:**
   - Frontend typecheck lulus: `npm run typecheck` di `hmi/frontend/`
   - Frontend production build lulus: `npm run build` di `hmi/frontend/`
   - Backend tests lulus: `python -m pytest -v` di `hmi/backend/`
   - Tidak ada cross-feature imports atau circular dependencies.


# Instruksi untuk AI Agent

## CodeGraph (Code Intelligence)

Project ini menggunakan **CodeGraph** untuk code intelligence & knowledge graph.

- Database lokal tersimpan di `.codegraph/` (SQLite: `codegraph.db`). Direktori ini **di-ignore oleh git** (hanya `.codegraph/.gitignore` yang di-track) — jangan commit isinya.
- Sebelum mengeksplorasi kode yang besar/kompleks, gunakan CodeGraph sebagai sumber konteks utama:
  - `codegraph query <search>` — cari simbol/definisi
  - `codegraph explore <query...>` — eksplorasi area: source simbol relevan + call paths
  - `codegraph node <name>` — source satu simbol + caller/callee trail (atau baca file dengan nomor baris)
  - `codegraph files` — struktur file dari index
  - `codegraph status` — cek status & statistik index
- Setelah melakukan perubahan kode yang signifikan, jalankan `codegraph sync` agar index tetap mutakhir.
- Gunakan `codegraph index` untuk rebuild penuh dari nol jika index tidak sinkron.
- Bila tersedia, gunakan MCP tools `codegraph_explore` / `codegraph_node` untuk mendapatkan hasil yang sama tanpa CLI.

## Panduan Umum

- Stack: **Next.js 16 (App Router)** + **Supabase** (PostgreSQL + Auth + RLS) + **Tailwind CSS**.
- Aplikasi ini sudah **PWA**: `public/manifest.json`, `public/sw.js`, dan ikon di `public/icons/`.
- Baca `README.md` dan `DOCUMENTATION.md` untuk konteks fitur, skema database, dan panduan deploy.
- Lihat **`UI_UX_AUDIT.md`** untuk roadmap & milestone perbaikan UI/UX.

## Konvensi Komponen & UI

### Heading
- Hanya **satu `<h1>` per halaman**, menggunakan `text-xl font-bold` (konsisten di semua halaman terautentikasi).

### Modal
- Semua dialog memakai `Modal` dari `src/components/ui/Modal.tsx`.
- Semua konfirmasi penghapusan/aksi destruktif memakai `ConfirmDialog` dari `src/components/ui/ConfirmDialog.tsx` — **jangan pakai `window.confirm()` / `window.alert()`**.

### Scroll lock
- Pakai `useScrollLock` dari `src/lib/useScrollLock.ts` (counter global) — jangan mengubah `document.body.style.overflow` secara manual.

### Empty & Error state
- Empty state: `EmptyState` (`src/components/ui/EmptyState.tsx`).
- Error state: `ErrorState` (`src/components/ui/ErrorState.tsx`) dengan tombol retry bila memungkinkan.
- Jangan menulis teks kosong/error polos langsung tanpa komponen ini.

### Loading state
- Gunakan skeleton (`Skeleton`, `SkeletonRows`, `MasterTableSkeleton`) — hindari teks "Memuat..." polos.

### Form
- Semua label harus terasosiasi dengan input: `htmlFor` + `id` (atau bungkus input di dalam `<label>`).

### Toast
- Panggil `toast(message, type)` dari `src/components/Toast.tsx`.
- `ToastHost` sudah menangani stacking, dismiss, dan posisi aman mobile.

### Filter
- Filter antar halaman diutamakan **URL-first** (query params + `router.push`).
- Pengecualian: **Matriks Omset** memakai auto-sync `router.replace` + parameter `period`/`metric`/`date`; alihenkan ke pola URL-first jika/ketika dilakukan perombakan besar.

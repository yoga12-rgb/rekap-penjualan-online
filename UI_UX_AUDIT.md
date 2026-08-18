# Audit UI/UX — Rekap Penjualan Rajaklana

Dokumen ini berisi hasil audit UI/UX mendalam, temuan berdasarkan prioritas, serta roadmap & milestone untuk dikerjakan agent lain.

> **Tanggal audit:** 18 Agustus 2026
> **Cakupan:** Halaman publik & terautentikasi, komponen UI reusable, navigasi, aksesibilitas dasar, konsistensi pola interaksi, dan pengalaman lintas perangkat (desktop/mobile).

---

## 1. Ringkasan Eksekutif

Aplikasi sudah memiliki fondasi UI yang solid dan konsisten secara visual (sistem warna berbasis CSS variable, komponen `card`/`btn`/`input`, dark mode anti-flicker, responsif dasar). Namun terdapat sejumlah inkonsistensi interaksi dan kesenjangan aksesibilitas yang perlu distandarisasi sebelum fitur bertambah.

Tiga area terbesar yang perlu diperhatikan:

1. **Konsistensi pola interaksi** — campuran `window.confirm` (native) vs modal, pola filter berbeda antara halaman, feedback sukses/gagal yang tidak seragam.
2. **Aksesibilitas** — fokus modal belum dikelola penuh, `Combobox` belum punya atribut ARIA, label form banyak yang tidak terasosiasi dengan input.
3. **Komponen reusable** — belum ada komponen baku untuk empty state, confirm dialog, dan error state.

---

## 2. Temuan Berdasarkan Prioritas

### 🔴 Tinggi (High)

#### H1. Modal belum mengelola fokus secara penuh
**File:** `src/components/ui/Modal.tsx`

- Saat terbuka, fokus diarahkan ke elemen first-focusable, namun:
  - **Tidak ada focus trap** — pengguna keyboard masih bisa Tab keluar dari modal.
  - **Fokus tidak dikembalikan** ke trigger setelah modal ditutup.
  - Tidak ada `aria-labelledby` yang mengaitkan judul dengan dialog (hanya `aria-label`).

**Dampak:** navigasi keyboard kehilangan konteks; aksesibilitas rendah.

**Saran:** implementasikan focus trap minimal (loop Tab di dalam konten), simpan referensi elemen pemicu, pulihkan fokus saat close, dan pasang `aria-labelledby` dengan id judul.

#### H2. Scroll lock antara Modal dan Sidebar bisa konflik
**File:** `src/components/ui/Modal.tsx`, `src/components/Sidebar.tsx`

- Sidebar sudah memakai ref-counter scroll lock (`data-sidebar-scroll-locks`) agar tidak menimpa lock lain.
- Modal mengelola `document.body.style.overflow` secara independen (simpan `previousBodyOverflow`), **tanpa counter**, sehingga berisiko konflik saat modal dibuka di atas drawer atau bersamaan.

**Saran:** unifikasi mekanisme scroll lock menjadi satu utility (mis. `useScrollLock`) dengan counter shared, lalu pakai di Modal, Sidebar, dan komponen lain yang butuh.

#### H3. Dialog konfirmasi hapus tidak konsisten (native `confirm` vs modal)
**File:** `src/app/(app)/masters/*/...Client.tsx`, `src/app/(app)/ad-costs/AdCostsClient.tsx`

- Halaman master (merchants, outlets, products, users) dan ad-costs memakai `window.confirm(...)` native.
- Halaman transaksi sudah memakai **modal konfirmasi khusus** yang jauh lebih baik (informatif, tidak menghalangi UI app).

**Dampak:** pengalaman tidak konsisten dan terasa "keluar" dari aplikasi; buruk di mobile dan tidak bisa di-styling/bertema.

**Saran:** buat `ConfirmDialog` reusable, lalu ganti semua pemakaian `confirm()`.

### 🟠 Sedang (Medium)

#### M1. Label form tidak terasosiasi dengan input
**File:** tersebar di banyak client component dan `DateRangePicker.tsx`

- Banyak pola `<label className="label">...</label>` diikuti `<input>` tanpa `htmlFor` + `id` yang cocok.
- Akibatnya klik label tidak memfokuskan input, dan screen reader tidak mengumumkan pasangan label-input.

**Saran:** tambahkan `htmlFor`/`id` (atau bungkus input di dalam `<label>`), mulai dari komponen yang paling sering dipakai (`DateRangePicker`, `CurrencyInput`, form create/edit).

#### M2. Combobox kurang atribut ARIA
**File:** `src/components/ui/Combobox.tsx`

- Tidak ada `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`.
- Opsi dropdown dirender sebagai `<button>` tanpa semantik listbox/option.
- Input pencarian di dalam dropdown hanya memakai `placeholder`, tanpa label yang bisa diakses.

**Saran:** tambahkan atribut ARIA combobox/listbox, kelola `aria-activedescendant` mengikuti `highlight`, dan beri `aria-label` pada input pencarian.

#### M3. Heading hierarchy dan ukuran tidak konsisten
**File:** banyak halaman

- Ukuran h1 bervariasi: `text-2xl` (login, matrix) vs `text-xl` (transaksi, master, surveys, ad-costs, dashboard).
- Beberapa struktur heading loncat/tidak jelas.

**Saran:** tetapkan satu skala heading (mis. semua h1 halaman menggunakan satuan yang sama) dan pastikan hanya ada satu `<h1>` per halaman.

#### M4. Empty state tidak konsisten
**File:** `TransactionsClient.tsx`, `ProductsClient.tsx`, `MatrixClient.tsx`, dll.

- Teks bervariasi: "Belum ada transaksi.", "Belum ada data.", "Tidak ada data transaksi pada periode ini."
- Tidak ada komponen reusable, tanpa action/CTA yang konsisten.

**Saran:** buat `<EmptyState>` reusable (ikon, judul, deskripsi opsional, aksi opsional), lalu terapkan ke semua halaman.

#### M5. Loading state tidak seragam
**File:** `loading.tsx` di beberapa route, `MatrixClient.tsx`

- Beberapa halaman punya `loading.tsx` dengan skeleton; Matrix hanya teks "Memuat Matriks..." inline.
- Tidak semua halaman punya `loading.tsx` yang setara.

**Saran:** standarkan skeleton loading (gunakan `Skeleton`/`MasterTableSkeleton`/`SkeletonRows`) dan tambahkan loading state yang konsisten, termasuk untuk Matrix.

#### M6. Pola filter berbeda antara halaman lain dan Matrix
**File:** `MatrixClient.tsx` vs halaman filter lain

- Halaman lain menyimpan filter di URL via query params bernama + tombol "Terapkan Filter".
- Matrix memakai state lokal React lalu menyinkronkan ke URL via `router.replace` (auto-sync), dengan parameter berbeda (`period`, `metric`, `date`).

**Saran:** samakan pola filter supaya mudah dipahami dan di-share; pertimbangkan mengadopsi pola URL-first di Matrix, atau dokumentasikan mengapa Matrix berbeda.

#### M7. Error state kurang informatif dan tidak ada retry
**File:** `MatrixClient.tsx`, `DashboardClient.tsx`, `TransactionsClient.tsx`

- Error umumnya hanya teks merah; Matrix menampilkan "Error: <message>" tanpa tombol retry.
- Komponen lain menampilkan banner `loadError` tanpa aksi pemulihan.

**Saran:** buat komponen error state dengan pesan ramah + tombol "Coba lagi".

### 🟡 Rendah (Low)

#### L1. Feedback sukses tidak selalu muncul
- Beberapa server action menampilkan toast sukses, sebagian tidak atau tidak konsisten.
- Toast berbasis memori (`pushFn`) sehingga hilang saat refresh dan tidak bisa di-stack dengan prioritas.

**Saran:** standarkan respon server action dan pastikan semua aksi memberi feedback; pertimbangkan peningkatan `ToastHost` (dukungan lebih dari 1 baris, stacking, dan posisi aman di mobile).

#### L2. Toast posisi bisa menutupi header di mobile
**File:** `src/components/Toast.tsx`

- Posisi `fixed right-4 top-4` tetap di mobile dan bisa menutupi header/judul.

**Saran:** gunakan posisi aman dengan `safe-area-inset` dan pertimbangkan menempatkan toast di bawah header pada mobile.

#### L3. MobileNavbar belum punya pintasan "Matriks Omset"
**File:** `src/components/MobileNavbar.tsx`

- MobileNavbar hanya menampilkan Dashboard, Transaksi, Iklan, Survey + "Lainnya".
- Matriks Omset (fitur yang baru saja disempurnakan) hanya bisa diakses lewat menu "Lainnya".

**Saran:** evaluasi menambahkan "Matriks Omset" atau menata ulang ikon agar item penting tidak tersembunyi.

#### L4. Tabel matrix sulit di mobile (scroll dua arah)
**File:** `MatrixClient.tsx`

- Banyak kolom harian membuat tabel memanjang horizontal; pengguna mobile harus scroll horizontal + vertikal.

**Saran:** pertimbangkan mode tampilan mobile (mis. kartu per merchant/outlet, atau kolom "minggu ini" yang disederhanakan) dan pisahkan dari tabel desktop.

#### L5. Tidak ada indikator offline (PWA)
**File:** `public/sw.js`, `PwaRegister.tsx`

- Service worker sudah dikonfigurasi network-first, tetapi tidak ada indikator saat offline atau saat data dari cache dipakai.

**Saran:** tambahkan indikator kecil "Offline" atau banner saat navigator offline, dan perbaiki UX saat data tidak tersedia.

#### L6. Konsistensi format ekspor (CSV vs Excel)
**File:** `DashboardClient.tsx` (CSV) vs `TransactionsClient.tsx` (Excel)

- Dashboard mengekspor CSV, transaksi mengekspor `.xlsx`.

**Saran:** tetapkan standar ekspor aplikasi (disarankan menyeragamkan ke `.xlsx` atau menyediakan pilihan), agar perilaku konsisten di seluruh laporan.

---

## 3. Roadmap & Milestone

Setiap milestone punya **tujuan**, **daftar pekerjaan**, **file utama**, dan **Definition of Done (DoD)**. Urutan dirancang agar perbaikan pondasi dilakukan lebih dulu sebelum peningkatan UX lanjutan.

### Milestone 0 — Foundation: Design Token & Utility (durasi singkat)

**Tujuan:** menyiapkan fondasi agar perbaikan berikutnya konsisten dan tidak duplikatif.

**Pekerjaan:**
- [ ] Ekstrak utility scroll lock bersama (`useScrollLock` dengan counter).
- [ ] Tetapkan skala tipografi/heading dan terapkan aturan satu `<h1>` per halaman.
- [ ] Dokumentasikan konvensi komponen & pola interaksi di `agent.md`.

**File utama:** `src/lib/` (utility baru), `src/app/layout.tsx`, `agent.md`.

**DoD:**
- Ada satu utility scroll lock yang dipakai semua komponen yang mengunci scroll.
- Tidak ada halaman dengan lebih dari satu `<h1>`.
- Konvensi terdokumentasi di `agent.md`.

---

### Milestone 1 — Accessibility Baseline

**Tujuan:** memperbaiki aksesibilitas inti untuk modal, combobox, dan form.

**Pekerjaan:**
- [ ] Modal: focus trap, restore fokus, `aria-labelledby`, scroll lock via utility (H1, H2).
- [ ] Combobox: atribut ARIA combobox/listbox/`aria-activedescendant`, label input pencarian (M2).
- [ ] Asosiasikan semua label dengan input (`htmlFor`/`id` atau bungkus label) (M1).

**File utama:** `Modal.tsx`, `Combobox.tsx`, `DateRangePicker.tsx`, form create/edit di tiap modul.

**DoD:**
- Tab tidak keluar dari modal saat terbuka; fokus kembali ke trigger saat ditutup.
- Combobox dapat dinavigasi keyboard dan diumumkan screen reader.
- Semua input memiliki label terasosiasi.

---

### Milestone 2 — Component Library Consolidation

**Tujuan:** menghilangkan redundansi dan menyeragamkan komponen UI.

**Pekerjaan:**
- [ ] Buat `ConfirmDialog` reusable; ganti semua `window.confirm()` (H3).
- [ ] Buat `EmptyState` reusable dan terapkan konsisten (M4).
- [ ] Buat komponen error state dengan tombol retry (M7).
- [ ] Tingkatkan `ToastHost` (stacking, aman di mobile, dukungan pesan panjang) (L1, L2).

**File utama:** `src/components/ui/` (komponen baru), semua `*Client.tsx` master + ad-costs, `Toast.tsx`.

**DoD:**
- Tidak ada pemakaian `window.confirm`/`window.alert` tersisa.
- Semua halaman memakai komponen `EmptyState` dan error state yang sama.
- Toast menumpuk dengan benar dan tidak menutupi header di mobile.

---

### Milestone 3 — Filter & Navigation UX

**Tujuan:** menyamakan pola filter dan memperbaiki navigasi mobile.

**Pekerjaan:**
- [ ] Samakan pola filter Matrix dengan pola URL-first halaman lain (M6).
- [ ] Evaluasi & tambah pintasan "Matriks Omset" di MobileNavbar (L3).
- [ ] Konsistenkan indikator filter aktif di semua halaman.

**File utama:** `MatrixClient.tsx`, `MobileNavbar.tsx`, komponen filter halaman lain.

**DoD:**
- Filter di semua halaman dapat di-share via URL dengan perilaku konsisten.
- Item navigasi penting dapat diakses tanpa hambatan di mobile.

---

### Milestone 4 — Data Presentation & Loading

**Tujuan:** menyeragamkan tampilan data, loading, dan empty/error.

**Pekerjaan:**
- [ ] Terapkan skeleton loading konsisten (termasuk Matrix) (M5).
- [ ] Konsistenkan empty state dengan CTA yang relevan (M4 lanjutan).
- [ ] Sempurnakan tampilan error dengan pesan ramah + retry (M7 lanjutan).

**File utama:** semua `loading.tsx`, `MatrixClient.tsx`, `DashboardClient.tsx`, `TransactionsClient.tsx`.

**DoD:**
- Tidak ada loading state berupa teks polos; semua memakai skeleton.
- Semua empty/error state informatif dan konsisten.

---

### Milestone 5 — Advanced UX & PWA Polish

**Tujuan:** peningkatan pengalaman lanjutan dan kesiapan PWA.

**Pekerjaan:**
- [ ] Indikator offline saat service worker aktif (L5).
- [ ] Seragamkan format ekspor laporan (L6).
- [ ] Audit kontras warna dark mode (WCAG AA).
- [ ] Mode tampilan matrix mobile (kartu/non-tabel) (L4).
- [ ] Validasi inline form (mis. tanggal from > to) (terkait DateRangePicker).

**File utama:** `PwaRegister.tsx`, `public/sw.js`, `DashboardClient.tsx`, `TransactionsClient.tsx`, `MatrixClient.tsx`, `DateRangePicker.tsx`.

**DoD:**
- Pengguna melihat indikasi saat offline.
- Format ekspor konsisten di seluruh laporan.
- Kontras teks lolos pemeriksaan WCAG AA di light & dark mode.
- Matrix nyaman digunakan di layar mobile.

---

## 4. Urutan Eksekusi yang Disarankan

1. **Milestone 0** — fondasi (cepat, menurunkan risiko pekerjaan lanjutan).
2. **Milestone 1** — aksesibilitas inti (ini utang teknis paling berdampak).
3. **Milestone 2** — komponen reusable (menghapus `confirm()` dan duplikasi).
4. **Milestone 3** — filter & navigasi (konsistensi antar halaman).
5. **Milestone 4** — presentasi data (loading/empty/error).
6. **Milestone 5** — polish lanjutan & PWA.

> Milestone 0–2 sangat disarankan dikerjakan berurutan dan selesai sebelum menambah fitur besar baru, agar utang UI/UX tidak menumpuk.

---

## 6. Status Pengerjaan (Update)

Status berikut adalah hasil pengerjaan oleh AI agent pada **18 Agustus 2026**.

### ✅ Selesai

**Milestone 0**
- [x] Ekstrak `useScrollLock` (counter global) — `src/lib/useScrollLock.ts`.
- [x] Heading h1 diseragamkan (`text-xl font-bold`); halaman Matrix ikut disesuaikan.
- [x] Konvensi komponen & pola interaksi didokumentasikan di `agent.md`.

**Milestone 1**
- [x] Modal: focus trap, restore fokus, `aria-labelledby`, scroll lock via `useScrollLock`.
- [x] Combobox: atribut ARIA combobox/listbox/option/`aria-activedescendant`, label input pencarian.
- [x] Label form terasosiasi: `DateRangePicker`, `CurrencyInput`, `net-income`, harga item.

**Milestone 2**
- [x] Komponen `ConfirmDialog`, `EmptyState`, `ErrorState` dibuat di `src/components/ui/`.
- [x] Semua `window.confirm()` diganti `ConfirmDialog` (merchants, outlets, products, users, ad-costs).
- [x] `ToastHost` ditingkatkan (stacking, dismiss, posisi aman mobile, dukungan pesan panjang).

**Milestone 3 (sebagian)**
- [x] MobileNavbar: ditambahkan pintasan "Matriks" (`/reports/matrix`).

**Milestone 4**
- [x] MatrixClient refactor: skeleton loading, `ErrorState` + retry, `EmptyState`.
- [x] TransactionsClient: `ErrorState` (dengan retry) dan `EmptyState` untuk data kosong.

**Milestone 5 (sebagian)**
- [x] `OfflineIndicator` dibuat dan dipasang di root layout.

### ⏳ Belum Selesai (Tersisa)

- [ ] M3: Menyamakan pola filter Matrix ke URL-first penuh (saat ini masih auto-sync; sudah didokumentasikan di `agent.md`).
- [ ] M3: Konsistenkan indikator filter aktif di semua halaman.
- [ ] M5: Seragamkan format ekspor (CSV di Dashboard vs Excel di Transaksi).
- [ ] M5: Audit kontras warna dark mode (WCAG AA).
- [ ] M5: Mode tampilan matrix mobile (kartu/non-tabel).
- [ ] M5: Validasi inline form (mis. tanggal `from > to`) di `DateRangePicker` — belum diterapkan, hanya banner alert setelah submit di sebagian halaman.
- [ ] M4 lanjutan: terapkan skeleton/empty/error konsisten ke seluruh halaman master & surveys (baru diterapkan di Matrix & Transaksi).
- [ ] L1: Standarkan feedback sukses semua server action (sebagian sudah memakai toast, sebagian belum konsisten).

---

## 5. Kontributor Dokumen

Dokumen ini dibuat melalui audit kode statis oleh AI agent. Sebelum eksekusi, sebaiknya dilakukan verifikasi manual di browser untuk temuan visual/spasial (kontras, posisi toast, kenyamanan scroll matrix) karena audit berbasis kode tidak sepenuhnya menggantikan pengujian visual nyata.
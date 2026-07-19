# 📘 Dokumentasi Aplikasi — Rekap Penjualan Rajaklana

**Sistem Rekapitulasi & Analisis Penjualan Multi-Outlet untuk Abon Gulung Rajaklana**

---

## 📋 Daftar Isi

1. [Tentang Aplikasi](#1-tentang-aplikasi)
2. [Arsitektur & Stack](#2-arsitektur--stack)
3. [Panduan Instalasi](#3-panduan-instalasi)
4. [Struktur Database](#4-struktur-database)
5. [Hak Akses & Role](#5-hak-akses--role)
6. [Panduan Penggunaan](#6-panduan-penggunaan)
7. [API Endpoints](#7-api-endpoints)
8. [Maintenance & Troubleshooting](#8-maintenance--troubleshooting)
9. [Deploy ke Production](#9-deploy-ke-production)
10. [Pengembangan Lanjutan](#10-pengembangan-lanjutan)

---

## 1. Tentang Aplikasi

### Tujuan

Aplikasi ini dibuat untuk merekap dan menganalisis penjualan **Abon Gulung Rajaklana** yang dijual melalui berbagai platform **food merchant** (GoFood, GrabFood, ShopeeFood) di berbagai **outlet** cabang.

### Fitur Utama

- 📊 **Dashboard Analitik** — 8 tab visualisasi data (tren harian, produk terlaris, profit merchant, performa outlet, jam ramai, performa hari, insight otomatis, detail transaksi)
- 📈 **Matriks Omset Harian** — Laporan Pivot/Crosstab dinamis per merchant dan outlet (mingguan, bulanan, tahunan)
- 📝 **Manajemen Transaksi** — Input multi-varian dengan perhitungan komisi otomatis, pencatatan HPP, margin profit, dan flag pesanan fiktif
- 📣 **Biaya Iklan Harian** — Catat biaya iklan per outlet + merchant, terpisah dari potongan admin transaksi
- 🗳️ **Survey Customer** — Kumpulkan sumber informasi konsumen (misal: dari Instagram, Teman, dll) beserta visualisasi laporannya
- 🟢 **User Online** — Super Admin dapat melihat status online, IP tersamarkan, lokasi perkiraan, dan last seen user
- 🏪 **Master Data** — CRUD untuk outlet, food merchant, varian produk, template survey, dan akun kasir
- 🔐 **Role-based Access** — Super Admin vs Kasir dengan RLS database
- 🌙 **Dark/Light Mode** — Toggle tema
- 📥 **Export CSV** — Semua tab analitik bisa diexport
- 📱 **Responsive** — Mobile-friendly dengan sidebar drawer

### Target Pengguna

| Role            | Kemampuan                                                                    |
| --------------- | ---------------------------------------------------------------------------- |
| **Super Admin** | Akses penuh: melihat semua data, analisis, mengelola master data & user      |
| **Kasir**       | Terbatas: input transaksi dan biaya iklan hanya untuk outlet yang ditugaskan |

---

## 2. Arsitektur & Stack

### Tech Stack

| Layer          | Teknologi             | Versi      |
| -------------- | --------------------- | ---------- |
| **Framework**  | Next.js (App Router)  | 16.2+      |
| **Frontend**   | React + TypeScript    | 19.x / 5.x |
| **Styling**    | Tailwind CSS          | 3.4+       |
| **Database**   | Supabase (PostgreSQL) | -          |
| **Auth**       | Supabase Auth + RLS   | -          |
| **Charting**   | Recharts              | 2.12+      |
| **Icons**      | lucide-react          | 0.439+     |
| **Validation** | zod                   | 3.23+      |
| **Formatting** | ESLint                | 9.x        |

### Arsitektur Folder

```
📁 rekap-penjualan-online/
├── 📁 src/
│   ├── 📁 app/                          # Next.js App Router pages
│   │   ├── layout.tsx                   # Root layout (global styles, theme script)
│   │   ├── page.tsx                     # Root → redirect /dashboard
│   │   ├── globals.css                  # CSS variables & Tailwind base
│   │   ├── 📁 login/                    # Halaman login
│   │   │   ├── page.tsx                 # Server component
│   │   │   └── LoginForm.tsx            # Client component (form + supabase auth)
│   │   ├── 📁 (app)/                    # Layout group (protected routes)
│   │   │   ├── layout.tsx               # Authenticated layout (sidebar, header, toast)
│   │   │   ├── 📁 dashboard/            # Dashboard analitik
│   │   │   │   ├── page.tsx             # Server component (fetching data)
│   │   │   │   ├── DashboardClient.tsx  # Client component (visualisasi, filter, chart)
│   │   │   │   └── loading.tsx          # Loading skeleton
│   │   │   ├── 📁 transactions/         # Manajemen transaksi
│   │   │   │   ├── page.tsx             # Server component
│   │   │   │   ├── TransactionsClient.tsx # Client component (CRUD + filter)
│   │   │   │   ├── actions.ts           # Server Actions (create/update/delete)
│   │   │   │   └── loading.tsx
│   │   │   ├── 📁 ad-costs/             # Biaya iklan harian
│   │   │   ├── 📁 surveys/              # Survey customer (input & laporan)
│   │   │   └── 📁 masters/              # Master data CRUD
│   │   │       ├── 📁 merchants/        # Food merchant
│   │   │       ├── 📁 outlets/          # Outlet cabang
│   │   │       ├── 📁 products/         # Varian produk + pricing
│   │   │       ├── 📁 surveys/          # Template pertanyaan & jawaban survey
│   │   │       ├── 📁 user-presence/    # Monitor kasir online
│   │   │       └── 📁 users/            # Akun kasir
│   │   └── 📁 api/                      # API Route Handlers
│   │       └── 📁 dashboard/
│   │           └── 📁 transactions/     # Infinite scroll pagination endpoint
│   │               └── route.ts
│   ├── 📁 components/                   # Komponen reusable
│   │   ├── Sidebar.tsx                  # Navigasi sidebar (collapsible, mobile drawer)
│   │   ├── LogoutButton.tsx             # Tombol logout
│   │   ├── ThemeToggle.tsx              # Dark/light toggle
│   │   ├── ThemeScript.tsx              # Script tema (cegah flash)
│   │   ├── MerchantBadge.tsx            # Badge merchant dengan warna
│   │   ├── NavProgress.tsx              # Progress bar navigasi
│   │   ├── Toast.tsx                    # Notifikasi toast
│   │   └── 📁 ui/                       # UI primitives
│   │       ├── Combobox.tsx             # Searchable dropdown
│   │       ├── Modal.tsx                # Modal dialog
│   │       ├── ColorPicker.tsx          # Color picker
│   │       ├── Skeleton.tsx             # Loading skeleton
│   │       └── MasterTableSkeleton.tsx  # Skeleton khusus master table
│   ├── 📁 lib/                          # Utility & library code
│   │   ├── auth.ts                      # Auth helpers (getProfile, requireProfile, requireAdmin)
│   │   ├── date.ts                      # Date helpers (WIB/Jakarta timezone)
│   │   ├── utils.ts                     # cn(), formatIDR(), generateUUID()
│   │   ├── merchantColors.ts            # Warna merchant (presets + fallback palette)
│   │   └── 📁 supabase/                 # Supabase clients
│   │       ├── client.ts               # Browser client
│   │       ├── server.ts               # Server component client + admin client
│   │       ├── filterCookies.ts         # Helper set/get/clear filter cookie
│   │       └── middleware.ts            # Proxy middleware (session refresh + filter restore)
│   └── proxy.ts                         # Middleware entry point
├── 📁 supabase/
│   ├── schema.sql                       # Full database schema + RLS policies
│   ├── seed.sql                         # Data awal (opsional)
│   └── 📁 migrations/                   # Migrasi database
├── .env.example                         # Template environment variables
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── eslint.config.mjs
```

### Pola Arsitektur

```
                           ┌──────────────────┐
                           │  Next.js 16 App   │
                           │  Router (RSC)     │
                           └──────┬───────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
     │ Server      │    │ Server       │    │ API Route    │
     │ Components  │    │ Actions      │    │ Handlers     │
     │ (fetching)  │    │ (mutations)  │    │ (pagination) │
     └──────┬──────┘    └──────┬───────┘    └──────┬───────┘
            │                  │                    │
            ▼                  ▼                    ▼
     ┌─────────────────────────────────────────────────┐
     │              Supabase Client                     │
     │  (Server: createClient / Admin: createAdminClient)│
     └─────────────────────┬───────────────────────────┘
                           │
                           ▼
     ┌─────────────────────────────────────────────────┐
     │            Supabase (PostgreSQL)                 │
     │  + Auth + RLS Policies + Generated Columns       │
     └─────────────────────────────────────────────────┘
```

---

## 3. Panduan Instalasi

### Prasyarat

- Node.js 18+ (recommended: 20+)
- npm atau yarn
- Akun Supabase (free tier cukup)

### Langkah 1: Clone & Install

```bash
git clone https://github.com/yoga12-rgb/rekap-penjualan-online.git
cd rekap-penjualan-online
npm install
```

### Langkah 2: Setup Supabase

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Catat **Project URL**, **anon key**, dan **service_role key** dari Settings → API
3. Buka SQL Editor → paste isi `supabase/schema.sql` → **Run**
4. Jika database sudah ada, jalankan migrasi bertahap di `supabase/migrations/` sesuai nomor versi, termasuk `007_daily_ad_costs.sql`, `008_user_presence.sql`, `009_surveys.sql`, `010_survey_question_answers.sql`, `011_dashboard_summary_rpc.sql`, `012_transactions_summary_rpc.sql`, dan `013_add_merchant_increases_to_dashboard_summary.sql`
5. (Opsional) Paste `supabase/seed.sql` untuk data contoh

### Langkah 3: Konfigurasi Environment

```bash
cp .env.example .env.local
```

Isi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Langkah 4: Buat Super Admin Pertama

1. Supabase Dashboard → **Authentication** → **Users** → **Add User** (email + password)
2. Salin **UID user** yang baru dibuat
3. Di SQL Editor, jalankan:

```sql
insert into public.profiles (id, full_name, role)
values ('USER-UID-DI-SINI', 'Super Admin', 'super_admin')
on conflict (id) do update set role = 'super_admin';
```

### Langkah 5: Jalankan Development

```bash
npm run dev
```

Buka `http://localhost:3000` dan login dengan email yang didaftarkan.

---

## 4. Struktur Database

### Entity Relationship

```
┌──────────┐     ┌──────────────────┐     ┌──────────────────┐
│ outlets  │     │  food_merchants  │     │product_variants  │
├──────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)  │     │ id (PK)          │     │ id (PK)          │
│ name     │     │ name             │     │ name             │
│ created  │     │ color (nullable) │     │ base_price       │
└────┬─────┘     │ created          │     │ created          │
     │           └────────┬─────────┘     └────────┬─────────┘
     │                    │                        │
     │                    │    ┌───────────────────┼──────────┐
     │                    │    │                   │          │
     ▼                    ▼    ▼                   ▼          ▼
┌────────────────────────────────────────────────────────────┐
│                     transactions                            │
├────────────────────────────────────────────────────────────┤
│ id (PK) │ order_id (UUID) │ order_number (nullable)        │
│ created_by (FK→profiles) │ outlet_id (FK→outlets)          │
│ food_merchant_id (FK→food_merchants)                       │
│ product_variant_id (FK→product_variants)                   │
│ transaction_date (timestamptz) │ qty │ initial_price       │
│ deduction_fee │ net_profit (GENERATED)                     │
└────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐     ┌──────────────────────┐
│     product_variant_prices       │     │      profiles        │
├──────────────────────────────────┤     ├──────────────────────┤
│ id (PK) │ product_variant_id(FK) │     │ id (PK, FK→auth)    │
│ food_merchant_id (FK)            │     │ full_name (nullable) │
│ price │ created │ updated         │     │ role (enum)          │
│ UNIQUE(variant_id, merchant_id)  │     │ outlet_id (FK→outlets)│
└──────────────────────────────────┘     └──────────────────────┘
```

### Detail Tabel

#### `outlets`

| Kolom      | Tipe        | Keterangan         |
| ---------- | ----------- | ------------------ |
| id         | UUID (PK)   | Auto-generate      |
| name       | TEXT UNIQUE | Nama outlet/cabang |
| created_at | TIMESTAMPTZ | Default now()      |

#### `food_merchants`

| Kolom      | Tipe        | Keterangan                              |
| ---------- | ----------- | --------------------------------------- |
| id         | UUID (PK)   | Auto-generate                           |
| name       | TEXT UNIQUE | Nama merchant (GoFood, GrabFood, dll)   |
| color      | TEXT        | Warna hex (#rrggbb) untuk badge & chart |
| created_at | TIMESTAMPTZ | Default now()                           |

#### `product_variants`

| Kolom      | Tipe          | Keterangan         |
| ---------- | ------------- | ------------------ |
| id         | UUID (PK)     | Auto-generate      |
| name       | TEXT UNIQUE   | Nama varian produk |
| base_price | NUMERIC(12,2) | Harga dasar (≥0)   |
| hpp        | NUMERIC(12,2) | Harga Pokok Penjualan (HPP) (≥0) |
| created_at | TIMESTAMPTZ   | Default now()      |

#### `product_variant_prices`

| Kolom                   | Tipe                      | Keterangan                         |
| ----------------------- | ------------------------- | ---------------------------------- |
| id                      | UUID (PK)                 | Auto-generate                      |
| product_variant_id      | UUID (FK)                 | Ref → product_variants(id) CASCADE |
| food_merchant_id        | UUID (FK)                 | Ref → food_merchants(id) CASCADE   |
| price                   | NUMERIC(12,2)             | Harga khusus merchant (≥0)         |
| created_at / updated_at | TIMESTAMPTZ               | Auto                               |
| UNIQUE                  | (variant_id, merchant_id) |                                    |

#### `profiles`

| Kolom      | Tipe          | Keterangan                     |
| ---------- | ------------- | ------------------------------ |
| id         | UUID (PK, FK) | Ref → auth.users(id) CASCADE   |
| full_name  | TEXT          | Nama lengkap (nullable)        |
| role       | TEXT          | `'super_admin'` atau `'kasir'` |
| outlet_id  | UUID (FK)     | Ref → outlets(id) SET NULL     |
| created_at | TIMESTAMPTZ   | Default now()                  |

#### `transactions`

| Kolom                   | Tipe              | Keterangan                                                      |
| ----------------------- | ----------------- | --------------------------------------------------------------- |
| id                      | UUID (PK)         | Auto-generate                                                   |
| order_id                | UUID              | Satu ID untuk multi-item order                                  |
| order_number            | TEXT              | Nomor pesanan dari merchant (nullable)                          |
| created_by              | UUID (FK)         | Ref → profiles(id) RESTRICT                                     |
| outlet_id               | UUID (FK)         | Ref → outlets(id) RESTRICT                                      |
| food_merchant_id        | UUID (FK)         | Ref → food_merchants(id) RESTRICT                               |
| product_variant_id      | UUID (FK)         | Ref → product_variants(id) RESTRICT                             |
| transaction_date        | TIMESTAMPTZ       | Waktu transaksi (WIB)                                           |
| qty                     | INTEGER           | Quantity (>0)                                                   |
| initial_price           | NUMERIC(12,2)     | Harga statis saat transaksi (≥0)                                |
| deduction_fee           | NUMERIC(12,2)     | Potongan/komisi (≥0)                                            |
| **net_profit**          | **NUMERIC(14,2)** | **GENERATED ALWAYS AS** `(qty * initial_price) - deduction_fee` |
| total_hpp               | NUMERIC(12,2)     | Total HPP (qty * hpp varian) (≥0)                               |
| company_expense         | NUMERIC(12,2)     | Beban perusahaan tambahan (≥0)                                  |
| is_fake                 | BOOLEAN           | Penanda pesanan fiktif (tidak dihitung sebagai revenue)         |
| created_at / updated_at | TIMESTAMPTZ       | Auto                                                            |

#### `daily_ad_costs`

| Kolom                   | Tipe          | Keterangan                                 |
| ----------------------- | ------------- | ------------------------------------------ |
| id                      | UUID (PK)     | Auto-generate                              |
| cost_date               | DATE          | Tanggal biaya iklan                        |
| outlet_id               | UUID (FK)     | Ref → outlets(id) RESTRICT                 |
| food_merchant_id        | UUID (FK)     | Ref → food_merchants(id) RESTRICT          |
| amount                  | NUMERIC(12,2) | Nominal biaya iklan harian (≥0)            |
| note                    | TEXT          | Catatan opsional                           |
| created_by              | UUID (FK)     | Ref → profiles(id) RESTRICT                |
| created_at / updated_at | TIMESTAMPTZ   | Auto                                       |
| UNIQUE                  | -             | `(cost_date, outlet_id, food_merchant_id)` |

#### `user_presence`

| Kolom        | Tipe          | Keterangan                           |
| ------------ | ------------- | ------------------------------------ |
| user_id      | UUID (PK, FK) | Ref → profiles(id) ON DELETE CASCADE |
| last_seen_at | TIMESTAMPTZ   | Waktu heartbeat terakhir             |
| ip_address   | TEXT          | IP Address tersamarkan               |
| country      | TEXT          | Lokasi perkiraan negara              |
| region       | TEXT          | Lokasi perkiraan wilayah/provinsi    |
| city         | TEXT          | Lokasi perkiraan kota                |
| timezone     | TEXT          | Zona waktu perangkat                 |
| user_agent   | TEXT          | Ringkasan user agent browser/device  |
| path         | TEXT          | Halaman terakhir yang diakses        |
| created_at   | TIMESTAMPTZ   | Default now()                        |
| updated_at   | TIMESTAMPTZ   | Default now()                        |

#### `survey_questions`

| Kolom         | Tipe        | Keterangan                             |
| ------------- | ----------- | -------------------------------------- |
| id            | UUID (PK)   | Auto-generate                          |
| question_text | TEXT        | Teks pertanyaan survey                 |
| is_active     | BOOLEAN     | Menandakan status aktif                |
| sort_order    | INTEGER     | Urutan pengurutan                      |
| created_at    | TIMESTAMPTZ | Default now()                          |
| updated_at    | TIMESTAMPTZ | Default now()                          |

#### `survey_answers`

| Kolom      | Tipe        | Keterangan                             |
| ---------- | ----------- | -------------------------------------- |
| id         | UUID (PK)   | Auto-generate                          |
| label      | TEXT UNIQUE | Opsi label jawaban                     |
| is_active  | BOOLEAN     | Menandakan status aktif                |
| sort_order | INTEGER     | Urutan pengurutan                      |
| created_at | TIMESTAMPTZ | Default now()                          |
| updated_at | TIMESTAMPTZ | Default now()                          |

#### `survey_responses`

| Kolom         | Tipe        | Keterangan                             |
| ------------- | ----------- | -------------------------------------- |
| id            | UUID (PK)   | Auto-generate                          |
| question_id   | UUID (FK)   | Ref → survey_questions(id)             |
| answer_id     | UUID (FK)   | Ref → survey_answers(id) (nullable)    |
| outlet_id     | UUID (FK)   | Ref → outlets(id)                      |
| created_by    | UUID (FK)   | Ref → profiles(id)                     |
| other_text    | TEXT        | Jawaban kustom jika opsi "Lainnya"     |
| response_date | DATE        | Tanggal respon (Default WIB)           |
| created_at    | TIMESTAMPTZ | Default now()                          |

#### `survey_question_answers`

| Kolom       | Tipe         | Keterangan                  |
| ----------- | ------------ | --------------------------- |
| question_id | UUID (PK, FK)| Ref → survey_questions(id)  |
| answer_id   | UUID (PK, FK)| Ref → survey_answers(id)    |
| is_active   | BOOLEAN      | Status aktif                |
| sort_order  | INTEGER      | Urutan opsi per pertanyaan  |
| created_at  | TIMESTAMPTZ  | Default now()               |
| updated_at  | TIMESTAMPTZ  | Default now()               |

### Indexes

```sql
idx_tx_date (transaction_date DESC)
idx_tx_order (order_id)
idx_tx_order_number (order_number)
idx_tx_outlet (outlet_id)
idx_tx_merchant (food_merchant_id)
idx_tx_variant (product_variant_id)
idx_variant_prices_product (product_variant_id)
idx_variant_prices_merchant (food_merchant_id)
idx_ad_costs_date (cost_date DESC)
idx_ad_costs_outlet (outlet_id)
idx_ad_costs_merchant (food_merchant_id)
idx_user_presence_last_seen (last_seen_at DESC)
idx_survey_questions_order (is_active, sort_order, question_text)
idx_survey_answers_order (is_active, sort_order, label)
idx_survey_responses_date (response_date DESC)
idx_survey_responses_outlet (outlet_id)
idx_survey_responses_question (question_id)
idx_survey_responses_answer (answer_id)
idx_survey_question_answers_question (question_id, is_active, sort_order)
idx_survey_question_answers_answer (answer_id)
```

### Row Level Security (RLS)

Helper functions:

- `is_super_admin()` — cek apakah user saat ini super_admin
- `my_outlet_id()` — dapatkan outlet_id dari user saat ini

Kebijakan per tabel:

- **Master tables** (outlets, food_merchants, product_variants, product_variant_prices): semua login bisa SELECT, hanya super_admin yang INSERT/UPDATE/DELETE
- **Profiles**: user bisa SELECT profil sendiri, super_admin bisa SELECT semua; hanya super_admin yang bisa menulis
- **Transactions**:
  - **SELECT**: super_admin semua, kasir hanya outlet sendiri
  - **INSERT**: super_admin semua, kasir hanya untuk outlet sendiri & `created_by = auth.uid()`
  - **UPDATE**: super_admin semua, kasir hanya outlet sendiri
  - **DELETE**: super_admin semua, kasir hanya outlet sendiri
- **Daily ad costs**:
  - **SELECT**: super_admin semua, kasir hanya outlet sendiri
  - **INSERT**: super_admin semua, kasir hanya untuk outlet sendiri & `created_by = auth.uid()`
  - **UPDATE**: super_admin semua, kasir hanya outlet sendiri
  - **DELETE**: super_admin semua, kasir hanya outlet sendiri
- **User presence**:
  - **SELECT**: super_admin semua, user hanya record sendiri
  - **INSERT/UPDATE**: user hanya heartbeat sendiri
  - **DELETE**: hanya super_admin

### Database RPC

- `get_dashboard_summary(p_from, p_to, p_previous_from, p_previous_to, p_outlet, p_merchant, p_variant)` mengembalikan ringkasan dashboard dalam satu payload JSON.
- RPC ini dipakai oleh halaman Dashboard untuk mengurangi transfer data transaksi mentah dari Supabase ke server Next.js.
- Jika RPC belum tersedia atau gagal, aplikasi masih punya fallback ke fetch transaksi bertahap.
- `get_transactions_summary(p_from, p_to, p_outlet, p_merchant, p_variant, p_q)` menghitung total card halaman Transaksi tanpa mengirim semua baris transaksi ke Next.js.
- `get_transaction_order_page(p_from, p_to, p_outlet, p_merchant, p_variant, p_q, p_offset, p_limit, p_is_fake)` mengembalikan batch order transaksi beserta item-itemnya untuk infinite scroll.
- `get_revenue_matrix(p_from, p_to, p_group_by, p_outlet, p_merchant)` menghasilkan data pivot (Crosstab) yang mengelompokkan omset dan net profit per merchant, per outlet, dan per rentang waktu (harian, bulanan, tahunan).
- Function dibuat sebagai SQL `stable` dengan `search_path = public`; akses data tetap mengikuti RLS user yang sedang login.

---

## 5. Hak Akses & Role

### Matrix Akses

| Menu                     |   Super Admin   |        Kasir         |
| ------------------------ | :-------------: | :------------------: |
| Dashboard (semua outlet) |       ✅        | ❌ (hanya outletnya) |
| Dashboard (filter)       |  Semua filter   | Tanpa filter outlet  |
| Transaksi — Lihat        |    ✅ Semua     |  ✅ Outlet sendiri   |
| Transaksi — Tambah       | ✅ Semua outlet | ✅ Outlet ditugaskan |
| Transaksi — Edit         |       ✅        |  ✅ Outlet sendiri   |
| Transaksi — Hapus        |       ✅        |  ✅ Outlet sendiri   |
| Biaya Iklan — Lihat      |    ✅ Semua     |  ✅ Outlet sendiri   |
| Biaya Iklan — Tambah     | ✅ Semua outlet | ✅ Outlet ditugaskan |
| Biaya Iklan — Edit       |       ✅        |  ✅ Outlet sendiri   |
| Biaya Iklan — Hapus      |       ✅        |  ✅ Outlet sendiri   |
| Survey — Input           | ✅ Semua outlet | ✅ Outlet ditugaskan |
| Survey — Laporan         |    ✅ Semua     |  ✅ Outlet sendiri   |
| User Online              |       ✅        |          ❌          |
| Master Outlet            |       ✅        |          ❌          |
| Master Merchant          |       ✅        |          ❌          |
| Master Produk            |       ✅        |          ❌          |
| Master User/Akun         |       ✅        |          ❌          |
| Master Survey (Q&A)      |       ✅        |          ❌          |
| Laporan Matriks Omset    |       ✅        |          ❌          |

### Alur Autentikasi

```
User → Login (/login) → Supabase Auth
  ↓
Middleware (proxy.ts) → Refresh session via Supabase SSR
  ↓
Authenticated? → No → Redirect /login
  ↓ Yes
requireProfile() → Ambil profile dari tabel profiles
  ↓
Role check: requireAdmin() untuk halaman master
  ↓
Tampilkan UI sesuai role
```

---

## 6. Panduan Penggunaan

### 6.1 Dashboard

#### Filter Data

```
[ Dari ▼ ] [ Sampai ▼ ] [ Outlet ▼ ] [ Merchant ▼ ] [ Varian ▼ ] [ Terapkan Filter ] [ Export CSV ]
[Hari ini] [7H] [30H] [Bulan ini] [Bulan lalu] [YTD] [Tahun] [Reset]
```

**Cara pakai**:

1. Pilih rentang tanggal (atau gunakan preset cepat)
2. Filter berdasarkan outlet, merchant, varian produk (atau biarkan "Semua")
3. Klik **Terapkan Filter** untuk mengambil data baru. Preset tanggal langsung diterapkan hanya untuk mengganti rentang tanggal dari filter yang sudah aktif.
4. Klik **Export** untuk download CSV tab yang aktif

Catatan:

- Reset menghapus filter aktif sekaligus cookie filter tersimpan.
- Dashboard memprioritaskan RPC `get_dashboard_summary` untuk mengambil agregasi transaksi, biaya iklan, perbandingan periode, leaderboard, dan insight dalam satu request.
- Jika RPC tidak tersedia, dashboard fallback ke pengambilan transaksi dan biaya iklan bertahap per 1000 baris agar hasil tidak terpotong batas default API.
- Saat filter varian produk aktif, biaya iklan tidak dikurangkan ke Profit Bersih karena biaya iklan dicatat per outlet dan merchant, bukan per varian.

#### Tab Analitik

| Tab                  | Fungsi                                                                            | Visualisasi       |
| -------------------- | --------------------------------------------------------------------------------- | ----------------- |
| **Tren Harian**      | Grafik garis omset, net profit, profit bersih, potongan, dan biaya iklan per hari | Line Chart        |
| **Produk Terlaris**  | Top 10 produk berdasarkan quantity                                                | Bar Chart + Tabel |
| **Profit Merchant**  | Profit bersih per food merchant dengan warna badge                                | Bar Chart (warna) |
| **Outlet**           | Performa per outlet (omset, net, biaya iklan, profit bersih, qty, transaksi)      | Bar Chart + Tabel |
| **Jam Ramai**        | Distribusi transaksi per jam (24 jam)                                             | Bar Chart + Tabel |
| **Hari**             | Distribusi dan performa penjualan berdasarkan hari dalam seminggu (Senin-Minggu)  | Bar Chart + Tabel |
| **Insight**          | Perbandingan periode + insight otomatis + penurunan performa                      | Kartu + Tabel     |
| **Detail Transaksi** | List semua transaksi (infinite scroll)                                            | Tabel             |

#### Key Performance Indicators (KPI)

- Total Omset
- Total Potongan Admin
- Potongan Admin (%)
- Net Profit
- Biaya Iklan
- Profit Bersih
- Total Qty
- Total Transaksi
- Rata-rata Omset
- Rata-rata Qty
- Rata-rata Net

### 6.2 Transaksi

#### Membuat Transaksi Baru

1. Klik **+ Tambah Transaksi**
2. Isi:
   - **Outlet** (otomatis untuk kasir)
   - **Nomor Pesanan** (opsional, dari merchant)
   - **Food Merchant** (GoFood/Grab/Shopee/dll)
   - **Tanggal/Waktu** (default: sekarang WIB)
3. **Item Transaksi**:
   - Pilih **Varian** (otomatis menampilkan harga default/sesuai merchant)
   - Isi **Qty**
   - Harga otomatis terisi dari database, bisa diubah manual
   - Klik **+ Tambah Varian** untuk multi-item
4. **Pendapatan Bersih**: isi nominal pendapatan bersih yang diterima
   - Potongan/komisi **dihitung otomatis** = total omset - pendapatan bersih
   - Potongan dibagi proporsional berdasarkan omset per item
5. Klik **Simpan Transaksi**

#### Edit Transaksi

- Klik ikon ✏️ pada card transaksi
- Ubah data yang diperlukan
- Klik **Simpan Perubahan**

#### Hapus Transaksi

- Klik ikon 🗑️ pada card transaksi
- Konfirmasi di modal yang muncul
- **Catatan**: Semua item dalam group order ikut terhapus permanen

#### Filter Transaksi

- Rentang tanggal (dengan preset cepat: Hari ini, 7H, 30H, YTD)
- Filter outlet, merchant, varian
- Pencarian teks (no. pesanan / produk / outlet / merchant)
- Klik **Terapkan Filter** untuk mengambil data baru; preset tanggal langsung diterapkan hanya untuk tanggal yang sudah aktif
- Filter otomatis tersimpan ke cookie browser & URL (tidak perlu terapkan ulang saat kembali ke halaman)
- Reset menghapus filter aktif sekaligus cookie filter tersimpan
- Total card transaksi dihitung melalui RPC `get_transactions_summary`.
- List order transaksi dimuat bertahap melalui RPC `get_transaction_order_page` dan endpoint `/api/transactions/orders`.
- Jika RPC transaksi belum tersedia, halaman fallback ke pengambilan transaksi bertahap agar halaman tetap bisa dipakai.

### 6.3 Biaya Iklan Harian

Biaya iklan harian dipakai untuk menghitung **Profit Bersih** dan tidak masuk ke potongan/komisi per transaksi.

- Satu record mewakili kombinasi `tanggal + outlet + merchant`
- Nominal dapat ditambah, diedit, dan dihapus oleh super admin; kasir hanya untuk outlet yang ditugaskan
- Jika input kombinasi yang sama sudah ada, sistem memperbarui record lama
- Dashboard menghitung **Profit Bersih = Net Profit - Biaya Iklan**
- Saat filter varian produk aktif di Dashboard, biaya iklan tidak dikurangkan karena biaya iklan tidak melekat ke varian tertentu
- Filter tanggal/outlet/merchant memakai tombol **Terapkan Filter**; preset tanggal langsung diterapkan hanya untuk tanggal yang sudah aktif
- Reset menghapus filter aktif sekaligus cookie filter tersimpan

### 6.4 Master Data

Akses dari sidebar → **Master Data** (hanya Super Admin).

#### User Online

- Menampilkan status **Online**, **Baru aktif**, atau **Offline** berdasarkan heartbeat aplikasi
- User dianggap online jika `last_seen_at` berada dalam 2 menit terakhir
- Menampilkan last seen, IP tersamarkan, lokasi perkiraan, timezone, device/browser ringkas, dan halaman terakhir
- Lokasi berasal dari header IP/proxy platform seperti Vercel/Cloudflare bila tersedia, bukan GPS browser
- Data ini hanya dapat dilihat oleh Super Admin

#### Food Merchant

- Tambah/Edit/Hapus merchant dengan nama dan warna badge
- Warna digunakan di chart dashboard dan badge transaksi
- Preset otomatis: GoFood (merah), GrabFood (hijau), ShopeeFood (oranye)
- Bisa custom warna dengan ColorPicker

#### Outlet

- Tambah/Edit/Hapus outlet cabang
- Nama outlet unik

#### Produk & Varian

- Tambah/Edit/Hapus varian produk dengan base price
- Atur harga khusus per-merchant (pricing matrix)
- Jika harga khusus tidak diisi, aplikasi menggunakan base_price

#### Akun Kasir

- Tambah/Edit/Hapus akun kasir
- Assign outlet untuk batasan akses

#### Template Survey

- Tambah/Edit/Hapus pertanyaan survey (misal: "Dari mana Anda mengetahui Abon Gulung Rajaklana?").
- Mengelola opsi jawaban (misal: "Instagram", "Teman/Keluarga", "Rekomendasi Ojek Online", "Lainnya").
- Opsi "Lainnya" secara dinamis memungkinkan pengisian teks kustom oleh kasir saat input survey.

---

### 6.5 Survey Customer

Digunakan untuk mendata umpan balik dari pelanggan mengenai dari mana mereka mengetahui produk Abon Gulung Rajaklana, untuk membantu analisis pemasaran.

- **Akses Kasir**: Kasir dapat menginput respon survey baru berdasarkan outlet tempat mereka ditugaskan.
- **Akses Super Admin**: Dapat menginput respon survey untuk seluruh outlet, serta melihat laporan grafik persentase sumber pelanggan secara keseluruhan maupun terfilter per outlet dan rentang tanggal.
- **Laporan/Report**: Menampilkan total respon dan visualisasi distribusi jawaban per pertanyaan untuk memetakan media promosi yang paling efektif.

---

### 6.6 Laporan Matriks Omset Harian

Laporan *Crosstab* bergaya pivot table yang menyajikan performa pendapatan tiap Outlet dan Merchant secara matriks (Baris: Merchant/Outlet, Kolom: Tanggal).

- **Akses**: Fitur ini dikhususkan hanya untuk **Super Admin**.
- **Filter Periode**: Tersedia 3 preset navigasi cepat (Mingguan, Bulanan, Tahunan) dengan tombol geser rentang.
- **Metric Toggle**: Matriks bisa ditukar modenya untuk menampilkan angka **Omset** (Kotor) atau **Net Profit** (Bersih).
- **Performa Database**: Dihitung sangat cepat murni dari database PostgreSQL menggunakan fungsi RPC JSON Aggregation (`get_revenue_matrix`).

---

## 7. API Endpoints

### Route Handler

#### `GET /api/dashboard/transactions`

Endpoint untuk infinite scroll detail transaksi.

**Query Parameters**:
| Parameter | Tipe | Required | Default | Keterangan |
|-----------|------|----------|---------|------------|
| from | string (YYYY-MM-DD) | ✅ | - | Tanggal awal (WIB) |
| to | string (YYYY-MM-DD) | ✅ | - | Tanggal akhir (WIB) |
| offset | number | ❌ | 0 | Offset pagination |
| limit | number | ❌ | 30 | Max 100 items per page |
| outlet | UUID | ❌ | - | Filter outlet (super_admin only) |
| merchant | UUID | ❌ | - | Filter merchant |
| variant | UUID | ❌ | - | Filter variant |

**Response**:

```json
{
  "rows": [
    {
      "id": "uuid",
      "order_number": "string | null",
      "transaction_date": "timestamptz",
      "qty": 0,
      "initial_price": 0,
      "deduction_fee": 0,
      "net_profit": 0,
      "outlets": { "name": "string" },
      "food_merchants": { "name": "string", "color": "string | null" },
      "product_variants": { "name": "string" }
    }
  ],
  "nextOffset": 30,
  "hasMore": true
}
```

#### `GET /api/transactions/orders`

Endpoint untuk infinite scroll card order pada halaman Transaksi. Endpoint ini memanggil RPC `get_transaction_order_page`.

**Query Parameters**:
| Parameter | Tipe | Required | Default | Keterangan |
|-----------|------|----------|---------|------------|
| from | string (YYYY-MM-DD) | ✅ | 7 hari terakhir | Tanggal awal (WIB) |
| to | string (YYYY-MM-DD) | ✅ | hari ini | Tanggal akhir (WIB) |
| offset | number | ❌ | 0 | Offset order |
| limit | number | ❌ | 12 | Max 48 order per request |
| outlet | UUID | ❌ | - | Filter outlet (super_admin only) |
| merchant | UUID | ❌ | - | Filter merchant |
| variant | UUID | ❌ | - | Filter variant |
| q | string | ❌ | - | Pencarian no. pesanan, outlet, merchant, atau produk |

**Response**:

```json
{
  "groups": [
    {
      "order_id": "uuid",
      "orderNumber": "string | null",
      "date": "timestamptz",
      "outlet": "string",
      "merchant": "string",
      "merchantColor": "string | null",
      "qty": 0,
      "gross": 0,
      "fee": 0,
      "net": 0,
      "rows": []
    }
  ],
  "nextOffset": 12,
  "hasMore": true
}
```

### Supabase RPC

#### `public.get_dashboard_summary(...)`

RPC utama untuk agregasi Dashboard. Dipanggil dari Server Component `/dashboard` dengan parameter tanggal periode aktif, periode pembanding, dan filter outlet/merchant/varian.

Output berupa JSON dengan bagian:

- `totals`
- `comparison`
- `daily`
- `leaderboard`
- `merchantBreakdown`
- `outletBreakdown`
- `hourly`
- `productDeclines`
- `merchantDeclines`
- `merchantIncreases` (Ditambahkan pada versi migrasi 013)

Untuk database baru, function ini sudah ada di `supabase/schema.sql`. Untuk database existing, jalankan `supabase/migrations/013_add_merchant_increases_to_dashboard_summary.sql`.

#### `public.get_transactions_summary(...)`

RPC untuk total card halaman Transaksi: jumlah order, qty, omset, potongan/komisi, dan net profit.

#### `public.get_transaction_order_page(...)`

RPC untuk mengambil batch card order transaksi beserta item transaksi di dalamnya. Dipakai oleh Server Component `/transactions` untuk render awal dan route `/api/transactions/orders` untuk batch berikutnya.

Untuk database baru, function transaksi ini sudah ada di `supabase/schema.sql`. Untuk database existing, jalankan `supabase/migrations/012_transactions_summary_rpc.sql`.

### Server Actions

#### `createOrder(payload)`

Membuat transaksi baru dengan multi-item.

**Payload**:

```typescript
{
  outlet_id: string;           // UUID
  order_number?: string;       // max 80 chars
  food_merchant_id: string;    // UUID
  transaction_date: string;    // ISO datetime dengan WIB offset
  deduction_fee: number;       // Total potongan (dihitung otomatis dari frontend)
  items: Array<{
    product_variant_id: string; // UUID
    qty: number;                // integer > 0
    initial_price: number;      // harga statis >= 0
  }>
}
```

#### `updateOrder(payload)`

Mengupdate order yang sudah ada. Menghapus item yang dihapus, mengupdate yang diedit, insert yang baru.

**Payload** (sama dengan create, tambah `order_id`):

```typescript
{
  order_id: string;
  // ... sama dengan createOrder
  items: Array<{
    id?: string; // UUID item yang sudah ada (untuk update)
    product_variant_id: string;
    qty: number;
    initial_price: number;
  }>;
}
```

#### `deleteOrder(orderId: string)`

Menghapus seluruh item dalam satu order.

---

## 8. Maintenance & Troubleshooting

### Operasi Rutin

#### Backup Database

Di Supabase Dashboard:

- **Database** → **Backups** → aktifkan Point-in-Time Recovery atau backup manual

#### Memantau Kinerja

- **Database** → **Query Performance** — cek slow queries
- **Reports** — monitor penggunaan (terutama storage & auth)

### Troubleshooting

| Masalah                                     | Penyebab                             | Solusi                                           |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| Login gagal "Invalid login credentials"     | Email/password salah                 | Reset password di Auth → Users                   |
| Login sukses tapi redirect ke /login terus  | Profile belum dibuat                 | Insert ke tabel profiles                         |
| Transaksi tidak muncul di dashboard         | Filter salah / data tidak sesuai WIB | Cek filter date, pastikan data di DB             |
| Error "crypto.randomUUID is not a function" | Aplikasi dijalankan via HTTP biasa   | Gunakan HTTPS / sudah diperbaiki dengan fallback |
| Edit merchant gagal                         | Kolom `color` belum ada di DB        | Jalankan migrasi alter table                     |
| Grafik kosong                               | Data tidak ada di range              | Perluas range tanggal                            |

### Logging

- **Next.js**: log server di terminal saat dev, di Vercel Dashboard saat production
- **Supabase**: Query log di Database → Query Performance
- **Auth logs**: Authentication → Logs

---

## 9. Deploy ke Production

### Deploy ke Vercel (Recommended)

1. Push repository ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import repository
3. Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
4. Deploy ✅

### Deploy Self-hosted

```bash
npm run build
npm start  # atau gunakan PM2 untuk production
```

### Checklist Production

- [ ] **Rotate service_role key** jika sebelumnya bocor di repository publik
- [ ] Environment variables terisi semua (jangan ada placeholder)
- [ ] Schema SQL sudah dijalankan di Supabase production
- [ ] User super_admin sudah dibuat
- [ ] Domain + HTTPS terkonfigurasi
- [ ] Backup database diaktifkan
- [ ] Monitor query performance setelah beberapa hari

---

## 10. Pengembangan Lanjutan

### Fitur yang Bisa Ditambahkan

- **Upload bukti transaksi** (foto struk)
- **Notifikasi otomatis** (komisi harian via WhatsApp)
- **Manajemen stok** produk
- **Laporan periode** (PDF/Excel)
- **Multi-bahasa** (i18n)
- **Analisis prediktif** (forecasting penjualan)
- **Integrasi API langsung** dengan GoFood/Grab/Shopee

### Arsitektur untuk Skala Besar

Jika data sudah mencapai puluhan ribu transaksi per hari:

1. **Partisi tabel** `transactions` per bulan
2. **Materialized views** di atas RPC dashboard jika volume transaksi harian sudah sangat besar
3. **Redis cache** untuk data dashboard yang sering diakses
4. **Pagination** server-side penuh (sudah diimplementasikan untuk detail transaksi)

---

## Kontak & Support

- **WhatsApp**: [085374748881](https://wa.me/6285374748881?text=Halo%2C%20saya%20ingin%20buat%20akun%20Rajaklana%20Sales%20Recap.)
- **Repository**: [github.com/yoga12-rgb/rekap-penjualan-online](https://github.com/yoga12-rgb/rekap-penjualan-online)
- **Dibuat dengan ❤️ untuk Rajaklana Abon Gulung**

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

- 📊 **Dashboard Analitik** — 7 tab visualisasi data (tren harian, produk terlaris, profit merchant, performa outlet, jam ramai, insight otomatis, detail transaksi)
- 📝 **Manajemen Transaksi** — Input multi-varian dengan perhitungan komisi otomatis
- 🏪 **Master Data** — CRUD untuk outlet, food merchant, varian produk, dan akun kasir
- 🔐 **Role-based Access** — Super Admin vs Kasir dengan RLS database
- 🌙 **Dark/Light Mode** — Toggle tema
- 📥 **Export CSV** — Semua tab analitik bisa diexport
- 📱 **Responsive** — Mobile-friendly dengan sidebar drawer

### Target Pengguna

| Role            | Kemampuan                                                               |
| --------------- | ----------------------------------------------------------------------- |
| **Super Admin** | Akses penuh: melihat semua data, analisis, mengelola master data & user |
| **Kasir**       | Terbatas: input transaksi hanya untuk outlet yang ditugaskan            |

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
│   │   │   └── 📁 masters/              # Master data CRUD
│   │   │       ├── 📁 merchants/        # Food merchant
│   │   │       ├── 📁 outlets/          # Outlet cabang
│   │   │       ├── 📁 products/         # Varian produk + pricing
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
│   │       └── middleware.ts            # Next.js middleware (session refresh)
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
4. (Opsional) Paste `supabase/seed.sql` untuk data contoh

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
| created_at / updated_at | TIMESTAMPTZ       | Auto                                                            |

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
| Master Outlet            |       ✅        |          ❌          |
| Master Merchant          |       ✅        |          ❌          |
| Master Produk            |       ✅        |          ❌          |
| Master User/Akun         |       ✅        |          ❌          |

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
[ Dari ▼ ] [ Sampai ▼ ] [ Outlet ▼ ] [ Merchant ▼ ] [ Varian ▼ ] [ Export CSV ]
[Hari ini] [7H] [30H] [Bulan ini] [Bulan lalu] [YTD] [Tahun] [Reset]
```

**Cara pakai**:

1. Pilih rentang tanggal (atau gunakan preset cepat)
2. Filter berdasarkan outlet, merchant, varian produk (atau biarkan "Semua")
3. Klik **Export** untuk download CSV tab yang aktif

#### Tab Analitik

| Tab                  | Fungsi                                                       | Visualisasi       |
| -------------------- | ------------------------------------------------------------ | ----------------- |
| **Tren Harian**      | Grafik garis omset, net profit, potongan per hari            | Line Chart        |
| **Produk Terlaris**  | Top 10 produk berdasarkan quantity                           | Bar Chart + Tabel |
| **Profit Merchant**  | Net profit per food merchant dengan warna badge              | Bar Chart (warna) |
| **Outlet**           | Performa per outlet (omset, net, qty, transaksi)             | Bar Chart + Tabel |
| **Jam Ramai**        | Distribusi transaksi per jam (24 jam)                        | Bar Chart + Tabel |
| **Insight**          | Perbandingan periode + insight otomatis + penurunan performa | Kartu + Tabel     |
| **Detail Transaksi** | List semua transaksi (infinite scroll)                       | Tabel             |

#### Key Performance Indicators (KPI)

- Total Omset
- Total Potongan Admin
- Potongan Admin (%)
- Net Profit
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
- Filter tersimpan ke localStorage & URL

### 6.3 Master Data

Akses dari sidebar → **Master Data** (hanya Super Admin).

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
2. **Materialized views** untuk agregasi dashboard
3. **Redis cache** untuk data dashboard yang sering diakses
4. **Pagination** server-side penuh (sudah diimplementasikan untuk detail transaksi)

---

## Kontak & Support

- **WhatsApp**: [085374748881](https://wa.me/6285374748881?text=Halo%2C%20saya%20ingin%20buat%20akun%20Rajaklana%20Sales%20Recap.)
- **Repository**: [github.com/yoga12-rgb/rekap-penjualan-online](https://github.com/yoga12-rgb/rekap-penjualan-online)
- **Dibuat dengan ❤️ untuk Rajaklana Abon Gulung**

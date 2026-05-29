# 🥩 Rekap Penjualan Abon Gulung Rajaklana

**Sistem rekapitulasi & analisis penjualan multi-outlet** untuk Abon Gulung Rajaklana yang dijual melalui berbagai platform food merchant (GoFood, GrabFood, ShopeeFood).

---

## ✨ Fitur Unggulan

- 📊 **Dashboard Analitik** — 7 tab visualisasi interaktif (tren harian, produk terlaris, profit merchant, performa outlet, jam ramai, insight otomatis, detail transaksi)
- 📝 **Manajemen Transaksi** — Input multi-varian dengan perhitungan komisi otomatis
- 📣 **Biaya Iklan Harian** — Catat biaya iklan per outlet + merchant, terpisah dari potongan admin transaksi
- 🟢 **User Online** — Super Admin dapat melihat status online, IP tersamarkan, lokasi perkiraan, dan last seen user
- 🏪 **Master Data CRUD** — Outlet, food merchant (dengan warna badge), varian produk & pricing matrix, akun kasir
- 🔐 **Role-based Access** — Super Admin & Kasir, diamankan dengan Row Level Security PostgreSQL
- 🌙 **Dark/Light Mode** — Toggle tema dengan anti-flicker script
- 📥 **Export CSV** — Semua tab dashboard bisa diexport
- 📱 **Responsive Design** — Mobile-friendly dengan sidebar drawer + floating filter button
- ⏰ **Timezone WIB** — Semua timestamp dikelola dalam waktu Jakarta (Asia/Jakarta)

---

## 🛠 Stack

| Layer          | Teknologi                                                                   | Versi      |
| -------------- | --------------------------------------------------------------------------- | ---------- |
| **Framework**  | [Next.js](https://nextjs.org/) (App Router)                                 | 16.2+      |
| **Frontend**   | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | 19.x / 5.x |
| **Styling**    | [Tailwind CSS](https://tailwindcss.com/)                                    | 3.4+       |
| **Database**   | [Supabase](https://supabase.com/) (PostgreSQL)                              | -          |
| **Auth**       | Supabase Auth + Row Level Security                                          | -          |
| **Charting**   | [Recharts](https://recharts.org/)                                           | 2.12+      |
| **Icons**      | [lucide-react](https://lucide.dev/)                                         | 0.439+     |
| **Validation** | [zod](https://zod.dev/)                                                     | 3.23+      |
| **Date**       | date-fns + Intl.DateTimeFormat                                              | -          |
| **Formatting** | ESLint                                                                      | 9.x        |

---

## 🚀 Panduan Cepat

### 1. Prasyarat

- Node.js 18+ (recommended: 20+)
- npm atau yarn
- Akun Supabase (free tier cukup)

### 2. Clone & Install

```bash
git clone https://github.com/yoga12-rgb/rekap-penjualan-online.git
cd rekap-penjualan-online
npm install
```

### 3. Setup Supabase

1. Buka [supabase.com](https://supabase.com) → New Project
2. Catat **Project URL**, **anon key**, **service_role key** dari Settings → API
3. Buka SQL Editor → paste isi `supabase/schema.sql` → Run
4. Jika database sudah ada, jalankan migrasi bertahap di `supabase/migrations/` sesuai nomor versi, termasuk `007_daily_ad_costs.sql` dan `008_user_presence.sql`
5. (Opsional) Paste `supabase/seed.sql` untuk data contoh

### 4. Konfigurasi Environment

```bash
cp .env.example .env.local
```

Isi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 5. Buat Super Admin Pertama

1. Supabase Dashboard → Authentication → Users → Add User (email + password)
2. Salin UID user yang baru dibuat
3. Di SQL Editor, jalankan:

```sql
insert into public.profiles (id, full_name, role)
values ('USER-UID-DI-SINI', 'Super Admin', 'super_admin')
on conflict (id) do update set role = 'super_admin';
```

### 6. Jalankan Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) dan login.

### 7. Build Production

```bash
npm run build
npm start
```

---

## 🔐 Hak Akses

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
| User Online              |       ✅        |          ❌          |
| Master Outlet            |       ✅        |          ❌          |
| Master Merchant          |       ✅        |          ❌          |
| Master Produk            |       ✅        |          ❌          |
| Akun Kasir               |       ✅        |          ❌          |

> Semua akses diamankan oleh **Row Level Security PostgreSQL** — bukan hanya UI.

---

## 📖 Logika Bisnis Penting

- **Harga statis**: Harga di transaksi disimpan pada kolom `initial_price`. Mengubah master harga produk **tidak** mempengaruhi transaksi yang sudah tersimpan.
- **Net profit otomatis**: `net_profit` adalah **generated column**: `(qty * initial_price) - deduction_fee`. Data selalu konsisten.
- **Biaya iklan harian**: biaya iklan dicatat per `tanggal + outlet + merchant`, terpisah dari potongan/komisi transaksi.
- **Profit Bersih**: Dashboard menghitung **Profit Bersih = Net Profit - Biaya Iklan**. Saat filter varian aktif, biaya iklan tidak dikurangkan karena biaya iklan tidak melekat ke varian tertentu.
- **Komisi proporsional**: Potongan komisi dibagi proporsional ke setiap item berdasarkan omset.
- **Perbandingan periode**: Dashboard otomatis membandingkan periode saat ini dengan periode sebelumnya (panjang hari sama).
- **Filter manual**: perubahan filter tanggal/outlet/merchant/varian tidak langsung query; klik **Terapkan Filter** untuk mengambil data baru. Preset tanggal langsung diterapkan hanya untuk tanggal aktif, Reset membersihkan cookie filter, dan data besar diambil bertahap agar tidak terpotong 1000 baris.
- **User online**: status online dihitung dari heartbeat aplikasi. IP ditampilkan tersamarkan dan lokasi adalah perkiraan dari header IP/proxy, bukan GPS.

---

## 📂 Struktur Proyek

```
📁 src/
├── 📁 app/              # Next.js App Router pages
│   ├── login/           # Halaman login
│   ├── (app)/           # Layout terotentikasi
│   │   ├── dashboard/   # Dashboard analitik
│   │   ├── transactions/ # CRUD transaksi
│   │   ├── ad-costs/     # CRUD biaya iklan harian
│   │   └── masters/     # Master data (merchants, outlets, products, users)
│   └── api/             # API Route Handlers
├── 📁 components/       # Komponen reusable
├── 📁 lib/              # Utility functions
│   └── supabase/        # Supabase clients
📁 supabase/
├── schema.sql           # Full database schema
├── seed.sql             # Data awal
└── migrations/          # Migrasi
```

---

## 📘 Dokumentasi Lengkap

Lihat **[DOCUMENTATION.md](./DOCUMENTATION.md)** untuk dokumentasi lengkap yang mencakup:

- Panduan instalasi detail
- Struktur database & Entity Relationship Diagram
- Panduan penggunaan fitur per fitur
- API endpoints & Server Actions reference
- Troubleshooting & maintenance
- Checklist deploy production

---

## ☁️ Deploy ke Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyoga12-rgb%2Frekap-penjualan-online)

1. Push repository ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import repository
3. Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
4. Deploy ✅

---

## 📞 Kontak & Support

- **WhatsApp**: [085374748881](https://wa.me/6285374748881?text=Halo%2C%20saya%20ingin%20buat%20akun%20Rajaklana%20Sales%20Recap.)
- **Repository**: [github.com/yoga12-rgb/rekap-penjualan-online](https://github.com/yoga12-rgb/rekap-penjualan-online)

---

> Dibuat dengan ❤️ untuk Rajaklana Abon Gulung

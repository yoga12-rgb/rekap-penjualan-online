# Rekap Penjualan Abon Gulung Rajaklana

Sistem rekapitulasi & analisis penjualan multi-outlet (GoFood/GrabFood/ShopeeFood) berbasis Next.js + Supabase.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth + RLS)
- Recharts (grafik), xlsx (export Excel)

## Cara Setup (urut)

### 1. Install dependency
```bash
npm install
```

### 2. Buat project Supabase
- Buka https://supabase.com → New Project.
- Copy: Project URL, anon key, service_role key.

### 3. Konfigurasi env
Copy `.env.example` → `.env.local`, lalu isi:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Jalankan SQL schema
Di Supabase Dashboard → SQL Editor → tempel isi `supabase/schema.sql` → Run.
Lalu (opsional) tempel `supabase/seed.sql` untuk data awal.

### 5. Buat Super Admin pertama
- Supabase Dashboard → Authentication → Users → Add user (email + password).
- Salin UID user → di SQL Editor jalankan:
```sql
insert into public.profiles (id, full_name, role)
values ('USER-UID-DI-SINI', 'Super Admin', 'super_admin')
on conflict (id) do update set role='super_admin';
```

### 6. Jalankan dev server
```bash
npm run dev
```
Buka http://localhost:3000 dan login.

## Hak Akses

| Menu                        | Super Admin | Kasir |
|----------------------------|:----------:|:-----:|
| Dashboard (semua outlet)   | ✅ | hanya outletnya |
| Transaksi (CRUD)           | ✅ semua | ✅ tapi terbatas outletnya |
| Master Outlet/Merchant/Produk | ✅ | ❌ |
| Akun Kasir                 | ✅ | ❌ |

RLS Postgres yang menjaga akses data — bukan hanya UI.

## Logika Bisnis Penting
- Harga di transaksi disimpan **statis** pada kolom `initial_price`. Mengubah master harga produk **tidak** mempengaruhi transaksi yang sudah tersimpan.
- `net_profit` dihitung sebagai generated column: `(qty * initial_price) - deduction_fee`.
- Potongan komisi diisi nominal manual per transaksi.

## Deploy
Vercel: Import repo, set 3 env var di project settings, deploy.

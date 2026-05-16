-- Seed master data awal. Jalankan SETELAH schema.sql dan SETELAH membuat akun
-- super admin pertama via Supabase Auth (Dashboard → Authentication → Users).
--
-- Ganti 'YOUR-SUPER-ADMIN-UID' dengan UUID user dari auth.users.

-- 1. Tandai user pertama sebagai super_admin
-- insert into public.profiles (id, full_name, role)
-- values ('YOUR-SUPER-ADMIN-UID', 'Super Admin', 'super_admin')
-- on conflict (id) do update set role='super_admin';

-- 2. Outlet (8 outlet contoh)
insert into public.outlets (name) values
  ('Outlet Pusat'), ('Outlet Cabang 1'), ('Outlet Cabang 2'), ('Outlet Cabang 3'),
  ('Outlet Cabang 4'), ('Outlet Cabang 5'), ('Outlet Cabang 6'), ('Outlet Cabang 7')
on conflict (name) do nothing;

-- 3. Food Merchants
insert into public.food_merchants (name) values
  ('GoFood'), ('GrabFood'), ('ShopeeFood')
on conflict (name) do nothing;

-- 4. Produk awal (sesuaikan)
insert into public.product_variants (name, base_price) values
  ('Abon Gulung Original', 15000),
  ('Abon Gulung Pedas', 16000),
  ('Abon Gulung Keju', 18000)
on conflict (name) do nothing;

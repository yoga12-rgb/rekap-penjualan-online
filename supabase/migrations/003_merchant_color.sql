-- Migration: warna kustom per merchant.
-- Nilai berupa hex (#rrggbb). Jika NULL, sistem fallback ke preset (GoFood/Grab/Shopee)
-- atau palet hash berdasarkan nama.
-- Jalankan SEKALI di Supabase SQL Editor.

alter table public.food_merchants
  add column if not exists color text
    check (color is null or color ~* '^#[0-9a-f]{6}$');

-- Set default warna untuk merchant existing (boleh diubah lewat UI).
update public.food_merchants set color = '#e11d2a' where lower(name) like '%gofood%' or lower(name) like '%go-food%' or lower(name) like '%gojek%';
update public.food_merchants set color = '#00b14f' where lower(name) like '%grab%';
update public.food_merchants set color = '#ee4d2d' where lower(name) like '%shopee%';

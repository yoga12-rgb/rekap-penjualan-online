-- Migration: tambahkan order_id untuk mengelompokkan baris transaksi
-- yang berasal dari 1 input multi-varian (1 komisi).
-- Jalankan SEKALI di Supabase SQL Editor.

alter table public.transactions
  add column if not exists order_id uuid;

-- Backfill: setiap row lama dianggap "order" sendiri (1 baris = 1 order)
update public.transactions
   set order_id = id
 where order_id is null;

alter table public.transactions
  alter column order_id set not null,
  alter column order_id set default gen_random_uuid();

create index if not exists idx_tx_order on public.transactions(order_id);

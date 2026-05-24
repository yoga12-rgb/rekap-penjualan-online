-- Migration: tambahkan nomor pesanan user-facing.
-- Berbeda dari order_id UUID yang dipakai internal untuk grouping baris transaksi.

alter table public.transactions
  add column if not exists order_number text;

create index if not exists idx_tx_order_number on public.transactions(order_number);

-- Migration: harga produk per merchant.
-- Jika harga khusus merchant belum tersedia, aplikasi fallback ke product_variants.base_price.

create table if not exists public.product_variant_prices (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  food_merchant_id uuid not null references public.food_merchants(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_variant_id, food_merchant_id)
);

create index if not exists idx_variant_prices_product on public.product_variant_prices(product_variant_id);
create index if not exists idx_variant_prices_merchant on public.product_variant_prices(food_merchant_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_variant_prices_updated_at on public.product_variant_prices;
create trigger trg_variant_prices_updated_at before update on public.product_variant_prices
  for each row execute function public.set_updated_at();

alter table public.product_variant_prices enable row level security;

drop policy if exists "variant_prices_read" on public.product_variant_prices;
create policy "variant_prices_read" on public.product_variant_prices for select using (auth.uid() is not null);

drop policy if exists "variant_prices_admin_write" on public.product_variant_prices;
create policy "variant_prices_admin_write" on public.product_variant_prices for all
  using (public.is_super_admin()) with check (public.is_super_admin());

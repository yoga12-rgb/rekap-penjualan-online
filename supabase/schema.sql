-- =====================================================================
-- Rajaklana Sales Recap - Supabase Schema
-- Jalankan di Supabase SQL Editor (urutkan dari atas ke bawah).
-- =====================================================================

-- 1. TABLES ------------------------------------------------------------

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.food_merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_price numeric(12,2) not null check (base_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('super_admin','kasir')),
  outlet_id uuid references public.outlets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  food_merchant_id uuid not null references public.food_merchants(id) on delete restrict,
  product_variant_id uuid not null references public.product_variants(id) on delete restrict,
  transaction_date timestamptz not null default now(),
  qty integer not null check (qty > 0),
  initial_price numeric(12,2) not null check (initial_price >= 0), -- HARGA STATIS saat transaksi
  deduction_fee numeric(12,2) not null default 0 check (deduction_fee >= 0),
  net_profit numeric(14,2) generated always as ((qty * initial_price) - deduction_fee) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tx_date on public.transactions(transaction_date desc);
create index if not exists idx_tx_outlet on public.transactions(outlet_id);
create index if not exists idx_tx_merchant on public.transactions(food_merchant_id);
create index if not exists idx_tx_variant on public.transactions(product_variant_id);

-- 2. UPDATED_AT TRIGGER -----------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_tx_updated_at on public.transactions;
create trigger trg_tx_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- 3. HELPER FUNCTIONS (untuk RLS) -------------------------------------

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='super_admin');
$$;

create or replace function public.my_outlet_id()
returns uuid language sql stable security definer set search_path = public as $$
  select outlet_id from public.profiles where id = auth.uid();
$$;

-- 4. ENABLE RLS --------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.outlets          enable row level security;
alter table public.food_merchants   enable row level security;
alter table public.product_variants enable row level security;
alter table public.transactions     enable row level security;

-- 5. POLICIES ----------------------------------------------------------

-- profiles: tiap user bisa baca profile sendiri; super_admin baca semua
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using ( id = auth.uid() or public.is_super_admin() );

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles
  for all using ( public.is_super_admin() ) with check ( public.is_super_admin() );

-- master tables: semua login bisa SELECT, hanya super_admin yang menulis
do $$ begin
  perform 1;
end $$;

drop policy if exists "outlets_read" on public.outlets;
create policy "outlets_read" on public.outlets for select using ( auth.uid() is not null );
drop policy if exists "outlets_admin_write" on public.outlets;
create policy "outlets_admin_write" on public.outlets for all
  using ( public.is_super_admin() ) with check ( public.is_super_admin() );

drop policy if exists "merchants_read" on public.food_merchants;
create policy "merchants_read" on public.food_merchants for select using ( auth.uid() is not null );
drop policy if exists "merchants_admin_write" on public.food_merchants;
create policy "merchants_admin_write" on public.food_merchants for all
  using ( public.is_super_admin() ) with check ( public.is_super_admin() );

drop policy if exists "variants_read" on public.product_variants;
create policy "variants_read" on public.product_variants for select using ( auth.uid() is not null );
drop policy if exists "variants_admin_write" on public.product_variants;
create policy "variants_admin_write" on public.product_variants for all
  using ( public.is_super_admin() ) with check ( public.is_super_admin() );

-- transactions:
--   super_admin: full access
--   kasir: hanya outlet miliknya
drop policy if exists "tx_select" on public.transactions;
create policy "tx_select" on public.transactions for select
  using ( public.is_super_admin() or outlet_id = public.my_outlet_id() );

drop policy if exists "tx_insert" on public.transactions;
create policy "tx_insert" on public.transactions for insert
  with check (
    public.is_super_admin()
    or (outlet_id = public.my_outlet_id() and created_by = auth.uid())
  );

drop policy if exists "tx_update" on public.transactions;
create policy "tx_update" on public.transactions for update
  using ( public.is_super_admin() or outlet_id = public.my_outlet_id() )
  with check ( public.is_super_admin() or outlet_id = public.my_outlet_id() );

drop policy if exists "tx_delete" on public.transactions;
create policy "tx_delete" on public.transactions for delete
  using ( public.is_super_admin() or outlet_id = public.my_outlet_id() );

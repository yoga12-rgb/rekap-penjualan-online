-- Migration: biaya iklan harian per outlet + merchant.
-- Biaya ini terpisah dari potongan admin per transaksi.

create table if not exists public.daily_ad_costs (
  id uuid primary key default gen_random_uuid(),
  cost_date date not null,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  food_merchant_id uuid not null references public.food_merchants(id) on delete restrict,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cost_date, outlet_id, food_merchant_id)
);

create index if not exists idx_ad_costs_date on public.daily_ad_costs(cost_date desc);
create index if not exists idx_ad_costs_outlet on public.daily_ad_costs(outlet_id);
create index if not exists idx_ad_costs_merchant on public.daily_ad_costs(food_merchant_id);

drop trigger if exists trg_ad_costs_updated_at on public.daily_ad_costs;
create trigger trg_ad_costs_updated_at before update on public.daily_ad_costs
  for each row execute function public.set_updated_at();

alter table public.daily_ad_costs enable row level security;

drop policy if exists "ad_costs_select" on public.daily_ad_costs;
create policy "ad_costs_select" on public.daily_ad_costs for select
  using (public.is_super_admin() or outlet_id = public.my_outlet_id());

drop policy if exists "ad_costs_admin_write" on public.daily_ad_costs;
drop policy if exists "ad_costs_insert" on public.daily_ad_costs;
create policy "ad_costs_insert" on public.daily_ad_costs for insert
  with check (
    public.is_super_admin()
    or (outlet_id = public.my_outlet_id() and created_by = auth.uid())
  );

drop policy if exists "ad_costs_update" on public.daily_ad_costs;
create policy "ad_costs_update" on public.daily_ad_costs for update
  using (public.is_super_admin() or outlet_id = public.my_outlet_id())
  with check (public.is_super_admin() or outlet_id = public.my_outlet_id());

drop policy if exists "ad_costs_delete" on public.daily_ad_costs;
create policy "ad_costs_delete" on public.daily_ad_costs for delete
  using (public.is_super_admin() or outlet_id = public.my_outlet_id());

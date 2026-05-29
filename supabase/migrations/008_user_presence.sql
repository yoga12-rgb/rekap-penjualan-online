-- Migration: user presence / online status.
-- Menyimpan heartbeat terakhir, IP, lokasi perkiraan dari header platform, dan device ringkas.

create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  ip_address text,
  country text,
  region text,
  city text,
  timezone text,
  user_agent text,
  path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_presence_last_seen on public.user_presence(last_seen_at desc);

drop trigger if exists trg_user_presence_updated_at on public.user_presence;
create trigger trg_user_presence_updated_at before update on public.user_presence
  for each row execute function public.set_updated_at();

alter table public.user_presence enable row level security;

drop policy if exists "presence_select_self_or_admin" on public.user_presence;
create policy "presence_select_self_or_admin" on public.user_presence for select
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "presence_insert_self" on public.user_presence;
create policy "presence_insert_self" on public.user_presence for insert
  with check (user_id = auth.uid());

drop policy if exists "presence_update_self_or_admin" on public.user_presence;
create policy "presence_update_self_or_admin" on public.user_presence for update
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "presence_delete_admin" on public.user_presence;
create policy "presence_delete_admin" on public.user_presence for delete
  using (public.is_super_admin());

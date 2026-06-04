-- Survey customer source feature.

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete restrict,
  answer_id uuid references public.survey_answers(id) on delete set null,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  other_text text,
  response_date date not null default ((timezone('Asia/Jakarta', now()))::date),
  created_at timestamptz not null default now(),
  constraint survey_responses_answer_or_other check (
    answer_id is not null or nullif(btrim(coalesce(other_text, '')), '') is not null
  )
);

create index if not exists idx_survey_questions_order
  on public.survey_questions(is_active, sort_order, question_text);
create index if not exists idx_survey_answers_order
  on public.survey_answers(is_active, sort_order, label);
create index if not exists idx_survey_responses_date
  on public.survey_responses(response_date desc);
create index if not exists idx_survey_responses_outlet
  on public.survey_responses(outlet_id);
create index if not exists idx_survey_responses_question
  on public.survey_responses(question_id);
create index if not exists idx_survey_responses_answer
  on public.survey_responses(answer_id);

drop trigger if exists trg_survey_questions_updated_at on public.survey_questions;
create trigger trg_survey_questions_updated_at before update on public.survey_questions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_survey_answers_updated_at on public.survey_answers;
create trigger trg_survey_answers_updated_at before update on public.survey_answers
  for each row execute function public.set_updated_at();

alter table public.survey_questions enable row level security;
alter table public.survey_answers enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists "survey_questions_read" on public.survey_questions;
create policy "survey_questions_read" on public.survey_questions for select
  using (auth.uid() is not null);

drop policy if exists "survey_questions_admin_write" on public.survey_questions;
create policy "survey_questions_admin_write" on public.survey_questions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "survey_answers_read" on public.survey_answers;
create policy "survey_answers_read" on public.survey_answers for select
  using (auth.uid() is not null);

drop policy if exists "survey_answers_admin_write" on public.survey_answers;
create policy "survey_answers_admin_write" on public.survey_answers for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "survey_responses_select" on public.survey_responses;
create policy "survey_responses_select" on public.survey_responses for select
  using (public.is_super_admin() or outlet_id = public.my_outlet_id());

drop policy if exists "survey_responses_insert" on public.survey_responses;
create policy "survey_responses_insert" on public.survey_responses for insert
  with check (
    public.is_super_admin()
    or (outlet_id = public.my_outlet_id() and created_by = auth.uid())
  );

drop policy if exists "survey_responses_admin_delete" on public.survey_responses;
create policy "survey_responses_admin_delete" on public.survey_responses for delete
  using (public.is_super_admin());

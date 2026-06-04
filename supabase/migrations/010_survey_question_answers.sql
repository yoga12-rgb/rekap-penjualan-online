-- Relasi jawaban per pertanyaan survey.

create table if not exists public.survey_question_answers (
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  answer_id uuid not null references public.survey_answers(id) on delete cascade,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (question_id, answer_id)
);

create index if not exists idx_survey_question_answers_question
  on public.survey_question_answers(question_id, is_active, sort_order);

create index if not exists idx_survey_question_answers_answer
  on public.survey_question_answers(answer_id);

insert into public.survey_question_answers (question_id, answer_id, is_active, sort_order)
select q.id, a.id, true, a.sort_order
from public.survey_questions q
cross join public.survey_answers a
on conflict (question_id, answer_id) do nothing;

drop trigger if exists trg_survey_question_answers_updated_at on public.survey_question_answers;
create trigger trg_survey_question_answers_updated_at before update on public.survey_question_answers
  for each row execute function public.set_updated_at();

alter table public.survey_question_answers enable row level security;

drop policy if exists "survey_question_answers_read" on public.survey_question_answers;
create policy "survey_question_answers_read" on public.survey_question_answers for select
  using (auth.uid() is not null);

drop policy if exists "survey_question_answers_admin_write" on public.survey_question_answers;
create policy "survey_question_answers_admin_write" on public.survey_question_answers for all
  using (public.is_super_admin()) with check (public.is_super_admin());

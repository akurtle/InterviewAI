create extension if not exists pgcrypto;

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_type text not null check (session_type in ('interview', 'pitch')),
  record_mode text not null check (record_mode in ('video', 'audio', 'both')),
  question_context jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  transcripts jsonb not null default '[]'::jsonb,
  vision_frames jsonb not null default '[]'::jsonb,
  speech_feedback jsonb,
  video_feedback jsonb,
  speech_score double precision,
  video_score double precision,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.interview_session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null check (position >= 0),
  question_text text not null,
  question_category text,
  question_rationale text,
  answer_text text,
  answer_started_at timestamptz,
  answer_ended_at timestamptz,
  answer_duration_seconds integer generated always as (
    case
      when answer_started_at is null or answer_ended_at is null then null
      else greatest(0, floor(extract(epoch from (answer_ended_at - answer_started_at)))::integer)
    end
  ) stored,
  transcript_segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (session_id, position)
);

alter table public.interview_sessions
  add column if not exists role_text text
    generated always as (nullif(btrim(coalesce(question_context ->> 'role', '')), '')) stored,
  add column if not exists company_text text
    generated always as (nullif(btrim(coalesce(question_context ->> 'company', '')), '')) stored,
  add column if not exists call_type_text text
    generated always as (nullif(btrim(coalesce(question_context ->> 'callType', '')), '')) stored,
  add column if not exists question_count integer
    generated always as (jsonb_array_length(questions)) stored,
  add column if not exists transcript_count integer
    generated always as (jsonb_array_length(transcripts)) stored,
  add column if not exists vision_frame_count integer
    generated always as (jsonb_array_length(vision_frames)) stored,
  add column if not exists duration_seconds integer
    generated always as (
      greatest(0, floor(extract(epoch from (ended_at - started_at)))::integer)
    ) stored;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_time_order_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_time_order_chk
      check (ended_at >= started_at);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_speech_score_range_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_speech_score_range_chk
      check (speech_score is null or (speech_score >= 0 and speech_score <= 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_video_score_range_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_video_score_range_chk
      check (video_score is null or (video_score >= 0 and video_score <= 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_question_context_type_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_question_context_type_chk
      check (jsonb_typeof(question_context) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_questions_type_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_questions_type_chk
      check (jsonb_typeof(questions) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_transcripts_type_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_transcripts_type_chk
      check (jsonb_typeof(transcripts) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_sessions_vision_frames_type_chk'
  ) then
    alter table public.interview_sessions
      add constraint interview_sessions_vision_frames_type_chk
      check (jsonb_typeof(vision_frames) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_session_answers_transcript_segments_type_chk'
  ) then
    alter table public.interview_session_answers
      add constraint interview_session_answers_transcript_segments_type_chk
      check (jsonb_typeof(transcript_segments) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_session_answers_time_order_chk'
  ) then
    alter table public.interview_session_answers
      add constraint interview_session_answers_time_order_chk
      check (
        answer_started_at is null
        or answer_ended_at is null
        or answer_ended_at >= answer_started_at
      );
  end if;
end
$$;

drop index if exists public.interview_sessions_user_id_created_at_idx;
create index if not exists interview_sessions_user_id_created_at_idx
  on public.interview_sessions (user_id, created_at desc)
  include (
    session_type,
    record_mode,
    role_text,
    company_text,
    call_type_text,
    question_count,
    transcript_count,
    vision_frame_count,
    duration_seconds,
    speech_score,
    video_score,
    started_at,
    ended_at,
    updated_at
  );

create index if not exists interview_session_answers_user_session_position_idx
  on public.interview_session_answers (user_id, session_id, position)
  include (
    question_text,
    question_category,
    question_rationale,
    answer_text,
    answer_started_at,
    answer_ended_at,
    answer_duration_seconds
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists interview_sessions_set_updated_at on public.interview_sessions;

create trigger interview_sessions_set_updated_at
before update on public.interview_sessions
for each row
execute function public.set_updated_at();

alter table public.interview_sessions enable row level security;
alter table public.interview_session_answers enable row level security;

drop policy if exists "Users can view their own sessions" on public.interview_sessions;
create policy "Users can view their own sessions"
on public.interview_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own sessions" on public.interview_sessions;
create policy "Users can insert their own sessions"
on public.interview_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own sessions" on public.interview_sessions;
create policy "Users can update their own sessions"
on public.interview_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own sessions" on public.interview_sessions;
create policy "Users can delete their own sessions"
on public.interview_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own session answers" on public.interview_session_answers;
create policy "Users can view their own session answers"
on public.interview_session_answers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own session answers" on public.interview_session_answers;
create policy "Users can insert their own session answers"
on public.interview_session_answers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own session answers" on public.interview_session_answers;
create policy "Users can update their own session answers"
on public.interview_session_answers
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own session answers" on public.interview_session_answers;
create policy "Users can delete their own session answers"
on public.interview_session_answers
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop view if exists public.interview_session_summaries;
create view public.interview_session_summaries
with (security_invoker = true)
as
select
  id,
  user_id,
  session_type,
  record_mode,
  role_text as role,
  company_text as company,
  call_type_text as call_type,
  question_count,
  transcript_count,
  vision_frame_count,
  duration_seconds,
  speech_score,
  video_score,
  started_at,
  ended_at,
  created_at,
  updated_at
from public.interview_sessions;

revoke all on public.interview_session_summaries from public, anon;
grant select on public.interview_session_summaries to authenticated;

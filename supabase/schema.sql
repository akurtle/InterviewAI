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

create index if not exists interview_sessions_user_id_created_at_idx
  on public.interview_sessions (user_id, created_at desc);

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

drop policy if exists "Users can view their own sessions" on public.interview_sessions;
create policy "Users can view their own sessions"
on public.interview_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own sessions" on public.interview_sessions;
create policy "Users can insert their own sessions"
on public.interview_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own sessions" on public.interview_sessions;
create policy "Users can update their own sessions"
on public.interview_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own sessions" on public.interview_sessions;
create policy "Users can delete their own sessions"
on public.interview_sessions
for delete
using (auth.uid() = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'voice-quiz-audio',
  'voice-quiz-audio',
  true,
  15728640,
  array['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.voice_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  champion_id text not null,
  champion_key text not null,
  champion_name text not null,
  champion_title text not null default '',
  audio_url text,
  audio_path text unique,
  source_type text not null default 'communitydragon'
    check (source_type in ('communitydragon', 'upload')),
  in_quiz boolean not null default false,
  quiz_position integer check (quiz_position is null or quiz_position >= 0),
  created_at timestamptz not null default now(),
  check (
    (source_type = 'communitydragon' and audio_url is not null)
    or (source_type = 'upload' and audio_path is not null)
  )
);

create index voice_quiz_questions_owner_idx
on public.voice_quiz_questions (owner_id, in_quiz, quiz_position, created_at);

alter table public.voice_quiz_questions enable row level security;

create policy "Admins can manage their voice quiz"
on public.voice_quiz_questions for all
to authenticated
using (
  owner_id = (select auth.uid())
  and public.is_admin()
)
with check (
  owner_id = (select auth.uid())
  and public.is_admin()
);

create policy "Anyone can hear voice quiz audio"
on storage.objects for select
to public
using (bucket_id = 'voice-quiz-audio');

create policy "Admins can upload voice quiz audio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'voice-quiz-audio'
  and public.is_admin()
);

create policy "Admins can delete voice quiz audio"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'voice-quiz-audio'
  and public.is_admin()
);

revoke all on table public.voice_quiz_questions from anon, authenticated;
grant select, insert, update, delete
on public.voice_quiz_questions
to authenticated;

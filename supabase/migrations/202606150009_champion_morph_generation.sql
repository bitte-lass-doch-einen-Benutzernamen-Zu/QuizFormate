insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'morph-images',
  'morph-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.morph_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  first_champion_id text not null,
  first_champion_name text not null,
  second_champion_id text not null,
  second_champion_name text not null,
  image_path text not null unique,
  created_at timestamptz not null default now()
);

create index morph_generations_owner_created_idx
on public.morph_generations (owner_id, created_at desc);

alter table public.morph_generations enable row level security;

create policy "Admins can read their morph generations"
on public.morph_generations for select
to authenticated
using (
  owner_id = (select auth.uid())
  and public.is_admin()
);

create policy "Anyone can view generated morph images"
on storage.objects for select
to public
using (bucket_id = 'morph-images');

revoke all on table public.morph_generations from anon, authenticated;
grant select on table public.morph_generations to authenticated;

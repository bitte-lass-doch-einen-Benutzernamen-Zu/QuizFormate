create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now()
);

create table public.game_nights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.game_night_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_nights(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 30 check (max_uses between 1 and 100),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create table public.game_night_participants (
  room_id uuid not null references public.game_nights(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_game_night(check_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_nights
    where id = check_room_id
      and owner_id = auth.uid()
  );
$$;

create or replace function public.is_game_night_participant(
  check_room_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_night_participants
    where room_id = check_room_id
      and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.game_nights enable row level security;
alter table public.game_night_invites enable row level security;
alter table public.game_night_participants enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Admins can manage game nights"
on public.game_nights for all
to authenticated
using (public.is_admin() and owner_id = (select auth.uid()))
with check (public.is_admin() and owner_id = (select auth.uid()));

create policy "Participants can read their game night"
on public.game_nights for select
to authenticated
using (
  expires_at > now()
  and public.is_game_night_participant(id)
);

create policy "Admins can read their invites"
on public.game_night_invites for select
to authenticated
using (
  public.is_admin()
  and public.owns_game_night(room_id)
);

create policy "Participants can read their membership"
on public.game_night_participants for select
to authenticated
using (
  user_id = (select auth.uid())
  or (public.is_admin() and public.owns_game_night(room_id))
);

create or replace function public.create_game_night(
  room_title text,
  valid_hours integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_code text;
  new_room public.game_nights;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins können Einladungen erstellen.';
  end if;
  if char_length(trim(room_title)) not between 1 and 80 then
    raise exception 'Der Titel muss zwischen 1 und 80 Zeichen lang sein.';
  end if;
  if valid_hours not between 1 and 24 then
    raise exception 'Die Gültigkeit muss zwischen 1 und 24 Stunden liegen.';
  end if;

  generated_code := upper(encode(gen_random_bytes(4), 'hex'));

  insert into public.game_nights (owner_id, title, expires_at)
  values (
    auth.uid(),
    trim(room_title),
    now() + make_interval(hours => valid_hours)
  )
  returning * into new_room;

  insert into public.game_night_invites (room_id, code_hash, expires_at)
  values (
    new_room.id,
    encode(digest(generated_code, 'sha256'), 'hex'),
    new_room.expires_at
  );

  return jsonb_build_object(
    'room_id', new_room.id,
    'code', generated_code,
    'expires_at', new_room.expires_at
  );
end;
$$;

create or replace function public.join_game_night(
  invite_code text,
  participant_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_invite public.game_night_invites;
  selected_room public.game_nights;
  anonymous_user boolean;
begin
  if auth.uid() is null then
    raise exception 'Für den Beitritt ist eine anonyme Sitzung erforderlich.';
  end if;

  anonymous_user := coalesce(
    ((auth.jwt() ->> 'is_anonymous')::boolean),
    false
  );
  if not anonymous_user then
    raise exception 'Invite-Codes sind nur für Gastzugänge vorgesehen.';
  end if;
  if char_length(trim(participant_name)) not between 1 and 40 then
    raise exception 'Der Name muss zwischen 1 und 40 Zeichen lang sein.';
  end if;

  select invite.*
  into selected_invite
  from public.game_night_invites invite
  where invite.code_hash = encode(
    digest(upper(trim(invite_code)), 'sha256'),
    'hex'
  )
  for update;

  if selected_invite.id is null
    or selected_invite.expires_at <= now()
    or selected_invite.uses >= selected_invite.max_uses then
    raise exception 'Dieser Invite-Code ist ungültig oder abgelaufen.';
  end if;

  select room.*
  into selected_room
  from public.game_nights room
  where room.id = selected_invite.room_id
    and room.expires_at > now();

  if selected_room.id is null then
    raise exception 'Dieser Spieleabend ist bereits beendet.';
  end if;

  insert into public.game_night_participants (
    room_id,
    user_id,
    display_name
  )
  values (
    selected_room.id,
    auth.uid(),
    trim(participant_name)
  )
  on conflict (room_id, user_id)
  do update set display_name = excluded.display_name;

  update public.game_night_invites
  set uses = uses + 1
  where id = selected_invite.id;

  return jsonb_build_object(
    'room_id', selected_room.id,
    'room_title', selected_room.title,
    'display_name', trim(participant_name),
    'expires_at', selected_room.expires_at
  );
end;
$$;

revoke all on function public.create_game_night(text, integer) from public;
revoke all on function public.join_game_night(text, text) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.owns_game_night(uuid) from public;
revoke all on function public.is_game_night_participant(uuid) from public;
grant execute on function public.create_game_night(text, integer) to authenticated;
grant execute on function public.join_game_night(text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_game_night(uuid) to authenticated;
grant execute on function public.is_game_night_participant(uuid) to authenticated;

-- Supabase entfernt anonyme Auth-Nutzer nicht automatisch. Diese Abfrage kann
-- regelmäßig im SQL Editor oder später per Cron ausgeführt werden.
-- delete from auth.users
-- where is_anonymous is true
--   and created_at < now() - interval '7 days';

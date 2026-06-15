create table public.buzzer_states (
  room_id uuid primary key references public.game_nights(id) on delete cascade,
  is_open boolean not null default false,
  winner_user_id uuid references auth.users(id) on delete set null,
  winner_name text,
  buzzed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (winner_user_id is null and winner_name is null and buzzed_at is null)
    or
    (winner_user_id is not null and winner_name is not null and buzzed_at is not null)
  )
);

insert into public.buzzer_states (room_id)
select id from public.game_nights
on conflict (room_id) do nothing;

alter table public.buzzer_states enable row level security;

create policy "Room members can read the buzzer"
on public.buzzer_states for select
to authenticated
using (
  public.owns_game_night(room_id)
  or public.is_game_night_participant(room_id)
);

revoke all on table public.buzzer_states from anon, authenticated;
grant select on table public.buzzer_states to authenticated;

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

  generated_code := upper(
    encode(extensions.gen_random_bytes(4), 'hex')
  );

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
    encode(extensions.digest(generated_code, 'sha256'), 'hex'),
    new_room.expires_at
  );

  insert into public.buzzer_states (room_id)
  values (new_room.id);

  return jsonb_build_object(
    'room_id', new_room.id,
    'room_title', new_room.title,
    'code', generated_code,
    'expires_at', new_room.expires_at
  );
end;
$$;

create or replace function public.press_buzzer(check_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_name text;
  claimed_state public.buzzer_states;
  current_state public.buzzer_states;
begin
  select participant.display_name
  into participant_name
  from public.game_night_participants participant
  join public.game_nights room on room.id = participant.room_id
  where participant.room_id = check_room_id
    and participant.user_id = auth.uid()
    and room.expires_at > now();

  if participant_name is null then
    raise exception 'Du bist kein aktiver Teilnehmer dieses Raums.';
  end if;

  update public.buzzer_states
  set
    winner_user_id = auth.uid(),
    winner_name = participant_name,
    buzzed_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where room_id = check_room_id
    and is_open
    and winner_user_id is null
  returning * into claimed_state;

  if claimed_state.room_id is not null then
    current_state := claimed_state;
  else
    select *
    into current_state
    from public.buzzer_states
    where room_id = check_room_id;
  end if;

  return jsonb_build_object(
    'room_id', current_state.room_id,
    'is_open', current_state.is_open,
    'winner_user_id', current_state.winner_user_id,
    'winner_name', current_state.winner_name,
    'buzzed_at', current_state.buzzed_at,
    'updated_at', current_state.updated_at,
    'claimed', claimed_state.room_id is not null
  );
end;
$$;

create or replace function public.control_buzzer(
  check_room_id uuid,
  buzzer_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_state public.buzzer_states;
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann diesen Buzzer steuern.';
  end if;

  if buzzer_action = 'open' then
    update public.buzzer_states
    set
      is_open = true,
      winner_user_id = null,
      winner_name = null,
      buzzed_at = null,
      updated_at = clock_timestamp()
    where room_id = check_room_id
    returning * into next_state;
  elsif buzzer_action = 'lock' then
    update public.buzzer_states
    set is_open = false, updated_at = clock_timestamp()
    where room_id = check_room_id
    returning * into next_state;
  elsif buzzer_action = 'reset' then
    update public.buzzer_states
    set
      is_open = false,
      winner_user_id = null,
      winner_name = null,
      buzzed_at = null,
      updated_at = clock_timestamp()
    where room_id = check_room_id
    returning * into next_state;
  else
    raise exception 'Unbekannte Buzzer-Aktion.';
  end if;

  if next_state.room_id is null then
    raise exception 'Für diesen Raum wurde kein Buzzer gefunden.';
  end if;

  return jsonb_build_object(
    'room_id', next_state.room_id,
    'is_open', next_state.is_open,
    'winner_user_id', next_state.winner_user_id,
    'winner_name', next_state.winner_name,
    'buzzed_at', next_state.buzzed_at,
    'updated_at', next_state.updated_at
  );
end;
$$;

revoke all on function public.press_buzzer(uuid) from public;
revoke all on function public.control_buzzer(uuid, text) from public;
grant execute on function public.press_buzzer(uuid) to authenticated;
grant execute on function public.control_buzzer(uuid, text) to authenticated;

alter publication supabase_realtime add table public.buzzer_states;

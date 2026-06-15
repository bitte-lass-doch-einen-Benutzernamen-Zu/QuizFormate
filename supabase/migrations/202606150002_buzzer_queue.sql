alter table public.buzzer_states
add column next_position integer not null default 1
check (next_position >= 1);

create table public.buzzer_entries (
  room_id uuid not null references public.game_nights(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  position integer not null check (position >= 1),
  buzzed_at timestamptz not null default clock_timestamp(),
  primary key (room_id, user_id),
  unique (room_id, position)
);

insert into public.buzzer_entries (
  room_id,
  user_id,
  display_name,
  position,
  buzzed_at
)
select room_id, winner_user_id, winner_name, 1, buzzed_at
from public.buzzer_states
where winner_user_id is not null
on conflict (room_id, user_id) do nothing;

update public.buzzer_states
set next_position = case when winner_user_id is null then 1 else 2 end;

alter table public.buzzer_entries enable row level security;

create policy "Room members can read the buzzer queue"
on public.buzzer_entries for select
to authenticated
using (
  public.owns_game_night(room_id)
  or public.is_game_night_participant(room_id)
);

revoke all on table public.buzzer_entries from anon, authenticated;
grant select on table public.buzzer_entries to authenticated;

create or replace function public.buzzer_snapshot(check_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_state public.buzzer_states;
  queue jsonb;
begin
  if not (
    public.owns_game_night(check_room_id)
    or public.is_game_night_participant(check_room_id)
  ) then
    raise exception 'Du hast keinen Zugriff auf diesen Buzzer.';
  end if;

  select *
  into current_state
  from public.buzzer_states
  where room_id = check_room_id;

  if current_state.room_id is null then
    raise exception 'Für diesen Raum wurde kein Buzzer gefunden.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', entry.user_id,
        'display_name', entry.display_name,
        'position', entry.position,
        'buzzed_at', entry.buzzed_at
      )
      order by entry.position
    ),
    '[]'::jsonb
  )
  into queue
  from public.buzzer_entries entry
  where entry.room_id = check_room_id;

  return jsonb_build_object(
    'room_id', current_state.room_id,
    'is_open', current_state.is_open,
    'winner_user_id', current_state.winner_user_id,
    'winner_name', current_state.winner_name,
    'buzzed_at', current_state.buzzed_at,
    'updated_at', current_state.updated_at,
    'queue', queue
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
  current_state public.buzzer_states;
  assigned_position integer;
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

  select *
  into current_state
  from public.buzzer_states
  where room_id = check_room_id
  for update;

  if current_state.room_id is null then
    raise exception 'Für diesen Raum wurde kein Buzzer gefunden.';
  end if;

  if current_state.is_open and not exists (
    select 1
    from public.buzzer_entries
    where room_id = check_room_id
      and user_id = auth.uid()
  ) then
    assigned_position := current_state.next_position;

    insert into public.buzzer_entries (
      room_id,
      user_id,
      display_name,
      position,
      buzzed_at
    )
    values (
      check_room_id,
      auth.uid(),
      participant_name,
      assigned_position,
      clock_timestamp()
    );

    update public.buzzer_states
    set
      winner_user_id = case
        when assigned_position = 1 then auth.uid()
        else winner_user_id
      end,
      winner_name = case
        when assigned_position = 1 then participant_name
        else winner_name
      end,
      buzzed_at = case
        when assigned_position = 1 then clock_timestamp()
        else buzzed_at
      end,
      next_position = assigned_position + 1,
      updated_at = clock_timestamp()
    where room_id = check_room_id;
  end if;

  return public.buzzer_snapshot(check_room_id)
    || jsonb_build_object('position', assigned_position);
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
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann diesen Buzzer steuern.';
  end if;

  if buzzer_action = 'open' then
    delete from public.buzzer_entries where room_id = check_room_id;
    update public.buzzer_states
    set
      is_open = true,
      winner_user_id = null,
      winner_name = null,
      buzzed_at = null,
      next_position = 1,
      updated_at = clock_timestamp()
    where room_id = check_room_id;
  elsif buzzer_action = 'lock' then
    update public.buzzer_states
    set is_open = false, updated_at = clock_timestamp()
    where room_id = check_room_id;
  elsif buzzer_action = 'reset' then
    delete from public.buzzer_entries where room_id = check_room_id;
    update public.buzzer_states
    set
      is_open = false,
      winner_user_id = null,
      winner_name = null,
      buzzed_at = null,
      next_position = 1,
      updated_at = clock_timestamp()
    where room_id = check_room_id;
  else
    raise exception 'Unbekannte Buzzer-Aktion.';
  end if;

  if not found then
    raise exception 'Für diesen Raum wurde kein Buzzer gefunden.';
  end if;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

revoke all on function public.buzzer_snapshot(uuid) from public;
grant execute on function public.buzzer_snapshot(uuid) to authenticated;

alter publication supabase_realtime add table public.buzzer_entries;

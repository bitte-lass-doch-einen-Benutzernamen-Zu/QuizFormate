alter table public.buzzer_states
add column buzzer_visible boolean not null default true,
add column text_input_visible boolean not null default false;

create table public.room_text_entries (
  room_id uuid not null references public.game_nights(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  content text not null check (char_length(content) between 1 and 500),
  submitted_at timestamptz not null default clock_timestamp(),
  primary key (room_id, user_id)
);

alter table public.room_text_entries
add constraint room_text_entries_participant_fkey
foreign key (room_id, user_id)
references public.game_night_participants(room_id, user_id)
on delete cascade;

alter table public.room_text_entries enable row level security;

create policy "Room members can read text entries"
on public.room_text_entries for select
to authenticated
using (
  public.owns_game_night(room_id)
  or (
    public.is_game_night_participant(room_id)
    and user_id = (select auth.uid())
  )
);

revoke all on table public.room_text_entries from anon, authenticated;
grant select on table public.room_text_entries to authenticated;

create or replace function public.buzzer_snapshot(check_room_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_state public.buzzer_states;
  queue jsonb;
  text_entries jsonb;
begin
  if not (
    public.owns_game_night(check_room_id)
    or public.is_game_night_participant(check_room_id)
  ) then
    raise exception 'Du hast keinen Zugriff auf diesen Raum.';
  end if;

  select *
  into current_state
  from public.buzzer_states
  where room_id = check_room_id;

  if current_state.room_id is null then
    raise exception 'Für diesen Raum wurde kein Zustand gefunden.';
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', entry.user_id,
        'display_name', entry.display_name,
        'content', entry.content,
        'submitted_at', entry.submitted_at
      )
      order by entry.submitted_at desc
    ),
    '[]'::jsonb
  )
  into text_entries
  from public.room_text_entries entry
  where entry.room_id = check_room_id
    and (
      public.owns_game_night(check_room_id)
      or entry.user_id = auth.uid()
    );

  return jsonb_build_object(
    'room_id', current_state.room_id,
    'is_open', current_state.is_open,
    'buzzer_visible', current_state.buzzer_visible,
    'text_input_visible', current_state.text_input_visible,
    'winner_user_id', current_state.winner_user_id,
    'winner_name', current_state.winner_name,
    'buzzed_at', current_state.buzzed_at,
    'updated_at', current_state.updated_at,
    'queue', queue,
    'text_entries', text_entries
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

  if current_state.buzzer_visible
    and current_state.is_open
    and not exists (
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

create or replace function public.submit_room_text(
  check_room_id uuid,
  submitted_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_name text;
begin
  if char_length(trim(submitted_text)) not between 1 and 500 then
    raise exception 'Der Text muss zwischen 1 und 500 Zeichen lang sein.';
  end if;

  select participant.display_name
  into participant_name
  from public.game_night_participants participant
  join public.game_nights room on room.id = participant.room_id
  join public.buzzer_states state on state.room_id = participant.room_id
  where participant.room_id = check_room_id
    and participant.user_id = auth.uid()
    and room.expires_at > now()
    and state.text_input_visible;

  if participant_name is null then
    raise exception 'Die Texteingabe ist derzeit nicht freigegeben.';
  end if;

  insert into public.room_text_entries (
    room_id,
    user_id,
    display_name,
    content,
    submitted_at
  )
  values (
    check_room_id,
    auth.uid(),
    participant_name,
    trim(submitted_text),
    clock_timestamp()
  )
  on conflict (room_id, user_id)
  do update set
    display_name = excluded.display_name,
    content = excluded.content,
    submitted_at = excluded.submitted_at;

  update public.buzzer_states
  set updated_at = clock_timestamp()
  where room_id = check_room_id;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.control_room_feature(
  check_room_id uuid,
  feature_name text,
  enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann Raumfunktionen steuern.';
  end if;

  if feature_name = 'buzzer' then
    update public.buzzer_states
    set
      buzzer_visible = enabled,
      is_open = case when enabled then is_open else false end,
      updated_at = clock_timestamp()
    where room_id = check_room_id;
  elsif feature_name = 'text' then
    update public.buzzer_states
    set
      text_input_visible = enabled,
      updated_at = clock_timestamp()
    where room_id = check_room_id;
  else
    raise exception 'Unbekannte Raumfunktion.';
  end if;

  if not found then
    raise exception 'Für diesen Raum wurde kein Zustand gefunden.';
  end if;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.clear_room_texts(check_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann Texte löschen.';
  end if;

  delete from public.room_text_entries
  where room_id = check_room_id;

  update public.buzzer_states
  set updated_at = clock_timestamp()
  where room_id = check_room_id;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.leave_game_night()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room_id uuid;
begin
  select room_id
  into current_room_id
  from public.game_night_participants
  where user_id = auth.uid();

  delete from public.buzzer_entries
  where user_id = auth.uid();

  delete from public.room_text_entries
  where user_id = auth.uid();

  delete from public.game_night_participants
  where user_id = auth.uid();

  if current_room_id is not null then
    perform public.normalize_buzzer_queue(current_room_id);
  end if;
end;
$$;

revoke all on function public.submit_room_text(uuid, text) from public;
revoke all on function public.control_room_feature(uuid, text, boolean) from public;
revoke all on function public.clear_room_texts(uuid) from public;
grant execute on function public.submit_room_text(uuid, text) to authenticated;
grant execute on function public.control_room_feature(uuid, text, boolean) to authenticated;
grant execute on function public.clear_room_texts(uuid) to authenticated;

alter publication supabase_realtime add table public.room_text_entries;

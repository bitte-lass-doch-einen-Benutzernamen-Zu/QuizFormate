create or replace function public.normalize_buzzer_queue(check_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_entry public.buzzer_entries;
  entry_count integer;
begin
  update public.buzzer_entries
  set position = position + 1000000
  where room_id = check_room_id;

  with ordered_entries as (
    select
      room_id,
      user_id,
      row_number() over (
        partition by room_id
        order by position, buzzed_at, user_id
      )::integer as next_position
    from public.buzzer_entries
    where room_id = check_room_id
  )
  update public.buzzer_entries entry
  set position = ordered.next_position
  from ordered_entries ordered
  where entry.room_id = ordered.room_id
    and entry.user_id = ordered.user_id
    and entry.position <> ordered.next_position;

  select *
  into first_entry
  from public.buzzer_entries
  where room_id = check_room_id
  order by position
  limit 1;

  select count(*)
  into entry_count
  from public.buzzer_entries
  where room_id = check_room_id;

  update public.buzzer_states
  set
    winner_user_id = first_entry.user_id,
    winner_name = first_entry.display_name,
    buzzed_at = first_entry.buzzed_at,
    next_position = entry_count + 1,
    updated_at = clock_timestamp()
  where room_id = check_room_id;
end;
$$;

-- Repair queues that already contain gaps.
do $$
declare
  room_record record;
begin
  for room_record in
    select room_id from public.buzzer_states
  loop
    perform public.normalize_buzzer_queue(room_record.room_id);
  end loop;
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
    extensions.digest(upper(trim(invite_code)), 'sha256'),
    'hex'
  )
  for update;

  if selected_invite.id is null
    or selected_invite.expires_at <= now() then
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

  delete from public.buzzer_entries entry
  where entry.user_id in (
    select participant.user_id
    from public.game_night_participants participant
    where participant.invite_id = selected_invite.id
      or participant.user_id = auth.uid()
  );

  delete from public.game_night_participants participant
  where participant.invite_id = selected_invite.id
    or participant.user_id = auth.uid();

  perform public.normalize_buzzer_queue(selected_room.id);

  insert into public.game_night_participants (
    room_id,
    user_id,
    display_name,
    invite_id
  )
  values (
    selected_room.id,
    auth.uid(),
    trim(participant_name),
    selected_invite.id
  );

  update public.game_night_invites
  set uses = 1
  where id = selected_invite.id;

  return jsonb_build_object(
    'room_id', selected_room.id,
    'room_title', selected_room.title,
    'display_name', trim(participant_name),
    'expires_at', selected_room.expires_at
  );
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

  delete from public.game_night_participants
  where user_id = auth.uid();

  if current_room_id is not null then
    perform public.normalize_buzzer_queue(current_room_id);
  end if;
end;
$$;

revoke all on function public.normalize_buzzer_queue(uuid) from public;

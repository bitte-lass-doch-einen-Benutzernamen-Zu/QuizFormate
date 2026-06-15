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
  participants jsonb;
  room_owner boolean;
begin
  room_owner := public.owns_game_night(check_room_id);

  if not (
    room_owner
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
      room_owner
      or entry.user_id = auth.uid()
    );

  if room_owner then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', participant.user_id,
          'display_name', participant.display_name,
          'joined_at', participant.joined_at,
          'buzzer_position', buzzer.position,
          'has_text', text_entry.user_id is not null
        )
        order by participant.joined_at, participant.display_name
      ),
      '[]'::jsonb
    )
    into participants
    from public.game_night_participants participant
    left join public.buzzer_entries buzzer
      on buzzer.room_id = participant.room_id
      and buzzer.user_id = participant.user_id
    left join public.room_text_entries text_entry
      on text_entry.room_id = participant.room_id
      and text_entry.user_id = participant.user_id
    where participant.room_id = check_room_id;
  else
    participants := '[]'::jsonb;
  end if;

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
    'text_entries', text_entries,
    'participants', participants
  );
end;
$$;

create or replace function public.manage_room_participant(
  check_room_id uuid,
  participant_user_id uuid,
  participant_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann Teilnehmer verwalten.';
  end if;

  if not exists (
    select 1
    from public.game_night_participants
    where room_id = check_room_id
      and user_id = participant_user_id
  ) then
    raise exception 'Dieser Teilnehmer ist nicht mehr im Raum.';
  end if;

  delete from public.buzzer_entries
  where room_id = check_room_id
    and user_id = participant_user_id;

  delete from public.room_text_entries
  where room_id = check_room_id
    and user_id = participant_user_id;

  if participant_action = 'remove' then
    delete from public.game_night_participants
    where room_id = check_room_id
      and user_id = participant_user_id;
  elsif participant_action <> 'reset' then
    raise exception 'Unbekannte Teilnehmer-Aktion.';
  end if;

  perform public.normalize_buzzer_queue(check_room_id);
  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.remove_all_room_participants(
  check_room_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann Teilnehmer entfernen.';
  end if;

  delete from public.buzzer_entries
  where room_id = check_room_id;

  delete from public.room_text_entries
  where room_id = check_room_id;

  delete from public.game_night_participants
  where room_id = check_room_id;

  perform public.normalize_buzzer_queue(check_room_id);
  return public.buzzer_snapshot(check_room_id);
end;
$$;

revoke all on function public.manage_room_participant(uuid, uuid, text)
from public;
revoke all on function public.remove_all_room_participants(uuid)
from public;
grant execute on function public.manage_room_participant(uuid, uuid, text)
to authenticated;
grant execute on function public.remove_all_room_participants(uuid)
to authenticated;

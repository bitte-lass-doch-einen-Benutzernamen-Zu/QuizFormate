alter table public.buzzer_states
add column if not exists camera_visible boolean not null default false;

create table if not exists public.room_camera_frames (
  room_id uuid not null references public.game_nights(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  frame_data text not null check (char_length(frame_data) <= 180000),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (room_id, user_id)
);

alter table public.room_camera_frames
add constraint room_camera_frames_participant_fkey
foreign key (room_id, user_id)
references public.game_night_participants(room_id, user_id)
on delete cascade;

alter table public.room_camera_frames enable row level security;

create policy "Room owners can read camera frames"
on public.room_camera_frames for select
to authenticated
using (public.owns_game_night(room_id));

revoke all on table public.room_camera_frames from anon, authenticated;
grant select on table public.room_camera_frames to authenticated;

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
  camera_frames jsonb;
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
    raise exception 'Fuer diesen Raum wurde kein Zustand gefunden.';
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
          'has_text', text_entry.user_id is not null,
          'points', coalesce(score.points, 0)
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
    left join public.live_quiz_scores score
      on score.room_id = participant.room_id
      and score.user_id = participant.user_id
    where participant.room_id = check_room_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', frame.user_id,
          'display_name', frame.display_name,
          'frame_data', frame.frame_data,
          'updated_at', frame.updated_at
        )
        order by frame.updated_at desc
      ),
      '[]'::jsonb
    )
    into camera_frames
    from public.room_camera_frames frame
    where frame.room_id = check_room_id;
  else
    participants := '[]'::jsonb;
    camera_frames := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'room_id', current_state.room_id,
    'is_open', current_state.is_open,
    'buzzer_visible', current_state.buzzer_visible,
    'text_input_visible', current_state.text_input_visible,
    'camera_visible', current_state.camera_visible,
    'morph_guess_mode', current_state.morph_guess_mode,
    'own_score', coalesce((
      select score.points
      from public.live_quiz_scores score
      where score.room_id = check_room_id
        and score.user_id = auth.uid()
    ), 0),
    'winner_user_id', current_state.winner_user_id,
    'winner_name', current_state.winner_name,
    'buzzed_at', current_state.buzzed_at,
    'updated_at', current_state.updated_at,
    'queue', queue,
    'text_entries', text_entries,
    'participants', participants,
    'camera_frames', camera_frames
  );
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
  elsif feature_name = 'camera' then
    update public.buzzer_states
    set
      camera_visible = enabled,
      updated_at = clock_timestamp()
    where room_id = check_room_id;

    if not enabled then
      delete from public.room_camera_frames
      where room_id = check_room_id;
    end if;
  else
    raise exception 'Unbekannte Raumfunktion.';
  end if;

  if not found then
    raise exception 'Fuer diesen Raum wurde kein Zustand gefunden.';
  end if;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.submit_room_camera_frame(
  check_room_id uuid,
  frame_data text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_name text;
begin
  if char_length(frame_data) > 180000
    or frame_data not like 'data:image/jpeg;base64,%' then
    raise exception 'Das Kamerabild ist ungueltig oder zu gross.';
  end if;

  select participant.display_name
  into participant_name
  from public.game_night_participants participant
  join public.game_nights room on room.id = participant.room_id
  join public.buzzer_states state on state.room_id = participant.room_id
  where participant.room_id = check_room_id
    and participant.user_id = auth.uid()
    and room.expires_at > now()
    and state.camera_visible;

  if participant_name is null then
    raise exception 'Die Kamera ist derzeit nicht freigegeben.';
  end if;

  insert into public.room_camera_frames (
    room_id,
    user_id,
    display_name,
    frame_data,
    updated_at
  )
  values (
    check_room_id,
    auth.uid(),
    participant_name,
    frame_data,
    clock_timestamp()
  )
  on conflict (room_id, user_id)
  do update set
    display_name = excluded.display_name,
    frame_data = excluded.frame_data,
    updated_at = excluded.updated_at;

  update public.buzzer_states
  set updated_at = clock_timestamp()
  where room_id = check_room_id;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.clear_room_camera_frame(check_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.room_camera_frames
  where room_id = check_room_id
    and user_id = auth.uid();

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

  delete from public.room_camera_frames
  where user_id = auth.uid();

  delete from public.game_night_participants
  where user_id = auth.uid();

  if current_room_id is not null then
    perform public.normalize_buzzer_queue(current_room_id);
  end if;
end;
$$;

revoke all on function public.submit_room_camera_frame(uuid, text) from public;
revoke all on function public.clear_room_camera_frame(uuid) from public;
grant execute on function public.submit_room_camera_frame(uuid, text) to authenticated;
grant execute on function public.clear_room_camera_frame(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.room_camera_frames;
exception
  when duplicate_object then null;
end $$;

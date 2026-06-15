alter table public.buzzer_states
add column morph_guess_mode text not null default 'both'
check (morph_guess_mode in ('both', 'one'));

create table public.game_night_scores (
  room_id uuid not null references public.game_nights(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (room_id, user_id),
  foreign key (room_id, user_id)
    references public.game_night_participants(room_id, user_id)
    on delete cascade
);

alter table public.game_night_scores enable row level security;

create policy "Room members can read scores"
on public.game_night_scores for select
to authenticated
using (
  public.owns_game_night(room_id)
  or public.is_game_night_participant(room_id)
);

revoke all on table public.game_night_scores from anon, authenticated;
grant select on table public.game_night_scores to authenticated;

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
  own_score integer;
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
          'has_text', text_entry.user_id is not null,
          'points', coalesce(score.points, 0)
        )
        order by coalesce(score.points, 0) desc, participant.display_name
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
    left join public.game_night_scores score
      on score.room_id = participant.room_id
      and score.user_id = participant.user_id
    where participant.room_id = check_room_id;
  else
    participants := '[]'::jsonb;
  end if;

  select coalesce(score.points, 0)
  into own_score
  from public.game_night_participants participant
  left join public.game_night_scores score
    on score.room_id = participant.room_id
    and score.user_id = participant.user_id
  where participant.room_id = check_room_id
    and participant.user_id = auth.uid();

  return jsonb_build_object(
    'room_id', current_state.room_id,
    'is_open', current_state.is_open,
    'buzzer_visible', current_state.buzzer_visible,
    'text_input_visible', current_state.text_input_visible,
    'morph_guess_mode', current_state.morph_guess_mode,
    'own_score', coalesce(own_score, 0),
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

create or replace function public.award_morph_points(
  check_room_id uuid,
  participant_user_id uuid,
  point_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann Punkte vergeben.';
  end if;

  if point_delta not in (-1, 1, 3) then
    raise exception 'Erlaubt sind nur -1, +1 oder +3 Punkte.';
  end if;

  if not exists (
    select 1
    from public.game_night_participants
    where room_id = check_room_id
      and user_id = participant_user_id
  ) then
    raise exception 'Dieser Teilnehmer ist nicht mehr im Raum.';
  end if;

  insert into public.game_night_scores (room_id, user_id, points)
  values (check_room_id, participant_user_id, point_delta)
  on conflict (room_id, user_id)
  do update set
    points = public.game_night_scores.points + excluded.points,
    updated_at = clock_timestamp();

  update public.buzzer_states
  set updated_at = clock_timestamp()
  where room_id = check_room_id;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

create or replace function public.set_morph_guess_mode(
  check_room_id uuid,
  guess_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann den Rate-Modus ändern.';
  end if;

  if guess_mode not in ('both', 'one') then
    raise exception 'Unbekannter Rate-Modus.';
  end if;

  update public.buzzer_states
  set
    morph_guess_mode = guess_mode,
    updated_at = clock_timestamp()
  where room_id = check_room_id;

  if not found then
    raise exception 'Für diesen Raum wurde kein Zustand gefunden.';
  end if;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

revoke all on function public.award_morph_points(uuid, uuid, integer)
from public;
revoke all on function public.set_morph_guess_mode(uuid, text)
from public;
grant execute on function public.award_morph_points(uuid, uuid, integer)
to authenticated;
grant execute on function public.set_morph_guess_mode(uuid, text)
to authenticated;

alter publication supabase_realtime add table public.game_night_scores;

create or replace function public.reset_live_quiz_scores(check_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_game_night(check_room_id) then
    raise exception 'Nur die Spielleitung kann Punkte zuruecksetzen.';
  end if;

  delete from public.game_night_scores
  where room_id = check_room_id;

  update public.buzzer_states
  set updated_at = clock_timestamp()
  where room_id = check_room_id;

  if not found then
    raise exception 'Fuer diesen Raum wurde kein Zustand gefunden.';
  end if;

  return public.buzzer_snapshot(check_room_id);
end;
$$;

revoke all on function public.reset_live_quiz_scores(uuid)
from public;
grant execute on function public.reset_live_quiz_scores(uuid)
to authenticated;

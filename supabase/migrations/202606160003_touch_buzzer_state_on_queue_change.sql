create or replace function public.touch_buzzer_state_from_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched_room_id uuid;
begin
  touched_room_id := coalesce(new.room_id, old.room_id);

  update public.buzzer_states
  set updated_at = clock_timestamp()
  where room_id = touched_room_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists touch_buzzer_state_on_queue_change
on public.buzzer_entries;

create trigger touch_buzzer_state_on_queue_change
after insert or update or delete on public.buzzer_entries
for each row
execute function public.touch_buzzer_state_from_queue();

revoke all on function public.touch_buzzer_state_from_queue()
from public;

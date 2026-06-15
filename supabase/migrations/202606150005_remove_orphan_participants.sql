delete from public.buzzer_entries entry
where entry.user_id in (
  select participant.user_id
  from public.game_night_participants participant
  where participant.invite_id is null
);

delete from public.game_night_participants
where invite_id is null;

alter table public.game_night_participants
drop constraint game_night_participants_invite_id_fkey;

alter table public.game_night_participants
alter column invite_id set not null;

alter table public.game_night_participants
add constraint game_night_participants_invite_id_fkey
foreign key (invite_id)
references public.game_night_invites(id)
on delete cascade;

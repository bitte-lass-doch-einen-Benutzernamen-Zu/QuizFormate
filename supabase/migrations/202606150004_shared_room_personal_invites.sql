alter table public.game_night_participants
add column invite_id uuid references public.game_night_invites(id) on delete set null;

-- Existing rooms usually had one invite. Preserve that relationship where
-- possible before active rooms are consolidated.
with ranked_participants as (
  select
    room_id,
    user_id,
    row_number() over (partition by room_id order by joined_at, user_id) as slot
  from public.game_night_participants
),
ranked_invites as (
  select
    room_id,
    id,
    row_number() over (partition by room_id order by created_at, id) as slot
  from public.game_night_invites
)
update public.game_night_participants participant
set invite_id = invite.id
from ranked_participants ranked_participant
join ranked_invites invite
  on invite.room_id = ranked_participant.room_id
  and invite.slot = ranked_participant.slot
where participant.room_id = ranked_participant.room_id
  and participant.user_id = ranked_participant.user_id;

delete from public.game_night_participants participant
using public.game_nights room
where participant.room_id = room.id
  and room.expires_at <= now();

-- A host has one active game night. Existing active rooms are merged into the
-- newest room so already distributed codes continue to work together.
do $$
declare
  owner_record record;
  target_room_id uuid;
  latest_expiry timestamptz;
begin
  for owner_record in
    select distinct owner_id
    from public.game_nights
    where expires_at > now()
  loop
    select id
    into target_room_id
    from public.game_nights
    where owner_id = owner_record.owner_id
      and expires_at > now()
    order by created_at desc
    limit 1;

    select max(expires_at)
    into latest_expiry
    from public.game_nights
    where owner_id = owner_record.owner_id
      and expires_at > now();

    update public.game_nights
    set expires_at = latest_expiry
    where id = target_room_id;

    update public.game_night_invites invite
    set room_id = target_room_id
    where invite.room_id in (
      select id
      from public.game_nights
      where owner_id = owner_record.owner_id
        and expires_at > now()
    );

    insert into public.game_night_participants (
      room_id,
      user_id,
      display_name,
      joined_at,
      invite_id
    )
    select
      target_room_id,
      participant.user_id,
      participant.display_name,
      participant.joined_at,
      participant.invite_id
    from public.game_night_participants participant
    join public.game_nights room on room.id = participant.room_id
    where room.owner_id = owner_record.owner_id
      and room.expires_at > now()
      and participant.room_id <> target_room_id
    on conflict (room_id, user_id)
    do update set
      display_name = excluded.display_name,
      joined_at = excluded.joined_at,
      invite_id = coalesce(
        excluded.invite_id,
        public.game_night_participants.invite_id
      );

    delete from public.game_night_participants participant
    using public.game_nights room
    where participant.room_id = room.id
      and room.owner_id = owner_record.owner_id
      and room.expires_at > now()
      and room.id <> target_room_id;

    delete from public.game_nights
    where owner_id = owner_record.owner_id
      and expires_at > now()
      and id <> target_room_id;

    delete from public.buzzer_entries
    where room_id = target_room_id;

    update public.buzzer_states
    set
      is_open = false,
      winner_user_id = null,
      winner_name = null,
      buzzed_at = null,
      next_position = 1,
      updated_at = clock_timestamp()
    where room_id = target_room_id;
  end loop;
end;
$$;

create unique index game_night_participants_one_invite
on public.game_night_participants(invite_id)
where invite_id is not null;

create unique index game_night_participants_one_room_per_user
on public.game_night_participants(user_id);

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
  active_room public.game_nights;
  requested_expiry timestamptz;
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

  requested_expiry := now() + make_interval(hours => valid_hours);

  select *
  into active_room
  from public.game_nights
  where owner_id = auth.uid()
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if active_room.id is null then
    insert into public.game_nights (owner_id, title, expires_at)
    values (auth.uid(), trim(room_title), requested_expiry)
    returning * into active_room;

    insert into public.buzzer_states (room_id)
    values (active_room.id);
  else
    update public.game_nights
    set
      title = trim(room_title),
      expires_at = greatest(expires_at, requested_expiry)
    where id = active_room.id
    returning * into active_room;
  end if;

  generated_code := upper(
    encode(extensions.gen_random_bytes(4), 'hex')
  );

  insert into public.game_night_invites (
    room_id,
    code_hash,
    expires_at,
    max_uses
  )
  values (
    active_room.id,
    encode(extensions.digest(generated_code, 'sha256'), 'hex'),
    active_room.expires_at,
    1
  );

  update public.game_night_invites
  set expires_at = active_room.expires_at
  where room_id = active_room.id;

  return jsonb_build_object(
    'room_id', active_room.id,
    'room_title', active_room.title,
    'code', generated_code,
    'expires_at', active_room.expires_at
  );
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
begin
  delete from public.buzzer_entries
  where user_id = auth.uid();

  delete from public.game_night_participants
  where user_id = auth.uid();
end;
$$;

revoke all on function public.leave_game_night() from public;
grant execute on function public.leave_game_night() to authenticated;

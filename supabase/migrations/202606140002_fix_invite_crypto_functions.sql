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
  new_room public.game_nights;
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

  generated_code := upper(
    encode(extensions.gen_random_bytes(4), 'hex')
  );

  insert into public.game_nights (owner_id, title, expires_at)
  values (
    auth.uid(),
    trim(room_title),
    now() + make_interval(hours => valid_hours)
  )
  returning * into new_room;

  insert into public.game_night_invites (room_id, code_hash, expires_at)
  values (
    new_room.id,
    encode(extensions.digest(generated_code, 'sha256'), 'hex'),
    new_room.expires_at
  );

  return jsonb_build_object(
    'room_id', new_room.id,
    'code', generated_code,
    'expires_at', new_room.expires_at
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
    or selected_invite.expires_at <= now()
    or selected_invite.uses >= selected_invite.max_uses then
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

  insert into public.game_night_participants (
    room_id,
    user_id,
    display_name
  )
  values (
    selected_room.id,
    auth.uid(),
    trim(participant_name)
  )
  on conflict (room_id, user_id)
  do update set display_name = excluded.display_name;

  update public.game_night_invites
  set uses = uses + 1
  where id = selected_invite.id;

  return jsonb_build_object(
    'room_id', selected_room.id,
    'room_title', selected_room.title,
    'display_name', trim(participant_name),
    'expires_at', selected_room.expires_at
  );
end;
$$;

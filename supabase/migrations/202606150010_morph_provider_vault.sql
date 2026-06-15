create extension if not exists supabase_vault with schema vault;

create or replace function public.has_morph_openai_key()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'morph_openai_api_key'
        and nullif(trim(decrypted_secret), '') is not null
    );
$$;

create or replace function public.set_morph_openai_key(api_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_secret_id uuid;
  normalized_key text := trim(api_key);
begin
  if not public.is_admin() then
    raise exception 'Nur Admins können den KI-Zugang konfigurieren.';
  end if;
  if normalized_key !~ '^sk-[A-Za-z0-9_-]{20,}$' then
    raise exception 'Der OpenAI API-Key hat kein gültiges Format.';
  end if;

  select id
  into existing_secret_id
  from vault.decrypted_secrets
  where name = 'morph_openai_api_key'
  limit 1;

  if existing_secret_id is null then
    perform vault.create_secret(
      normalized_key,
      'morph_openai_api_key',
      'OpenAI API key for champion morph generation'
    );
  else
    perform vault.update_secret(
      existing_secret_id,
      normalized_key,
      'morph_openai_api_key',
      'OpenAI API key for champion morph generation'
    );
  end if;
end;
$$;

create or replace function public.get_morph_openai_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'morph_openai_api_key'
  limit 1;
$$;

revoke all on function public.has_morph_openai_key() from public;
revoke all on function public.set_morph_openai_key(text) from public;
revoke all on function public.get_morph_openai_key() from public;

grant execute on function public.has_morph_openai_key() to authenticated;
grant execute on function public.set_morph_openai_key(text) to authenticated;
grant execute on function public.get_morph_openai_key() to service_role;

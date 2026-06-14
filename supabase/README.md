# Supabase-Einrichtung

1. Unter <https://supabase.com/dashboard> ein kostenloses Projekt erstellen.
2. Unter **Authentication > Providers > Anonymous Sign-Ins** anonyme Logins
   aktivieren.
3. Den Inhalt von
   `supabase/migrations/202606140001_auth_and_invites.sql` im **SQL Editor**
   ausführen.
4. Unter **Authentication > Users** einen Benutzer mit E-Mail und Passwort
   für den Host erstellen.
5. Im SQL Editor dessen Rolle setzen:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'DEINE_EMAIL'
);
```

6. Im Supabase-Dialog **Connect** die Project URL und den Publishable Key
   kopieren. Niemals den Secret Key im Browser oder in Vercel verwenden.
7. Lokal eine `.env.local` mit diesen Werten erstellen:

```dotenv
VITE_SUPABASE_URL=https://DEIN_PROJEKT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

8. Dieselben Variablen in Vercel unter **Project Settings > Environment
   Variables** für Production, Preview und Development hinterlegen.

## Gastkonten aufräumen

Ein abgelaufener Spieleabend entzieht Gästen automatisch den Zugriff. Supabase
löscht anonyme Auth-Datensätze nicht automatisch. Für gelegentliche Abende
reicht es, diese Abfrage regelmäßig im SQL Editor auszuführen:

```sql
delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '7 days';
```

Vor einer öffentlichen Freigabe sollte unter **Authentication > Bot and Abuse
Protection** zusätzlich Cloudflare Turnstile aktiviert werden.
